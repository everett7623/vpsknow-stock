# VPSKnow Stock - 短链接系统总结

> 实现时间: 2026-07-31
> 状态: ✅ 代码完成,等待 Affiliate ID 配置

---

## 📦 已创建的文件

### 核心功能
1. **`apps/web/src/app/go/[id]/route.ts`** - 短链接路由 (302 重定向)
2. **`packages/shared/src/affiliate-config.ts`** - Affiliate 配置文件 (22 个 provider)
3. **`scripts/update-affiliate-links.ts`** - 数据库更新脚本
4. **`scripts/affiliate-links-queries.sql`** - SQL 查询脚本

### 文档
5. **`docs/AFFILIATE_LINKS.md`** - Affiliate 链接汇总
6. **`docs/SHORT_LINK_SYSTEM.md`** - 系统实现说明
7. **`docs/SHORT_LINK_DEPLOYMENT.md`** - 部署指南 (快速开始)

### 配置
8. **`scripts/package.json`** - 脚本依赖配置
9. **`packages/shared/src/index.ts`** - 导出 affiliate-config
10. **`packages/telegram/src/formatter.ts`** - 更新消息格式使用短链接

---

## 🎯 系统特性

### ✅ DigVPS 模式实现
```
用户点击: https://stock.vpsknow.com/go/bwg-dc6-95
      ↓ (服务器端 302,用户看不到)
中间跳转: https://bwh81.net/aff.php?aff=YOUR_ID&pid=95
      ↓ (WHMCS 自动跳转)
最终页面: https://bwh81.net/cart.php?a=confproduct&i=1
```

**用户体验**:
- ✅ 点击短链接
- ✅ 直接看到产品页面
- ✅ 地址栏不显示 affiliate 参数
- ✅ 更信任自己的域名

### ✅ 双层链接支持

**Provider 级别** (通用):
- 适用于没有稳定产品 PID 的 provider（如 Evoxt）
- 格式: `https://stock.vpsknow.com/go/buyvm`
- 跳转到 provider 主页

**Product 级别** (精确):
- 适用于支持 PID 的 provider（BandwagonHost、DMIT、BuyVM、SpartanHost、GreenCloudVPS、VMISS、SaltyFish、RackNerd、LiteServer、DediRock、BageVM）
- 格式: `https://stock.vpsknow.com/go/bwg-dc6-95`
- 直接跳转到具体产品页面

### ✅ 自动功能

- **点击统计**: 每次点击自动 `clicks++`
- **HTTP 缓存**: 1 小时缓存,减少数据库压力
- **404 处理**: 不存在的短链接返回 404
- **Fallback**: 如果短链接不存在,使用原始链接

---

## 📋 使用流程

### 1️⃣ 注册 Affiliate 计划

访问各 provider 官网获取 affiliate ID:

| Provider | 注册地址 | 佣金 |
|----------|---------|------|
| BandwagonHost | https://bandwagonhost.com (页脚 Affiliate) | 标准佣金 |
| BuyVM | https://my.frantech.ca/affiliates.php | 20% 循环 |
| RackNerd | https://my.racknerd.com (查找 Affiliates) | 标准佣金 |

### 2️⃣ 更新配置文件

编辑 `packages/shared/src/affiliate-config.ts`:

```typescript
bandwagonhost: {
  provider: 'bandwagonhost',
  affId: '74016',  // ⚠️ 替换为你的真实 ID
  urlTemplate: 'https://bwh81.net/aff.php?aff={affId}&pid={pid}',
  supportsPid: true,
},
```

### 3️⃣ 本地测试

```bash
cd D:/EvenFrank/Workspace/Github/vpsknow-stock
pnpm install
pnpm build
npx tsx scripts/update-affiliate-links.ts
```

### 4️⃣ 部署生产环境

```bash
# 提交代码
git add .
git commit -m "feat: 实现短链接系统(DigVPS模式)"
git push origin main

# SSH 到 VPS (通过 Hetzner Console VNC 修复防火墙后)
ssh root@168.119.246.220
cd /opt/vpsknow/vpsknow-stock
git pull origin main
docker compose -f docker-compose.production.yml up -d --build

# 运行更新脚本
docker compose -f docker-compose.production.yml exec worker \
  npx tsx /app/scripts/update-affiliate-links.ts
```

### 5️⃣ 测试验证

```bash
# 测试重定向
curl -I https://stock.vpsknow.com/go/buyvm

# 查询短链接
docker compose -f docker-compose.production.yml exec postgres \
  psql -U vpsknow -d vpsknow_stock -c \
  "SELECT slug, \"shortUrl\", clicks FROM affiliate_links LIMIT 10;"

# 查看 Telegram 通知
docker compose -f docker-compose.production.yml logs -f worker | grep "RESTOCK"
```

