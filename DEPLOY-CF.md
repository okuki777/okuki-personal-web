# Cloudflare Pages 部署（Git 自动部署）

推送到 GitHub → Cloudflare 自动构建 → 全站（含 `/api/*`）上线，改完 `git push` 就自动更新。

---

## 一、在 Cloudflare 里连仓库（一次就好）

1. 打开 https://dash.cloudflare.com/?to=/:account/workers-and-pages
2. **Create** → **Pages** → **Connect to Git**
3. 授权 GitHub，选仓库 **`okuki777/okuki-personal-web`**
4. 构建设置按下表填：

| 设置项 | 填什么 |
|---|---|
| Framework preset | **None**（或 Vite，两者都行） |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 留空 |
| Node version（环境变量） | `NODE_VERSION = 20`（仓库里已有 `.nvmrc`，二选一） |

5. **Save and Deploy**

首次构建约 1–2 分钟，完成后给你 `https://<项目名>.pages.dev`。

> 以后每次 `git push` 到 `main` 都会自动构建上线；PR 会生成预览环境。

---

## 二、为什么 API 也能跑

Cloudflare Pages 会自动读取仓库根目录的 **`functions/`**：

```
functions/
└── api/
    └── [[path]].js     → 处理 /api/meting、/api/songurl、/api/lyric、/api/search
```

内部复用 `shared/netease.js` —— 用 **WebCrypto(AES-CBC) + BigInt 模幂(RSA 无填充)** 实现网易云签名，
不依赖 `node:crypto`，所以在 Workers 运行时里原生可跑。

> 同一份签名逻辑，Node（Vercel / 自托管）与 Cloudflare 共用，前端不需要知道跑在哪。

本机实测（Node 里模拟 Pages 的 Request/Response）：

```
/api/meting   200 · 40 首 · 276ms
/api/songurl  200 · https=true
/api/lyric    200 · text/plain · 945 字节
/api/search   200 · 3 条
/api/nope     404
```

---

## 三、构建相关的两个文件

| 文件 | 作用 |
|---|---|
| `public/_headers` | 静态资源缓存策略（`/assets/*` 一年 immutable、`index.html` 不缓存） |
| `public/_redirects` | SPA 回退（找不到的路径回 `index.html`） |

两者会被 Vite 复制进 `dist/`，Cloudflare Pages 自动识别。

---

## 四、自定义域名

Pages 项目 → **Custom domains** → 添加域名 → 按提示加 CNAME。
Cloudflare 会自动签 HTTPS（免费），不需要额外配置。

> 注意：**域名托管在 Cloudflare 才能用它的 CDN 加速**；域名在国内注册商（阿里云/腾讯云）也能接入，
> 只是国内解析速度取决于线路。想要国内真正稳定，还是得走 [`DEPLOY-CN.md`](DEPLOY-CN.md) 那套备案方案。

---

## 五、和 Vercel 版的关系

两套并存，互不影响：

| 平台 | 静态 | API | 触发文件 |
|---|---|---|---|
| Vercel | `dist/` | `api/*.js`（Node 运行时） | `vercel.json` |
| Cloudflare Pages | `dist/` | `functions/api/[[path]].js`（Workers 运行时） | `wrangler.jsonc` |

同一次 `git push`，两边都能构建成功。

---

## 六、常见问题

**Q：构建报 `Cannot find module 'node:crypto'`？**
不应该出现——`shared/netease.js` 只用了 WebCrypto。如果出现，检查是不是还有文件 import 了 `node:crypto`。

**Q：`/api/meting` 返回 500？**
看 Pages → 项目 → **Functions** 日志。多半是网易云临时风控，重试即可；前端会自动退回公共 Meting 服务。

**Q：音乐能播但没声音？**
浏览器要求用户先点一下播放，这是策略限制，不是接口问题。

**Q：构建很慢 / 失败？**
Node 版本设成 20（环境变量 `NODE_VERSION`）。
