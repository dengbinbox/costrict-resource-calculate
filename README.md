# CoStrict AS — AI 资源估算工具

基于 React + TypeScript + Vite 构建的 GPU 资源预估工具，支持根据企业规模、使用场景动态估算所需 GPU 数量和部署成本。

---

## 功能特性

- 📊 **场景选择**：预置多种典型企业使用场景（高峰 / 低峰）
- 🔢 **参数配置**：支持自定义公司规模、用户数、RPM
- 💡 **自动估算**：根据 GPU 型号、并发能力自动计算所需卡数与机器数
- 💰 **成本展示**：实时展示预估采购成本
- ⚡ **离线可用**：所有数据在构建时内联，无需后端服务

---

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:5173）
npm run dev
```

### 构建生产包

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

---

## Docker 部署（推荐）

项目使用 Nginx 容器提供静态文件服务，支持无需 Node 环境的生产部署。

### 构建说明

由于 CSV 数据通过 Vite 的 `?raw` 导入在**编译时**内联进 JS Bundle，无需运行时 fetch 请求，因此镜像中不包含 Node.js 环境。

### 部署步骤

**第一步：构建前端产物**

```bash
npm run build
```

**第二步：构建 Docker 镜像**

```bash
docker build -t costrict-as:latest .
```

**第三步：启动容器**

```bash
# 监听宿主机 8080 端口
docker run -d \
  --name costrict-as \
  -p 8080:80 \
  --restart unless-stopped \
  costrict-as:latest
```

访问 [http://localhost:8080](http://localhost:8080) 即可使用。

### 镜像说明

| 文件 | 说明 |
|------|------|
| [`Dockerfile`](Dockerfile) | 基于 `nginx:1.27.1`，将 `dist/` 拷入镜像 |
| [`nginx.conf`](nginx.conf) | SPA 路由回退 + gzip 压缩 + 静态资源长期缓存 |
| [`.dockerignore`](.dockerignore) | 排除源码、依赖等，只打包 `dist/` 和配置文件 |

### 常用 Docker 命令

```bash
# 查看运行状态
docker ps -f name=costrict-as

# 查看日志
docker logs costrict-as

# 停止并删除容器
docker rm -f costrict-as

# 重新构建并部署
npm run build && docker build -t costrict-as:latest . && docker run -d --name costrict-as -p 8080:80 costrict-as:latest
```

---

## GitHub Actions 自动部署

本项目配置了自动构建与远程部署工作流（[`.github/workflows/release.yml`](.github/workflows/release.yml)），推送 tag 时自动触发构建并部署到远程服务器。

### 触发条件

推送任意 tag（如 `v1.0.0`）即可触发：

```bash
git tag v1.0.0
git push origin v1.0.0
```

### 配置 Secrets

在使用自动部署前，需要在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 中配置以下 Secrets：

| Secret | 说明 | 示例值 |
|---|---|---|
| `SSH_HOST` | 远程服务器 IP 或域名 | `192.168.1.100` |
| `SSH_PORT` | SSH 端口 | `22` |
| `SSH_USERNAME` | SSH 登录用户名 | `zhuge` |
| `REMOTE_PATH` | 远程部署目标目录 | `/home/zhuge/zhuge_web/costrict-resource-calculate` |
| `SSH_KEY` | SSH 私钥（与 `SSH_PASSWORD` 二选一） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SSH_PASSWORD` | SSH 登录密码（与 `SSH_KEY` 二选一） | `your_password` |

> **认证方式说明**：如果同时配置了 `SSH_KEY` 和 `SSH_PASSWORD`，优先使用密码（`SSH_PASSWORD`）。仅配置 `SSH_KEY` 时使用密钥认证。

### 部署行为

- 使用 `rsync -avz --delete` 将 `dist/` 完整同步到 `${REMOTE_PATH}/`
- `dist/index.html` → `${REMOTE_PATH}/index.html`
- `dist/assets/...` → `${REMOTE_PATH}/assets/...`
- `--delete` 确保远程多余的旧文件被自动清理

---

## 项目结构

```
costrict-as/
├── public/
│   └── data/
│       ├── scenarios.csv     # 使用场景数据（编译时内联）
│       └── gpu_models.csv    # GPU 型号数据（编译时内联）
├── src/
│   ├── pages/
│   │   └── ResourceEstimator.tsx   # 主页面组件
│   ├── utils/
│   │   └── csvParser.ts            # CSV 解析工具
│   └── types/
│       └── index.ts                # 类型定义
├── nginx.conf        # Nginx 配置
├── Dockerfile        # Docker 镜像构建文件
├── .dockerignore     # Docker 构建上下文排除规则
└── vite.config.ts    # Vite 构建配置
```

---

## 数据文件说明

### `public/data/scenarios.csv`

使用场景参考数据，字段：

| 字段 | 说明 |
|------|------|
| 场景 | 场景名称 |
| 全公司人数 | 基准企业总人数 |
| 使用人数 | 活跃用户数 |
| RPM | 每分钟请求数 |
| 并发 | 并发请求数（可为空） |

### `public/data/gpu_models.csv`

GPU 型号及性能参数，修改此文件后重新执行 `npm run build` 即可更新数据。

---

## 技术栈

- **框架**：React 19 + TypeScript
- **构建工具**：Vite 8
- **UI 组件库**：Ant Design 6
- **部署**：Nginx + Docker
