# Cloudflare Workers 部署（Git 自动部署）

推送到 GitHub → Cloudflare 自动构建 → 全站（含 `/api/*`）上线，以后 `git push` 就自动更新。

> 你在控制台看到的那一屏 **"Set up your application / Configure your Worker project"** 就是这条路。
> （Cloudflare 现在把 Git 集成放在 Workers 里，Pages 是另一条更老的路，本项目已兼容两者。）

---

## 一、控制台那三个命令，照这个填

| 字段 | 值 | 说明 |
|---|---|---|
| **Project name** | `okuki-personal-web` | 必须和 `wrangler.jsonc` 里的 `name` 一致，否则会部署成另一个 Worker |
| **Build command** | `npm run build` | 产出 `dist/` |
| **Deploy command** | `npx wrangler deploy` | 读 `wrangler.jsonc`，部署 Worker + 静态资源 |
| **Preview command** | `npx wrangler versions upload` | ⚠️ `npx wrangler preview` 是旧命令，已废弃，会报错 |
| **Enable Preview builds** | 可以关掉 | 个人站不需要 PR 预览，关掉省构建次数 |

环境变量（可选）：`NODE_VERSION = 20`（仓库里已有 `.nvmrc`，双保险）

点 **Deploy**，1–2 分钟出 `https://okuki-personal-web.<你的子域>.workers.dev`。

---

## 二、它是怎么跑起来的

```
wrangler.jsonc
├── main: worker/index.js          Worker 入口
└── assets.directory: ./dist       静态文件（Vite 构建产物）
    └── not_found_handling: single-page-application

worker/index.js
├── /api/*   → functions/api/[[path]].js   （WebCrypto 版网易云接口）
└── 其它      → env.ASSETS.fetch()          （静态文件 / SPA 回退）
```

关键点：**静态文件不经过 Worker**，Cloudflare 直接从边缘节点发；只有 `/api/*` 才唤起 Worker。

网易云签名在 `shared/netease.js`，用 **WebCrypto(AES-128-CBC) + BigInt 模幂(RSA 无填充)** 实现，
不依赖 `node:crypto`，所以在 Workers 运行时里原生可跑（Vercel 那边也是同一份代码）。

---

## 三、本机用真实 Workers 运行时验证过

不只是单元测试——用 `npx wrangler dev` 起了 workerd，实测：

```
GET /                                         200  text/html（静态 index.html）
GET /api/meting?...&id=18575726923            200  40 首
GET /api/songurl?id=3316182102                200  https=true
GET /api/lyric?id=3316182102                  200  text/plain · 1401 字节
GET /api/search?kw=周杰伦&limit=3              200  3 条
GET /api/nope                                 404
GET /some/deep/path                           200  text/html（SPA 回退）
GET /img/avatar.jpg                           200  image/jpeg
```

---

## 四、缓存

| 文件 | 作用 |
|---|---|
| `public/_headers` | `/assets/*` 一年 immutable、`index.html` 不缓存 |
| `public/_redirects` | SPA 回退（`assets.not_found_handling` 已覆盖，双保险） |

被 Vite 复制进 `dist/`，Workers 静态资源会读取。

---

## 五、自定义域名

Workers 项目 → **Settings → Domains & Routes → Add → Custom domain**。
域名托管在 Cloudflare 时自动签 HTTPS；不在 Cloudflare 就加一条 CNAME。

> 国内访问：`*.workers.dev` 和 `*.pages.dev` 一样不稳，别指望它替代国内服务器。
> 要国内快，走 [`server/DEPLOY-CN.md`](server/DEPLOY-CN.md) 那套（备案 + 轻量服务器，服务端已写好）。

---

## 六、和 Vercel / Pages 的关系

| 平台 | 静态 | API | 入口 |
|---|---|---|---|
| Cloudflare Workers | `dist/` | `functions/`（经 `worker/index.js` 转发） | `wrangler.jsonc` |
| Cloudflare Pages（可选） | `dist/` | `functions/` 直接被识别 | `pages_build_output_dir` |
| Vercel | `dist/` | `api/*.js`（Node 运行时） | `vercel.json` |

三个平台的业务逻辑共用 `shared/netease.js`，改一处三处生效。

---

## 七、常见问题

**Q：构建报 `Could not resolve "node:crypto"`？**
不该出现，本项目已全部改用 WebCrypto。若出现，检查是否新增了 Node 专用 import。

**Q：部署成功但 `/api/meting` 500？**
看 Worker 日志（`wrangler tail` 或面板 Observability）。多为网易云临时风控，前端会自动退回公共 Meting 服务。

**Q：Project name 和 wrangler.jsonc 不一致会怎样？**
`wrangler deploy` 以配置文件里的 `name` 为准，可能部署到另一个 Worker，导致面板上看到的是旧版本。保持两者一致。

**Q：本地怎么跑？**
```bash
npm run build
npx wrangler dev          # http://localhost:8787
```
