import { getLyric } from '../shared/netease.js'

/**
 * GET /api/lyric?id=xxx
 * 返回纯文本 LRC（前端 tab3.vue 就是 fetch 这个 URL 再按行解析）
 */

const CACHE_TTL = 24 * 60 * 60 * 1000
const cache = new Map()

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, 'https://x')
  const id = searchParams.get('id')

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')

  if (!id || !/^\d+$/.test(id)) {
    res.statusCode = 400
    return res.end('')
  }

  const hit = cache.get(id)
  if (hit && Date.now() - hit.t < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return res.end(hit.v)
  }

  try {
    const lrc = await getLyric(Number(id))
    cache.set(id, { t: Date.now(), v: lrc })
    res.statusCode = 200
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return res.end(lrc)
  } catch (e) {
    console.error('[lyric] failed:', e)
    res.statusCode = 502
    return res.end('')
  }
}
