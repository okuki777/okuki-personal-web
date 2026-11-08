import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import meting from './api/meting.js'
import lyric from './api/lyric.js'
import songurl from './api/songurl.js'
import search from './api/search.js'

const API_ROUTES = {
  '/api/meting': meting,
  '/api/lyric': lyric,
  '/api/songurl': songurl,
  '/api/search': search
}

/**
 * 本地 dev 直接跑 Vercel 的那两个 Serverless 函数，
 * 这样 /api/meting、/api/lyric 在开发环境和线上行为一致。
 */
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        const path = req.url.split('?')[0]
        const handler = API_ROUTES[path]
        if (!handler) return next()

        const shim = {
          statusCode: 200,
          headers: {},
          setHeader(k, v) { this.headers[k] = v },
          end(body) {
            res.writeHead(this.statusCode, this.headers)
            res.end(body)
          }
        }
        try {
          await handler({ url: req.url }, shim)
        } catch (e) {
          res.statusCode = 500
          res.end(String(e && e.message ? e.message : e))
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), devApi()],
  server: {
    // Windows 上别去 watch 临时/锁住的文件，否则 fs watcher 会 EBUSY 崩溃
    watch: {
      ignored: ['**/.tmp/**', '**/shots/**', '**/dist/**', '**/*.tmpdir/**', '**/*.tmp']
    }
  }
})
