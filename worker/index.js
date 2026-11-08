/**
 * Cloudflare Workers 入口（wrangler deploy 用）
 *
 * 分工：
 *   /api/*     → 交给 functions/api/[[path]].js（WebCrypto 版网易云接口）
 *   其它路径    → 交给静态资源（dist/），未命中时按 SPA 回退到 index.html
 */

import { onRequest } from '../functions/api/[[path]].js'

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url)

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return onRequest({ request, env, ctx, params: {} })
    }

    // 静态资源；wrangler.jsonc 里配了 not_found_handling: single-page-application
    return env.ASSETS.fetch(request)
  }
}
