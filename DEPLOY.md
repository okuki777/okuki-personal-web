# 部署到 Vercel

这个项目是 **Vite + Vue 3 + Vuetify**，并且带 4 个 Serverless 函数（`api/`）。
Vercel 会自动识别这两部分，**不需要改配置**。

---

## 路线 A：最快（不需要 GitHub，约 5 分钟）

适合先看到线上效果。

```powershell
cd "D:\okuki\Documents\ds okuki\leleo-home-page"
npx vercel
```

过程里会问你几个问题，照下面选：

| 提问 | 选 |
|---|---|
| Set up and deploy? | **Y** |
| Which scope? | 选你自己的账号 |
| Link to existing project? | **N** |
| What's your project's name? | 随便起，比如 `okuki-home` |
| In which directory is your code located? | 直接回车（`./`） |
| Want to modify these settings? | **N**（它会自动识别 Vite） |

完成后再跑一次上线生产环境：

```powershell
npx vercel --prod
```

拿到 `https://xxx.vercel.app` 就是你的站了。

> 注意：`.vercel.app` 域名在中国大陆经常打不开，建议后续绑自己的域名（Vercel 项目 → Settings → Domains）。

---

## 路线 B：长期（推荐，能自动更新）

前提：你自己的 GitHub 上有个空仓库。

```powershell
cd "D:\okuki\Documents\ds okuki\leleo-home-page"

# 1. 把远端换成你的仓库（现在的 origin 指向原作者 leleo886，push 会失败）
git remote set-url origin https://github.com/okuki777/你的仓库名.git

# 2. 提交本次所有改动
git add -A
git commit -m "personalize: okuki 主页（头像/壁纸/歌单/自建音乐接口/新增项目）"

# 3. 推上去
git push -u origin main
```

然后到 Vercel 网页 → **Add New → Project → Import** 选这个仓库 → 框架会自动识别为 Vite → Deploy。

以后每次改完 `git push` 就会自动部署。

---

## 部署后要检查的三件事

1. **音乐能不能播**：点左下齿轮 → 音乐播放 → 播放。
   接口路径是 `/api/meting`、`/api/songurl`、`/api/lyric`，可以直接在浏览器打开验证：
   - `https://你的域名/api/meting?server=netease&type=playlist&id=18575726923`
   - 应返回 40 条 JSON
2. **动态壁纸能不能放**：Safari / iOS 对自动播放有额外限制，若黑屏属正常（移动端配置走静态图）。
3. **项目卡是否还在**：现场新增的项目存在 `localStorage`，**只在你当前浏览器可见**，线上访问别人的设备看不到。

---

## 环境变量（可选）

如果用环境变量而不是 `config.js`，在 Vercel → Settings → Environment Variables 里加：

| Key | Value |
|---|---|
| `VITE_CONFIG` | 一整个 JSON（模板见 `img/env.md`） |

⚠️ 注意：**Vercel 里环境变量优先级高于 `config.js`**。用了环境变量就别再改 `config.js`，否则会困惑"为什么改了没生效"。

---

## 函数区域

`vercel.json` 里已经把 Serverless 函数区域设成 **hkg1（香港）**：

```json
{ "framework": "vite", "regions": ["hkg1"] }
```

原因：函数要访问网易云（国内服务），放美东延迟高且更容易被判定为境外 IP。想换区域改这一行即可。

---

## 常见问题

**Q：部署成功了但页面白屏？**
看构建日志里有没有 `Build failed`。本地先跑 `npm run build` 确认能过（注意：本机 `node_modules` 的 esbuild 在 Windows 上有时会因为 TEMP 目录权限报 `Access is denied`，那是本机问题，Vercel 上不会出现）。

**Q：音乐能拿到列表但播放没声音？**
1. 浏览器限制：必须用户点一下播放（有手势）才允许出声；
2. 检查 `/api/songurl?id=xxx` 是否返回了 `url`；
3. 若返回空，说明这首在网易云侧不可播（版权/VIP），代码会自动跳过。

**Q：`/api/meting` 返回 502？**
函数里访问网易云失败。看 Vercel → Functions 日志，通常是临时风控，重试即可；代码里保留了对公共 Meting 服务的兜底。
