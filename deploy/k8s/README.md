# 前端管理端（ddd-web）k8s 部署

本目录是 `ddd-web` 的 Kubernetes 清单（原生 YAML，`kubectl apply -f` 直接使用）。
命名空间刻意**不写进清单**，由 `kubectl apply -n <namespace>` 决定。

| 文件 | 内容 |
| `deployment.yaml` | 2 副本、HTTP 80、`/` 探针（200）、优雅停机、只读根文件系统 + emptyDir |
| `service.yaml` | ClusterIP，`http 80` |
| `ingress.yaml` | ingressClassName: apisix，与网关共用 host (`gateway.example.com`)：前端只认领 `/`（`/api` 由网关 Ingress 认领） |

---

## 1. 前置：构建镜像

在 `ddd-web` 仓库根目录执行：

```bash
docker build -t system/ddd-web:1.0-SNAPSHOT -f deploy/Dockerfile .
```

- Dockerfile 采用多阶段构建：
  - 构建阶段：基于 `node:20-alpine`，启用 `corepack` 调用项目指定的 `pnpm` 执行打包，输出 `dist/`；
  - 托管阶段：基于 `nginx:1.27-alpine`，采用 `exec` 方式启动（PID 1，透传 SIGTERM 优雅停机），托管静态产物。

---

## 2. 部署顺序

与后端网关部署在同一个命名空间（如 `ian-ddd`）：

```bash
NS=ian-ddd
kubectl create namespace "$NS" --dry-run=client -o yaml | kubectl apply -f -

# 部署前端工作负载与入口
kubectl apply -n "$NS" -f deploy/k8s/deployment.yaml
kubectl apply -n "$NS" -f deploy/k8s/service.yaml
kubectl apply -n "$NS" -f deploy/k8s/ingress.yaml
```

核对清单语法与服务端校验：

```bash
kubectl apply --dry-run=server -n "$NS" -f deploy/k8s/
```

---

## 3. 对外暴露与路由设计

### 3.1 同 Host 路径分流（同源无 CORS）

管理端前端与后端网关共用同一个 host `gateway.example.com`，两端各自的 Ingress 按路径职责分离：

```text
                     ┌── Host: gateway.example.com ──┐
                     │                               │
       Ingress: ian-ddd-gateway              Ingress: ddd-web
             /api (Prefix)                      / (Prefix)
                     │                               │
                     ▼                               ▼
            ian-ddd-gateway:8092                 ddd-web:80
           (后端 API，严格鉴权)              (nginx 静态托管 + SPA fallback)
```

- **职责切分与冲突规避**：前端 Ingress 只声明 `/`，后端网关 Ingress（`ddd/ian-ddd-gateway/dev-ops/k8s/ingress.yaml`）只声明 `/api`。绝对不能在前端 Ingress 中声明 `/api`，否则两份 Ingress 在同一 host + 同一 path 上重复，由 Ingress Controller 调度命中哪个后端是不确定的。
- **同源优势**：前端页面与接口调用在浏览器侧同域名同端口，无需配置和处理跨域资源共享（CORS），后端网关无需对前端开放额外的 CORS 预检放行逻辑。
- **动静隔离**：网关的白名单（`GatewayAuthFilter`）仅接受 `/api/admin|app|external/**` 与 `/actuator/health`，不承载静态资源；前端静态资源（JS/CSS/图片/字体）完全由本仓独立的 nginx 提供。
- **前缀匹配分流**：依据 Ingress 路由规则，`/api` 请求由网关 Ingress 认领，其他路径（如 `/login`, `/rbac/users` 等前端路由及静态资源）统一落入前端 Ingress 的 nginx SPA fallback。

### 3.2 访问方式

1. 本地测试需在 `/etc/hosts`（或本地 DNS）配置域名解析指向 Ingress Controller 监听地址：
   ```text
   127.0.0.1  gateway.example.com
   ```
2. 浏览器直接访问：`http://gateway.example.com/`。

---

## 4. 关键架构与运维约定

### 4.1 探针与健康检查
- `readinessProbe` 与 `livenessProbe` 均探测 `HTTP GET /`（端口 80），nginx 必须正常返回 HTTP 200（返回 `index.html`）。
- 启动探针（`startupProbe`）预留了启动裕度，防止容器调度冷启动时被存活探针误杀。

### 4.2 优雅停机
- Pod `terminationGracePeriodSeconds` 为 30s。
- 容器配置了 `lifecycle.preStop` 钩子（`sleep 5s`），确保 Pod 在被摘除 Service Endpoints 并从 Ingress Controller 同步注销后，才向 nginx 发送 SIGTERM。
- Dockerfile 使用 `exec nginx -g 'daemon off;'` 启动，使 nginx 成为 PID 1 进程，可直接响应并处理 SIGTERM 实现零丢失优雅停机。

### 4.3 只读根文件系统与权限控制
- 镜像开启 `readOnlyRootFilesystem: true`，防止运行时恶意修改静态文件。
- 临时文件目录（`/tmp`）、运行目录（`/var/run`）、nginx 缓存目录（`/var/cache/nginx`）均挂载为 `emptyDir`，并在 `nginx.conf` 中显式指定 `pid /tmp/nginx.pid;` 及 `*_temp_path /tmp/*`，避免只读文件系统引发启动崩溃。
- Container 仅赋予最小特权（`CHOWN`, `SETUID`, `SETGID`, `NET_BIND_SERVICE`），以支持 worker 进程降权运行及监听 80 端口。

### 4.4 刻意不做的事
1. **无 Secret / 无 ConfigMap**：前端是纯静态单页应用，无数据库连接或敏感中间件凭据，配置均在打包期决定。
2. **无 HPA / 无 PDB**：当前管理后台访问量稳定，双副本滚动更新足够满足高可用，暂无弹性伸缩与 Pod 中断预算需求。
3. **不配 TLS**：集群内统一保持 HTTP，TLS 证书在集群外层入口或反向代理网关统一终结。
