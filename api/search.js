import { weapi, httpsfy } from './_netease.js'

/**
 * GET /api/search?kw=周杰伦&limit=10
 * 返回 [{ id, title, author, pic, album }]
 *
 * 给"在页面上搜歌 / 点歌"这类功能用；目前没有前端界面，但接口先备好。
 */

const CACHE_TTL = 10 * 60 * 1000
const cache = new Map()

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, 'https://x')
  const kw = (searchParams.get('kw') || searchParams.get('keywords') || '').trim()
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (!kw) {
    res.statusCode = 400
    return res.end(JSON.stringify({ error: 'missing kw' }))
  }

  const key = `${kw}:${limit}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.t < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    return res.end(JSON.stringify(hit.v))
  }

  try {
    const d = await weapi('/weapi/search/get', { s: kw, type: 1, limit, offset: 0 })
    const songs = (d.result && d.result.songs) || []
    const list = songs.map(s => {
      const pic = s.album && s.album.picUrl ? httpsfy(s.album.picUrl) + '?param=120y120' : ''
      return {
        id: s.id,
        title: s.name || '',
        author: (s.artists || []).map(a => a.name).join(' / '),
        album: s.album ? s.album.name : '',
        duration: s.duration || 0,
        pic
      }
    })
    cache.set(key, { t: Date.now(), v: list })
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    res.end(JSON.stringify(list))
  } catch (e) {
    console.error('[search] failed:', e)
    res.statusCode = 502
    res.end(JSON.stringify({ error: String(e.message || e) }))
  }
}
