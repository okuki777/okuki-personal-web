/**
 * 兼容层：真正的实现在 shared/netease.js（WebCrypto 版，Node 与 Cloudflare 通用）。
 * 保留这个文件名，是为了让 api/ 下几个 Vercel 函数不用改引用。
 */
export {
  sign,
  weapi,
  httpsfy,
  fetchUrls,
  toItem,
  getPlaylist,
  getSong,
  getLyric,
  searchSongs
} from '../shared/netease.js'
