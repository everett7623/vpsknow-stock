# VPSKnow Stock 生产部署报告

**部署时间**: 2026-07-31 14:27 (UTC+8)  
**VPS**: Hetzner CX22 (168.119.246.220)  
**域名**: stock.vpsknow.com  
**执行人**: Claude Code

---

## ✅ 部署成功

### 服务状态

| 服务 | 状态 | 说明 |
|------|------|------|
| **Web** | ✅ Running (Healthy) | Next.js 15 网站,HTTPS 正常访问 |
| **Worker** | ✅ Running (Healthy) | 库存监控已启动,检测到 BuyVM 补货 |
| **Bot** | ✅ Running | Telegram Bot 已启动,等待命令 |
| **PostgreSQL** | ✅ Running (Healthy) | 数据库迁移完成,22 providers 已种子 |
| **Redis** | ✅ Running (Healthy) | 队列系统正常 |
| **Caddy** | ✅ Running | SSL 证书自动申请成功 (Let's Encrypt) |

### 核心功能验证

✅ **HTTPS 访问**: https://stock.vpsknow.com 返回 HTTP/2 200  
✅ **SSL 证书**: Let's Encrypt 自动签发,有效期至 2026-08-30  
✅ **数据库**: 22 providers, 19 products, 22 affiliate links  
✅ **库存监控**: Worker 已开始调度检查,检测到 2 次补货:
- BuyVM Las Vegas - Ryzen 3900X (2026-07-31 06:27:06)
- BuyVM New York - Categories (2026-07-31 06:27:07)

✅ **Telegram 通知**: Worker 成功发送补货通知到频道  
✅ **定时备份**: Cron 已配置,每天凌晨 2:00 备份数据库

---

## 🖥️ 服务器信息

**硬件配置**:
- CPU: 2 核
- 内存: 3.7GB (当前使用 1.2GB)
- 磁盘: 38GB (已用 7.5GB, 剩余 29GB)
- 操作系统: Debian 13 (trixie)

**Docker 版本**:
- Docker: 29.6.2
- Docker Compose: v5.3.1

**网络端口**:
- 80/tcp (HTTP) → Caddy 自动重定向到 HTTPS
- 443/tcp (HTTPS) → Caddy → Web (Next.js)
- 22/tcp (SSH)

---

## 📦 部署配置

### 环境变量 (.env)

```bash
# 数据库
POSTGRES_USER=vpsknow
POSTGRES_PASSWORD=<REDACTED>
POSTGRES_DB=vpsknow_stock

# Telegram
TELEGRAM_BOT_TOKEN=<REDACTED>
TELEGRAM_STOCK_CHANNEL_ID=@vpsknow_stock
TELEGRAM_OFFERS_CHANNEL_ID=@vpsknow_offers
TELEGRAM_ADMIN_CHAT_ID=-1004499373985

# 网站
SITE_DOMAIN=stock.vpsknow.com
NEXT_PUBLIC_SITE_URL=https://stock.vpsknow.com
ADMIN_DASHBOARD_TOKEN=<REDACTED>

# 其他
NODE_ENV=production
LOG_LEVEL=info
AFFILIATE_BASE_URL=https://go.uukk.de
```

### Docker Compose 栈

```
vpsknow-stock/
├── postgres (PostgreSQL 17)
├── redis (Redis 7)
├── migrate (一次性运行,已完成)
├── worker (库存监控 + LET 爬取)
├── bot (Telegram Bot)
├── web (Next.js 15)
└── caddy (反向代理 + SSL)
```

---

## ⚠️ 已知问题

### Provider 403 错误 (预期行为)

部分 provider 使用 Cloudflare 防护,HTTP 请求被拦截:

- **DMIT**: HTTP 403
- **SpartanHost**: HTTP 403  
- **VMISS**: HTTP 403 (hk-bgp)
- **DediRock**: Challenge page (vps-us)
- **Gullos**: SSL 错误

**解决方案**: 后续为这些 provider 配置 Playwright 浏览器自动化(需要额外 ~500MB 磁盘)。

### DNS 错误 (Provider 下线)

- **Onidel**: billing.onidel.com 无法解析
- **TierHive**: billing.tierhive.com 无法解析
- **WebHorizon**: billing.webhorizon.net 无法解析

这些可能是 provider 已下线或域名变更,需要手动排查。

---

## 📋 日常运维命令

### 查看服务状态

```bash
cd /opt/vpsknow/vpsknow-stock
docker compose -f docker-compose.production.yml ps
```

### 查看日志

```bash
# 实时查看 Worker 日志
docker compose -f docker-compose.production.yml logs -f worker

# 查看 Bot 日志
docker compose -f docker-compose.production.yml logs -f bot

# 查看所有服务日志
docker compose -f docker-compose.production.yml logs -f
```

### 重启服务

```bash
# 重启 Worker
docker compose -f docker-compose.production.yml restart worker

# 重启所有服务
docker compose -f docker-compose.production.yml restart
```

### 更新部署

```bash
cd /opt/vpsknow/vpsknow-stock
git pull origin main
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml logs -f worker
```

### 数据库备份

```bash
# 手动备份
cd /opt/vpsknow/vpsknow-stock
bash scripts/backup-postgres.sh

# 查看备份文件
ls -lh backups/

# 恢复备份
bash scripts/restore-postgres.sh backups/postgres-YYYY-MM-DD-HHMMSS.dump
```

### 验证部署

```bash
cd /opt/vpsknow/vpsknow-stock
bash scripts/verify-production.sh
```

---

## 🔐 安全建议

### 已完成

✅ 数据库密码使用 32 字符随机强密码  
✅ Admin Token 使用 48 字符随机密钥  
✅ PostgreSQL/Redis 不暴露到公网 (仅内部网络)  
✅ HTTPS 强制启用 (HSTS header)  
✅ Caddy 自动续期 SSL 证书  
✅ 定时备份已配置

### 待完成 (可选)

- [ ] 配置防火墙 (ufw) - 当前未启用
- [ ] 禁用 root SSH 登录,使用密钥认证
- [ ] 配置 fail2ban 防止暴力破解
- [ ] 设置系统自动更新
- [ ] 配置监控告警 (磁盘/内存/健康检查)

### 防火墙配置 (推荐)

```bash
apt install ufw -y
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

---

## 📊 性能状态

### 当前资源使用

- **内存**: 1.2GB / 3.7GB (32%)
- **磁盘**: 7.5GB / 38GB (21%)
- **容器数量**: 6 个 (postgres, redis, web, worker, bot, caddy)

### Docker 镜像大小

- `vpsknow-stock-web`: ~1.2GB (含 Node.js + Next.js + 依赖)
- `vpsknow-stock-worker`: ~1.2GB
- `vpsknow-stock-bot`: ~1.2GB
- `postgres:17-alpine`: ~424MB
- `redis:7-alpine`: ~58MB
- `caddy:2-alpine`: ~89MB

---

## 🎯 后续任务

### 短期 (本周)

- [ ] 测试 Telegram Bot 订阅功能 (`/start`, `/subscribe`)
- [ ] 验证 Admin Dashboard (`https://stock.vpsknow.com/admin`)
- [ ] 配置 Playwright 解决 Cloudflare 403 问题
- [ ] 排查 Onidel/TierHive/WebHorizon DNS 错误

### 中期 (本月)

- [ ] 配置系统监控 (Uptime Kuma / Prometheus)
- [ ] 优化 Worker 检查间隔 (根据实际补货频率调整)
- [ ] 添加更多 provider
- [ ] 配置 CDN (Cloudflare)

### 长期

- [ ] 迁移到 Kubernetes (如需要多节点)
- [ ] 添加 Grafana 可视化监控
- [ ] 实现 Provider 自动发现

---

## 📞 访问信息

**公开访问**:
- 网站: https://stock.vpsknow.com
- API 健康检查: https://stock.vpsknow.com/api/health
- Telegram Bot: @vpsknow_stock_bot
- 补货频道: @vpsknow_stock
- Offers 频道: @vpsknow_offers

**管理访问**:
- SSH: `ssh root@168.119.246.220`
- Admin Dashboard: https://stock.vpsknow.com/admin (需要 Token)
- 项目目录: `/opt/vpsknow/vpsknow-stock`

**重要文件**:
- 配置: `/opt/vpsknow/vpsknow-stock/.env`
- 备份: `/opt/vpsknow/vpsknow-stock/backups/`
- 日志: `docker compose logs` (不落盘,仅内存)

---

## ✅ 部署检查清单

- [x] Git 仓库已克隆
- [x] .env 文件已配置
- [x] Docker 镜像已构建
- [x] 数据库迁移已执行
- [x] Provider 种子数据已导入
- [x] 所有容器运行正常
- [x] PostgreSQL 健康检查通过
- [x] Redis 健康检查通过
- [x] Worker 健康检查通过
- [x] Web 健康检查通过
- [x] SSL 证书自动申请成功
- [x] HTTPS 网站可访问
- [x] Worker 已开始调度检查
- [x] Telegram Bot 已启动
- [x] 补货通知已发送
- [x] 定时备份已配置

---

## 🎉 总结

VPSKnow Stock 已成功部署到 Hetzner CX22 VPS,所有核心功能正常运行:

1. ✅ **网站**: https://stock.vpsknow.com 可通过 HTTPS 访问
2. ✅ **库存监控**: Worker 已开始每 90-300 秒检查 22 个 provider
3. ✅ **补货通知**: 已检测到 BuyVM 补货并推送到 Telegram 频道
4. ✅ **Bot**: @vpsknow_stock_bot 已启动,等待用户订阅
5. ✅ **SSL**: Let's Encrypt 证书自动申请成功,自动续期
6. ✅ **备份**: 定时任务已配置 (每天凌晨 2:00)

**当前问题**: 6 个 provider 因 Cloudflare/DNS 错误暂时无法检查,后续需配置 Playwright 或排查域名。

**系统负载**: 内存 32%, 磁盘 21%, 资源充足。

---

**部署耗时**: ~15 分钟 (镜像构建 ~10 分钟, 服务启动 ~2 分钟)

**下一步**: 在 Telegram 测试 Bot 订阅功能,验证用户端完整流程。
