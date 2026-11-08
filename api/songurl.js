import { fetchUrls } from '../shared/netease.js'

/**
 * GET /api/songurl?id=3316182102
 * 返回 { url }：在"要播这一首"的瞬间取地址，避免链接过期 / 混合内容被拦。
 * 320k 拿不到会自动降 192k、128k；确实没有（版权/VIP 限制）就返回空串，前端跳过。
 *
 * 不缓存：地址本身就带时效，缓存反而会放出过期的链接。
 */

export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, 'https://x')
  const id = searchParams.get('id')

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (!id || !/^\d+$/.test(id)) {
    res.statusCode = 400
    return res.end(JSON.stringify({ url: '', error: 'invalid id' }))
  }

  try {
    const map = await fetchUrls([Number(id)])
    res.statusCode = 200
    res.end(JSON.stringify({ url: map[Number(id)] || '' }))
  } catch (e) {
    console.error('[songurl] failed:', e)
    res.statusCode = 502
    res.end(JSON.stringify({ url: '', error: String(e.message || e) }))
  }
}
