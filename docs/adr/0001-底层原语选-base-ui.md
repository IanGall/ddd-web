# ADR 0001: 底层原语选型 Base UI（@base-ui/react）

## 状态

已采纳（日期：2026-09-16）

## 背景

在进行管理端前端系统从 Ant Design（v6）向现代无样式组件库迁移的架构决策中，需要为 shadcn/ui 选定底层原语。
shadcn/ui 自 2026-07 起新项目默认采用 **Base UI**（`@base-ui/react`）而非传统的 Radix UI。虽然 Radix UI 仍受官方长期支持且未废弃，但本项目 UI 层属于从零全新落地，没有历史 Radix 组件与代码资产包袱，因此具备直接采用新一代底层原语的条件。
在工程配置中，`components.json` 显式声明了 `"style": "base-nova"`，代表生成的 UI 组件底层全部直接 import `@base-ui/react/*` 原语模块。

## 决策

全面采用 Base UI（`@base-ui/react`）作为全仓底层交互原语，禁止在依赖与源码中引入 `@radix-ui/*`。
针对迁移与开发过程中踩到的具体差异，确立以下三条强制性实操约定：

1. **组合模式使用 `render` prop，禁止使用 `asChild`**：
   Base UI 放弃了 Radix 的 `asChild`（通过 `React.cloneElement` 隐式传递 props 和 ref 的黑盒模式），改为采用更加显式、类型更安全的 `render` prop（例如 `<PopoverTrigger render={<Button variant="outline" />} />`）。
   门禁守卫：`scripts/check-style.sh` 第 4 条红线专门通过词边界 `grep -rnw asChild` 进行全局扫描（必须使用 `-w` 词边界，否则会误命中业务变量如 `hasChildren`）。

2. **表单体系采用 Controller + Field 家族，摒弃虚拟 Form 根组件**：
   Base UI 未提供原生的 `Form` 原语容器。本项目表单体系严格遵循 `react-hook-form` 的 `Controller` + `@/components/ui/field` 家族（`Field`、`FieldLabel`、`FieldError`、`FieldGroup` 等）。
   统一规范：
   - 字段容器 `<Field>` 绑定 `data-invalid={fieldState.invalid}`，驱动整体错误样式与状态传递；
   - 具体输入控件（如 `<Input>`、`<Textarea>`）绑定 `aria-invalid={fieldState.invalid}`，确保无障碍可访问性；
   - 错误文案统一通过 `<FieldError errors={[fieldState.error]} />` 进行渲染。

3. **`SelectContent` 默认行为在消费侧覆写，不改动生成物**：
   Base UI 的 `SelectContent` 默认属性为 `alignItemWithTrigger={true}`（模仿操作系统原生 `<select>` 行为，下拉弹层会与当前选中项对齐并盖住触发器，在 DOM 表现为 `data-side="none"`）。
   本项目决定**不手改生成物** `src/components/ui/select.tsx`，而是在**消费侧显式传入 `alignItemWithTrigger={false}`**，使下拉弹层始终在触发器下方展开（带 `data-side="bottom"` 等方向属性）。全仓仅两处直接渲染 `<SelectContent>`：
   - `src/components/ClearableSelect/index.tsx`（业务下拉筛选通用包装件）
   - `src/components/DataTable/index.tsx`（表格底部分页器每页条数选择器）

## 理由

- **架构前瞻性**：顺应 shadcn/ui 官方生态发展演进，避免新建系统在起点就背负上一代原语（Radix）的技术负债。
- **类型安全与行为可预测性**：Base UI 的 `render` prop 传递模式避免了 `cloneElement` 带来的不可预期 prop 覆盖问题与 ref 转发断裂问题。
- **生成物干净度**：在消费层包装而非手改生成物默认参数，保证了未来能够平滑同步上游组件模板更新。

## 后果（含代价与已知偏离）

- **代价 1：开发者习惯重塑**：开发者从 Radix 或 antd 迁移过来时，容易习惯性写出 `asChild` 或寻找 `<Form>`，需依赖 `scripts/check-style.sh` 的红线门禁进行拦截。
- **代价 2：表单模板代码稍繁琐**：没有统一的 `<Form.Item>` 自动化注入机制，每个表单项都需要显式绑定 `Controller`、`<Field data-invalid>`、`<FieldLabel>`、控件与 `<FieldError>`。
- **代价 3：SelectContent 消费侧注意义务**：后续新增页面或封装组件若直接引入 `SelectContent`，必须谨记手动传递 `alignItemWithTrigger={false}`，否则会出现下拉弹层遮挡触发器的交互不一致。
- **已知偏离与后续修改约束**：当需要调整组件默认行为时，**必须在消费侧通过 `src/components/<Name>/` 包一层，严禁修改 `src/components/ui/` 下的生成物代码**。

## 相关文件

- `components.json`：配置 `style: base-nova`
- `package.json`：声明 `@base-ui/react` 依赖，无 `@radix-ui`
- `scripts/check-style.sh`：第 4 条红线（`asChild` 检查）与第 5 条红线（`@radix-ui` 检查）
- `src/components/ui/field.tsx`：表单字段容器与错误提示原语
- `src/components/ui/select.tsx`：Base UI 下拉菜单基础生成物
- `src/components/ClearableSelect/index.tsx`：消费侧覆写 `alignItemWithTrigger={false}`
- `src/components/DataTable/index.tsx`：消费侧覆写 `alignItemWithTrigger={false}`
