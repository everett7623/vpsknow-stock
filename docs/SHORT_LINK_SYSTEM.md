# Affiliate 短链接系统实现完成

> 实现时间: 2026-07-31
> 模式: DigVPS 风格 - 服务器端 302 重定向,用户看不到 affiliate 链接

---

## ✅ 已实现功能

### 1. 短链接路由
**文件**: `apps/web/src/app/go/[id]/route.ts`

```
用户点击: https://stock.vpsknow.com/go/bwg-dc6-95
      ↓ (服务器端 302 重定向)
中间跳转: https://bwh81.net/aff.php?aff=YOUR_ID&pid=95
      ↓ (WHMCS 自动跳转)
最终页面: https://bwh81.net/cart.php?a=confproduct&i=1
```

**特性**:
- ✅ 服务器端 302 重定向 (用户看不到 affiliate 链接)
- ✅ 自动记录点击统计 (`AffiliateLink.clicks++`)
- ✅ 1 小时 HTTP 缓存
- ✅ 404 处理 (短链接不存在)

### 2. Affiliate 配置文件
**文件**: `packages/shared/src/affiliate-config.ts`

包含 22 个 provider 的配置:
- ✅ Affiliate ID 占位符 (`YOUR_AFF_ID`)
- ✅ URL 模板 (支持 `{affId}` 和 `{pid}` 占位符)
- ✅ PID 支持标识 (`supportsPid: boolean`)
- ✅ 短链接生成函数 (`generateShortLinkSlug`)
- ✅ Affiliate URL 生成函数 (`generateAffiliateUrl`)

### 3. 数据库更新脚本
**文件**: `scripts/update-affiliate-links.ts`

功能:
- ✅ 遍历所有 providers
- ✅ 生成 provider 级别短链接 (如 `buyvm`)
- ✅ 生成 product 级别短链接 (如 `bwg-dc6-95`, 仅支持 PID 的 provider)
- ✅ 自动跳过未配置 affiliate ID 的 provider
- ✅ Upsert 操作 (创建或更新)

### 4. Telegram 消息更新
**文件**: `packages/telegram/src/formatter.ts`

- ✅ 使用短链接替代原始 affiliate 链接
- ✅ Fallback 到原始链接 (如果短链接不存在)
- ✅ 注释说明参数用途

### 5. SQL 查询脚本
**文件**: `scripts/affiliate-links-queries.sql`

- ✅ 查询所有短链接
- ✅ 点击统计 Top 10
- ✅ 手动插入示例

---

## 📋 使用步骤

### 步骤 1: 注册 Affiliate 计划

访问各 provider 官网注册 affiliate 账户:

| Provider | Affiliate 注册地址 | 说明 |
|----------|-------------------|------|
| BandwagonHost | https://bandwagonhost.com (查找 Affiliate 链接) | 注册后获取 `aff=xxxxx` |
| BuyVM | https://my.frantech.ca/affiliates.php | 20% 循环佣金 |
| RackNerd | https://my.racknerd.com (查找 Affiliate) | 标准 affiliate 计划 |
| ... | ... | ... |

### 步骤 2: 更新配置文件

编辑 `packages/shared/src/affiliate-config.ts`,替换所有 `YOUR_AFF_ID`:

```typescript
bandwagonhost: {
  provider: 'bandwagonhost',
  affId: '74016',  // ⚠️ 替换为你的真实 ID
  urlTemplate: 'https://bwh81.net/aff.php?aff={affId}&pid={pid}',
  supportsPid: true,
},
```

### 步骤 3: 运行更新脚本 (本地测试)

```bash
cd D:/EvenFrank/Workspace/Github/vpsknow-stock

# 安装依赖
pnpm install

# 生成数据库客户端
cd packages/database
pnpm db:generate

# 运行更新脚本
cd ../..
npx tsx scripts/update-affiliate-links.ts
```

### 步骤 4: 部署到生产环境

```bash
# 1. 提交代码
git add .
git commit -m "feat: 实现短链接系统(DigVPS模式)"
git push origin main

# 2. 远程更新 (通过 Hetzner Console VNC)
cd /opt/vpsknow/vpsknow-stock
git pull origin main
docker compose -f docker-compose.production.yml up -d --build

# 3. 运行更新脚本
docker compose -f docker-compose.production.yml exec -T worker \
  npx tsx /app/scripts/update-affiliate-links.ts
```

### 步骤 5: 验证短链接

```bash
# 查询已生成的短链接
docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U vpsknow -d vpsknow_stock -c \
  "SELECT slug, \"shortUrl\", \"targetUrl\" FROM affiliate_links LIMIT 10;"

# 测试短链接重定向
curl -I https://stock.vpsknow.com/go/buyvm
# 应该返回 302 Found, Location: https://my.frantech.ca/aff.php?aff=YOUR_ID
```

