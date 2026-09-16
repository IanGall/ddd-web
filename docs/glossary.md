# 术语表与概念澄清（Glossary）

本文档收录 `ddd-web` 系统中在架构设计、样式规范与核心业务交互中具有特殊约定、容易引发混淆的关键概念与术语。

---

### 1. 语义色 variant（Semantic Color Variant）

- **指什么**：指 `src/components/StatusBadge/index.tsx` 中定义的 12 种状态徽章变体（如 `success`, `destructive`, `info`, `warning`, `cyan`, `builtin`, `processing`, `type-dir`, `type-menu`, `type-action`, `current`, `muted`）。
- **为什么这么定**：禁止在页面代码中直接拼装 Tailwind 颜色类；当同一种颜色（如绿色）服务于不同领域的业务概念时，必须在类型与定义上**彻底拆分不同变体名**（如将绿色拆分为权限类型的 `type-menu` 与当前会话指示的 `current`）。若合并为单一的 `green`，未来调整某项业务的视觉表达时必然会误伤另一项业务。

### 2. 菜单分组用 submenu 而非 group（Submenu over Group）

- **指什么**：侧栏多级菜单（如 RBAC 模块）采用基于 `Collapsible` 与 `SidebarMenuSub` 的可折叠子菜单实现，而不采用静态不可收起的 `SidebarGroup` 分组。
- **为什么这么定**：静态不可折叠的分组标题无法与顶栏全局搜索交互协同——顶栏在用户键入搜索词时会自动触发「匹配项全量展开」，若使用不可折叠的分组，搜索展开与日常折叠的交互状态将互相打架，造成布局割裂。

### 3. 权限 × 关键字两层过滤（Two-layer Filtering: Permission × Keyword）

- **指什么**：指 `src/layout/menuFilter.ts` 中的 `filterMenuItems` 单趟递归过滤机制。
- **为什么这么定**：严格遵循「安全权限优先于搜索匹配」原则——算法先判断当前用户是否具备该菜单/分组的 `permission` 权限，未授权项直接剔除；只有在已获授权的菜单树子集中，才继续按输入关键字匹配展示。确保未授权的敏感功能无论搜索词如何匹配，绝不会被用户看见或搜索到。

### 4. 数据强调色板（Data Accent Palette）

- **指什么**：指 `src/lib/palette.ts` 中定义的 `DATA_PALETTE`（包含 orange, teal, navy, amber 四色）及对应透明度常量 `DATA_ACCENT_BADGE_ALPHA`。
- **为什么这么定**：通用 UI 变量（OKLCH）主要表达背景、前景色与边界，无法满足控制台统计卡片与数据可视化的强对比强调需求。该色板提供 light/dark 双值定义（暗色模式下对比度均 ≥ 7.7:1），且是全仓唯一允许出现十六进制色值字面量的受控豁免区。

### 5. 口径 C（已作废）（Criterion C - Obsolete）

- **指什么**：Ant Design 时代遗留的样式边界规则，即「Tailwind 只管几何 / 颜色只来自 antd token / 交互件用 antd」。
- **为什么这么定**：随着 Ant Design 被彻底卸载，全仓底层全面切换为 Tailwind CSS v4 + Base UI 原语，旧的三条规则已整体废弃。此处保留条目作为历史沿革备忘，严禁任何代码继续沿用旧口径对样式进行反向改造。

### 6. 生成物（vendored）（Vendored Code / Artifacts）

- **指什么**：指通过 `pnpm dlx shadcn add` 命令生成并存放于 `src/components/ui/` 下的 35 个基础无样式组件。
- **为什么这么定**：确立「不手改生成物」的铁律。业务定制一律在 `src/components/<Name>/` 包装；生成物目录加入 `.prettierignore` 以防止每次更新或新增组件时破坏 CI 的 `pnpm format` 格式化门禁。

### 7. `useSearchForm` 的 `getValues` 返回浅拷贝（Shallow Copy on `getValues`）

- **指什么**：指自定义 hook `src/hooks/useSearchForm.ts` 中，`getValues` 方法实现为 `(): T => ({ ...values })` 而非直接返回内部 state 对象。
- **为什么这么定**：调用方在触发检索或向父组件传递查询参数时，容易对获得的表单对象直接进行属性修改或清理。返回浅拷贝隔离了对象引用，避免外部静默篡改内部表单状态，降低偶发 bug。

### 8. Tree 的「全树 1 个 tab 停点」（Single Tab Stop for Tree View）

- **指什么**：自建组件 `src/components/Tree/index.tsx` 遵循 WAI-ARIA Tree View 规范，通过 roving tabindex 将键盘焦点统一收敛在当前的 `<li role="treeitem">`（`tabIndex={0}`），树内的展开按钮和 Checkbox 均强制声明 `tabIndex={-1}`。
- **为什么这么定**：原生 Checkbox 与 Button 各自拥有独立的 Tab 停点，20 个节点的树形选择器在展开时会产生 40+ 个连续停点，极大地破坏全键盘用户的导航效率；单停点设计保证用户仅需 1 次 Tab 即可穿透整棵树，进入树后完全由方向键流转。

### 9. Base UI `render` prop（Render Prop Composition）

- **指什么**：Base UI 用于替代 Radix UI `asChild` 属性的底层元素组合范式（例如 `<PopoverTrigger render={<Button />} />`）。
- **为什么这么定**：Radix 的 `asChild` 依靠 `React.cloneElement` 在底层隐式穿透和合并属性，类型推导脆弱且容易引发 ref 丢失；Base UI 采用显式的 `render` prop，属性合并与组件层级清晰可控。全仓严禁出现 `asChild` 词汇。

### 10. Refresh Token 单飞串行化（Refresh Token In-flight Serialization）

- **指什么**：指 `src/api/client.ts` 中针对 401 响应触发的刷新令牌重放保护机制。
- **为什么这么定**：网关安全策略要求同一 Refresh Token 在并发重放时直接销毁整组会话。前端通过全局互斥 Promise 确保并发 401 请求时仅发出一次刷新请求，其余请求排队等待该 Promise 决议后直接重放，避免合法用户因界面并发加载被错误踢下线。
