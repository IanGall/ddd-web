#!/usr/bin/env bash
# ddd-web（管理端前端）一键运维脚本：构建部署 / 查看状态 / 看日志 / 强制重启 / 清理。
#
# 用法：
#   bash deploy/deploy-local.sh                  # 默认动作 deploy：构建镜像 → apply 清单 → 收副本数 → 按需滚动 → 等就绪
#   bash deploy/deploy-local.sh status           # 查看部署状态（Deployment/Pod/Ingress/Service + 最近事件）
#   bash deploy/deploy-local.sh logs [--follow]  # 看 nginx 访问/错误日志（默认最后 100 行）
#   bash deploy/deploy-local.sh restart          # 强制滚动重启（无状态前端，等价于重建 Pod）
#   bash deploy/deploy-local.sh clean            # 只删 ddd-web 自己的 Deployment/Service/Ingress
#   bash deploy/deploy-local.sh clean --images   # 连本地镜像一起删（下次部署会重新构建）
#
# 选项：
#   --k8s-namespace NAME   k8s 命名空间，默认 ian-ddd（等价别名 --namespace）
#   --replicas N|keep      本地副本数，默认 1；keep = 完全按清单（2 副本，验证滚动更新时用）
#   --skip-build           deploy 时跳过镜像构建，直接用本地已有镜像（镜像不存在会报错）
#   --images               clean 时连本地镜像一起删
#   --follow | -f          logs 时持续跟随（Ctrl-C 退出）
#
# 幂等：deploy 把本地镜像的「层摘要 + 镜像配置」摘要打成 Deployment 的 Pod 模板注解 deploy-local.hash，
#       镜像内容没变就跳过滚动更新；重新构建出不同内容（代码变更）会自动触发滚动，因此重复执行安全。
#       注意不能用镜像 ID 当判据：BuildKit 每次构建都会重写 config 里的 created 时间戳，
#       即使所有层命中缓存、镜像内容完全一致，镜像 ID 也会变（已实测），那样会每次白滚一遍。
#
# 与后端 ddd/scripts/deploy-local.sh 的差异（都是刻意的）：
#   · 前端是纯静态 SPA：没有 ConfigMap / Secret / HPA / PDB，也没有注册中心命名空间的概念；
#   · 幂等摘要只看镜像 ID（前端没有运行期配置参与）；
#   · clean 只按名字删 ddd-web 的 Deployment/Service/Ingress，**不带 --all、也不提供 --purge**：
#     ian-ddd 是与后端（ian-ddd-auth / ian-ddd-gateway）共享的命名空间，
#     删命名空间会连带停掉后端服务；同理绝不能用 kubectl delete --all 清理。
#
# 镜像名与标签固定为 system/ddd-web:1.0-SNAPSHOT，必须与 deploy/k8s/deployment.yaml 的 image 一致。
#
# 依赖：docker（含 buildx 插件）、kubectl。
# 适用范围：本机/联调集群（直接用本地 Docker 里构建的镜像，不推仓库，清单是 imagePullPolicy: IfNotPresent）。
#           远端集群请先推镜像、改成不可变 tag 或 digest，不要用本脚本。
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

# 项目前缀：从项目目录名派生（/path/to/ian-<前缀> → <前缀>）。
# 它是「复制本项目派生的新项目无需改脚本」的单一来源——镜像名与 k8s 命名空间都由它派生。
if [ -z "${PROJECT_PREFIX:-}" ]; then
  _derived_base="$(basename "$(cd "${REPO_ROOT}/.." && pwd)")"
  case "${_derived_base}" in
    ian-*) PROJECT_PREFIX="${_derived_base#ian-}" ;;
    *)     PROJECT_PREFIX="ddd" ;;   # 目录名不符合约定时回退到历史默认值
  esac
fi

APP="ddd-web"
# 镜像名带**项目前缀**。本机 Docker 镜像库是全局共享的：若两个项目构建同名同 tag 的
# 镜像，后者会静默覆盖前者，而 k8s 用 imagePullPolicy: IfNotPresent —— 已在跑的 Pod
# 不受影响，但**重启 / 扩缩容**产生的新 Pod 会拉到被覆盖的镜像，
# 即「本项目的命名空间跑对方项目的前端」。故镜像名必须隔离。
IMAGE="system/ian-${PROJECT_PREFIX}-web"
TAG="1.0-SNAPSHOT"
MANIFEST_DIR="deploy/k8s"
# 与后端脚本使用同一个注解名，便于统一排查「为什么没滚动」
HASH_ANNOTATION="deploy-local.hash"

