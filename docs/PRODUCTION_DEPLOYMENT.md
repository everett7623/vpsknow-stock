# 生产部署实施指南

> 在真实 VPS 上部署 VPSKnow Stock 的详细步骤

---

## 📋 部署前准备

### VPS 要求

- **操作系统**: Ubuntu 22.04 LTS / Debian 12（推荐）
- **CPU**: 最低 2 核，推荐 4 核
- **内存**: 最低 2GB，推荐 4GB
- **磁盘**: 最低 20GB SSD，推荐 40GB
- **网络**: 稳定的网络连接，开放 80/443 端口

### 域名准备

- 已注册域名（例：`stock.vpsknow.com`）
- DNS A 记录指向 VPS IP 地址
- 等待 DNS 生效（通常 5-30 分钟）

---

## 🚀 第一次部署

### 步骤 1：连接 VPS

```bash
ssh root@your-vps-ip
```

### 步骤 2：安装依赖

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 安装 Docker Compose
apt install docker-compose-plugin -y

# 安装 Git
apt install git -y

# 验证安装
docker --version
docker compose version
git --version
```

### 步骤 3：克隆项目

```bash
# 创建工作目录
mkdir -p /opt/vpsknow
cd /opt/vpsknow

# 克隆仓库
git clone https://github.com/everett7623/vpsknow-stock.git
cd vpsknow-stock

# 查看最新版本
git log --oneline -5
```

### 步骤 4：配置环境变量

```bash
# 复制配置文件
cp .env.example .env

# 编辑配置
nano .env
```

**必须配置的环境变量**：

```bash
# 数据库（生成强密码）
POSTGRES_USER=vpsknow
POSTGRES_PASSWORD=<生成一个强密码，至少 16 字符>
POSTGRES_DB=vpsknow_stock
DATABASE_URL=postgresql://vpsknow:<密码>@postgres:5432/vpsknow_stock

# Redis
REDIS_URL=redis://redis:6379

# Telegram（从 @BotFather 获取）
TELEGRAM_BOT_TOKEN=<你的 Bot Token>
TELEGRAM_STOCK_CHANNEL_ID=@vpsknow_stock
TELEGRAM_OFFERS_CHANNEL_ID=@vpsknow_offers
TELEGRAM_ADMIN_CHAT_ID=<你的管理员 Chat ID>

# 网站
SITE_DOMAIN=stock.vpsknow.com
NEXT_PUBLIC_SITE_URL=https://stock.vpsknow.com
ADMIN_DASHBOARD_TOKEN=<生成一个随机字符串，至少 32 字符>

# Affiliate
AFFILIATE_BASE_URL=https://go.uukk.de

# 应用
NODE_ENV=production
LOG_LEVEL=info
```

**生成强密码的方法**：

```bash
# 方法 1：使用 openssl
openssl rand -base64 32

# 方法 2：使用 pwgen（需要安装）
apt install pwgen -y
pwgen 32 1

# 方法 3：在线生成
# 访问 https://passwordsgenerator.net/
```

### 步骤 5：验证配置

```bash
# 运行环境验证脚本
bash scripts/validate-env.sh

# 检查所有必需变量是否设置
grep -E "POSTGRES_PASSWORD|TELEGRAM_BOT_TOKEN|ADMIN_DASHBOARD_TOKEN" .env
```

### 步骤 6：启动服务

```bash
# 启动所有服务
docker compose -f docker-compose.production.yml up -d --build

# 查看启动日志
docker compose -f docker-compose.production.yml logs -f

# 等待所有服务启动（约 2-3 分钟）
# 按 Ctrl+C 退出日志查看
```

### 步骤 7：验证部署

```bash
# 运行验证脚本
bash scripts/verify-production.sh

# 手动检查各服务状态
docker compose -f docker-compose.production.yml ps

# 检查 Worker 健康
curl http://localhost:3001/health

# 检查网站
curl -I https://stock.vpsknow.com

# 查看日志
docker compose -f docker-compose.production.yml logs --tail=50 worker
docker compose -f docker-compose.production.yml logs --tail=50 bot
```

---

## 🔄 更新部署

### 常规更新

```bash
cd /opt/vpsknow/vpsknow-stock

# 拉取最新代码
git pull origin main

# 重新构建和启动
docker compose -f docker-compose.production.yml up -d --build

# 验证更新
bash scripts/verify-production.sh

# 查看日志
docker compose -f docker-compose.production.yml logs --tail=100 worker
```

### 数据库 Migration

```bash
# 如果有 schema 变更，migration 会自动运行
# 查看 migrate 服务日志
docker compose -f docker-compose.production.yml logs migrate

# 手动运行 migration（如需要）
docker compose -f docker-compose.production.yml run --rm migrate
```

---

## 🛠️ 日常运维

### 查看日志

```bash
# 实时查看所有日志
docker compose -f docker-compose.production.yml logs -f

# 查看特定服务日志
docker compose -f docker-compose.production.yml logs -f worker
docker compose -f docker-compose.production.yml logs -f bot
docker compose -f docker-compose.production.yml logs -f web

# 查看最近 100 行日志
docker compose -f docker-compose.production.yml logs --tail=100 worker
```

### 重启服务

```bash
# 重启所有服务
docker compose -f docker-compose.production.yml restart

# 重启特定服务
docker compose -f docker-compose.production.yml restart worker
docker compose -f docker-compose.production.yml restart bot
docker compose -f docker-compose.production.yml restart web
```

### 数据库备份

```bash
# 手动备份
bash scripts/backup-postgres.sh

