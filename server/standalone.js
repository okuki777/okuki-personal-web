/**
 * 独立服务端：给国内轻量服务器用（不依赖 Vercel）
 *
 *   node server/standalone.js
 *
 * 干两件事：
 *   1. 托管 dist/ 里的静态文件（gzip、强缓存、SPA 回退）
 *   2. 把 api/*.js 那四个函数挂到 /api/* 上（跟 Vercel 上跑的是同一份代码）
 *
 * 零依赖：只用 node 内置模块，服务器上不需要 npm install 就能跑。
 */

import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

import meting from '../api/meting.js'
import songurl from '../api/songurl.js'
import lyric from '../api/lyric.js'
import search from '../api/search.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 8080)

const API = {
  '/api/meting': meting,
  '/api/songurl': songurl,
  '/api/lyric': lyric,
  '/api/search': search
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json'
}

const COMPRESSIBLE = /^(text\/|application\/(json|javascript)|image\/svg)/

function send(res, code, headers, body) {
  res.writeHead(code, headers)
  res.end(body)
}

/** 把 Vercel 风格的 (req, res) 适配到 Node 原生 res */
function apiRes(res) {
  let code = 200
  const headers = {}
  return {
    get statusCode() { return code },
    set statusCode(v) { code = v },
    setHeader(k, v) { headers[k] = v },
    end(body) {
      const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf8')
      const accept = res.req.headers['accept-encoding'] || ''
      if (buf.length > 1024 && /gzip/.test(accept) && COMPRESSIBLE.test(headers['Content-Type'] || '')) {
        zlib.gzip(buf, (err, zipped) => {
          if (err) return send(res, code, headers, buf)
          headers['Content-Encoding'] = 'gzip'
          headers['Content-Length'] = zipped.length
          send(res, code, headers, zipped)
        })
        return
      }
      headers['Content-Length'] = buf.length
      send(res, code, headers, buf)
    }
  }
}

async function serveStatic(req, res, urlPath) {
  // 防目录穿越
  const safe = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  let file = path.join(DIST, safe)
  if (!file.startsWith(DIST)) return send(res, 403, {}, 'forbidden')

  let stat = null
  try { stat = await fsp.stat(file) } catch { /* 不存在 */ }

  // 目录或不存在 → 交给 SPA 回退
  if (!stat || stat.isDirectory()) {
    const indexPath = path.join(DIST, 'index.html')
    if (!fs.existsSync(indexPath)) {
      return send(res, 503, { 'Content-Type': 'text/plain; charset=utf-8' }, '还没构建：先跑 npm run build')
    }
    file = indexPath
    stat = await fsp.stat(file)
  }

  const ext = path.extname(file).toLowerCase()
  const type = MIME[ext] || 'application/octet-stream'
  const isHashed = /[\\/]assets[\\/]/.test(file) || /\.[0-9a-f]{8}\./i.test(file)

  const headers = {
    'Content-Type': type,
    // 带 hash 的资源可以长期缓存；html 不缓存，保证发版立刻生效
    'Cache-Control': ext === '.html'
      ? 'no-cache'
      : isHashed ? 'public, max-age=31536000, immutable' : 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff'
  }

  // 条件请求
  const etag = `W/"${stat.size}-${Number(stat.mtimeMs).toString(36)}"`
  headers.ETag = etag
  if (req.headers['if-none-match'] === etag) return send(res, 304, headers, '')

  const buf = await fsp.readFile(file)
  const accept = req.headers['accept-encoding'] || ''

  if (buf.length > 1024 && /gzip/.test(accept) && COMPRESSIBLE.test(type)) {
    return zlib.gzip(buf, (err, zipped) => {
      if (err) return send(res, 200, headers, buf)
      headers['Content-Encoding'] = 'gzip'
      send(res, 200, headers, zipped)
    })
  }
  send(res, 200, headers, buf)
}

const server = http.createServer(async (req, res) => {
  const started = Date.now()
  req.res = res
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (pathname.startsWith('/api/')) {
    const handler = API[pathname]
    if (!handler) return send(res, 404, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'not found' }))
    try {
      await handler({ url: req.url, method: req.method, headers: req.headers }, apiRes(res))
    } catch (e) {
      console.error('[api]', pathname, e)
      if (!res.headersSent) send(res, 500, { 'Content-Type': 'application/json' }, JSON.stringify({ error: String(e.message || e) }))
    }
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, { 'Content-Type': 'text/plain; charset=utf-8' }, 'method not allowed')
  }

  try {
    await serveStatic(req, res, pathname)
  } catch (e) {
    console.error('[static]', pathname, e)
    if (!res.headersSent) send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'internal error')
  } finally {
    const ms = Date.now() - started
    if (ms > 500) console.warn(`[slow] ${pathname} ${ms}ms`)
  }
})

server.listen(PORT, () => {
  console.log(`okuki homepage  →  http://0.0.0.0:${PORT}`)
  console.log(`静态目录: ${DIST}`)
  console.log(`API: ${Object.keys(API).join(', ')}`)
})
