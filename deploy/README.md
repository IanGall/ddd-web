# ddd-web 部署配置（deploy）

本目录包含管理端前端仓 `ddd-web` 的容器镜像构建、nginx 静态托管以及 Kubernetes 部署清单。

## 目录结构

```text
ddd-web/
├── .dockerignore       # 构建上下文排除清单（node_modules/dist/.agy-staff 等，见 §6）
└── deploy/
    ├── build.sh        # 镜像构建：架构自适应（跟随 Docker 服务端）+ buildx，单平台 --load
    ├── deploy-local.sh # 一键运维入口：deploy / status / logs / restart / clean
    ├── Dockerfile      # 多阶段构建：node 编译打包 → nginx 托管静态产物
    ├── nginx.conf      # 全局 nginx 配置（SPA fallback + 资源长效缓存 + 安全响应头）
    ├── README.md       # deploy 目录说明与快速指引（本文档）
    └── k8s/
        ├── deployment.yaml # 工作负载清单（2 副本、HTTP GET / 探针、优雅停机、只读根文件系统兼容）
        ├── service.yaml    # ClusterIP 80 端口服务定义
        ├── ingress.yaml    # apisix Ingress：与网关共用 host (gateway.example.com)，前端只声明 /（/api 由网关 Ingress 认领，同源无 CORS）
        └── README.md       # k8s 部署顺序、路由设计与注意事项
```

## 一键部署（推荐入口）

```bash
# 默认动作 deploy：构建镜像 → apply 清单 → 收副本数 → 按需滚动更新 → 等就绪 → 打印状态
bash deploy/deploy-local.sh

bash deploy/deploy-local.sh status            # Deployment/Pod/Ingress/Service + 最近事件
bash deploy/deploy-local.sh logs [--follow]   # nginx 访问/错误日志
bash deploy/deploy-local.sh restart           # 强制滚动重启
bash deploy/deploy-local.sh clean             # 只删 ddd-web 的 Deployment/Service/Ingress
bash deploy/deploy-local.sh clean --images    # 连本地镜像一起删
```

常用参数：

| 参数 | 说明 |
|------|------|
| `--k8s-namespace NAME` | 命名空间，默认 `ian-ddd`（等价别名 `--namespace`） |
| `--replicas N\|keep` | 本地副本数，默认 `1`；`keep` = 按清单的 2 副本 |
| `--skip-build` | 跳过镜像构建，直接用本地已有镜像 |
| `--images` | `clean` 时连本地镜像一起删（下次部署会重新构建） |
| `--follow` / `-f` | `logs` 时持续跟随 |

幂等：脚本把镜像的「层摘要 + 镜像配置」摘要写成 Deployment 的 Pod 模板注解 `deploy-local.hash`，
内容没变就跳过滚动更新，重复执行安全（不能用镜像 ID 当判据——BuildKit 每次都会重写 config 的 `created` 时间戳）。

**`clean` 的作用域与边界**：`ian-ddd` 命名空间是与后端 `ian-ddd-auth` / `ian-ddd-gateway` 共享的，
所以本脚本只按名字删 `ddd-web` 自己的 Deployment/Service/Ingress，**不带 `--all`，也不提供 `--purge`**；
删命名空间会连带停掉后端服务。同理，修复「接口 404」类问题时要先分清 `/api`（网关 Ingress）与 `/`（前端 Ingress）。

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

## 6. 构建上下文与 `.dockerignore`

构建上下文是**仓库根**（`deploy/Dockerfile` 里的 `COPY package.json …`、`COPY deploy/nginx.conf` 都相对仓根解析），因此仓根的 `.dockerignore` 是必需的，排除 `node_modules`、`dist`、`.agy-staff`、`.git`、`coverage` 等：

- **不带宿主依赖进容器**：宿主 `node_modules` 是 macOS 平台的原生二进制，覆盖容器内 pnpm 装好的 linux 依赖会直接踩坑；
- **保证部署脚本幂等**：`.agy-staff`（工具任务日志）等目录每次都在变，会让 `COPY . .` 层缓存失效、镜像内容摘要每次都判为「变了」，导致重复滚动更新。

## 快速校验

```bash
# 1. 部署脚本与构建脚本语法
bash -n deploy/build.sh deploy/deploy-local.sh

# 2. 验证 nginx.conf 语法（需本机具备 Docker 或 nginx）
docker run --rm -v $(pwd)/deploy/nginx.conf:/etc/nginx/nginx.conf:ro nginx:1.27-alpine nginx -t

# 3. 校验 k8s 清单语法（服务端 dry-run）
kubectl apply --dry-run=server -n ian-ddd -f deploy/k8s/
```
