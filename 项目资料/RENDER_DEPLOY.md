# Coze Chat — Render 部署说明

> 平台：[render.com](https://render.com) · 免费套餐 · 无需信用卡 · 自动 HTTPS

---

## 方案 A：一键部署（最快，3 分钟上线）

### 第一步：Fork 到自己的 GitHub

先将项目推送到你自己的 GitHub 仓库（必须是你有权限的仓库，Render 才能读取）：

```bash
tar -xzf coze-chat.tar.gz
cd coze-chat
git init
git add .
git commit -m "init: coze chat app"
```

在 GitHub 新建仓库后推送：

```bash
git remote add origin https://github.com/你的用户名/coze-chat.git
git branch -M main
git push -u origin main
```

### 第二步：点击一键部署按钮

仓库推送完成后，用浏览器打开以下链接（替换为你的 GitHub 用户名和仓库名）：

```
https://render.com/deploy?repo=https://github.com/你的用户名/coze-chat
```

Render 会自动读取仓库根目录的 `render.yaml` 蓝图文件，预填好所有配置：

- 服务名称：`coze-chat`
- 运行环境：Node.js
- 构建命令：`npm install`
- 启动命令：`node server.js`
- 区域：Singapore（亚太）
- 套餐：Free

### 第三步：确认并部署

页面上点击 **Apply** 按钮，等待 2～5 分钟，部署完成后即可访问。

---

## 方案 B：在 README 中添加一键部署按钮

如果你的项目是开源的，可以在 `README.md` 中加入这个徽章，任何人都能一键部署到自己的 Render 账户：

```markdown
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/你的用户名/coze-chat)
```

效果如下：

> [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

点击按钮 → 登录 Render → 自动读取 `render.yaml` → 点 Apply → 完成。

---

## 方案 C：手动在 Render 控制台部署

如果不想用命令行，也可以全程在网页操作：

1. 登录 [render.com](https://render.com) → **New +** → **Web Service**
2. 连接 GitHub 仓库，选中 `coze-chat`
3. Render 自动检测到 `render.yaml`，配置已预填，确认即可
4. 点击 **Deploy Web Service**

---

## render.yaml 配置说明

项目根目录的 `render.yaml` 内容如下，这是 Render 一键部署的核心：

```yaml
services:
  - type: web
    name: coze-chat
    runtime: node
    region: singapore
    plan: free
    buildCommand: npm install
    startCommand: node server.js
    healthCheckPath: /
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```

| 字段 | 说明 |
|---|---|
| `region: singapore` | 亚太区域，国内访问延迟最低 |
| `plan: free` | 免费套餐，无需信用卡 |
| `healthCheckPath: /` | Render 用此路径检测服务是否正常启动 |
| `PORT: 10000` | Render 免费套餐固定端口，server.js 通过 `process.env.PORT` 读取 |

---

## 部署成功后

Render 控制台顶部会显示访问地址：

```
https://coze-chat-xxxx.onrender.com
```

打开后在左下角「**配置**」面板填写：

- **API Key**：Coze 平台 → 个人设置 → API Token
- **Bot ID**：智能体 URL 中的纯数字 ID
- **服务区域**：国内选 `coze.cn`，国际选 `coze.com`

---

## 后续更新

本地修改代码后推送到 GitHub，Render **自动触发重新部署**：

```bash
git add .
git commit -m "update: 描述修改"
git push
```

---

## 常见问题

**Q：部署失败，提示找不到 `render.yaml`**
确认 `render.yaml` 在仓库**根目录**，且已提交到 `main` 分支：
```bash
git ls-files render.yaml   # 有输出即表示已提交
```

**Q：想换成欧美区域降低延迟**
修改 `render.yaml` 中 `region` 字段，可选值：`oregon`（美西）、`frankfurt`（欧洲）、`singapore`（亚太），修改后重新推送即生效。

**Q：数据会因为重新部署丢失吗**
不会。所有对话历史、API Key 均存储在**用户浏览器的 localStorage**，服务端无状态，重新部署不影响任何数据。
