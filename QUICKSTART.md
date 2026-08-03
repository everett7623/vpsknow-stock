# 快速启动指南

> VPSKnow Stock - 5 分钟快速上手

---

## 🚀 本地开发（最快路径）

### 前置要求

```bash
✅ Node.js >= 22
✅ pnpm >= 8
✅ Docker Desktop（PostgreSQL + Redis）
✅ Git
```

### 一键启动

```bash
# 1. 克隆并安装
git clone https://github.com/everett7623/vpsknow-stock.git
cd vpsknow-stock
pnpm install

# 2. 启动数据库
docker compose up -d postgres redis

# 3. 初始化数据库
cd packages/database
pnpm db:push
pnpm db:seed
cd ../..

# 4. 配置环境变量（最小配置）
cp .env.example .env
# 编辑 .env，至少设置：
# - TELEGRAM_BOT_TOKEN
# - TELEGRAM_OFFERS_CHANNEL_ID
# - TELEGRAM_ADMIN_CHAT_ID

# 5. 启动所有服务
pnpm dev
```

访问：
- 网站：http://localhost:3000
- Worker 健康检查：http://localhost:3001/health

---

## 📦 生产部署（Docker Compose）

### 一键部署

```bash
# 1. 克隆代码
git clone https://github.com/everett7623/vpsknow-stock.git
cd vpsknow-stock

# 2. 配置环境变量
cp .env.example .env
nano .env  # 填写所有必需变量

# 3. 启动
docker compose -f docker-compose.production.yml up -d --build

# 4. 验证
./scripts/verify-production.sh

# 5. 查看日志
docker compose -f docker-compose.production.yml logs -f worker
```

---

## 🧪 运行测试

```bash
# 所有测试
pnpm test

# 特定包
cd apps/worker && pnpm test
cd packages/providers && pnpm test

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint
```

---

## 📋 常用命令

### 开发

```bash
pnpm dev              # 启动所有服务
pnpm build            # 构建所有应用
pnpm typecheck        # TypeScript 检查
pnpm lint             # ESLint 检查
pnpm format           # Prettier 格式化
```

### 数据库

```bash
cd packages/database
pnpm db:push          # 推送 schema（开发）
pnpm db:migrate       # 创建 migration
pnpm db:seed          # 填充种子数据
pnpm studio           # Prisma Studio
```

### Docker

```bash
# 开发环境
docker compose up -d postgres redis

# 生产环境
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml logs -f worker
docker compose -f docker-compose.production.yml restart worker
```

---

## 🐛 故障排查

### Worker 不运行？

```bash
# 检查日志
docker compose logs worker

# 检查环境变量
docker compose exec worker env | grep TELEGRAM

# 手动测试 provider
cd apps/worker
pnpm dev
```

### 数据库连接失败？

```bash
# 检查 PostgreSQL
docker compose ps postgres
docker compose logs postgres

# 测试连接
docker compose exec postgres psql -U vpsknow -d vpsknow_stock -c "SELECT 1"
```

### Telegram 通知不发送？

```bash
# 验证 Bot Token
curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe

# 检查频道 ID 格式
echo $TELEGRAM_OFFERS_CHANNEL_ID  # 应为 @channel 或 -100xxx
```

---

## 📚 文档导航

| 文档 | 用途 |
|------|------|
| `README.md` | 项目概览 |
| `CLAUDE.md` | AI 工具开发指南 |
| `docs/TASKS.md` | 完整任务清单 |
| `docs/SPEC.md` | 技术规范 |
| `docs/DEPLOYMENT.md` | 部署详细指南 |
| `docs/DEPLOYMENT_CHECKLIST.md` | 部署检查清单 |
| `docs/PERFORMANCE.md` | 性能优化建议 |
| `docs/PROJECT_STATUS.md` | 项目状态报告 |

---

## 🎯 下一步

1. ✅ 本地开发环境运行成功
2. ✅ 所有测试通过
3. ⏭️ 配置 Telegram Bot
4. ⏭️ 部署到生产环境
5. ⏭️ 监控运行 24 小时

---

**需要帮助？** 查看 [CLAUDE.md](CLAUDE.md) 或提 Issue
