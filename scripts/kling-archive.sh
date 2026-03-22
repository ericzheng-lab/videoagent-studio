#!/bin/bash
# kling-archive.sh - 自动下载并归档 Kling 生成的视频
# 用法:
#   kling-archive.sh --url "https://..." --project "my-project" --shot "shot_01"
#   kling-archive.sh --task_id "xxx" --project "my-project" --shot "shot_01"
#
# 归档路径: /Users/drs/Documents/Obsidian-Vault/AI电影创作/04-案例库/{project}/{shot}.mp4
# 同时记录 metadata 到 {project}/archive-log.json

set -e

# 配置
ARCHIVE_BASE="/Users/drs/Documents/Obsidian-Vault/AI电影创作/04-案例库"
CONFIG_FILE="$(dirname "$0")/../config.json"

# 解析 config
BASE_URL=$(grep -o '"base_url"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*"\([^"]*\)"/\1/')
API_KEY=$(grep -o '"api_key"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*"\([^"]*\)"/\1/')

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[ARCHIVE]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

show_help() {
    cat << EOF
Kling Archive - 自动下载并归档生成的视频

Usage:
    kling-archive.sh --url URL --project NAME [--shot NAME] [--prompt TEXT]
    kling-archive.sh --task_id ID --project NAME [--shot NAME] [--prompt TEXT]

Options:
    --url URL           直接提供视频 URL 下载
    --task_id ID        通过 task_id 查询并下载
    --project NAME      项目名称（归档目录名）
    --shot NAME         镜头名称（文件名，默认按时间戳生成）
    --prompt TEXT       记录使用的提示词（可选）

Examples:
    # 直接下载
    kling-archive.sh --url "https://..." --project "cat-story" --shot "shot_01"

    # 通过 task_id 下载
    kling-archive.sh --task_id "xxx123" --project "cat-story" --prompt "猫咪在沙发上打盹"

EOF
}

# 从 task_id 获取视频 URL
get_url_from_task() {
    local TASK_ID="$1"
    log_info "查询任务状态: $TASK_ID"

    local RESPONSE=$(curl -s -X GET "$BASE_URL/kling/v1/videos/omni-video/$TASK_ID" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json")

    local STATUS=$(echo "$RESPONSE" | grep -o '"task_status"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"/\1/')

    if [ "$STATUS" != "succeed" ]; then
        log_error "任务状态: $STATUS（只有 succeed 状态才能下载）"
        exit 1
    fi

    echo "$RESPONSE" | grep -o '"url"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"/\1/'
}

# 下载视频
download_video() {
    local URL="$1"
    local OUTPUT="$2"

    log_info "下载视频到: $OUTPUT"
    curl -L -s -o "$OUTPUT" "$URL"

    if [ -f "$OUTPUT" ] && [ -s "$OUTPUT" ]; then
        local SIZE=$(du -sh "$OUTPUT" | cut -f1)
        log_info "✅ 下载成功 ($SIZE)"
    else
        log_error "❌ 下载失败"
        rm -f "$OUTPUT"
        exit 1
    fi
}

# 记录 metadata
record_metadata() {
    local PROJECT="$1"
    local SHOT_NAME="$2"
    local VIDEO_URL="$3"
    local TASK_ID="$4"
    local PROMPT="$5"
    local FILE_PATH="$6"
    local LOG_FILE="$ARCHIVE_BASE/$PROJECT/archive-log.json"
    local TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # 创建或追加 log
    local ENTRY="{\"shot\":\"$SHOT_NAME\",\"task_id\":\"$TASK_ID\",\"prompt\":\"$PROMPT\",\"url\":\"$VIDEO_URL\",\"file\":\"$FILE_PATH\",\"archived_at\":\"$TIMESTAMP\"}"

    if [ ! -f "$LOG_FILE" ]; then
        echo "[$ENTRY]" > "$LOG_FILE"
    else
        # 追加到数组（简单方式）
        local TMP=$(cat "$LOG_FILE" | sed 's/\]$//')
        echo "$TMP,$ENTRY]" > "$LOG_FILE"
    fi

    log_info "📝 已记录到: $LOG_FILE"
}

# 主逻辑
VIDEO_URL=""
TASK_ID=""
PROJECT=""
SHOT_NAME=""
PROMPT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --url) VIDEO_URL="$2"; shift 2 ;;
        --task_id) TASK_ID="$2"; shift 2 ;;
        --project) PROJECT="$2"; shift 2 ;;
        --shot) SHOT_NAME="$2"; shift 2 ;;
        --prompt) PROMPT="$2"; shift 2 ;;
        --help|-h) show_help; exit 0 ;;
        *) log_error "未知参数: $1"; show_help; exit 1 ;;
    esac
done

# 验证必填参数
if [ -z "$PROJECT" ]; then
    log_error "--project 是必填参数"
    show_help
    exit 1
fi

if [ -z "$VIDEO_URL" ] && [ -z "$TASK_ID" ]; then
    log_error "必须提供 --url 或 --task_id"
    show_help
    exit 1
fi

# 通过 task_id 获取 URL
if [ -z "$VIDEO_URL" ] && [ -n "$TASK_ID" ]; then
    VIDEO_URL=$(get_url_from_task "$TASK_ID")
    if [ -z "$VIDEO_URL" ]; then
        log_error "无法从 task_id 获取视频 URL"
        exit 1
    fi
fi

# 生成文件名
if [ -z "$SHOT_NAME" ]; then
    SHOT_NAME="shot_$(date +%Y%m%d_%H%M%S)"
fi

# 创建项目目录
PROJECT_DIR="$ARCHIVE_BASE/$PROJECT"
mkdir -p "$PROJECT_DIR"

# 下载路径
OUTPUT_FILE="$PROJECT_DIR/${SHOT_NAME}.mp4"

# 检查是否已存在
if [ -f "$OUTPUT_FILE" ]; then
    log_warn "文件已存在: $OUTPUT_FILE"
    OUTPUT_FILE="$PROJECT_DIR/${SHOT_NAME}_$(date +%H%M%S).mp4"
    log_info "改用: $OUTPUT_FILE"
fi

# 执行下载
download_video "$VIDEO_URL" "$OUTPUT_FILE"

# 记录 metadata
record_metadata "$PROJECT" "$SHOT_NAME" "$VIDEO_URL" "$TASK_ID" "$PROMPT" "$OUTPUT_FILE"

log_info ""
log_info "📁 归档完成"
log_info "   项目: $PROJECT"
log_info "   文件: $OUTPUT_FILE"