ACTION="deploy"
NAMESPACE="ian-${PROJECT_PREFIX}"
REPLICAS="1"
SKIP_BUILD="no"
WITH_IMAGES="no"
FOLLOW="no"

log() { printf '\033[32m[deploy-web]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[deploy-web]\033[0m %s\n' "$*"; }
die() {
  printf '\033[31m[deploy-web][ERROR]\033[0m %s\n' "$*" >&2
  exit 1
}

# -h 打印文件头的全部注释（选项与差异说明），新增说明行不用同步改行号
usage() { awk 'NR == 1 { next } /^[^#]/ { exit } { print }' "$0" | sed -e 's/^# \{0,1\}//'; }

# 允许省略动作（bash deploy/deploy-local.sh --replicas 2 等价于 deploy --replicas 2）
if [ $# -gt 0 ]; then
  case "$1" in
    -*) ;;
    *) ACTION="$1" && shift ;;
  esac
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --namespace | --k8s-namespace)
      NAMESPACE="${2:?--k8s-namespace 需要取值（k8s 命名空间，默认 ian-ddd）}"
      shift
      ;;
    --replicas)
      REPLICAS="${2:?--replicas 需要取值：1|2|... 或 keep}"
      shift
      ;;
    --skip-build) SKIP_BUILD="yes" ;;
    --images) WITH_IMAGES="yes" ;;
    --follow | -f) FOLLOW="yes" ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) die "未知参数：$1（-h 看用法）" ;;
  esac
  shift
done

case "${ACTION}" in deploy | status | logs | restart | clean) ;; *) die "未知动作：${ACTION}（支持 deploy|status|logs|restart|clean）" ;; esac
case "${REPLICAS}" in
  keep) ;;
  '' | *[!0-9]*) die "--replicas 只支持 keep 或非负整数（当前：${REPLICAS}）" ;;
esac
[ -n "${NAMESPACE}" ] || die "命名空间不能为空"
case "${NAMESPACE}" in default | kube-system | kube-public | kube-node-lease) die "拒绝操作系统命名空间 ${NAMESPACE}" ;; esac
command -v kubectl >/dev/null || die "找不到 kubectl"
if [ "${ACTION}" = "deploy" ] && [ "${SKIP_BUILD}" = "no" ]; then
  command -v docker >/dev/null || die "找不到 docker（只 apply 清单可用 --skip-build）"
fi

image_ref() { echo "${IMAGE}:${TAG}"; }
sha256() {
  if command -v sha256sum >/dev/null; then sha256sum | cut -c1-16; else shasum -a 256 | cut -c1-16; fi
}
# 镜像「内容」标识：层摘要（文件内容）+ 镜像配置（Env / Entrypoint / Cmd / ExposedPorts 等）。
# 刻意排除镜像 ID 与 Created：它们每次构建都会变，不反映内容差异（见文件头「幂等」说明）。
image_content_id() {
  docker image inspect "$1" >/dev/null 2>&1 || {
    echo missing
    return
  }
  docker image inspect "$1" --format '{{json .RootFS.Layers}}|{{json .Config}}' | sha256
}
pods() {
  kubectl get pods -n "${NAMESPACE}" -l "app.kubernetes.io/name=${APP}" \
    --sort-by=.metadata.creationTimestamp -o name 2>/dev/null || true
}

# ---------------------------------------------------------------- status / logs / restart

