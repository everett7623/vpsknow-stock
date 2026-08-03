# 部署检查清单

> 生成时间：2026-07-30
> 项目：VPSKnow Stock

---

## ✅ 部署前检查

### 1. 代码质量检查

- ✅ **所有测试通过**：65 个测试用例，100% 通过率
  - @vpsknow/providers: 24 passed
  - @vpsknow/worker: 31 passed
  - @vpsknow/bot: 5 passed
  - @vpsknow/parsers: 5 passed

- ✅ **TypeScript 类型检查**：无错误
- ✅ **ESLint 检查**：无警告
- ✅ **构建成功**：所有应用构建通过
  - Web: Next.js 生产构建完成
  - Worker: TypeScript 编译成功
  - Bot: TypeScript 编译成功

### 2. 环境变量检查

#### 必需环境变量

```bash
# 数据库
✅ DATABASE_URL                 # PostgreSQL 连接字符串
✅ POSTGRES_USER                # 数据库用户名
✅ POSTGRES_PASSWORD            # 数据库密码（强密码）
✅ POSTGRES_DB                  # 数据库名称

# Redis
✅ REDIS_URL                    # Redis 连接字符串

# Telegram
✅ TELEGRAM_BOT_TOKEN           # Bot API token
✅ TELEGRAM_OFFERS_CHANNEL_ID   # 补货和优惠公共频道 ID
✅ TELEGRAM_ADMIN_CHAT_ID       # 管理员通知 Chat ID

# 网站
✅ SITE_DOMAIN                  # 域名（例：stock.vpsknow.com）
✅ NEXT_PUBLIC_SITE_URL         # 公开站点 URL
✅ ADMIN_DASHBOARD_TOKEN        # 管理仪表板密钥

# Affiliate
✅ AFFILIATE_BASE_URL           # 联盟链接基础 URL
```

#### 可选环境变量

```bash
⚪ LOG_LEVEL                   # 日志级别（默认：info）
⚪ BACKUP_RETENTION_DAYS       # 备份保留天数（默认：14）
```

### 3. 基础设施检查

#### VPS 要求

```yaml
最低配置：
  CPU: 2 核心
  RAM: 2 GB
  磁盘: 20 GB SSD
  网络: 100 Mbps

推荐配置：
  CPU: 4 核心
  RAM: 4 GB
  磁盘: 40 GB SSD
  网络: 1 Gbps
```

#### 软件依赖

- ✅ Docker Engine >= 20.10
- ✅ Docker Compose >= 2.0
- ✅ Git
- ✅ 端口可用性：
  - 80 (HTTP)
  - 443 (HTTPS)
  - 3000 (Web - 内部)
  - 3001 (Worker Health - 内部)
  - 5432 (PostgreSQL - 内部)
  - 6379 (Redis - 内部)

### 4. 安全检查

- ✅ 强密码生成（POSTGRES_PASSWORD, ADMIN_DASHBOARD_TOKEN）
- ✅ 环境变量不在代码中
- ✅ `.env` 文件添加到 `.gitignore`
- ✅ Docker secrets 支持
- ✅ 防火墙配置（仅开放 80/443）
- ✅ SSH 密钥认证（禁用密码登录）

---

## 📝 部署步骤

### 第一次部署

```bash
# 1. 克隆仓库
git clone https://github.com/everett7623/vpsknow-stock.git
cd vpsknow-stock

# 2. 配置环境变量
cp .env.example .env
nano .env  # 填写所有必需变量

# 3. 启动服务
docker compose -f docker-compose.production.yml up -d --build

# 4. 验证部署
./scripts/verify-production.sh

# 5. 检查日志
docker compose -f docker-compose.production.yml logs -f worker
docker compose -f docker-compose.production.yml logs -f bot

# 6. 测试网站访问
curl https://stock.vpsknow.com
```

### 更新部署

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建和启动
docker compose -f docker-compose.production.yml up -d --build

# 3. 验证更新
./scripts/verify-production.sh

# 4. 查看日志确认无错误
docker compose -f docker-compose.production.yml logs --tail=100 worker
```

---

## 🔍 部署验证

### 自动验证脚本

```bash
./scripts/verify-production.sh
```

**检查项目**：
- ✅ PostgreSQL 健康状态
- ✅ Redis 连接
- ✅ Worker 健康端点
- ✅ Web 应用响应
- ✅ Database migrations 已应用
- ✅ Provider 种子数据存在

### 手动验证

```bash
# 1. 检查所有容器运行状态
docker compose -f docker-compose.production.yml ps

# 期望输出：所有服务 State = Up (healthy)

# 2. 测试 Worker 健康端点
curl http://localhost:3001/health

# 期望输出：{"status":"healthy",...}

