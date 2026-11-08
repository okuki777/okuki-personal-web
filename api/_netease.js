import crypto from 'node:crypto'

/**
 * 网易云 weapi 签名（不依赖任何第三方包）
 * 参数：AES-128-CBC 两层加密 + RSA(无填充) 加密随机密钥
 */

const PRESET_KEY = '0CoJUm6Qyw8W8jud'
const IV = '0102030405060708'
const BASE = 'https://music.163.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

// 网易云 web 端固定公钥
const PUB_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ3
7BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvakl
V8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44o
ncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`

function aesEncrypt(text, key) {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), Buffer.from(IV, 'utf8'))
  return Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()]).toString('base64')
}

function rsaEncrypt(text) {
  const reversed = Buffer.from(text.split('').reverse().join(''), 'utf8')
  const padded = Buffer.concat([Buffer.alloc(128 - reversed.length), reversed])
  return crypto.publicEncrypt(
    { key: PUB_KEY, padding: crypto.constants.RSA_NO_PADDING },
    padded
  ).toString('hex')
}

function sign(payload) {
  const text = JSON.stringify(payload)
  const secretKey = crypto.randomBytes(8).toString('hex') // 16 个字符
  return {
    params: aesEncrypt(aesEncrypt(text, PRESET_KEY), secretKey),
    encSecKey: rsaEncrypt(secretKey)
  }
}

export async function weapi(path, payload = {}) {
  const { params, encSecKey } = sign({ ...payload, csrf_token: '' })
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
    body
  })

  if (!res.ok) throw new Error(`netease HTTP ${res.status}`)
  const json = await res.json()
  if (json && json.code && json.code !== 200) {
    throw new Error(`netease code ${json.code}${json.message ? ' ' + json.message : ''}`)
  }
  return json
}

/** 站内是 https：把 http:// 的播放地址升级，否则会被当成混合内容拦掉 */
export function httpsfy(url) {
  if (!url) return ''
  return url.replace(/^http:\/\//i, 'https://')
}

/**
 * 取播放地址：先试 320k，拿不到再降 192k / 128k
 * （有些歌只有低码率可用，不降级就会"这首放不了"）
 */
export async function fetchUrls(ids, brs = [320000, 192000, 128000]) {
  const map = {}
  let pending = ids.filter(Boolean)
  for (const br of brs) {
    if (!pending.length) break
    const missing = []
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
        console.warn('[meting] url chunk failed:', e.message)
      }
    }
    pending = pending.filter(id => !map[id])
  }
  return map
}

/** 统一成前端要的结构（url 由 /api/songurl 按需取，不在这里预取） */
export function toItem(t) {
  const pic = t.al && t.al.picUrl ? httpsfy(t.al.picUrl) + '?param=300y300' : ''
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
