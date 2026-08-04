# VPSKnow Stock - hostdzire VPS 部署完成报告

> 部署时间: 2026-07-31 17:37 (UTC+8)
> 部署到: hostdzire VPS (209.50.227.204)
> 状态: ✅ 生产就绪

---

## 🎉 部署成功

### 服务器信息

**原 VPS (Hetzner)**: ❌ SSH 被防火墙锁死,已放弃  
**新 VPS (hostdzire)**: ✅ 部署成功

| 项目 | 值 |
|------|-----|
| **IP** | 209.50.227.204 |
| **配置** | 4核 / 6GB RAM / 100GB SSD |
| **带宽** | 25TB / 10Gbps |
| **系统** | Debian 13 (trixie) |
| **Docker** | 29.7.0 + Compose v5.3.1 |

---

## ✅ 服务状态

| 服务 | 状态 | 说明 |
|------|------|------|
| **Web** | ✅ Healthy | https://stock.vpsknow.com (HTTP/2 200) |
| **Worker** | ✅ Healthy | 已检测到 GreenCloudVPS/BuyVM 补货 |
| **Bot** | ✅ Running | Telegram Bot 运行中 |
| **PostgreSQL** | ✅ Healthy | 22 providers + 19 products |
| **Redis** | ✅ Healthy | 队列系统正常 |
| **Caddy** | ✅ Running | SSL 证书自动申请成功 |

---

## 🔐 SSL 证书

✅ **Let's Encrypt 自动签发成功**

```
Issuer: acme-v02.api.letsencrypt.org-directory
Certificate for: stock.vpsknow.com
Valid until: ~2026-10-30 (90天自动续期)
```

---

## 📊 功能验证

### ✅ HTTPS 访问
```bash
$ curl -I https://stock.vpsknow.com
HTTP/2 200
alt-svc: h3=":443"; ma=2592000
strict-transport-security: max-age=31536000; includeSubDomains
```

### ✅ 数据库
- 22 providers (BandwagonHost, DMIT, BuyVM...)
- 19 products (种子数据)
- 18 affiliate links (真实 affiliate ID)

### ✅ Worker 补货检测
- GreenCloudVPS: 5 次补货通知已发送
- BuyVM: 2 次补货通知已发送
- 部分 provider 遇到 Cloudflare 403 (预期行为)

### ✅ Telegram 通知
- Bot Token: <REDACTED>
- Channel: @vpsknow_stock
- Admin Chat: -1004499373985

---

## 📋 部署清单

### ✅ 已完成

- [x] 从 Excel 导入 18 个真实 affiliate ID
- [x] 实现 DigVPS 风格短链接系统
- [x] 添加 WHMCS PID 支持 (Product.whmcsPid 字段)
- [x] 数据库迁移和 seed
- [x] Docker 环境搭建
- [x] 生产环境部署
- [x] DNS 更新到新 VPS
- [x] SSL 证书自动申请
- [x] Worker 开始监控补货
- [x] Telegram 通知正常发送

### ⚠️ 待完成

- [ ] 填入 DMIT 产品的 WHMCS PID (6 个产品)
- [ ] 配置 Playwright 解决 Cloudflare 403
- [ ] 为部分 provider 配置 API token

---

## 🔑 重要凭据

### SSH 访问
```bash
ssh root@209.50.227.204
Password: <REDACTED>
```

### 数据库
```
User: vpsknow
Password: <REDACTED>
Database: vpsknow_stock
```

### Admin Dashboard
```
URL: https://stock.vpsknow.com/admin
Token: <REDACTED>
```

---

## 📝 日常运维

### 查看服务状态
```bash
cd /opt/vpsknow/vpsknow-stock
docker compose -f docker-compose.production.yml ps
```

### 查看 Worker 日志
```bash
docker compose -f docker-compose.production.yml logs -f worker
```

### 重启服务
```bash
docker compose -f docker-compose.production.yml restart worker
```

### 更新部署
```bash
cd /opt/vpsknow/vpsknow-stock
git pull origin main
docker compose -f docker-compose.production.yml up -d --build
```

### 数据库备份
```bash
docker compose -f docker-compose.production.yml exec postgres \
  pg_dump -U vpsknow vpsknow_stock > backup-$(date +%Y%m%d).sql
```

---

## 🐛 已知问题

### 1. 部分 Provider 遇到 403
**受影响**: DMIT, SpartanHost, VMISS, Crunchbits, Alwyzon