---

## 🔧 配置说明

### Provider 级别链接 (通用)

适用于**不支持 PID** 的 provider (如 BuyVM, HostHatch):

```
短链接: https://stock.vpsknow.com/go/buyvm
目标链接: https://my.frantech.ca/aff.php?aff=YOUR_ID
```

### Product 级别链接 (精确)

适用于**支持 PID** 的 provider (如 BandwagonHost, DMIT, RackNerd):

```
短链接: https://stock.vpsknow.com/go/bwg-dc6-95
目标链接: https://bwh81.net/aff.php?aff=YOUR_ID&pid=95

短链接: https://stock.vpsknow.com/go/racknerd-kvm-2g
目标链接: https://my.racknerd.com/aff.php?aff=YOUR_ID&pid=456
```

**优势**:
- ✅ 直接跳转到具体产品页面
- ✅ 更高的转化率
- ✅ 精确追踪每个产品的点击

---

## 📊 数据库 Schema

### `affiliate_links` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String | Primary Key |
| `providerId` | String | Provider ID (外键) |
| `slug` | String | 短链接 ID (唯一,如 `bwg-dc6-95`) |
| `targetUrl` | String | 目标 affiliate 链接 |
| `shortUrl` | String | 完整短链接 URL |
| `clicks` | Int | 点击统计 (默认 0) |

### 示例数据

```sql
INSERT INTO affiliate_links VALUES
(
  'link_001',
  'provider_bandwagonhost_id',
  'bwg-dc6-95',
  'https://bwh81.net/aff.php?aff=74016&pid=95',
  'https://stock.vpsknow.com/go/bwg-dc6-95',
  0
);
```

---

## 🎯 Telegram 通知效果

### 更新前
```
🔗 Order: https://bwh81.net/aff.php?aff=74016&pid=95
```
❌ 用户看到 affiliate 链接,可能不信任

### 更新后
```
🔗 Order: https://stock.vpsknow.com/go/bwg-dc6-95
```
✅ 用户看到自己的域名,更信任
✅ 点击后服务器端 302 到 affiliate 链接
✅ 用户只看到最终产品页面

---

## ⚠️ 注意事项

### 1. Affiliate ID 保密
- ✅ 不要在公开代码中硬编码真实 affiliate ID
- ✅ 使用环境变量或配置文件
- ✅ `.gitignore` 排除包含真实 ID 的配置

### 2. 测试所有链接
- ✅ 手动点击每个短链接,确认跳转正确
- ✅ 检查 affiliate 追踪是否生效 (查看 provider 后台)
- ✅ 确认最终落地页正确

### 3. Provider URL 变更
- ⚠️ Provider 可能更换域名或 affiliate 系统
- ✅ 定期检查链接有效性
- ✅ 监控 404/500 错误率

### 4. 点击统计
- ✅ 使用 `AffiliateLink.clicks` 字段追踪点击
- ✅ 与 provider 后台数据对比,验证追踪准确性
- ✅ 定期分析热门产品,优化推广策略

---

## 📈 后续优化

### 1. 点击分析
```sql
-- 最受欢迎的产品
SELECT
  al.slug,
  p.name,
  al.clicks,
  al."targetUrl"
FROM affiliate_links al
JOIN providers p ON al."providerId" = p.id
WHERE al.clicks > 0
ORDER BY al.clicks DESC
LIMIT 20;
```

### 2. A/B 测试
- 对比 provider 级别 vs product 级别链接的转化率
- 测试不同消息格式的点击率

### 3. 缓存优化
- 增加 CDN 缓存 (Cloudflare)
- Redis 缓存热门链接映射

### 4. 监控告警
- 监控 404 错误率 (短链接不存在)
- 监控重定向响应时间
- Provider affiliate 链接失效告警

---

## 🔗 参考资料

- **DigVPS 补货站**: https://product.digvps.com/
- **WHMCS Affiliate 文档**: https://docs.whmcs.com/Affiliates
- **短链接最佳实践**: 服务器端重定向 + 点击统计

---

## ✅ 检查清单

部署前检查:

- [ ] 已注册所有 provider 的 affiliate 计划
- [ ] 已获取所有 affiliate ID
- [ ] 已更新 `affiliate-config.ts` (替换 `YOUR_AFF_ID`)
- [ ] 已在本地测试更新脚本
- [ ] 已提交代码到 Git
- [ ] 已在生产环境运行更新脚本
- [ ] 已手动测试 5+ 个短链接
- [ ] 已检查 Telegram 通知中的链接
- [ ] 已验证 affiliate 追踪生效

---

**状态**: ✅ 代码已实现,等待填入真实 affiliate ID 后部署

**下一步**: 注册 affiliate 计划 → 更新配置文件 → 运行更新脚本 → 部署生产环境
