# 境内云函数部署（把 /api 搬回国内）

## 为什么需要这一步

网易云的播放地址接口**按 IP 地区发放数据**：

| 调用方 | `/api/meting`（元数据） | `/api/songurl`（播放地址） |
|---|---|---|
| 国内 IP（你家宽带 / 国内服务器） | ✅ 40 首 | ✅ 83–243ms 拿到 https 地址 |
| Cloudflare 边缘（洛杉矶） | ✅ 40 首 | ❌ 返回 `url: null` |

所以静态文件放 Cloudflare 没问题，**只要把 `/api` 这一层放到境内**，音乐就能放。

架构：

```
浏览器 → okuki.top (Cloudflare Worker)
              ├── /            → 静态文件（dist/，边缘直出，快）
              └── /api/*       → 反向代理 → 境内云函数 → 网易云
```

前端**一行都不用改**，`/api/...` 路径保持不变。

---

## 打包

在项目根目录：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\pack-cloudfunction.ps1
```

会生成 `cloudfunction.zip`（约 30 KB，**零依赖**，不含 node_modules），里面是：

```
package.json          ← {"type":"module","main":"cloudbase/index.js"}
cloudbase/index.js    ← 入口，导出 main(event, context)
shared/netease.js     ← 网易云签名与取流
shared/router.js      ← 路由
```

---

## 方案一：腾讯云开发 CloudBase（推荐，有免费额度）

1. 打开 https://console.cloud.tencent.com/tcb → **新建环境**（按量计费，选免费额度）
2. 左侧 **云函数 → 新建云函数**
   - 函数名称：`okuki-api`
   - 运行环境：**Node.js 18**
   - 提交方式：**上传代码包** → 选 `cloudfunction.zip`
   - 执行入口：`index.main`（即 `cloudbase/index.js` 的 `main`）
3. 建好后进入函数 → **HTTP 访问服务 / HTTP 触发器** → 添加路径
   - 路径：`/api`
   - 认证：**免鉴权**（我们的代码自己处理 CORS）
4. 拿到访问域名，形如：

```
https://okuki-api-xxxxxxxx.service.tcloudbase.com
```

5. 验证（把域名换成你的）：

```bash
curl "https://okuki-api-xxxxxxxx.service.tcloudbase.com/api/meting?server=netease&type=playlist&id=18575726923"
curl "https://okuki-api-xxxxxxxx.service.tcloudbase.com/api/songurl?id=28999945"
```

第二条应返回 `{"url":"https://m7xx.music.126.net/..."}`。

---

## 方案二：腾讯云 SCF + API 网关

1. https://console.cloud.tencent.com/scf → 新建函数 → **Node.js 18**
2. 上传 `cloudfunction.zip`，执行方法填 `index.main`
3. 触发器 → **API 网关触发器** → 路径 `/api` → 免鉴权
4. 拿到 API 网关域名（`https://xxxx.apigw.tencentcs.com`）

---

## 方案三：阿里云函数计算 FC

1. https://fc.console.aliyun.com → 创建函数 → **Node.js 18** → 上传 zip
2. 请求处理程序填 `index.handler`
3. 创建 **HTTP 触发器** → 路径 `/api` → 允许匿名
4. 拿到公网访问地址

---

## 接回 Cloudflare

拿到函数域名后，改仓库里的 `wrangler.jsonc`：

```jsonc
"vars": {
  "API_ORIGIN": "https://okuki-api-xxxxxxxx.service.tcloudbase.com"
}
```

推送后 Cloudflare 自动构建，`/api/*` 就会走境内。前端无感。

> 也可以在 Cloudflare 面板 → Worker → Settings → Variables 里改 `API_ORIGIN`，
> 但**改完需要重新部署**才生效，改仓库里这个文件更省事。

---

## 注意事项

- **CORS**：路由器已经返回 `Access-Control-Allow-Origin: *`，且处理了 `OPTIONS` 预检，跨域直连也能用。
- **冷启动**：云函数首次调用约 1–3 秒，之后稳定在几百毫秒。播放地址接口本来就按需调用，可接受。
- **费用**：只在打开音乐播放器时才产生调用，个人站用量远低于免费额度。
- **HTTPS**：云厂商默认域名自带证书，无需配置。
- **不要把云函数域名写进前端**：前端始终请求同域 `/api`，由 Worker 转发。这样以后换云厂商只改一行配置。