# 3. 检查数据库连接
docker compose -f docker-compose.production.yml exec postgres \
  psql -U vpsknow -d vpsknow_stock -c "SELECT COUNT(*) FROM providers;"

# 期望输出：21 行（21 个 providers）

# 4. 检查 Redis 连接
docker compose -f docker-compose.production.yml exec redis redis-cli ping

# 期望输出：PONG

# 5. 测试网站访问
curl -I https://stock.vpsknow.com

# 期望输出：HTTP/2 200
```

---

## 🔧 故障排查

### 常见问题

#### 1. 容器启动失败

```bash
# 查看详细日志
docker compose -f docker-compose.production.yml logs <service-name>

# 常见原因：
# - 环境变量未设置
# - 端口冲突
# - 磁盘空间不足
```

#### 2. 数据库连接失败

```bash
# 检查 PostgreSQL 日志
docker compose -f docker-compose.production.yml logs postgres

# 检查连接字符串
echo $DATABASE_URL

# 测试连接
docker compose -f docker-compose.production.yml exec worker \
  node -e "require('@vpsknow/database').prisma.\$connect().then(() => console.log('OK'))"
```

#### 3. Worker 不执行检查

```bash
# 查看 Worker 日志
docker compose -f docker-compose.production.yml logs -f worker

# 检查 Redis 队列
docker compose -f docker-compose.production.yml exec redis redis-cli
> KEYS bull:*
> LLEN bull:stock-check:wait

# 手动触发测试检查
docker compose -f docker-compose.production.yml exec worker \
  node -e "require('./dist/index.js')"
```

#### 4. Telegram 通知未发送

```bash
# 验证 Bot Token
curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe

# 检查频道 ID 格式（应为 @username 或 -100xxxxxxxx）
echo $TELEGRAM_OFFERS_CHANNEL_ID

# 查看 Worker 日志中的 Telegram 错误
docker compose -f docker-compose.production.yml logs worker | grep -i telegram
```

---

## 📊 监控和维护

### 日常监控

```bash
# 查看资源使用
docker stats

# 检查磁盘空间
df -h

# 查看最近的补货事件
docker compose -f docker-compose.production.yml exec postgres \
  psql -U vpsknow -d vpsknow_stock -c \
  "SELECT * FROM stock_events ORDER BY detected_at DESC LIMIT 10;"
```

### 定期维护

```bash
# 1. 数据库备份（建议每日）
./scripts/backup-postgres.sh

# 2. 清理旧 Docker 镜像
docker system prune -a --filter "until=168h"

# 3. 检查日志大小
docker compose -f docker-compose.production.yml logs --tail=0 | wc -l

# 4. 更新依赖（每月）
pnpm update --latest
pnpm build
pnpm test
```

### 备份策略

```bash
# 自动备份（添加到 crontab）
0 2 * * * cd /path/to/vpsknow-stock && ./scripts/backup-postgres.sh

# 恢复备份
./scripts/restore-postgres.sh backups/postgres-2026-07-30-020000.dump
```

---

## 🎯 部署后验证清单

- [ ] 所有 Docker 容器运行正常
- [ ] Worker 健康端点响应 200
- [ ] 网站可通过 HTTPS 访问
- [ ] 数据库包含 21 个 providers
- [ ] Redis 可连接
- [ ] 首次 stock check 已执行（查看日志）
- [ ] Telegram Bot 响应 /start 命令
- [ ] 管理员收到 Worker 启动通知（如配置）
- [ ] SSL 证书有效（Caddy 自动申请）
- [ ] 备份脚本可执行且正常运行
- [ ] 监控告警已配置（如使用）

---

## 🚀 性能优化建议（生产环境）

### 1. PostgreSQL 调优

```yaml
# docker-compose.production.yml
services:
  postgres:
    command: >
      postgres
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c maintenance_work_mem=128MB
      -c max_connections=50
```

### 2. Redis 配置

```yaml
services:
  redis:
    command: >
      redis-server
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
```

### 3. Caddy 优化

```yaml
services:
  caddy:
    command: caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
    # 启用 HTTP/3 和 Gzip
```

---

## 📞 紧急联系

**如遇生产环境问题**：

1. 查看 Worker 日志：`docker compose logs -f worker`
2. 检查健康端点：`curl http://localhost:3001/health`
3. 重启服务：`docker compose restart worker`
4. 回滚版本：`git checkout <previous-commit> && docker compose up -d --build`

**数据恢复**：

```bash
# 停止所有服务
docker compose -f docker-compose.production.yml down

# 恢复最新备份
./scripts/restore-postgres.sh backups/latest.dump

# 重新启动
docker compose -f docker-compose.production.yml up -d
```

---

**✅ 所有检查完成，准备部署！**
