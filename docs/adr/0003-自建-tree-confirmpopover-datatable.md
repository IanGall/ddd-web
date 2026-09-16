# ADR 0003: 自建 Tree、ConfirmPopover 与 DataTable 的架构决策

## 状态

已采纳（日期：2026-09-16）

## 背景

在从 Ant Design 全面迁移到 shadcn/ui + Base UI 的过程中，发现官方组件库缺失三个核心交互组件：

1. 带多选框与层级联动的权限树（原依赖 antd `Tree`）；
2. 行内操作二次确认浮层（原依赖 antd `Popconfirm`）；
3. 具备服务端分页、层级展开与固定列的高性能表格（原依赖 antd `Table`）。

如果为这三个组件分别引入独立的三方库，会导致工程体积膨胀、样式系统（Tailwind v4）割裂、暗色模式难以无缝衔接。因此决定在无头原语之上自主封装这三个核心组件。

## 决策

### 1. Tree 组件自建与无障碍规范

- **业务定位**：替代全仓唯一一处 antd `Tree checkable` 场景——`src/pages/rbac/roles/RolePermissionModal.tsx` 的权限分配树。
- **层级联动对齐**：父子节点联动逻辑严格对齐 antd 默认行为（`checkStrictly=false`）：
  - 勾选父节点自动级联勾选所有已启用的子孙节点；
  - 子节点部分勾选时，父节点进入半选状态（indeterminate）；
  - 提交数据时，由消费方将已全选项与半选项合并处理（`finalKeySet = new Set([...checkedKeys, ...halfCheckedKeys])`），后端 RBAC 鉴权依赖半选父节点以保障菜单层级在前端导航与权限树上的完整可见性。
- **键盘导航遵循 WAI-ARIA 规范**：
  - **刻意不声称与 Ant Design 逐位一致**：Ant Design 依赖已被彻底移除，代码层面无法也不应去确证其非标的 Space/Enter 历史实现。本实现严格遵循 WAI-ARIA Tree View 标准规范。
  - **Roving Tabindex（单 Tab 停点）**：键盘焦点管理通过 roving tabindex 实现，`tabIndex={0}` 仅落在当前活动节点（`activeKey`）对应的 `<li role="treeitem">` 上；内部的展开/折叠 `<button>` 与 `<Checkbox>` 均显式设置为 `tabIndex={-1}`。
    - **改进效果**：改造前每个节点内部包含 2 个 Tab 停点，展开 20 个权限节点需要按 40+ 次 Tab 键才能穿透整个树；改造后**全树仅有 1 个全局 Tab 停点**，Tab 聚焦树后由方向键接管导航。
  - **按键语义映射**：
    - `ArrowDown` / `ArrowUp`：在可见节点序列中下移/上移焦点；
    - `ArrowRight`：若当前节点可展开且处于折叠态，执行展开（焦点不动）；若已展开，将焦点移至其首个子节点；若为叶子节点则无操作；
    - `ArrowLeft`：若当前节点已展开，执行折叠（焦点不动）；若已折叠且存在父节点，将焦点移至父节点；
    - `Home` / `End`：焦点直接跳转至第一个/最后一个可见节点；
    - `Space`（空格）：仅切换当前节点的勾选状态，不改变展开/折叠状态；
    - `Enter`（回车）：若存在子节点，仅切换当前节点的展开/折叠状态，不改变勾选状态。
  - **坚决不加 `aria-activedescendant`**：本项目采用的是真实的 DOM 焦点移动与 roving tabindex，WAI-ARIA 规范指出这与 `aria-activedescendant` 属于互斥机制；若两者并存，读屏软件会对同一次焦点变更进行重复播报，破坏无障碍体验。
  - **Space 双切换踩坑与防御机制**：
    - Base UI 的 `Checkbox` 组件是在 `keyup` 事件阶段派发 `click` 以切换勾选，且其内部逻辑仅检查同一次 `keyup` 事件的 `defaultPrevented`。如果在父级 `li` 的 `keydown` 处理函数中执行 `event.preventDefault()`，根本拦截不到后续原生触发的 `keyup`；
    - 此外，Base UI 内部的 `mergeProps` 会将组件自身 handler 排在最前，外部传入的 `onKeyUp` 同样无法提前拦截；
    - **可靠工程解法**：通过 `tabIndex={-1}` 确保焦点永远不可能直接落在 Checkbox 控件上，并在 `li` 的 `handleKeyDown` 处理函数首行加入目标校验：`if (event.target !== event.currentTarget) return;`。当焦点在 `li` 上按空格时，由自建逻辑统一派发 `handleToggleCheck`，杜绝一次按键触发两次翻转的 Bug。

### 2. ConfirmPopover 自建（为什么自建而不是引三方）

