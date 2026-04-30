# ── Stage 1: 构建 ──────────────────────────────────────────────────────────────
# 如需多阶段构建（含 Node 环境），取消下面注释并注释掉单阶段部分
# FROM node:22-alpine AS builder
# WORKDIR /app
# COPY package.json package-lock.json ./
# RUN npm ci
# COPY . .
# RUN npm run build

# ── 单阶段构建：在宿主机执行 npm run build 后再 docker build ─────────────────
# 使用宿主机已有的 nginx:1.27.1 镜像（无需联网拉取）
FROM nginx:1.27.1

# 拷贝 Vite 构建产物
COPY dist /usr/share/nginx/html

# 替换默认 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
