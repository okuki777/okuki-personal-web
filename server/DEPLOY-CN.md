# 国内部署方案（买域名 + 备案 + 轻量服务器）

目标：**国内打开快、稳定**。这条路绕不开备案，但一次做完，以后只需要 `git pull` 更新。

---

## 一、要买什么

| 项目 | 买哪 | 价位 | 备注 |
|---|---|---|---|
| 域名 | 阿里云 / 腾讯云 | `.com` 首年 ¥60–90，续费 ~¥90 | **别在境外注册商买**，否则不能备案（要先转入） |
| 服务器 | 阿里云/腾讯云 **轻量应用服务器** 2 核 2G | ¥99–199/年（常有新客/学生优惠） | 3M 带宽够；系统选 **Ubuntu 22.04** |
| 备案 | 在买服务器的那家提交 | 免费 | 主体+网站备案，7–20 个工作日 |
| HTTPS 证书 | Let's Encrypt | 免费 | `certbot` 一条命令，或面板点一下 |

**顺序很重要**：先买域名 → 实名认证（1–2 天）→ 买服务器（要 ≥3 个月订单才能备案）→ 提交备案 → 备案通过后解析域名。

> 备案期间网站不能开 80/443，先用 IP + 8080 端口自测，不影响开发。

---

## 二、服务器环境（三条命令）

```bash
# 1. Node 20（Ubuntu 22.04）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx

# 2. PM2（进程守护，挂了自动拉起）
sudo npm i -g pm2

# 3. 防火墙放行
sudo ufw allow 80,443/tcp && sudo ufw allow 8080/tcp
```

不想敲命令就用 **1Panel** 或 **宝塔** 面板（图形化装 Node、Nginx、证书），效果一样。

---

## 三、把网站放上去

```bash
# 本地（Windows）：先传上去
scp -r "D:\okuki\Documents\ds okuki\leleo-home-page" root@你的服务器IP:/var/www/okuki

# 或者服务器上直接 git clone（推荐，以后更新只要 git pull）
cd /var/www && git clone https://github.com/okuki777/你的仓库.git okuki && cd okuki
```

服务器上：

```bash
cd /var/www/okuki
npm ci --omit=dev          # 只装运行依赖
npm run build              # 产出 dist/
pm2 start server/ecosystem.config.cjs
pm2 save && pm2 startup    # 开机自启
```

自测（备案通过前用这个）：

```
http://服务器IP:8080/
http://服务器IP:8080/api/meting?server=netease&type=playlist&id=18575726923
```

---

## 四、配 Nginx + HTTPS

```bash
sudo cp server/nginx.conf /etc/nginx/conf.d/okuki.conf
sudo nano /etc/nginx/conf.d/okuki.conf     # 把 okuki.example.com 换成你的域名
sudo nginx -t && sudo systemctl reload nginx

# 证书（自动改 Nginx 配置）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名 -d www.你的域名
```

---

## 五、备案通过后

1. 域名解析：A 记录 → 服务器 IP（`@` 和 `www` 各一条）。
2. 打开 `https://你的域名` 验证。
3. **页脚挂备案号**（法律要求）：

```js
// src/config.js
statement: ["沪ICP备2026XXXXXXX号", "Copyright © 2026 okuki"],
```

改完 `git push`（或服务器 `git pull && npm run build`）。

---

## 六、日常更新

```bash
cd /var/www/okuki
git pull
npm ci --omit=dev   # 依赖没变可以跳过
npm run build
pm2 restart okuki-home
```

`dist/` 变了但 Node 服务不用重启也行（静态文件每次现读），重启只是为了保险。

---

## 七、这套服务端是什么

`server/standalone.js` 是一个**零依赖** Node 服务：

- 托管 `dist/` 静态文件：gzip、带 hash 资源永久缓存、HTML 不缓存、SPA 回退、ETag
- 把 `api/*.js` 那四个函数挂到 `/api/*`（和 Vercel 上是同一份代码）

实测（本机）：

```
首页            200 · text/html
/api/meting     200 · 40 首
/api/songurl    200 · https=true
JS 传输         773 KB → gzip 后 254 KB
未知路径        回退 index.html（SPA）
未知 API        404
```

好处：**不绑定任何平台**。今天跑在轻量服务器，明天想换香港/云函数，代码不用动。

---

## 八、成本与时间

| 阶段 | 时间 | 花费 |
|---|---|---|
| 买域名 + 实名 | 1–2 天 | ¥60–90/年 |
| 买服务器 | 当天 | ¥99–199/年 |
| 备案 | 7–20 个工作日 | 免费 |
| 部署 + 证书 | 1 小时 | — |

**合计约 ¥160–290/年**，换来国内直连（通常 20–50ms 首字节）。
