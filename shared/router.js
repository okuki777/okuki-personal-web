/**
 * 平台无关的路由层：把 GET /api/* 变成 { status, headers, body }
 *
 * 供三个环境复用：
 *   · Cloudflare Pages Functions  (functions/api/[[path]].js)
 *   · 境内云函数（腾讯云开发 / 阿里云 FC）(cloudbase/index.js)
 *   · 自托管 Node 服务             (server/standalone.js，可选)
 */

import {
  getPlaylist,
  getSong,
  resolvePlayableUrl,
  getLyric,
  searchSongs
} from './netease.js'

const CACHE_TTL = 10 * 60 * 1000
const cache = new Map()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*'
}

function json(status, data, extra = {}) {
  return {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra },
    body: JSON.stringify(data)
  }
}

function text(status, body, extra = {}) {
  return {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS, ...extra },
    body: body || ''
  }
}

export async function handle({ url, method = 'GET' }) {
  const u = new URL(url, 'https://placeholder')
  const path = u.pathname.replace(/\/+$/, '')
  const q = u.searchParams

  if (method === 'OPTIONS') return { status: 204, headers: CORS, body: '' }
  if (method !== 'GET' && method !== 'HEAD') return json(405, { error: 'method not allowed' })

  try {
    if (path === '/api/meting' || path === '/meting') {
      const server = (q.get('server') || 'netease').toLowerCase()
      const type = (q.get('type') || 'playlist').toLowerCase()
      const id = q.get('id')

      if (!id) return json(400, { error: 'missing id' })
      if (server !== 'netease') return json(400, { error: 'only netease is supported' })
      if (!['playlist', 'song'].includes(type)) return json(400, { error: 'type must be playlist or song' })

      const key = `${type}:${id}`
      const hit = cache.get(key)
      if (hit && Date.now() - hit.t < CACHE_TTL) {
        return json(200, hit.v, { 'Cache-Control': 'public, max-age=60, s-maxage=60', 'X-Cache': 'HIT' })
      }

      const list = type === 'playlist' ? await getPlaylist(id) : await getSong(id)
      cache.set(key, { t: Date.now(), v: list })
      return json(200, list, { 'Cache-Control': 'public, max-age=600, s-maxage=600' })
    }

    if (path === '/api/songurl' || path === '/songurl') {
      const id = q.get('id')
      if (!id || !/^\d+$/.test(id)) return json(400, { url: '', error: 'invalid id' })
      const url = await resolvePlayableUrl(id)
      return json(200, { url }, { 'Cache-Control': 'no-store' })
    }

    if (path === '/api/lyric' || path === '/lyric') {
      const id = q.get('id')
      if (!id || !/^\d+$/.test(id)) return text(400, '')
      const lrc = await getLyric(Number(id))
      return text(200, lrc, { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' })
    }

    if (path === '/api/search' || path === '/search') {
      const kw = (q.get('kw') || q.get('keywords') || '').trim()
      const limit = Math.min(50, Math.max(1, parseInt(q.get('limit') || '10', 10) || 10))
      if (!kw) return json(400, { error: 'missing kw' })
      const list = await searchSongs(kw, limit)
      return json(200, list, { 'Cache-Control': 'public, max-age=300, s-maxage=300' })
    }

    return json(404, { error: 'not found', path })
  } catch (e) {
    console.error('[router]', path, e)
    return json(502, { error: String((e && e.message) || e) })
  }
}
