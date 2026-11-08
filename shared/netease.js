/**
 * 网易云 weapi 签名核心 —— 可移植版
 *
 * 同时运行在两种环境：
 *   · Node（Vercel 函数 / 自托管服务端）  → globalThis.crypto 自 Node 18 起可用
 *   · Cloudflare Workers / Pages Functions → WebCrypto 原生支持
 *
 * 不用 node:crypto，所以两边是同一份代码：
 *   AES-128-CBC 交给 WebCrypto（自带 PKCS#7 填充）
 *   RSA 无填充用 BigInt 手算模幂（WebCrypto 不支持裸 RSA）
 */

const PRESET_KEY = '0CoJUm6Qyw8W8jud'
const IV = '0102030405060708'
const BASE = 'https://music.163.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

// 网易云 web 端固定公钥的 n / e（1024 位）
const MODULUS = BigInt(
  '0x00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725' +
  '152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ec' +
  'bda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813' +
  'cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7'
)
const PUBLIC_EXPONENT = 65537n

const enc = new TextEncoder()

function toBase64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

async function aesEncrypt(text, key) {
  const ck = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'AES-CBC' }, false, ['encrypt'])
  const buf = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: enc.encode(IV) }, ck, enc.encode(text))
  return toBase64(new Uint8Array(buf))
}

/** RSA 无填充：c = m^e mod n，结果固定 256 位十六进制 */
function rsaEncrypt(text) {
  const reversed = text.split('').reverse().join('')
  let m = 0n
  for (let i = 0; i < reversed.length; i++) {
    m = (m << 8n) + BigInt(reversed.charCodeAt(i) & 0xff)
  }
  let result = 1n
  let base = m % MODULUS
  let exp = PUBLIC_EXPONENT
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % MODULUS
    base = (base * base) % MODULUS
    exp >>= 1n
  }
  return result.toString(16).padStart(256, '0')
}

function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('') // 16 个字符
}

export async function sign(payload) {
  const text = JSON.stringify({ ...payload, csrf_token: '' })
  const secret = randomSecret()
  return {
    params: await aesEncrypt(await aesEncrypt(text, PRESET_KEY), secret),
    encSecKey: rsaEncrypt(secret)
  }
}

export async function weapi(path, payload = {}) {
  const { params, encSecKey } = await sign(payload)
  const body = new URLSearchParams({ params, encSecKey })

  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      'Referer': BASE + '/',
      'Origin': BASE,
      'Cookie': 'os=pc; appver=2.9.7; osver=; deviceId=netease'
    },
    body: body.toString()
  })

  if (!res.ok) throw new Error(`netease HTTP ${res.status}`)
  const json = await res.json()
  if (json && json.code && json.code !== 200) {
    throw new Error(`netease code ${json.code}${json.message ? ' ' + json.message : ''}`)
  }
  return json
}

/** 站内是 https：把 http:// 的地址升级，否则会被当成混合内容拦掉 */
export function httpsfy(url) {
  if (!url) return ''
  return url.replace(/^http:\/\//i, 'https://')
}

/** 取播放地址：320k → 192k → 128k 逐级降级 */
export async function fetchUrls(ids, brs = [320000, 192000, 128000]) {
  const map = {}
  let pending = ids.filter(Boolean)
  for (const br of brs) {
    if (!pending.length) break
    for (let i = 0; i < pending.length; i += 100) {
      const chunk = pending.slice(i, i + 100)
      try {
        const d = await weapi('/weapi/song/enhance/player/url', {
          ids: '[' + chunk.join(',') + ']',
          br
        })
        for (const item of d.data || []) {
          if (item && item.id && item.url) map[item.id] = httpsfy(item.url)
        }
      } catch (e) {
        console.warn('[netease] url chunk failed:', e.message)
      }
    }
    pending = pending.filter(id => !map[id])
  }
  return map
}

/**
 * 带兜底的取地址：
 * 有些环境（比如 Cloudflare 境外边缘）调 weapi 拿不到 url——网易云按 IP 地域/版权限制回空。
 * 依次尝试：
 *   1. weapi player/url（320k→192k→128k）
 *   2. 官方 outer url（服务端解析 302，绕开地域限制的常见路径）
 *   3. 公共 Meting 服务
 */
export async function resolvePlayableUrl(id) {
  const map = await fetchUrls([Number(id)])
  if (map[id]) return map[id]

  // 兜底 2：网易云 outer url
  try {
    const r = await fetch(`https://music.163.com/song/media/outer/url?id=${id}.mp3`, {
      redirect: 'manual',
      headers: { 'User-Agent': UA, 'Referer': BASE + '/' }
    })
    const loc = r.headers.get('location') || ''
    if (/^https?:\/\//i.test(loc) && !/\/404/.test(loc)) return httpsfy(loc)
  } catch (e) {
    console.warn('[netease] outer url failed:', e.message)
  }

  // 兜底 3：公共 Meting
  try {
    const r = await fetch(`https://api.i-meto.com/meting/api?server=netease&type=song&id=${id}`)
    const arr = await r.json()
    const u = Array.isArray(arr) && arr[0] && arr[0].url
    if (u) return httpsfy(u)
  } catch (e) {
    console.warn('[netease] meting fallback failed:', e.message)
  }

  return ''
}

/** 统一成前端要的结构 */
export function toItem(t) {  const pic = t.al && t.al.picUrl ? httpsfy(t.al.picUrl) + '?param=300y300' : ''
  const ar = t.ar || t.artists || []
  return {
    id: t.id,
    title: t.name || '',
    author: ar.map(a => a.name).join(' / '),
    url: '',
    pic,
    lrc: `/api/lyric?id=${t.id}`
  }
}

/* ---------- 供各平台适配层复用的业务方法 ---------- */

export async function getPlaylist(id) {
  const d = await weapi('/weapi/v6/playlist/detail', { id: Number(id), n: 1000, s: 8 })
  let tracks = (d.playlist && d.playlist.tracks) || []
  const trackIds = (d.playlist && d.playlist.trackIds) || []
  if (tracks.length < trackIds.length) {
    const ids = trackIds.map(t => t.id).slice(0, 1000)
    const detail = await weapi('/weapi/v3/song/detail', { c: JSON.stringify(ids.map(i => ({ id: i }))) })
    if (detail.songs) tracks = detail.songs
  }
  return tracks.map(t => toItem(t))
}

export async function getSong(id) {
  const d = await weapi('/weapi/v3/song/detail', { c: JSON.stringify([{ id: Number(id) }]) })
  return (d.songs || []).map(t => toItem(t))
}

export async function getLyric(id) {
  const d = await weapi('/weapi/song/lyric', { id: Number(id), lv: -1, kv: -1, tv: -1 })
  return (d.lrc && d.lrc.lyric) || ''
}

export async function searchSongs(kw, limit = 10) {
  const d = await weapi('/weapi/search/get', { s: kw, type: 1, limit, offset: 0 })
  const songs = (d.result && d.result.songs) || []
  return songs.map(s => ({
    id: s.id,
    title: s.name || '',
    author: (s.artists || []).map(a => a.name).join(' / '),
    album: s.album ? s.album.name : '',
    duration: s.duration || 0,
    pic: s.album && s.album.picUrl ? httpsfy(s.album.picUrl) + '?param=120y120' : ''
  }))
}
