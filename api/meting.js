import { weapi, toItem } from './_netease.js'

/**
 * GET /api/meting?server=netease&type=playlist&id=18575726923
 * 返回歌单元数据（不含播放地址）：[{ id, title, author, url:'', pic, lrc }]
 *
 * 为什么不在这里预取播放地址：
 *   1. 网易云的播放地址带时间戳、会过期，预取的那批等播到第 20 首时早就失效了；
 *   2. 预取 40 首要发几十次请求，首屏变慢。
 * 播放地址改由 /api/songurl?id= 在"要播这一首"的瞬间取，永远是新鲜的。
 */

const CACHE_TTL = 10 * 60 * 1000
const cache = new Map()

async function getPlaylist(id) {
  const d = await weapi('/weapi/v6/playlist/detail', { id: Number(id), n: 1000, s: 8 })
  let tracks = (d.playlist && d.playlist.tracks) || []

  // 曲目多时 v6 只给一部分，用 trackIds 补齐
  const trackIds = (d.playlist && d.playlist.trackIds) || []
  if (tracks.length < trackIds.length) {
    const ids = trackIds.map(t => t.id).slice(0, 1000)
    const detail = await weapi('/weapi/v3/song/detail', {
      c: JSON.stringify(ids.map(i => ({ id: i })))
    })
    if (detail.songs) tracks = detail.songs
  }

  return tracks.map(t => toItem(t))
}

async function getSong(id) {
  const d = await weapi('/weapi/v3/song/detail', { c: JSON.stringify([{ id: Number(id) }]) })
  return (d.songs || []).map(t => toItem(t))
}

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, 'https://x')
  const server = (searchParams.get('server') || 'netease').toLowerCase()
  const type = (searchParams.get('type') || 'playlist').toLowerCase()
  const id = searchParams.get('id')

  res.setHeader('Access-Control-Allow-Origin', '*')

  if (!id) return send(res, 400, { error: 'missing id' })
  if (server !== 'netease') return send(res, 400, { error: 'only netease is supported' })
  if (!['playlist', 'song'].includes(type)) return send(res, 400, { error: 'type must be playlist or song' })

  const key = `${type}:${id}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.t < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT')
    return send(res, 200, hit.v, 60)
  }

  try {
    const list = type === 'playlist' ? await getPlaylist(id) : await getSong(id)
    cache.set(key, { t: Date.now(), v: list })
    return send(res, 200, list, 600)
  } catch (e) {
    console.error('[meting] failed:', e)
    return send(res, 502, { error: String(e.message || e) }, 0)
  }
}

function send(res, code, body, sMaxAge = 0) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (sMaxAge > 0) res.setHeader('Cache-Control', `public, max-age=${sMaxAge}, s-maxage=${sMaxAge}`)
  res.end(JSON.stringify(body))
}