**原因**: Cloudflare 或其他防护拦截 HTTP 请求

**解决方案**: 配置 Playwright 浏览器自动化
```bash
# 在 worker 容器中安装 Playwright
docker compose -f docker-compose.production.yml exec worker \
  npx playwright install chromium
```

### 2. ServaRICA DNS 错误
**错误**: `getaddrinfo ENOTFOUND billing.servarica.com`

**原因**: 域名无法解析,可能已下线

**解决方案**: 确认 provider 是否仍在运营,或更新域名

### 3. WHMCS PID 未配置
**状态**: Product.whmcsPid 字段为 NULL

**影响**: 短链接跳转到 provider 主页而非具体产品

**解决方案**: 手动获取各 provider 产品的 WHMCS PID 并填入

---

## 📈 性能状态

### 资源使用
```
CPU: 4核 (AMD EPYC)
内存: 6GB (当前使用 ~1GB)
磁盘: 100GB (已用 ~5GB)
网络: 25TB / 10Gbps
```

### 容器资源
```
- vpsknow-stock-web: ~200MB
- vpsknow-stock-worker: ~150MB
- vpsknow-stock-bot: ~100MB
- postgres:17-alpine: ~50MB
- redis:7-alpine: ~10MB
- caddy:2-alpine: ~20MB
```

---

## 🎯 后续优化

### 短期 (本周)
- [ ] 填入 DMIT 的 6 个产品 WHMCS PID
- [ ] 配置 Playwright 解决 Cloudflare 403
- [ ] 测试 Telegram Bot 订阅功能

### 中期 (本月)
- [ ] 添加更多 provider
- [ ] 优化 Worker 检查间隔
- [ ] 配置监控告警 (Uptime Kuma)
- [ ] 实现点击统计分析

### 长期
- [ ] 添加 Admin Dashboard 功能
- [ ] 实现 Provider 自动发现
- [ ] 优化数据库查询性能
- [ ] CDN 加速 (Cloudflare)

---

## 📞 访问信息

**公开访问**:
- 网站: https://stock.vpsknow.com
- API: https://stock.vpsknow.com/api/health
- Telegram Bot: @vpsknow_stock_bot
- 补货频道: @vpsknow_stock

**管理访问**:
- SSH: `ssh root@209.50.227.204`
- Admin Dashboard: https://stock.vpsknow.com/admin
- 项目目录: `/opt/vpsknow/vpsknow-stock`

---

## ✅ 部署时间线

| 时间 | 事件 |
|------|------|
| 14:00 | Hetzner VPS SSH 被防火墙锁死,决定放弃 |
| 15:30 | 开始在 hostdzire VPS 部署 |
| 15:35 | 安装 Docker 完成 |
| 15:40 | 克隆代码仓库 |
| 15:45 | 配置 .env 文件 |
| 16:00 | 修复 TypeScript 编译错误 |
| 16:30 | Docker 镜像构建完成 |
| 16:35 | 所有容器启动成功 |
| 16:40 | 数据库迁移和 seed 完成 |
| 17:00 | DNS 更新生效 |
| 17:05 | SSL 证书自动申请成功 |
| 17:10 | Worker 开始检测补货 |
| **17:37** | **部署完成** ✅ |

**总耗时**: ~2.5 小时

---

## 🎉 总结

VPSKnow Stock 已成功部署到 hostdzire VPS (209.50.227.204),所有核心功能正常运行:

1. ✅ **HTTPS 网站** - https://stock.vpsknow.com 可访问
2. ✅ **SSL 证书** - Let's Encrypt 自动签发
3. ✅ **库存监控** - Worker 已开始检测 22 个 provider
4. ✅ **补货通知** - 已发送 7+ 条 Telegram 通知
5. ✅ **短链接系统** - DigVPS 风格服务器端重定向
6. ✅ **数据库** - PostgreSQL 17 + Redis 7 运行正常

**当前问题**: 
- 6 个 provider 因 Cloudflare 403 暂时无法检查
- DMIT 产品 WHMCS PID 待填入

**系统负载**: CPU ~10%, 内存 ~15%, 磁盘 ~5%

**下一步**: 填入 DMIT WHMCS PID,配置 Playwright 解决 Cloudflare 问题

---

**部署状态**: ✅ 生产就绪

**文档版本**: 2026-07-31

> 📋 本报告遵循:`chinese-language.md` - 简体中文回复规则
