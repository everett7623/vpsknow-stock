# 📋 WHMCS PID 配置完整总结

> 更新时间: 2026-07-31
> Commit: 待推送
> 状态: ✅ 代码架构完成,⚠️ 等待填入真实 WHMCS PID

---

## 🎯 问题和解决方案

### 问题根源

你说得对!我之前**没搞清楚 PID 的含义**:

❌ **错误理解**: 以为 `productId` (如 `"bwg-the-plan-dc6"`) 就是 PID  
✅ **正确理解**: WHMCS PID 是**数字 ID** (如 `"95"`),需要从 provider 网站获取

### 解决方案

1. **添加 `whmcsPid` 字段** - 在 Product 表中存储真实 WHMCS PID
2. **更新短链接生成逻辑** - 使用 `whmcsPid` 而非 `productId`
3. **手动填入真实 PID** - 访问各 provider 网站获取

---

## ✅ 已完成的架构更新

### 1. 数据库 Schema

```typescript
model Product {
  id                 String   @id
  providerId         String
  productId          String   // 我们的内部 ID (如 "bwg-the-plan-dc6")
  whmcsPid           String?  // ⬅️ 新增: WHMCS PID (如 "95")
  planName           String
  // ... 其他字段
}
```

### 2. Affiliate 配置函数

```typescript
// 更新前
generateAffiliateUrl(providerSlug, productId)

// 更新后
generateAffiliateUrl(providerSlug, whmcsPid)  // whmcsPid 是数字字符串
```

### 3. 短链接生成脚本

```typescript
// 检查产品是否有 whmcsPid
if (config.supportsPid && product.whmcsPid) {
  // 有 WHMCS PID: 生成精确链接
  productTargetUrl = generateAffiliateUrl(provider.slug, product.whmcsPid);
  // 例: aff.php?aff=68376&pid=95
} else {
  // 无已验证 WHMCS PID: 保留精确订单直连
  productTargetUrl = product.orderUrl;
}
```

---

## 📊 效果对比

### 示例: BandwagonHost THE PLAN

| 阶段 | 短链接 | 目标链接 | 效果 |
|------|--------|----------|------|
| **之前 (错误)** | `/go/bandwagonhost-bwg-the-plan-dc6` | `aff.php?aff=68376&pid=bwg-the-plan-dc6` | ❌ WHMCS 无法识别 |
| **现在 (架构)** | `/go/bandwagonhost-bwg-the-plan-dc6` | `aff.php?aff=68376` | ⚠️ 跳转到主页 (未填入 PID) |
| **填入 PID 后** | `/go/bandwagonhost-bwg-the-plan-dc6` | `aff.php?aff=68376&pid=95` | ✅ 跳转到产品购买页 |

---

## 🔧 如何获取 WHMCS PID

### 方法 1: 从产品订购链接获取 (推荐)

```bash
# 1. 访问 provider 官网
https://bandwagonhost.com

# 2. 找到产品,点击 "Order Now"

# 3. 查看浏览器地址栏
https://bandwagonhost.com/cart.php?a=add&pid=95
                                            ^^
                                      这就是 WHMCS PID

# 4. 记录: productId="bwg-the-plan-dc6" → whmcsPid="95"
```

### 方法 2: 从 Affiliate Dashboard 获取

1. 登录 provider 的 affiliate 后台
2. 查找 "Marketing Materials" 或 "Product Links"
3. 复制推广链接,提取 `pid` 参数

### 方法 3: 从参考链接提取

```
DigVPS 示例链接: https://bwh81.net/aff.php?aff=74016&pid=95
                                                      ^^
                                               提取 PID: 95
```

---

## 📝 填入 WHMCS PID 的步骤

### 步骤 1: 收集所有产品的 WHMCS PID

创建一个临时表格记录:

| Provider | Product Name | productId | whmcsPid |
|----------|--------------|-----------|----------|
| BandwagonHost | THE PLAN | `bwg-the-plan-dc6` | `95` |
| BandwagonHost | 20G KVM | `bwg-20g-kvm-dc6` | `87` |
| DMIT | PVM.LAX.Pro | `dmit-pvm-lax-pro` | `?` |
| RackNerd | 2GB KVM | `racknerd-kvm-2g` | `?` |

### 步骤 2: 更新 seed.ts

```typescript
// packages/database/prisma/seed.ts

const bwgPlans = [
  {
    productId: 'bwg-the-plan-dc6',
    whmcsPid: '95',  // ⬅️ 添加真实 WHMCS PID
    planName: 'THE PLAN',
    location: 'DC6 CN2 GIA-E',
    priceCents: 4999,
    billingCycle: 'annually',
  },
  {
    productId: 'bwg-20g-kvm-dc6',
    whmcsPid: '87',  // ⬅️ 需要从官网获取
    planName: '20G KVM - CN2 GIA-E',
    location: 'DC6 CN2 GIA-E',
    priceCents: 6599,
    billingCycle: 'annually',
  },
];

// upsert 时包含 whmcsPid
await prisma.product.upsert({
  where: { /* ... */ },
  update: { whmcsPid: plan.whmcsPid },  // ⬅️ 更新
  create: {
    providerId: bandwagonhost.id,
    productId: plan.productId,
    whmcsPid: plan.whmcsPid,  // ⬅️ 创建时包含
    planName: plan.planName,
    // ... 其他字段
  },
});
```

### 步骤 3: 运行数据库迁移

