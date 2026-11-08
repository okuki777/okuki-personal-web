/**
 * Cloudflare Pages Functions（自动部署到 Cloudflare Pages 时生效）
 *
 * 路由（与 Vercel 版完全一致，前端不用改）：
 *   GET /api/meting?server=netease&type=playlist&id=xxx
 *   GET /api/songurl?id=xxx
 *   GET /api/lyric?id=xxx
 *   GET /api/search?kw=xxx&limit=10
 *
 * 依赖 shared/netease.js —— 用 WebCrypto + BigInt 实现网易云签名，
 * 不需要 node:crypto，所以能在 Workers 运行时里跑。
 */

import {
  getPlaylist,
  getSong,
  resolvePlayableUrl,
  getLyric,
  searchSongs
} from '../../shared/netease.js'

const playlistCache = new Map()   // isolate 级缓存，10 分钟
const CACHE_TTL = 10 * 60 * 1000

const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    ...(init.headers || {})
  }
})

const text = (body, init = {}) => new Response(body, {
  ...init,
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    ...(init.headers || {})
  }
})

export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '')
  const q = url.searchParams

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json({ error: 'method not allowed' }, { status: 405 })
  }

  try {
    if (path === '/api/meting') {
      const server = (q.get('server') || 'netease').toLowerCase()
      const type = (q.get('type') || 'playlist').toLowerCase()
      const id = q.get('id')

      if (!id) return json({ error: 'missing id' }, { status: 400 })
      if (server !== 'netease') return json({ error: 'only netease is supported' }, { status: 400 })
      if (!['playlist', 'song'].includes(type)) return json({ error: 'type must be playlist or song' }, { status: 400 })

      const key = `${type}:${id}`
      const hit = playlistCache.get(key)
      if (hit && Date.now() - hit.t < CACHE_TTL) {
        return json(hit.v, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60', 'X-Cache': 'HIT' } })
      }

      const list = type === 'playlist' ? await getPlaylist(id) : await getSong(id)
      playlistCache.set(key, { t: Date.now(), v: list })
      return json(list, { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600' } })
    }

    if (path === '/api/songurl') {
      const id = q.get('id')
      if (!id || !/^\d+$/.test(id)) return json({ url: '', error: 'invalid id' }, { status: 400 })
      const url = await resolvePlayableUrl(id)
      return json({ url }, { headers: { 'Cache-Control': 'no-store' } })
    }

    if (path === '/api/lyric') {
      const id = q.get('id')
      if (!id || !/^\d+$/.test(id)) return text('', { status: 400 })
      const lrc = await getLyric(Number(id))
      return text(lrc, { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } })
    }

    if (path === '/api/search') {
      const kw = (q.get('kw') || q.get('keywords') || '').trim()
      const limit = Math.min(50, Math.max(1, parseInt(q.get('limit') || '10', 10) || 10))
      if (!kw) return json({ error: 'missing kw' }, { status: 400 })
      const list = await searchSongs(kw, limit)
      return json(list, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } })
    }

    return json({ error: 'not found' }, { status: 404 })
  } catch (e) {
    console.error('[api]', path, e)
    return json({ error: String((e && e.message) || e) }, { status: 502 })
  }
}