# 设置定时备份（每天凌晨 2 点）
crontab -e

# 添加以下行
0 2 * * * cd /opt/vpsknow/vpsknow-stock && bash scripts/backup-postgres.sh
```

### 数据库恢复

```bash
# 列出备份文件
ls -lh backups/

# 恢复指定备份
bash scripts/restore-postgres.sh backups/postgres-2026-07-30-020000.dump
```

### 监控资源使用

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看网络连接
netstat -tulpn | grep -E "80|443|3000|5432|6379"
```

---

## 🔍 故障排查

### Worker 不执行检查

```bash
# 查看 Worker 日志
docker compose -f docker-compose.production.yml logs --tail=100 worker

# 检查 Redis 连接
docker compose -f docker-compose.production.yml exec redis redis-cli ping

# 检查数据库连接
docker compose -f docker-compose.production.yml exec postgres \
  psql -U vpsknow -d vpsknow_stock -c "SELECT COUNT(*) FROM providers;"

# 重启 Worker
docker compose -f docker-compose.production.yml restart worker
```

### Telegram 通知不发送

```bash
# 验证 Bot Token
TELEGRAM_BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN .env | cut -d '=' -f2)
curl https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe

# 检查频道 ID
grep TELEGRAM_STOCK_CHANNEL_ID .env

# 查看 Worker 日志中的 Telegram 错误
docker compose -f docker-compose.production.yml logs worker | grep -i telegram
```

### 网站无法访问

```bash
# 检查 Caddy 日志
docker compose -f docker-compose.production.yml logs caddy

# 检查 DNS 解析
dig stock.vpsknow.com

# 检查端口是否开放
netstat -tulpn | grep -E "80|443"

# 检查防火墙
ufw status

# 如果使用 ufw，开放端口
ufw allow 80/tcp
ufw allow 443/tcp
```

### 容器频繁重启

```bash
# 查看容器状态
docker compose -f docker-compose.production.yml ps

# 查看容器日志
docker compose -f docker-compose.production.yml logs --tail=200 <service-name>

# 检查资源使用
docker stats

# 检查磁盘空间
df -h
```

---

## 🔒 安全加固

### 配置防火墙

```bash
# 安装 ufw
apt install ufw -y

# 默认策略
ufw default deny incoming
ufw default allow outgoing

# 允许 SSH（重要！）
ufw allow ssh

# 允许 HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# 启用防火墙
ufw enable

# 查看状态
ufw status
```

### SSH 安全配置

```bash
# 编辑 SSH 配置
nano /etc/ssh/sshd_config

# 修改以下配置
PermitRootLogin no                  # 禁止 root 登录
PasswordAuthentication no           # 禁用密码登录（使用密钥）
Port 22                             # 可以改为其他端口

# 重启 SSH 服务
systemctl restart sshd
```

### 定期更新

```bash
# 系统更新
apt update && apt upgrade -y

# Docker 镜像更新
cd /opt/vpsknow/vpsknow-stock
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d

# 清理旧镜像
docker system prune -a --filter "until=168h"
```

---

## 📊 性能优化

### PostgreSQL 优化

编辑 `docker-compose.production.yml`：

```yaml
services:
  postgres:
    command: >
      postgres
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c maintenance_work_mem=128MB
      -c max_connections=50
```

### Redis 优化

编辑 `docker-compose.production.yml`：

```yaml
services:
  redis:
    command: >
      redis-server
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
```

### 日志轮转

```bash
# 配置 Docker 日志大小限制
nano /etc/docker/daemon.json

# 添加以下内容
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# 重启 Docker
systemctl restart docker
```

---

## 📈 监控告警

### 设置健康检查监控

```bash
# 创建监控脚本
nano /opt/vpsknow/health-monitor.sh

# 内容：
#!/bin/bash
HEALTH_URL="http://localhost:3001/health"
if ! curl -f "$HEALTH_URL" &> /dev/null; then
  echo "Worker health check failed" | mail -s "VPSKnow Alert" admin@example.com
fi

# 添加到 crontab（每 5 分钟检查）
*/5 * * * * /opt/vpsknow/health-monitor.sh
```

### 磁盘空间告警

```bash
# 磁盘空间监控脚本
nano /opt/vpsknow/disk-monitor.sh

# 内容：
#!/bin/bash
USAGE=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $USAGE -gt 80 ]; then
  echo "Disk usage is ${USAGE}%" | mail -s "VPSKnow Disk Alert" admin@example.com
fi

# 添加到 crontab（每小时检查）
0 * * * * /opt/vpsknow/disk-monitor.sh
```

---

## ✅ 部署成功检查清单

- [ ] 所有 Docker 容器运行正常（`docker ps`）
- [ ] Worker 健康检查返回 200（`curl http://localhost:3001/health`）
- [ ] 网站可通过 HTTPS 访问（`curl -I https://stock.vpsknow.com`）
- [ ] 数据库包含 21 个 providers
- [ ] Telegram Bot 响应 `/start` 命令
- [ ] 首次 stock check 已执行（查看 Worker 日志）
- [ ] SSL 证书自动申请成功（Caddy）
- [ ] 备份脚本可执行
- [ ] 防火墙配置正确
- [ ] 定时任务已设置（备份）

---

## 📞 获取帮助

- **GitHub Issues**: https://github.com/everett7623/vpsknow-stock/issues
- **文档**: 查看 `docs/` 目录
- **紧急回滚**: `git checkout <previous-commit> && docker compose up -d --build`

---

**祝部署顺利！🚀**
