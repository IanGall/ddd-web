# ddd-web 部署配置（deploy）

本目录包含管理端前端仓 `ddd-web` 的容器镜像构建、nginx 静态托管以及 Kubernetes 部署清单。

## 目录结构

```text
ddd-web/deploy/
├── Dockerfile          # 多阶段构建：node 编译打包 → nginx 托管静态产物
├── nginx.conf          # 全局 nginx 配置（SPA fallback + 资源长效缓存 + 安全响应头）
├── README.md           # deploy 目录说明与快速指引（本文档）
└── k8s/
    ├── deployment.yaml # 工作负载清单（2 副本、HTTP GET / 探针、优雅停机、只读根文件系统兼容）
    ├── service.yaml    # ClusterIP 80 端口服务定义
    ├── ingress.yaml    # apisix Ingress：与网关共用 host (gateway.example.com)，前端只声明 /（/api 由网关 Ingress 认领，同源无 CORS）
    └── README.md       # k8s 部署顺序、路由设计与注意事项
```

## 核心设计与规约

1. **同源分流（无 CORS）**：
   管理端前端与后端网关共用同一域名 `gateway.example.com`：
   - 后端网关 Ingress 认领 `/api` 并路由给 `ian-ddd-gateway:8092`；
   - 前端 Ingress 仅认领 `/` 并路由给前端静态托管服务 `ddd-web:80`。
   同 host 使得浏览器请求属于同源请求，网关与前端均无需配置或处理 CORS。

2. **动静隔离**：
   后端网关不托管静态资源（其白名单仅放行 `/api/admin|app|external/**` 与 `/actuator/health`），前端静态文件完全由独立的 nginx 提供。

3. **SPA 路由 History Fallback 与缓存分层**：
   - `index.html` 禁用强缓存（`no-cache, no-store, must-revalidate`），确保应用更新发布后客户端即时获取最新入口；
   - `/assets/` 静态构建产物带 content-hash，开启 1 年强缓存（`max-age=31536000, immutable`）；
   - 所有非物理文件路由均通过 `try_files $uri $uri/ /index.html` 回退，保障 React Router 浏览器端路由刷新不返回 404。

4. **容器安全与优雅停机**：
   - Dockerfile 使用 `exec` 形式启动 nginx 成为 PID 1 进程，确保正确接收与透传 SIGTERM 信号；
   - 部署清单配置 `lifecycle.preStop` 钩子（`sleep 5s`），在 Endpoints 摘除完成前平滑处理剩余请求；
   - 适配 `readOnlyRootFilesystem: true`，将临时缓存目录挂载至 `emptyDir`。

5. **纯静态零状态服务**：
   - 前端无需连接数据库或后端中间件，清单中不包含 ConfigMap、Secret、HPA、PDB 等复杂资源，保持极简与免运维。

## 快速校验

```bash
# 1. 验证 nginx.conf 语法（需本机具备 Docker 或 nginx）
docker run --rm -v $(pwd)/deploy/nginx.conf:/etc/nginx/nginx.conf:ro nginx:1.27-alpine nginx -t

# 2. 校验 k8s 清单语法（服务端 dry-run）
kubectl apply --dry-run=server -f deploy/k8s/
```
