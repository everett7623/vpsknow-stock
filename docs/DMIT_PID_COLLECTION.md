# DMIT WHMCS PID 收集指南

> 用途: 为 DMIT 产品获取真实 WHMCS PID
> 网站: https://www.dmit.io

---

## 📝 如何获取 DMIT 产品的 WHMCS PID

### 步骤 1: 访问 DMIT 官网

```
https://www.dmit.io
```

### 步骤 2: 查找 VPS 产品页面

点击导航栏:
- "Products" → "VPS"
- 或直接访问: https://www.dmit.io/cart.php

### 步骤 3: 点击产品的 "Order Now" 按钮

每个产品都有一个 "Order Now" 或 "Add to Cart" 按钮

### 步骤 4: 查看浏览器地址栏

地址栏会显示类似这样的 URL:

```
https://www.dmit.io/cart.php?a=add&pid=123
                                       ^^^
                                    WHMCS PID
```

### 步骤 5: 记录所有产品的 PID

创建一个表格:

| 产品名称 | 位置 | productId (我们的) | whmcsPid (WHMCS) |
|---------|------|-------------------|------------------|
| PVM.LAX.Pro | Los Angeles | `dmit-pvm-lax-pro` | `123` ← 待填入 |
| PVM.LAX.Pocket | Los Angeles | `dmit-pvm-lax-pocket` | `?` |
| PVM.HKG.Pro | Hong Kong | `dmit-pvm-hkg-pro` | `?` |
| ... | ... | ... | `?` |

---

## 🎯 DMIT 产品列表 (从 seed.ts)

根据代码中的 seed 数据,DMIT 有以下产品需要获取 PID:

```typescript
const dmitPlans = [
  { productId: 'dmit-pvm-lax-tiny', planName: 'PVM.LAX.Tiny', location: 'Los Angeles' },
  { productId: 'dmit-pvm-lax-pocket', planName: 'PVM.LAX.Pocket', location: 'Los Angeles' },
  { productId: 'dmit-pvm-lax-starter', planName: 'PVM.LAX.Starter', location: 'Los Angeles' },
  { productId: 'dmit-pvm-hkg-pocket', planName: 'PVM.HKG.Pocket', location: 'Hong Kong' },
  { productId: 'dmit-pvm-hkg-starter', planName: 'PVM.HKG.Starter', location: 'Hong Kong' },
  { productId: 'dmit-pvm-hkg-lite', planName: 'PVM.HKG.Lite', location: 'Hong Kong' },
];
```

---

## 📋 填入表格 (待完成)

请访问 DMIT 官网,为每个产品填入 WHMCS PID:

### PVM.LAX 系列

| 产品 | productId | whmcsPid |
|------|-----------|----------|
| PVM.LAX.Tiny | `dmit-pvm-lax-tiny` | `_____` ← 填入 |
| PVM.LAX.Pocket | `dmit-pvm-lax-pocket` | `_____` |
| PVM.LAX.Starter | `dmit-pvm-lax-starter` | `_____` |

### PVM.HKG 系列

| 产品 | productId | whmcsPid |
|------|-----------|----------|
| PVM.HKG.Pocket | `dmit-pvm-hkg-pocket` | `_____` |
| PVM.HKG.Starter | `dmit-pvm-hkg-starter` | `_____` |
| PVM.HKG.Lite | `dmit-pvm-hkg-lite` | `_____` |

---

## 🔧 更新代码 (填入 PID 后)

### 编辑 `packages/database/prisma/seed.ts`

```typescript
// 找到 DMIT 产品定义部分
const dmitPlans = [
  {
    productId: 'dmit-pvm-lax-tiny',
    whmcsPid: '123',  // ← 填入真实 PID
    planName: 'PVM.LAX.Tiny',
    location: 'Los Angeles',
    priceCents: 2890,
    billingCycle: 'monthly',
  },
  {
    productId: 'dmit-pvm-lax-pocket',
    whmcsPid: '124',  // ← 填入真实 PID
    planName: 'PVM.LAX.Pocket',
    location: 'Los Angeles',
    priceCents: 1490,
    billingCycle: 'monthly',
  },
  // ... 其他产品
];

// 在 upsert 中添加 whmcsPid
for (const plan of dmitPlans) {
  await prisma.product.upsert({
    where: {
      providerId_productId: { providerId: dmit.id, productId: plan.productId },
    },
    update: {
      whmcsPid: plan.whmcsPid,  // ← 更新
      // ... 其他字段
    },
    create: {
      providerId: dmit.id,
      productId: plan.productId,
      whmcsPid: plan.whmcsPid,  // ← 创建时包含
      planName: plan.planName,
      category: 'vps',
      location: plan.location,
      priceCents: plan.priceCents,
      billingCycle: plan.billingCycle,
    },
  });
}
```

---

## 🧪 本地测试

```bash
cd packages/database

# 推送 schema (添加 whmcsPid 字段)
pnpm db:push

# 重新 seed
pnpm db:seed

# 验证
pnpm prisma studio
# 打开浏览器,查看 Product 表,确认 whmcsPid 已填入
```

---

## 🚀 部署到生产环境

```bash
# 1. 提交代码
git add packages/database/prisma/seed.ts
git commit -m "feat: 添加 DMIT 产品的 WHMCS PID"
git push origin main

# 2. SSH 到 VPS
ssh root@168.119.246.220
cd /opt/vpsknow/vpsknow-stock
git pull origin main

# 3. 运行迁移和 seed
docker compose -f docker-compose.production.yml exec worker \
  npx prisma db push

docker compose -f docker-compose.production.yml exec worker \
  npx tsx /app/packages/database/prisma/seed.ts

# 4. 重新生成短链接
docker compose -f docker-compose.production.yml exec worker \
  npx tsx /app/scripts/update-affiliate-links.ts

# 5. 验证
docker compose -f docker-compose.production.yml exec postgres \
  psql -U vpsknow -d vpsknow_stock -c "
SELECT \"productId\", \"whmcsPid\", \"planName\"
FROM products
WHERE \"providerId\" = (SELECT id FROM providers WHERE slug = 'dmit');
"
```

---

## 📞 需要帮助?

如果访问 DMIT 网站有困难,可以:

1. **查看 affiliate 后台** - 登录 https://www.dmit.io/aff.php?aff=6077,查看推广链接
2. **参考其他补货站** - 看看其他补货监控站点的 DMIT 链接
3. **直接测试** - 先不填 PID,部署后观察 Telegram 通知中的链接是否正确

---

**下一步**: 请访问 DMIT 官网,获取 6 个产品的 WHMCS PID,我帮你更新代码。

> 📋 本指南遵循:`chinese-language.md` - 简体中文回复规则