do_status() {
  log "命名空间 ${NAMESPACE} 的部署状态："
  if ! kubectl get deploy -n "${NAMESPACE}" -o name >/dev/null 2>&1; then
    warn "命名空间 ${NAMESPACE} 不存在"
    return
  fi
  if ! kubectl get deploy "${APP}" -n "${NAMESPACE}" >/dev/null 2>&1; then
    warn "命名空间 ${NAMESPACE} 里没有 Deployment/${APP}（先执行 deploy）"
    return
  fi
  kubectl get deploy "${APP}" -n "${NAMESPACE}" \
    -o custom-columns='DEPLOY:.metadata.name,READY:.status.readyReplicas,DESIRED:.spec.replicas,IMAGE:.spec.template.spec.containers[0].image' 2>/dev/null | sed 's/^/  /' || true
  kubectl get pods -n "${NAMESPACE}" -l "app.kubernetes.io/name=${APP}" \
    -o custom-columns='POD:.metadata.name,READY:.status.containerStatuses[0].ready,STATUS:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount' 2>/dev/null | sed 's/^/  /' || true
  kubectl get ingress,svc -n "${NAMESPACE}" 2>/dev/null | grep -E 'NAME|ddd-web' | sed 's/^/  /' || true
  # 前端只认领 /，/api 归后端网关的 Ingress；这里顺手确认它还在，避免「接口 404」被误判成前端问题
  if kubectl get ingress ian-ddd-gateway -n "${NAMESPACE}" >/dev/null 2>&1; then
    printf '  同 host 的 /api 由 Ingress/ian-ddd-gateway 认领\n'
  else
    warn "命名空间 ${NAMESPACE} 里没有 Ingress/ian-ddd-gateway：/api 不会被路由（前端只认领 /）"
  fi
  log "最近事件（尾部 10 条）："
  kubectl get events -n "${NAMESPACE}" --sort-by=.lastTimestamp 2>/dev/null | tail -10 | sed 's/^/  /' || true
}

do_logs() {
  local list
  list="$(pods)"
  [ -n "${list}" ] || {
    warn "${APP}：没有 Pod"
    return
  }
  if [ "${FOLLOW}" = "yes" ]; then
    # 跟随只能跟一个 Pod，取最新的那个
    local newest
    newest="$(echo "${list}" | tail -1)"
    log "${newest#pod/} 日志（follow，Ctrl-C 退出）"
    kubectl logs -n "${NAMESPACE}" "${newest}" --tail=100 -f
  else
    local p
    for p in ${list}; do
      log "${p#pod/} 日志（最后 100 行）"
      kubectl logs -n "${NAMESPACE}" "${p}" --tail=100 2>&1 | sed 's/^/  /' || true
    done
  fi
}

do_restart() {
  if ! kubectl get deploy "${APP}" -n "${NAMESPACE}" >/dev/null 2>&1; then
    die "不存在 Deployment/${APP}（先执行 deploy）"
  fi
  log "滚动重启 ${APP}"
  kubectl rollout restart "deploy/${APP}" -n "${NAMESPACE}" >/dev/null
  kubectl rollout status "deploy/${APP}" -n "${NAMESPACE}" --timeout=240s
}

# ---------------------------------------------------------------- clean

do_clean() {
  if kubectl get deploy "${APP}" -n "${NAMESPACE}" >/dev/null 2>&1; then
    log "清理 ${APP} 的工作负载与入口（命名空间 ${NAMESPACE} 与其它服务保持不动）："
    kubectl get deploy,svc,ingress "${APP}" -n "${NAMESPACE}" 2>/dev/null | sed 's/^/  /' || true
    # 按名字逐个删，绝不用 --all：命名空间与 ian-ddd-auth / ian-ddd-gateway 共享
    kubectl delete "deploy/${APP}" "svc/${APP}" "ingress/${APP}" -n "${NAMESPACE}" --ignore-not-found 2>&1 | sed 's/^/  /' || true
  else
    warn "命名空间 ${NAMESPACE} 里没有 Deployment/${APP}，跳过工作负载清理"
  fi
  if [ "${WITH_IMAGES}" = "yes" ]; then
    # Pod 还在 Terminating 时镜像被容器引用着，docker rmi 会失败；先等 Pod 真正消失（最多 90s）
    kubectl wait --for=delete pod -l "app.kubernetes.io/name=${APP}" -n "${NAMESPACE}" --timeout=90s >/dev/null 2>&1 || true
    if docker image inspect "$(image_ref)" >/dev/null 2>&1; then
      log "删除本地镜像 $(image_ref)"
      docker rmi "$(image_ref)" >/dev/null 2>&1 || warn "删除 $(image_ref) 失败（可能仍被其它 tag/容器引用）"
    else
      warn "本地没有镜像 $(image_ref)，无需删除"
    fi
  fi
  log "清理完成（命名空间 ${NAMESPACE} 保留，后端服务未受影响）"
}

# ---------------------------------------------------------------- deploy

