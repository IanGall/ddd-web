# 管理端前端系统（ddd-web）

## 1. 仓定位

`ddd-web` 是基于 React + TypeScript + Vite + Ant Design (v5) 构建的独立管理端单页应用（SPA）。

作为 `ian-ddd-gateway` 网关管理端接口（`/api/admin/**`）的权威第一方消费者，本仓负责管理端认证与登录、有效权限引导、RBAC 用户/角色/权限管理、渠道凭证管理以及我的会话管理等能力的前端呈现。

## 2. 与后端仓的关系

- **同级目录**：在开发工作区中，`ddd-web` 与后端核心仓 `ddd`、脚手架仓 `ddd-scaffold` 保持同级检出（`~/IdeaProjects/ian-ddd/ddd-web`）。
- **工具链隔离**：独立仓隔离 Java/Maven 与 Node/pnpm 工具链，前端构建与提交不触发后端全量构建（Checkstyle、JaCoCo 门禁等）。
- **契约权威**：接口契约以 `docs/plans/admin-web-plan.md` 为唯一事实来源，前端严格对齐网关 REST 契约。

## 3. 本地启动与开发

### 环境要求

- Node.js：`mise.toml` 中为 `lts`（当前解析为 `24.21.0`）
- pnpm：`mise.toml` 中为 `latest`（当前解析为 `12.4.1`）
- TypeScript：TS 因 typescript-eslint 尚不支持而暂锁 6.0.3，待其支持 TS ≥7.1 后放开。
- Vitest：版本写 `^5.0.0` 而非更高的补丁号。pnpm 12 默认启用 `minimumReleaseAge` 供应链隔离（新发布的包需满 24 小时才允许安装），写成 `^5.0.0` 时 pnpm 会自动选中「已过隔离期的最新版」；若把下界抬到刚发布的版本，会因为候选全被隔离而安装失败。**不要为了「用上最新补丁」去放宽这个下界或添加 `minimumReleaseAgeExclude`。**

如果已安装 [mise](https://mise.jdx.dev/)，进入目录后会自动切换对应版本：

```bash
mise install
```

### 常用命令

```bash
# 安装依赖
pnpm install

# 启动本地开发服务（访问 http://localhost:5173 或 http://127.0.0.1:5173）
pnpm dev

# 执行 TypeScript 类型检查
pnpm typecheck

# 代码规范检查
pnpm lint

# 代码格式检查 / 自动格式化
pnpm format
pnpm format:fix

# 单元测试（Vitest）
pnpm test

# 生产构建
pnpm build
```

## 4. 网络架构与代理机制

### 开发期代理（Dev Proxy）

- **开发服务端口与主机绑定**：端口固定为 `5173`（**禁止使用 80 端口**，宿主机 80 端口已被 OrbStack 占用，且 macOS 绑定 1024 以下特权端口需要 root 权限）。显式指定 `server.host: '127.0.0.1'` 绑定 IPv4，避免 Vite 默认仅监听 IPv6（`[::1]`）导致 `http://127.0.0.1:5173` 访问失败，同时避免设为 `true` 将服务暴露至局域网。
- **Vite 代理**：`vite.config.ts` 中配置 `server.proxy`，将 `/api` 前缀的所有请求代理转发至本地网关服务 `http://127.0.0.1:8092`（`changeOrigin: true`）。
- **无 CORS 限制**：浏览器发出的请求为开发服务器同源请求，完全绕开网关未开启 CORS 的限制。

### 生产期 Ingress 分流（Production Ingress Routing）

生产环境下前端静态构建产物（`dist/`）由 `nginx:alpine` 托管。
在 Kubernetes 集群中，前端与后端网关共用同一个 Host（`gateway.example.com`），由 Ingress 控制器（如 APISIX）按请求路径协同分流：

- 前端 Ingress 仅认领 `/` 路径，路由至前端静态托管服务 `ddd-web:80`
- 后端网关 Ingress 认领 `/api` 路径，路由至后端网关服务 `ian-ddd-gateway:8092`

前端 Ingress 绝不重复声明 `/api`，避免在同一 host + 同一 path 下产生后端路由冲突。
由于前端页面与 API 在浏览器视角下完全同源（相同 Schema、Domain 与 Port），生产环境同样无需网关开启 CORS。

## 5. 核心安全约束

1. **令牌仅存内存**：`accessToken` 与 `refreshToken` 仅保存在 Zustand 内存状态中，严禁写入 `localStorage`、`sessionStorage`、URL 或日志。
2. **Refresh Token 单飞串行化**：后端对于同一 Refresh Token 的并发请求视为重放并撤销整个设备会话族。前端在 401 触发时通过互斥锁/共享 Promise 确保全局同一时刻仅发起一次刷新请求，其余并发请求排队等待刷新结果后重放。
3. **设备指纹**：`deviceId` 仅在内存中生成一次并复用，会话关闭即销毁。
