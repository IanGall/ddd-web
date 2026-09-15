# ========================================================
# 阶段 1：node 构建静态产物
# ========================================================
FROM node:20-alpine AS builder

WORKDIR /app

# 启用 corepack 获取项目中指定的 pnpm（免额外安装独立包）
RUN corepack enable

# 复制依赖与包管理器配置（包含 pnpm-workspace.yaml 的构建授权配置）
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc* ./

# 安装依赖：优先遵循锁定文件，无锁文件时自动降级安装
RUN pnpm install --frozen-lockfile || pnpm install

# 复制源码并执行 Vite 生产打包
COPY . .
RUN pnpm build

# ========================================================
# 阶段 2：nginx 托管静态产物
# ========================================================
FROM nginx:1.27-alpine

# 设置上海时区
ENV TZ=Asia/Shanghai

# 清理 nginx 基础镜像预置的默认欢迎文件与站点配置
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# 复制自定义全局 nginx 配置（SPA fallback、静态资源长效缓存、安全响应头）
COPY deploy/nginx.conf /etc/nginx/nginx.conf

# 从构建阶段提取静态 bundle 至托管目录
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# exec 使 nginx 取代 sh 成为容器内 PID 1，保证准确接收 SIGTERM 信号以实现优雅停机
# 机制与后端 Gateway Dockerfile 的 exec java 保持一致
ENTRYPOINT ["sh", "-c", "exec nginx -g 'daemon off;'"]
