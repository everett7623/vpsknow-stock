# WHMCS PID 配置指南

> 更新时间: 2026-07-31
> 用途: 为产品添加真实的 WHMCS PID,实现精确跳转

---

## 🔍 什么是 WHMCS PID?

**WHMCS PID** 是 WHMCS (Web Host Manager Complete Solution) 系统中产品的**数字 ID**。

### 示例

```
完整链接: https://bandwagonhost.com/aff.php?aff=68376&pid=95
                                                           ^^^^^^
                                                         WHMCS PID
```

- `aff=68376` - Affiliate ID (我们的推广 ID)
- `pid=95` - Product ID (WHMCS 产品 ID,直达具体产品购买页)

---

## 📊 数据库 Schema 更新

### 添加 `whmcsPid` 字段

```sql
-- Migration: 20260731_add_whmcs_pid
ALTER TABLE products ADD COLUMN "whmcsPid" TEXT;
CREATE INDEX "products_whmcsPid_idx" ON products("whmcsPid");
```

### Product 表结构

```typescript
model Product {
  id                 String   @id
  providerId         String
  productId          String   // 我们的内部 ID (如 "bwg-the-plan-dc6")
  whmcsPid           String?  // WHMCS PID (如 "95")  ⬅️ 新增
  planName           String
  // ... 其他字段
}
```

---

## 🔧 如何获取 WHMCS PID?

### 方法 1: 从产品页面 URL 获取

1. 访问 provider 官网
2. 点击产品的 "Order Now" 按钮
3. 查看浏览器地址栏

```
示例 1 - BandwagonHost:
https://bandwagonhost.com/cart.php?a=add&pid=95
                                            ^^
                                         WHMCS PID

示例 2 - RackNerd:
https://my.racknerd.com/order/config/index/?pid=792
                                                ^^^
                                             WHMCS PID
```

### 方法 2: 从 Affiliate Dashboard 获取

1. 登录 provider 的 affiliate 后台
2. 查找 "Marketing Materials" 或 "Promotion Links"
3. 复制带 PID 的推广链接

### 方法 3: 从现有推广链接提取

```bash
# 示例: 从 DigVPS 的链接中提取
https://bwh81.net/aff.php?aff=74016&pid=95
                                      ^^
                                   提取 PID: 95
```

---

## 📝 填入 WHMCS PID

### 步骤 1: 更新数据库 Schema

```bash
cd packages/database
pnpm db:push
# 或者创建迁移
pnpm prisma migrate dev --name add_whmcs_pid
```

### 步骤 2: 为产品添加 WHMCS PID

编辑 `packages/database/prisma/seed.ts`:

```typescript
// 之前: 只有 productId
const bwgPlans = [
  {
    productId: 'bwg-the-plan-dc6',
    planName: 'THE PLAN',
    location: 'DC6 CN2 GIA-E',
    priceCents: 4999,
    billingCycle: 'annually',
  },
];

// 修改后: 添加 whmcsPid
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
    whmcsPid: '87',  // ⬅️ 需要从 BWH 官网获取
    planName: '20G KVM - CN2 GIA-E',
    location: 'DC6 CN2 GIA-E',
    priceCents: 6599,
    billingCycle: 'annually',
  },
];

// 在 upsert 时包含 whmcsPid
await prisma.product.upsert({
  where: { /* ... */ },
  update: {},
  create: {
    providerId: bandwagonhost.id,
    productId: plan.productId,
    whmcsPid: plan.whmcsPid,  // ⬅️ 添加此行
    planName: plan.planName,
    // ... 其他字段
  },
});
```

### 步骤 3: 重新运行 Seed

```bash
cd packages/database
pnpm db:seed
```

---

## 🎯 效果对比

### 之前 (无 WHMCS PID)

```
短链接: https://stock.vpsknow.com/go/bandwagonhost-bwg-the-plan-dc6
      ↓
跳转到: https://bandwagonhost.com/aff.php?aff=68376
      ↓
最终页面: BandwagonHost 主页 (用户需要手动找产品) ❌
```

### 之后 (有 WHMCS PID)

```
短链接: https://stock.vpsknow.com/go/bandwagonhost-bwg-the-plan-dc6
      ↓
跳转到: https://bandwagonhost.com/aff.php?aff=68376&pid=95
      ↓
最终页面: THE PLAN 产品购买页 (一键下单) ✅
```

---

## 📋 待填入 WHMCS PID 的 Provider

### 高优先级 (支持 PID)

| Provider | 产品数 | 获取方式 |
|----------|--------|----------|
| **BandwagonHost** | 6 | 访问 bandwagonhost.com,点击每个产品的 Order 按钮 |
| **DMIT** | 6 | 访问 dmit.io,查看产品订购链接 |
| **RackNerd** | 未知 | 访问 my.racknerd.com,查看 VPS 产品 |

### 中优先级 (可能支持 PID)

- Evoxt
- LiteServer
- Clouvider
- DediRock

### 低优先级 (不支持 PID)

- BuyVM (使用通用链接)
- GreenCloudVPS (使用通用链接)
- 其他不使用 WHMCS 的 provider

---

## 🚀 部署流程

### 1. 获取 WHMCS PID

手动访问各 provider 网站,记录每个产品的 PID

### 2. 更新 Seed 数据

编辑 `packages/database/prisma/seed.ts`,为每个产品添加 `whmcsPid`

### 3. 本地测试

```bash
cd packages/database
pnpm db:push          # 更新 schema
pnpm db:seed          # 重新 seed
cd ../..
npx tsx scripts/update-affiliate-links.ts  # 生成短链接
```

### 4. 部署到生产环境

```bash
ssh root@168.119.246.220
cd /opt/vpsknow/vpsknow-stock
git pull origin main
docker compose -f docker-compose.production.yml up -d --build

# 运行迁移
docker compose -f docker-compose.production.yml exec worker \
  npx prisma migrate deploy

# 重新 seed
docker compose -f docker-compose.production.yml exec worker \
  npx tsx /app/packages/database/prisma/seed.ts

# 重新生成短链接
docker compose -f docker-compose.production.yml exec worker \
  npx tsx /app/scripts/update-affiliate-links.ts
```

---

## ✅ 验证

### 查询已配置 WHMCS PID 的产品

```sql
SELECT
  p.name as provider,
  pr.\"productId\",
  pr.\"whmcsPid\",
  pr.\"planName\"
FROM products pr
JOIN providers p ON pr.\"providerId\" = p.id
WHERE pr.\"whmcsPid\" IS NOT NULL
ORDER BY p.name, pr.\"planName\";
```

### 测试短链接

```bash
# 有 WHMCS PID 的产品
curl -I https://stock.vpsknow.com/go/bandwagonhost-bwg-the-plan-dc6
# 应该返回: Location: ...aff.php?aff=68376&pid=95

# 无 WHMCS PID 的产品
curl -I https://stock.vpsknow.com/go/buyvm-slice-1024-lv
# 应该返回: Location: ...aff.php?aff=6836 (无 pid)
```

---

## 📝 TODO

- [ ] 获取 BandwagonHost 所有产品的 WHMCS PID
- [ ] 获取 DMIT 所有产品的 WHMCS PID
- [ ] 获取 RackNerd 所有产品的 WHMCS PID
- [ ] 更新 seed.ts 添加 whmcsPid
- [ ] 创建数据库迁移
- [ ] 本地测试
- [ ] 部署到生产环境
- [ ] 验证短链接跳转正确

---

**下一步**: 手动获取各 provider 的 WHMCS PID,更新 seed 数据

> 📋 本文档遵循:`chinese-language.md` - 简体中文回复规则
