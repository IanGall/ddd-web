#!/usr/bin/env bash
set -euo pipefail

# 确保以项目根目录为基准路径
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

has_error=0

report_violation() {
  local title="$1"
  local output="$2"
  if [ -n "$output" ]; then
    echo "❌ 违规项: $title"
    echo "$output"
    echo ""
    has_error=1
  fi
}

# 1. 颜色字面量工具类：src 下匹配 (bg|text|border|from|to)-[# 的文件/行数须为 0
check_color_utility=$(grep -rnE '(bg|text|border|from|to)-\[#' src 2>/dev/null || true)
report_violation "颜色字面量工具类 (bg|text|border|from|to)-[#" "$check_color_utility"

# 2. antd 残留：src（含 *.ts/*.tsx）与 package.json 中匹配 antd 或 @ant-design 须为 0
check_antd=$(grep -rnE '(antd|@ant-design)' src package.json 2>/dev/null || true)
report_violation "antd 残留 (antd 或 @ant-design)" "$check_antd"

# 3. var(--ant- 须为 0（antd 时代的跨体系引用，已废）
check_var_ant=$(grep -rn 'var(--ant-' src 2>/dev/null || true)
report_violation "var(--ant- 跨体系引用" "$check_var_ant"

# 4. asChild 作为独立单词须为 0（Base UI 用 render；注意用 grep -rnw，否则会误命中 hasChildren）
check_as_child=$(grep -rnw 'asChild' src 2>/dev/null || true)
report_violation "asChild 独立单词（Base UI 请用 render）" "$check_as_child"

# 5. @radix-ui 须为 0（本仓用 Base UI，不用 Radix）
check_radix=$(grep -rn '@radix-ui' src package.json 2>/dev/null || true)
report_violation "@radix-ui 引用（本仓使用 Base UI）" "$check_radix"

# 6. 除 src/lib/palette.ts 外，src 下十六进制颜色字面量（#[0-9a-fA-F]{3,8}）须为 0
#    显式例外：
#    - src/lib/palette.ts：数据可视化调色板（DATA_PALETTE）唯一定义处，允许十六进制色值与 hexToRgba。
#    - src/test/：单元测试用例，允许对十六进制色值与色彩转换进行断言。
check_hex_color=$(find src -type f ! -path 'src/lib/palette.ts' ! -path 'src/test/*' -exec grep -HnE '#[0-9a-fA-F]{3,8}' {} + 2>/dev/null || true)
report_violation "十六进制颜色字面量（仅允许 src/lib/palette.ts 与 src/test/）" "$check_hex_color"

if [ "$has_error" -ne 0 ]; then
  exit 1
fi

echo "样式红线检查通过"
