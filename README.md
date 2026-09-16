# 管理端前端系统（ddd-web）

## 1. 仓定位

`ddd-web` 是基于 React + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui 构建的独立管理端单页应用（SPA）。

作为 `ian-ddd-gateway` 网关管理端接口（`/api/admin/**`）的权威第一方消费者，本仓负责管理端认证与登录、有效权限引导、RBAC 用户/角色/权限管理、渠道凭证管理以及我的会话管理等能力的前端呈现。

**架构决策记录（ADR）与术语表见 [`docs/`](docs/)**：`docs/adr/` 记录「为什么这样定、代价是什么、下次改要注意什么」；[`docs/glossary.md`](docs/glossary.md) 收录本仓特有术语。改动样式/组件前建议先读 `docs/adr/`。

## 2. 与后端仓的关系

- **同级目录**：在开发工作区中，`ddd-web` 与后端核心仓 `ddd`、脚手架仓 `ddd-scaffold` 保持同级检出（`~/IdeaProjects/ian-ddd/ddd-web`）。
- **工具链隔离**：独立仓隔离 Java/Maven 与 Node/pnpm 工具链，前端构建与提交不触发后端全量构建（Checkstyle、JaCoCo 门禁等）。
- **契约权威**：接口契约以**工作区根目录**的 `../docs/plans/admin-web-plan.md` 为唯一事实来源（该文件**不在本仓内、也不在任何 git 仓内**，与 `ddd`/`ddd-scaffold` 共享同一份），前端严格对齐网关 REST 契约。

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

# 构建镜像并一键部署到本地 k8s（deploy | status | logs | restart | clean，见 deploy/README.md）
bash deploy/deploy-local.sh
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
4. **主题偏好除外条款**：`localStorage` 中**仅允许** `ddd-web-theme` 一个键（值为 `light` / `dark` / `system`）。主题偏好不是敏感数据，与第 1 条「令牌仅存内存」的约定**不冲突**；但**严禁**把访问令牌、`channelSecret`、`deviceId` 或任何凭证与该键同源持久化。

## 6. 样式与主题约定

### 6.1 技术选型

- **Tailwind CSS v4 + shadcn/ui**：style 为 `base-nova`、底层原语是 **Base UI**（`@base-ui/react`）而非 Radix——shadcn 自 2026-07 起默认 Base UI，Radix 仍受支持但本项目 UI 层全新故取 Base UI。
- **组件生成物**：生成物位于 `src/components/ui/`，由 `pnpm dlx shadcn@4.21.0 add <name>` 生成。
- **生态选型**：图标 `lucide-react`、提示 `sonner`、表格 `@tanstack/react-table` (v9)、表单 `react-hook-form` + `zod` (v4)。

### 6.2 三条规则

1. **颜色只来自主题变量**：一律用 `bg-background` / `text-foreground` / `text-muted-foreground` / `border-border` / `bg-card` / `bg-primary` / `text-destructive` / `bg-muted` / `bg-sidebar-*` 等；禁止颜色字面量与 Tailwind 调色板色类。
2. **src/components/ui/ 是生成物，不手改**：需要扩展能力时在 `src/components/<Name>/` 包一层（范例：`LoadingButton`、`ClearableSelect`、`ConfirmPopover`、`TagInput`、`StatusBadge`、`Tree`、`DataTable`、`ThemeToggle`）。**包括「改不了默认行为」的情况也在消费侧解决**——例如 `SelectContent` 的 `alignItemWithTrigger` 默认 `true`（弹层会压住触发器），本仓在仅有的两处消费点显式传 `false`。
3. **业务语义色只走 StatusBadge 的语义变体**（12 个）：禁止在页面里写颜色类；**禁止用颜色名命名变体**（同一颜色承载不同语义时必须拆开，例如 green 拆成 `type-menu` 与 `current`）。

### 6.3 红线（已脚本化，见 scripts/check-style.sh，可 pnpm check-style）