build_image() {
  [ "${SKIP_BUILD}" = "yes" ] && return
  log "构建镜像（脚本自动识别本机架构）：$(image_ref)"
  log "构建过程中无实时输出，完整日志：${TMP_DIR}/build.log"
  (cd "${REPO_ROOT}" && bash ./deploy/build.sh >"${TMP_DIR}/build.log" 2>&1) || {
    tail -20 "${TMP_DIR}/build.log" >&2
    die "镜像构建失败"
  }
  grep -E '^构建 ' "${TMP_DIR}/build.log" | tail -1 || true
}

ensure_namespace() {
  kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 && return
  log "创建命名空间 ${NAMESPACE}"
  kubectl create namespace "${NAMESPACE}"
}

apply_manifests() {
  # 逐文件 apply：清单里没有生成式配置，目录整体 apply 也等价，但显式列出更清楚哪些资源归本脚本管
  kubectl apply -n "${NAMESPACE}" \
    -f "${MANIFEST_DIR}/deployment.yaml" \
    -f "${MANIFEST_DIR}/service.yaml" \
    -f "${MANIFEST_DIR}/ingress.yaml" >/dev/null
  log "已应用清单：${MANIFEST_DIR}/{deployment,service,ingress}.yaml"
}

# 本地副本数默认收到 1 个，避免在开发机上白占内存；keep = 保持清单里的 2 副本。
# 前端清单刻意不配 HPA，所以这里只需 scale；将来若加了 HPA，还要同步改 minReplicas（见后端脚本）。
tune_replicas() {
  [ "${REPLICAS}" = "keep" ] && return
  kubectl scale "deploy/${APP}" -n "${NAMESPACE}" --replicas="${REPLICAS}" >/dev/null
  log "${APP}：副本数设为 ${REPLICAS}（要按清单 2 副本用 --replicas keep）"
}

# 镜像内容没变就不滚动：把镜像内容摘要打成 Pod 模板注解，变了才触发滚动更新
rollout_if_changed() {
  local current live hash
  current="$(image_content_id "$(image_ref)")"
  [ "${current}" != "missing" ] || die "本地没有镜像 $(image_ref)：去掉 --skip-build 重跑，或先执行 bash deploy/build.sh"
  live="$(kubectl get deploy "${APP}" -n "${NAMESPACE}" \
    -o jsonpath="{.spec.template.metadata.annotations.${HASH_ANNOTATION//./\\.}}" 2>/dev/null || true)"
  hash="$(echo "${current}" | sha256)"
  if [ -n "${live}" ] && [ "${live}" = "${hash}" ]; then
    log "${APP}：镜像没变，跳过滚动更新"
    return
  fi
  kubectl patch deploy "${APP}" -n "${NAMESPACE}" --type=merge \
    -p "{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"${HASH_ANNOTATION}\":\"${hash}\"}}}}}" >/dev/null
  log "${APP}：触发滚动更新（摘要 ${hash}）"
}

do_deploy() {
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "${TMP_DIR}"' EXIT
  log "部署 ${APP} 到 k8s 命名空间 ${NAMESPACE}，镜像 $(image_ref)"
  ensure_namespace
  build_image
  apply_manifests
  tune_replicas
  rollout_if_changed
  kubectl rollout status "deploy/${APP}" -n "${NAMESPACE}" --timeout=240s
  do_status
  log "验证（宿主机经 Ingress，不需要 port-forward；需 /etc/hosts 里有 gateway.example.com → 127.0.0.1）："
  printf '  首页：curl -s -o /dev/null -w "%%{http_code}\\n" -H "Host: gateway.example.com" http://127.0.0.1/          # 期望 200\n'
  printf '  接口：curl -s -o /dev/null -w "%%{http_code}\\n" -H "Host: gateway.example.com" http://127.0.0.1/api/admin/rbac/users   # 期望 401（/api 归网关）\n'
  warn "手工 kubectl apply -f ${MANIFEST_DIR}/ 是安全的（无生成式配置），但会把副本数重置回清单的 2"
  if [ "${REPLICAS}" != "keep" ]; then
    warn "本地副本数已收到 ${REPLICAS}；要回到清单的 2 副本用 --replicas keep"
  fi
}

case "${ACTION}" in
  deploy) do_deploy ;;
  status) do_status ;;
  logs) do_logs ;;
  restart) do_restart ;;
  clean) do_clean ;;
esac