- **自建理由**：基于 `@/components/ui/popover`（Base UI Popover 原语）与 `LoadingButton` 即可用数十行代码实现高内聚的确认气泡，相比引入体积庞大的三方弹出层，能做到零外部样式侵入、完全复用全站 OKLCH 主题配色，且具备完整的异步操作 loading 锁。
- **纯派生状态防御**：在 `disabled` 为 true 时必须关闭浮层。此逻辑严禁写成 `useEffect(() => { if (disabled) setOpen(false); }, [disabled])`，而必须写为纯派生状态：`const effectiveOpen = open && !disabled;`，并直接传给 `<Popover open={effectiveOpen}>`。这是因为本仓 ESLint 配置将 `react-hooks/set-state-in-effect` 设为 error，纯派生状态杜绝了解析副作用与多余渲染。

### 3. DataTable 自建（为什么自建与 TanStack Table v9 适配）

- **自建理由**：数据表格是管理系统使用频度最高的组件，引入三方一体化表格库往往带来大量难以定制的内联样式，无法与 Tailwind v4 及自维护设计系统深度协同。选用无头（headless）的 TanStack Table 搭配 `src/components/ui/table`，能获得对 DOM 结构、分页器布局与单元格样式的完全控制。
- **TanStack Table v9 破坏性变更适配**：
  - 采用 `@tanstack/react-table` v9 版本。相比 v8，v9 是一次底层重大重构：
    1. 核心 Hook 由 `useReactTable` 重命名为 `useTable`；
    2. 必须显式传入 `features` 配置（使用 `tableFeatures({ ...stockFeatures, expandedRowModel: createExpandedRowModel() })` 初始化功能特性集）；
    3. 组件渲染统一读取 `table.state`；
    4. 实测验证：v9 的服务端分页属性 `manualPagination` 与 `pageCount` 沿用了 v8 的命名。
- **分页与索引对齐**：对外接口统一维持业务直觉的 **1-based `pageNum`**（内部在初始化与变更时自动换算为 TanStack Table 所需的 `pageIndex = Math.max(0, pageNum - 1)`）。
- **固定列透视防御与实测数据**：
  - 右侧操作列固定依赖 `columnPinning.end`，表头和单元格通过 CSS 类 `sticky end-0` 结合 **实心背景 `bg-background`** 实现；
  - 若未声明实心背景，横向滚动时被卷入底部的列内容会直接在固定列文本下方透视显示，造成文字重叠；
  - **真机实测数据**：在 1200px 宽表真机滚动核对中，滚动前后右侧操作列的绝对 `right` 坐标仅产生 0.33px 的微弱亚像素舍入差，而其余数据列向左平移了 345px（精确等于容器的 `scrollLeft` 上限），固定列在视觉与交互上纹丝不动。

## 理由

- **完全掌握渲染控制权**：自建组件与项目无头架构、Tailwind v4 及暗色模式浑然一体，消除外部样式的污染。
- **无障碍与工程鲁棒性**：严格落实 WAI-ARIA 规范与 React 19 最佳实践，避免历史遗留问题。

## 后果（含代价与已知偏离）

- **代价 1：组件演化维护成本完全自担**：自建组件的所有边界测试、键盘兼容性与性能调优均由本项目团队承担，缺乏大型开源社区的即时修复支持。
- **代价 2：权限树调用方需显式处理半选键**：Tree 组件本身为纯受控组件，调用方在提交表单时必须谨记将 `halfCheckedKeys` 与 `checkedKeys` 做并集提交，否则会造成后端层级权限不完整。
- **代价 3：表格功能需渐进增补**：若未来需要列宽拖拽、多列复杂排序或虚拟滚动，需要继续在 `useDataTable.ts` 中基于 TanStack Table 特性集进行增量适配。
- **已知偏离**：Tree 的键盘行为遵循 WAI-ARIA 国际标准，未逐像素、逐键位模拟 antd 的私有实现细节。

## 相关文件

- `src/components/Tree/index.tsx`：自建无障碍树组件
- `src/test/tree.test.tsx`：包含 14 项用例的 Tree 行为与键盘导航单测
- `src/pages/rbac/roles/RolePermissionModal.tsx`：Tree 在权限分配业务中的唯一使用点
- `src/components/ConfirmPopover/index.tsx`：自建二次确认气泡
- `src/test/confirm-popover.test.tsx`：ConfirmPopover 行为与异步单测
- `src/components/DataTable/index.tsx`：自建通用服务端表格组件
- `src/components/DataTable/useDataTable.ts`：TanStack Table v9 核心配置与状态封装
- `src/test/data-table.test.tsx`：DataTable 分页与固定列单测
- `src/components/ui/table.tsx`：底层 Table 样式基座
- `src/components/ui/popover.tsx`：底层 Popover 交互原语
- `src/components/ui/checkbox.tsx`：底层 Checkbox 交互原语