1. **颜色字面量工具类**：`src` 下匹配 `(bg|text|border|from|to)-\[#` 的文件/行数须为 0。
2. **antd 残留**：`src`（含 `*.ts`/`*.tsx`）与 `package.json` 中匹配 `antd` 或 `@ant-design` 须为 0。
3. **`var(--ant-`**：须为 0（antd 时代的跨体系引用，已废）。
4. **`asChild` 作为独立单词**：须为 0（Base UI 用 `render`；匹配时用 `grep -rnw`，避免误命中 `hasChildren`）。
5. **`@radix-ui`**：须为 0（本仓用 Base UI，不用 Radix）。
6. **十六进制颜色字面量**：除 `src/lib/palette.ts` 外，`src` 下十六进制颜色字面量（`#[0-9a-fA-F]{3,8}`）须为 0（显式排除 `src/test/` 断言）。
7. **生成物补丁守位**：`src/hooks/use-mobile.ts` 必须包含真实调用 `return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);`。防止 `shadcn add --overwrite` 回退我们的补丁——回退后 `pnpm lint` 也会失败，但那条报错不指向真正原因，故用这条更明确的守卫。

### 6.4 例外

- `src/lib/palette.ts` 是唯一允许出现颜色字面量的文件（`DATA_PALETTE` 的 light/dark 双值 + `hexToRgba` + `resolveDataAccent`），仅用于数据可视化。
- `StatusBadge` 内部允许用 Tailwind 调色板类表达状态色（shadcn 主题里没有状态色）。
- `src/components/ui/scroll-area.tsx` 曾删掉一行未被使用的 `import * as React`，否则 TS6133 会让 `pnpm build` 失败。
- `src/hooks/use-mobile.ts` 已手工改为 `useSyncExternalStore`（避免 `react-hooks/set-state-in-effect`）；若被 shadcn 覆盖需重新应用。
- **`.dark` 下成对覆写 `--sidebar-primary` 与 `--sidebar-primary-foreground`**：注册表暗色值是紫色 `oklch(0.488 0.243 264.376)`，会让品牌 logo 方块与用户头像变紫，故改为与全局主色一致的中性值。**必须成对改**——注册表的暗色前景近白，只改主色会造成白底白字。这是对注册表默认值的**刻意偏离**（详见 `docs/adr/0004`）。
- **Sonner 的 `theme` 由 `App.tsx` 以 prop 覆盖传入**（读 `resolvedTheme`），因此**不改** `src/components/ui/sonner.tsx`——它的 `{...props}` 在 `theme={theme}` 之后展开，外部 prop 会覆盖内部值。

> 上述偏离**严格收敛于**：`ui/scroll-area.tsx` 一处、`hooks/use-mobile.ts` 一处、`.dark` 的两个变量、以及 `App.tsx` 传 `Toaster` 的 `theme`。不存在第 3 处未经记录的手改（可用 `grep -rn "//.*[一-龥]" src/components/ui/` 复核生成物里没有我们的注释）。

### 6.5 主题层落点

