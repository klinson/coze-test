# Coze Chat — 生产环境部署配置说明

## 部署方案概览

| 方案 | 适用场景 | 难度 |
|---|---|---|
| [方案 A：云服务器（推荐）](#方案-a云服务器-直接部署) | 完整控制权，长期稳定运行 | ★★☆ |
| [方案 B：Railway](#方案-brailway-平台部署) | 快速上线，免运维 | ★☆☆ |
| [方案 C：Docker](#方案-cdocker-容器化部署) | 标准化，便于迁移 | ★★☆ |

---

## 部署前准备

### 1. 确认 Node.js 版本

生产环境要求 Node.js **>= 22.0.0**。

```bash
node -v   # 应输出 v22.x.x
```

### 2. 设置环境变量

项目通过环境变量配置运行端口，**不需要**在服务端存储 API Key（由用户在浏览器端配置）。

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 服务监听端口 |
| `NODE_ENV` | `development` | 设为 `production` 开启生产优化 |

---

## 方案 A：云服务器 直接部署

适用于阿里云 ECS、腾讯云 CVM、Vultr、DigitalOcean 等任意 Linux 服务器。

### 1. 上传项目文件

```bash
# 本地执行，上传压缩包到服务器
scp coze-chat.tar.gz root@your-server-ip:/opt/
```

### 2. 服务器上解压并安装

```bash
cd /opt
tar -xzf coze-chat.tar.gz
cd coze-chat
npm install --omit=dev   # 仅安装生产依赖
```

### 3. 安装 PM2（进程守护）

```bash
npm install -g pm2
```

### 4. 启动并配置开机自启

```bash
# 启动应用
NODE_ENV=production PORT=3000 pm2 start server.js --name coze-chat

# 保存进程列表
pm2 save

# 设置开机自启（按提示执行输出的命令）
pm2 startup
```

常用 PM2 命令：

```bash
pm2 status              # 查看运行状态
pm2 logs coze-chat      # 查看实时日志
pm2 restart coze-chat   # 重启服务
pm2 stop coze-chat      # 停止服务
```

### 5. 配置 Nginx 反向代理

安装 Nginx：

```bash
# Ubuntu / Debian
apt update && apt install -y nginx

# CentOS / RHEL
yum install -y nginx
```

创建站点配置文件 `/etc/nginx/sites-available/coze-chat`：

```nginx
server {
    listen 80;
    server_name your-domain.com;   # 替换为你的域名或服务器 IP

    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
    }

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # SSE 流式输出关键配置
        proxy_set_header   Connection        '';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # 禁止 Nginx 缓冲响应（SSE 必须）
        proxy_buffering    off;
        proxy_cache        off;

        # 超时设置（流式输出需要较长时间）
        proxy_read_timeout    300s;
        proxy_connect_timeout 10s;
        proxy_send_timeout    300s;

        # 关闭分块编码压缩（避免 SSE 被截断）
        gzip off;
    }
}
```

启用配置：

```bash
# Ubuntu / Debian
ln -s /etc/nginx/sites-available/coze-chat /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# CentOS（将配置文件放到 /etc/nginx/conf.d/coze-chat.conf）
nginx -t && systemctl reload nginx
```

### 6. 配置 HTTPS（推荐）

使用 Certbot 免费申请 SSL 证书：

```bash
# Ubuntu / Debian
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com

# 证书自动续期（certbot 安装后已自动配置定时任务，验证即可）
certbot renew --dry-run
```

证书申请成功后，Nginx 配置会自动更新为 HTTPS，HTTP 请求自动跳转。

---

## 方案 B：Railway 平台部署

Railway 提供开箱即用的 Node.js 托管，无需配置服务器。

### 1. 准备 GitHub 仓库

```bash
cd coze-chat
git init
git add .
git commit -m "init"
# 推送到你的 GitHub 仓库
git remote add origin https://github.com/your-name/coze-chat.git
git push -u origin main
```

### 2. 在 Railway 上部署

1. 访问 [railway.app](https://railway.app) 并登录
2. 点击「New Project」→「Deploy from GitHub repo」
3. 选择 `coze-chat` 仓库
4. Railway 会自动检测 Node.js 项目并部署

### 3. 配置环境变量

在 Railway 项目面板 → Settings → Variables 中添加：

```
NODE_ENV=production
PORT=3000
```

### 4. 绑定自定义域名（可选）

Railway 面板 → Settings → Domains → Add Custom Domain，按提示配置 DNS CNAME 记录。

> Railway 免费套餐有月度用量限制，个人低频使用通常够用；高频使用建议升级付费套餐。

---

## 方案 C：Docker 容器化部署

### 1. 创建 Dockerfile

在项目根目录创建 `Dockerfile`：

```dockerfile
FROM node:22-alpine

WORKDIR /app

# 先复制依赖文件，利用 Docker 层缓存
COPY package*.json ./
RUN npm install --omit=dev

# 复制项目文件
COPY . .

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 启动命令
CMD ["node", "server.js"]
```

创建 `.dockerignore`：

```
node_modules
*.tar.gz
.git
.gitignore
```

### 2. 构建镜像

```bash
docker build -t coze-chat:latest .
```

### 3. 运行容器

```bash
docker run -d \
  --name coze-chat \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  coze-chat:latest
```

### 4. 使用 Docker Compose（推荐）

创建 `docker-compose.yml`：

```yaml
version: '3.9'

services:
  app:
    build: .
    image: coze-chat:latest
    container_name: coze-chat
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 5s
      retries: 3
```

启动：

```bash
docker compose up -d
docker compose logs -f   # 查看日志
```

---

## 生产环境安全核查清单

在上线前逐项确认：

- [ ] **HTTPS 已启用**：敏感操作（API Key 传输）必须走加密连接
- [ ] **域名已配置**：不使用裸 IP 访问（有助于申请 SSL 证书）
- [ ] **Nginx 缓冲已关闭**：`proxy_buffering off` 确保 SSE 正常流式输出
- [ ] **超时时间已设置**：`proxy_read_timeout 300s` 防止长对话被 Nginx 截断
- [ ] **PM2 开机自启已配置**：服务器重启后自动恢复服务
- [ ] **限流已启用**：`server.js` 中 `express-rate-limit` 默认已开启（60次/分钟/IP）
- [ ] **Node.js 版本正确**：生产机器上 `node -v` >= 22

---

## Nginx 配置常见问题

### SSE 输出卡住、不实时

原因：Nginx 默认开启响应缓冲，SSE 数据会被攒批后发送。

解决：确认 Nginx 配置中包含以下两行：

```nginx
proxy_buffering off;
gzip off;
```

### 长对话中途断开（502/504）

原因：Nginx 默认超时时间（60s）导致长时间流式输出被切断。

解决：调大超时时间：

```nginx
proxy_read_timeout    300s;
proxy_send_timeout    300s;
```

### 部署后前端页面样式丢失

原因：静态资源路径问题，或 Nginx 配置了 `try_files` 导致 API 请求被拦截。

解决：本项目所有 API 路径均以 `/api/` 开头，Nginx 使用单一 `location /` 代理所有请求到 Node.js 即可，无需单独处理静态文件。

---

## 更新部署

### 方案 A（服务器直接部署）

```bash
# 1. 上传新压缩包并解压（覆盖 public/ routes/ 等目录）
scp coze-chat.tar.gz root@your-server-ip:/opt/
ssh root@your-server-ip "cd /opt && tar -xzf coze-chat.tar.gz && cd coze-chat && npm install --omit=dev"

# 2. 用 PM2 重启服务
ssh root@your-server-ip "pm2 restart coze-chat"
```

### 方案 B（Railway）

推送新代码到 GitHub main 分支，Railway 自动触发重新部署。

### 方案 C（Docker）

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```
