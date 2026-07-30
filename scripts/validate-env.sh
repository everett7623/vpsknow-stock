#!/usr/bin/env bash
# 环境配置验证脚本
# 用于检查生产部署前所有必需的环境变量和配置

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# 打印函数
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  VPSKnow Stock - 环境配置验证${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_check() {
    echo -n "  检查 $1... "
}

print_pass() {
    echo -e "${GREEN}✓ 通过${NC}"
    ((PASSED_CHECKS++))
}

print_fail() {
    echo -e "${RED}✗ 失败${NC}"
    echo -e "${RED}    原因: $1${NC}"
    ((FAILED_CHECKS++))
}

print_warn() {
    echo -e "${YELLOW}⚠ 警告${NC}"
    echo -e "${YELLOW}    原因: $1${NC}"
    ((WARNING_CHECKS++))
}

print_section() {
    echo ""
    echo -e "${BLUE}[$1]${NC}"
}

# 检查环境变量是否设置
check_env_var() {
    local var_name=$1
    local required=$2
    ((TOTAL_CHECKS++))

    print_check "环境变量 $var_name"

    if [ -z "${!var_name}" ]; then
        if [ "$required" = "required" ]; then
            print_fail "未设置"
            return 1
        else
            print_warn "未设置（可选）"
            return 0
        fi
    else
        print_pass
        return 0
    fi
}

# 检查环境变量格式
check_env_format() {
    local var_name=$1
    local pattern=$2
    local description=$3
    ((TOTAL_CHECKS++))

    print_check "$description"

    if [ -z "${!var_name}" ]; then
        print_warn "变量未设置，跳过格式检查"
        return 0
    fi

    if [[ "${!var_name}" =~ $pattern ]]; then
        print_pass
        return 0
    else
        print_fail "格式不正确"
        return 1
    fi
}

# 检查文件是否存在
check_file_exists() {
    local file_path=$1
    local description=$2
    ((TOTAL_CHECKS++))

    print_check "$description"

    if [ -f "$file_path" ]; then
        print_pass
        return 0
    else
        print_fail "文件不存在: $file_path"
        return 1
    fi
}

# 检查命令是否可用
check_command() {
    local cmd=$1
    local description=$2
    ((TOTAL_CHECKS++))

    print_check "$description"

    if command -v "$cmd" &> /dev/null; then
        print_pass
        return 0
    else
        print_fail "命令未找到: $cmd"
        return 1
    fi
}

# 检查端口是否可用
check_port() {
    local port=$1
    local description=$2
    ((TOTAL_CHECKS++))

    print_check "$description"

    if command -v nc &> /dev/null; then
        if nc -z localhost "$port" 2>/dev/null; then
            print_warn "端口 $port 已被占用"
            return 0
        else
            print_pass
            return 0
        fi
    else
        print_warn "nc 命令不可用，跳过端口检查"
        return 0
    fi
}

# 主检查流程
main() {
    print_header

    # 加载 .env 文件
    if [ -f "$PROJECT_ROOT/.env" ]; then
        echo -e "${GREEN}找到 .env 文件，加载环境变量...${NC}"
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    else
        echo -e "${YELLOW}警告: .env 文件不存在${NC}"
        echo "请从 .env.example 复制并配置环境变量"
        echo ""
    fi

    # 1. 基础设施检查
    print_section "基础设施"
    check_command "docker" "Docker"
    check_command "docker-compose" "Docker Compose"
    check_command "git" "Git"
    check_command "node" "Node.js"
    check_command "pnpm" "pnpm"

    # 2. 必需环境变量检查
    print_section "必需环境变量"
    check_env_var "DATABASE_URL" "required"
    check_env_var "POSTGRES_USER" "required"
    check_env_var "POSTGRES_PASSWORD" "required"
    check_env_var "POSTGRES_DB" "required"
    check_env_var "REDIS_URL" "required"
    check_env_var "TELEGRAM_BOT_TOKEN" "required"
    check_env_var "TELEGRAM_STOCK_CHANNEL_ID" "required"
    check_env_var "TELEGRAM_OFFERS_CHANNEL_ID" "required"
    check_env_var "TELEGRAM_ADMIN_CHAT_ID" "required"
    check_env_var "SITE_DOMAIN" "required"
    check_env_var "NEXT_PUBLIC_SITE_URL" "required"
    check_env_var "ADMIN_DASHBOARD_TOKEN" "required"
    check_env_var "AFFILIATE_BASE_URL" "required"

    # 3. 可选环境变量检查
    print_section "可选环境变量"
    check_env_var "HOSTHATCH_API_TOKEN" "optional"
    check_env_var "LOG_LEVEL" "optional"
    check_env_var "BACKUP_RETENTION_DAYS" "optional"

    # 4. 环境变量格式检查
    print_section "环境变量格式验证"
    check_env_format "DATABASE_URL" "^postgresql://.+" "数据库 URL 格式"
    check_env_format "REDIS_URL" "^redis://.+" "Redis URL 格式"
    check_env_format "TELEGRAM_BOT_TOKEN" "^[0-9]+:[A-Za-z0-9_-]+" "Telegram Bot Token 格式"
    check_env_format "NEXT_PUBLIC_SITE_URL" "^https?://.+" "网站 URL 格式"

    # 5. 关键文件检查
    print_section "关键文件"
    check_file_exists "$PROJECT_ROOT/docker-compose.production.yml" "生产 Docker Compose 文件"
    check_file_exists "$PROJECT_ROOT/Dockerfile" "Dockerfile"
    check_file_exists "$PROJECT_ROOT/packages/database/prisma/schema.prisma" "Prisma Schema"
    check_file_exists "$PROJECT_ROOT/scripts/backup-postgres.sh" "备份脚本"
    check_file_exists "$PROJECT_ROOT/scripts/restore-postgres.sh" "恢复脚本"
    check_file_exists "$PROJECT_ROOT/scripts/verify-production.sh" "验证脚本"

    # 6. 端口可用性检查
    print_section "端口可用性"
    check_port 80 "HTTP 端口 (80)"
    check_port 443 "HTTPS 端口 (443)"
    check_port 3000 "Web 应用端口 (3000)"
    check_port 5432 "PostgreSQL 端口 (5432)"
    check_port 6379 "Redis 端口 (6379)"

    # 7. 安全检查
    print_section "安全配置"
    ((TOTAL_CHECKS++))
    print_check "PostgreSQL 密码强度"
    if [ -n "$POSTGRES_PASSWORD" ]; then
        if [ ${#POSTGRES_PASSWORD} -ge 16 ]; then
            print_pass
        else
            print_warn "密码长度小于 16 字符，建议使用更强的密码"
        fi
    else
        print_fail "密码未设置"
    fi

    ((TOTAL_CHECKS++))
    print_check "管理员 Token 强度"
    if [ -n "$ADMIN_DASHBOARD_TOKEN" ]; then
        if [ ${#ADMIN_DASHBOARD_TOKEN} -ge 32 ]; then
            print_pass
        else
            print_warn "Token 长度小于 32 字符，建议使用更长的 Token"
        fi
    else
        print_fail "Token 未设置"
    fi

    # 打印总结
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  检查完成${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    echo "总检查项: $TOTAL_CHECKS"
    echo -e "${GREEN}通过: $PASSED_CHECKS${NC}"
    echo -e "${RED}失败: $FAILED_CHECKS${NC}"
    echo -e "${YELLOW}警告: $WARNING_CHECKS${NC}"
    echo ""

    # 返回状态
    if [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${GREEN}✓ 所有关键检查通过，可以部署！${NC}"
        if [ $WARNING_CHECKS -gt 0 ]; then
            echo -e "${YELLOW}⚠ 有 $WARNING_CHECKS 个警告项，建议修复后再部署${NC}"
        fi
        exit 0
    else
        echo -e "${RED}✗ 有 $FAILED_CHECKS 个检查失败，请修复后再部署${NC}"
        exit 1
    fi
}

# 执行主函数
main "$@"