- **唯一主题源** = `src/index.css`：三条 import（`tailwindcss` / `tw-animate-css` / `shadcn/tailwind.css`）+ `:root` 与 `.dark` 的 OKLCH 变量 + `@theme inline` 颜色映射 + `@layer base`。
- **`@theme inline` 的 `--color-*` 映射块必须自己维护**：`shadcn/tailwind.css` 只提供 `data-*` 变体与若干 `@utility`，**不含颜色映射**，删掉它 `bg-background` 这类类会全部失效。
- **`@custom-variant dark (&:is(.dark *))` 必须保留**：Tailwind v4 的 `dark:` 默认走 `prefers-color-scheme`；不改成类变体时，用户系统为深色模式会让 `dark:` 工具类生效而 `:root` 变量不变，配色半深半浅。
- **换肤只改 `:root` 与 `.dark`**。
- **深色模式接线**：`next-themes` 的 `ThemeProvider(attribute="class")` 位于 `QueryClientProvider` 与 `TooltipProvider` 之间；`<Toaster>` 的 `theme` 跟随 `resolvedTheme`。
- **防闪烁脚本必须手写**（`index.html` 的 `<head>`、模块入口之前）：next-themes 注入的那个脚本是随 React 渲染插入的，在 SPA 里**首帧之后**才执行，起不到作用（它为 Next.js SSR 设计），且 `scriptProps` 无法关闭注入。
- **主题存储键在两处硬编码**：`src/lib/theme.ts` 的 `THEME_STORAGE_KEY` 与 `index.html` 内联脚本里的 `'ddd-web-theme'` 字符串——脚本无法 `import`，**改一处必须同步改另一处**。
- **变量完整性有守卫**：`src/test/theme-vars.test.ts` + `src/test/fixtures/neutral-inline-colors.light.json` 断言 `:root`（32 个，含 `--radius`）、`.dark`（31 个，**刻意不含** `--radius`，继承同值）、`@theme inline`（31 条 `--color-*`）与注册表快照一致。**改 `src/index.css` 的变量块后须同步更新快照。** 这条守卫防的是一起真实事故：`:root` 曾漏 `--radius` → `--radius-lg: var(--radius)` 解析为空 → **全站圆角归零**，而当时 189 个用例全绿、`pnpm build` 也通过（jsdom 不加载 Tailwind，构建成功不代表 CSS 变量有值）。
- **新增/修改数据强调色**必须同步 `src/test/palette.test.ts` 里的对比度（对暗底 ≥ 4.5）与色相（与浅色值相差 ≤ 20°）守卫。
- 决策背景见 `docs/adr/0004-主题源与暗色接线.md`。

### 6.6 基础设施约定

- **禁止把 `src/index.css` 改回 antd 时代**的 `@layer theme, base, antd, ...` + `<StyleProvider layer>` 方案。
- **表单规范**：**Base UI 下没有 Form 组件**，必须用 `Controller` + `Field` 家族；约定 `data-invalid` 加在 `<Field>`、`aria-invalid` 加在控件、错误用 `<FieldError errors={[fieldState.error]} />`。
- **生成物格式化隔离**：`src/components/ui/` 已加入 `.prettierignore`（vendored 生成物），因此新增 shadcn 组件不会让 `pnpm format` 变红。
- **样式回归无法用 jsdom 测试发现**：vitest 配置独立于 `vite.config.ts`、不挂 Tailwind 插件、也不套 Provider，故测试里 Tailwind 与主题都不生效——测试只能守住行为与文案，样式必须真机核对。
- **改这几样必须先真机核对**：`SidebarProvider` 的 `collapsible`、`--sidebar-width`、响应式断点前缀（`md:`/`lg:` 等）。原因是 jsdom 里 `hidden`/`md:block` 这类前缀与 `matchMedia` 都不真实生效（`src/test/setup.ts` 的 stub 恒返回 `matches: false`），单测通过并不代表窄屏正确。同理，改 `collapsible` 会让 `src/hooks/use-mobile.ts` 的代码路径从「不可达」变成「被真实走到」。
- **安全约定保留**：访问令牌仅存内存、refresh 单飞、deviceId 内存化；**`channelSecret` 严禁进入任何持久化存储或日志**。

## 7. 已知问题

- **`/favicon.ico` 返回 404**：任何页面加载都会请求该路径并得到 404（`index.html` 未声明图标，`nginx.conf` 也未提供）。属于外观层面的小瑕疵、不影响功能。处理方式二选一：① 提供一个真实的图标资源并在 `index.html` 用 `<link rel="icon">` 声明；② 若暂不需要图标，在 `index.html` 加 `<link rel="icon" href="data:,">` 以消除该请求。**本项目尚未提供品牌图标资产，故此项留待决定。**
