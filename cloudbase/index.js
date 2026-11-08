/**
 * 境内云函数入口（腾讯云开发 CloudBase / 腾讯云 SCF 云函数 HTTP 访问）
 *
 * 为什么要跑在境内：
 *   网易云的播放地址接口按 IP 地区发数据，境外（含 Cloudflare 边缘、香港）返回空。
 *   把这一层放在境内，Cloudflare 那边只做反向代理，音乐才放得出来。
 *
 * 部署：把整个仓库（或 shared/ + cloudbase/）传到云函数，入口文件 cloudbase/index.js，
 *      运行时 Node 18+，然后给它配一个 HTTP 访问路径，例如 /api。
 *      详细步骤见 cloudbase/README.md。
 */

import { handle } from '../shared/router.js'

/**
 * 腾讯云 SCF / CloudBase 的事件格式（API 网关 v2）：
 *   event.path, event.httpMethod, event.queryString, event.headers
 * 返回 { statusCode, headers, body }
 */
export async function main(event, context) {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET'
  const path = event.path || event.requestContext?.http?.path || '/'
  const qs = event.queryString || (event.queryStringParameters
    ? new URLSearchParams(event.queryStringParameters).toString()
    : '')

  const res = await handle({ url: path + (qs ? '?' + qs : ''), method })

  return {
    statusCode: res.status,
    headers: res.headers,
    body: res.body,
    isBase64Encoded: false
  }
}

/** 阿里云函数计算（HTTP 触发器）兼容写法 */
export async function handler(event, context) {
  return main(event, context)
}

export default main