---

## 🔧 配置示例

### 支持 PID 的 Provider (推荐)

```typescript
bandwagonhost: {
  provider: 'bandwagonhost',
  affId: '74016',
  urlTemplate: 'https://bwh81.net/aff.php?aff={affId}&pid={pid}',
  supportsPid: true,  // ✅ 支持产品级别链接
},
```

**效果**:
- Provider 链接: `/go/bandwagonhost` → 主页
- Product 链接: `/go/bwg-dc6-95` → 具体产品页面

### 不支持 PID 的 Provider

```typescript
evoxt: {
  provider: 'evoxt',
  affId: '994',
  urlTemplate: 'https://console.evoxt.com/aff.php?aff={affId}',
  supportsPid: false,
},
```

**效果**:
- Provider 链接: `/go/evoxt` → affiliate 入口
- Product 链接: 使用 adapter 提取的精确订单直连

---

## 📊 数据流图

```
[Telegram 补货通知]
      ↓
https://stock.vpsknow.com/go/bwg-dc6-95
      ↓
[Next.js /go/[id] 路由]
      ↓
[查询数据库: affiliate_links WHERE slug='bwg-dc6-95']
      ↓
[更新点击统计: clicks++]
      ↓
[302 重定向: https://bwh81.net/aff.php?aff=74016&pid=95]
      ↓
[WHMCS 识别 affiliate 参数]
      ↓
[用户最终看到: https://bwh81.net/cart.php?a=confproduct&i=1]
```

---

## ⚠️ 注意事项

### 1. Affiliate ID 保密
- ❌ 不要在公开 GitHub 仓库硬编码真实 ID
- ✅ 使用环境变量或私有配置文件
- ✅ 添加 `.gitignore` 规则

### 2. 链接测试
- ✅ 手动点击每个短链接
- ✅ 检查最终落地页正确
- ✅ 在 provider affiliate 后台验证追踪生效

### 3. 定期维护
- ⚠️ Provider 可能更换域名或 affiliate 系统
- ✅ 定期检查链接有效性
- ✅ 监控 404 错误率

### 4. 防火墙问题
- ⚠️ 生产 VPS 的 SSH 仍被防火墙阻止
- ✅ 通过 Hetzner Console VNC 访问
- ✅ 运行 `ufw disable` 或 `ufw allow 22/tcp`

---

## 📈 后续优化

### 1. 点击分析
```sql
-- 最受欢迎的产品
SELECT slug, clicks, "shortUrl"
FROM affiliate_links
WHERE clicks > 0
ORDER BY clicks DESC
LIMIT 20;
```

### 2. CDN 加速
- 添加 Cloudflare CDN
- 缓存 `/go/*` 路由

### 3. 监控告警
- 监控 404 错误率
- 监控重定向响应时间
- Provider 链接失效告警

### 4. A/B 测试
- 对比不同消息格式的点击率
- 优化 CTA (Call-to-Action)

---

## ✅ 检查清单

部署前:
- [ ] 已注册所有 provider 的 affiliate 计划
- [ ] 已获取所有 affiliate ID
- [ ] 已更新 `affiliate-config.ts`
- [ ] 已在本地测试更新脚本
- [ ] 已提交代码到 Git

部署后:
- [ ] 已在生产环境运行更新脚本
- [ ] 已测试 5+ 个短链接
- [ ] 已检查 Telegram 通知中的链接
- [ ] 已验证 affiliate 追踪生效
- [ ] 已修复 VPS SSH 访问问题

---

## 📞 下一步

### 🔴 紧急任务
1. **修复 VPS SSH 访问** (通过 Hetzner Console VNC)
2. **注册 Affiliate 计划** (获取真实 ID)
3. **更新配置文件** (替换 `YOUR_AFF_ID`)

### 🟢 部署任务
4. **提交代码** (`git push`)
5. **生产部署** (`docker compose up -d --build`)
6. **运行更新脚本** (生成短链接)
7. **测试验证** (点击短链接)

### 🔵 优化任务
8. **监控点击统计** (每周查看)
9. **分析转化率** (对比 provider 后台)
10. **优化消息格式** (提高点击率)

---

**状态**: ✅ 代码实现完成

**阻塞**: ⚠️ 等待 Affiliate ID 配置 + VPS SSH 访问修复

**预计完成时间**: 配置 ID 后 1 小时内部署完成

---

> 📋 本总结遵循:`chinese-language.md` - 简体中文回复规则