```bash
cd packages/database

# 生成 Prisma Client
pnpm db:generate

# 推送 schema 到数据库 (添加 whmcsPid 字段)
pnpm db:push

# 重新 seed (更新 whmcsPid)
pnpm db:seed
```

### 步骤 4: 重新生成短链接

```bash
cd ../..
npx tsx scripts/update-affiliate-links.ts

# 预期输出:
# ✅ BandwagonHost: Provider link updated
#    └─ 2 product-specific links (with WHMCS PID)
#    └─ 4 provider links (no WHMCS PID)
```

---

## 🚀 生产环境部署

### 步骤 1: 推送代码

```bash
git push origin main
```

### 步骤 2: SSH 到 VPS (修复防火墙后)

```bash
ssh root@168.119.246.220
cd /opt/vpsknow/vpsknow-stock
git pull origin main
```

### 步骤 3: 运行迁移

```bash
# 构建新镜像
docker compose -f docker-compose.production.yml up -d --build

# 运行迁移 (添加 whmcsPid 字段)
docker compose -f docker-compose.production.yml exec worker \
  npx prisma db push

# 重新 seed (如果已更新 whmcsPid)
docker compose -f docker-compose.production.yml exec worker \
  npx tsx /app/packages/database/prisma/seed.ts
```

### 步骤 4: 重新生成短链接

```bash
docker compose -f docker-compose.production.yml exec worker \
  npx tsx /app/scripts/update-affiliate-links.ts
```

### 步骤 5: 验证

```bash
# 查询已配置 WHMCS PID 的产品
docker compose -f docker-compose.production.yml exec postgres \
  psql -U vpsknow -d vpsknow_stock -c "
SELECT
  p.name as provider,
  pr.\"productId\",
  pr.\"whmcsPid\",
  pr.\"planName\"
FROM products pr
JOIN providers p ON pr.\"providerId\" = p.id
WHERE pr.\"whmcsPid\" IS NOT NULL;
"

# 测试短链接
curl -I https://stock.vpsknow.com/go/bandwagonhost-bwg-the-plan-dc6
# 如果有 whmcsPid: Location: ...aff.php?aff=68376&pid=95
# 如果无 whmcsPid: Location: ...aff.php?aff=68376
```

---

## 📋 待办事项清单

### 🔴 必须完成

- [ ] **获取 BandwagonHost 所有产品的 WHMCS PID** (6 个产品)
  - 访问 https://bandwagonhost.com
  - 点击每个产品的 "Order Now"
  - 记录 URL 中的 `pid=xxx`

- [ ] **获取 DMIT 所有产品的 WHMCS PID** (6 个产品)
  - 访问 https://www.dmit.io
  - 查看产品订购链接

- [ ] **获取 RackNerd 产品的 WHMCS PID**
  - 访问 https://my.racknerd.com
  - 查看 VPS 产品链接

### 🟡 可选完成

- [x] LiteServer - 已从产品卡片 ID 提取 PID
- [ ] Clouvider - 未验证产品级 affiliate 规则，保留精确订单直连
- [ ] Evoxt - 未验证产品级 affiliate 规则，保留精确订单直连

### ✅ 已完成

- [x] 添加 Product.whmcsPid 字段
- [x] 更新短链接生成逻辑
- [x] 创建数据库迁移
- [x] 更新文档

---

## 📖 相关文档

- **`docs/WHMCS_PID_GUIDE.md`** - 完整配置指南
- **`docs/SHORT_LINK_PRODUCT_FIX.md`** - 问题修复说明
- **`packages/database/prisma/migrations/20260731_add_whmcs_pid/migration.sql`** - 数据库迁移

---

## 🎯 下一步行动

### 立即行动

1. **手动获取 WHMCS PID** - 访问各 provider 网站,记录每个产品的真实 PID
2. **更新 seed.ts** - 为每个产品添加 `whmcsPid` 字段
3. **本地测试** - 运行迁移和 seed,确认短链接正确

### 部署顺序

```
1. 修复 VPS SSH 访问 (通过 Hetzner Console VNC)
   ↓
2. 推送代码到 GitHub
   ↓
3. SSH 到 VPS, git pull
   ↓
4. 运行数据库迁移 (添加 whmcsPid 字段)
   ↓
5. 重新 seed (如果已填入 WHMCS PID)
   ↓
6. 重新生成短链接
   ↓
7. 测试验证
```

---

## ✅ 总结

### 问题已理解

你说得对!我之前**没搞清楚 PID**:
- ❌ 误以为 `productId` 就是 PID
- ✅ 现在理解 WHMCS PID 是数字 ID,需要手动获取

### 架构已完成

- ✅ 数据库 schema 已添加 `whmcsPid` 字段
- ✅ 短链接生成逻辑已更新
- ✅ 检查 `product.whmcsPid` 决定是否使用精确链接
- ✅ 完整文档已创建

### 待填入数据

- ⚠️ 需要手动访问各 provider 网站获取真实 WHMCS PID
- ⚠️ 更新 seed.ts 为产品添加 whmcsPid
- ⚠️ 重新 seed 数据库

---

**状态**: ✅ 代码架构完成,⚠️ 等待填入真实 WHMCS PID

**当前阻塞**: 
1. VPS SSH 访问被防火墙阻止
2. 需要手动获取各 provider 的 WHMCS PID

**预计完成时间**: 获取 PID 后 2 小时内完成部署

---

> 📋 本总结遵循:`chinese-language.md` - 简体中文回复规则
