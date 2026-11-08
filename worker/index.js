/**
 * Cloudflare Workers 入口（wrangler deploy 用）
 *
 * 分工：
 *   /api/*  → 如果配了 API_ORIGIN（境内云函数），就反向代理过去；
 *             没配则用本地函数（注意：境外边缘调网易云拿不到播放地址）
 *   其它路径 → 交给静态资源（dist/），未命中时按 SPA 回退到 index.html
 */

import { onRequest } from '../functions/api/[[path]].js'

export default {
  async fetch(request, env, ctx) {
    const { pathname, search } = new URL(request.url)

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      const origin = (env.API_ORIGIN || '').trim().replace(/\/+$/, '')
      if (origin) {
        try {
          const upstream = await fetch(origin + pathname + search, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'User-Agent': 'okuki-worker-proxy'
            },
            // 云函数冷启动 + 网易云往返，留足 20 秒
            signal: AbortSignal.timeout(20000)
          })
          const headers = new Headers(upstream.headers)
          headers.delete('content-encoding')
          headers.delete('content-length')
          headers.set('X-API-Via', 'cloudbase')
          return new Response(upstream.body, { status: upstream.status, headers })
        } catch (e) {
          return new Response(JSON.stringify({ error: 'upstream failed', detail: String(e && e.message || e) }), {
            status: 502,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-API-Via': 'cloudbase-error' }
          })
        }
      }
      return onRequest({ request, env, ctx, params: {} })
    }

    // 静态资源；wrangler.jsonc 里配了 not_found_handling: single-page-application
    return env.ASSETS.fetch(request)
  }
}
