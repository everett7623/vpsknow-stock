# Affiliate 链接配置

> 更新时间: 2026-07-31
> 格式: 原始 aff 链接 + pid=xxx

---

## 📋 链接格式说明

### 当前使用 (临时)
```
https://go.uukk.de/provider
```

### 目标格式 (需更新)
```
原始_aff_链接?pid=YOUR_PID
或
https://go.uukk.de/provider?pid=YOUR_PID
```

---

## 🔗 Provider Affiliate 链接汇总

### S-Tier Providers (补货重点)

| Provider | 当前 shortUrl | 原始 targetUrl | 状态 |
|----------|---------------|----------------|------|
| **BandwagonHost** | `https://go.uukk.de/bwg` | `https://bandwagonhost.com/aff.php?aff=YOUR_ID` | ⚠️ 需更新 PID |
| **DMIT** | `https://go.uukk.de/dmit` | `https://www.dmit.io/aff.php?aff=YOUR_ID` | ⚠️ 需更新 PID |
| **BuyVM** | `https://go.uukk.de/buyvm` | `https://my.frantech.ca/aff.php?aff=YOUR_ID` | ⚠️ 需更新 PID |
| **HostHatch** | `https://go.uukk.de/hosthatch` | `https://cloud.hosthatch.com/signup` | ⚠️ 无 aff 参数 |
| **SpartanHost** | `https://go.uukk.de/spartanhost` | `https://billing.spartanhost.net` | ⚠️ 无 aff 参数 |
| **VMISS** | `https://go.uukk.de/vmiss` | `https://app.vmiss.com` | ⚠️ 无 aff 参数 |
| **V.PS** | `https://go.uukk.de/vps` | `https://vps.hosting` | ⚠️ 无 aff 参数 |
| **SaltyFish** | `https://go.uukk.de/saltyfish` | `https://portal.saltyfish.io` | ⚠️ 无 aff 参数 |
| **GreenCloudVPS** | `https://go.uukk.de/greencloudvps` | `https://greencloudvps.com` | ⚠️ 无 aff 参数 |
| **AkileCloud** | `https://go.uukk.de/akilecloud` | `https://next.akile.io/shop/server/` | ⚠️ 无 aff 参数 |

### A-Tier Providers

| Provider | 当前 shortUrl | 原始 targetUrl | 状态 |
|----------|---------------|----------------|------|
| **RackNerd** | `https://go.uukk.de/racknerd` | `https://my.racknerd.com` | ⚠️ 需更新 |
| **Clouvider** | `https://go.uukk.de/clouvider` | `https://www.clouvider.com` | ⚠️ 需更新 |
| **LiteServer** | `https://go.uukk.de/liteserver` | `https://liteserver.nl` | ⚠️ 需更新 |
| **Crunchbits** | `https://go.uukk.de/crunchbits` | `https://crunchbits.com` | ⚠️ 需更新 |
| **ServaRICA** | `https://go.uukk.de/servarica` | `https://servarica.com` | ⚠️ 需更新 |
| **Evoxt** | `https://go.uukk.de/evoxt` | `https://evoxt.com` | ⚠️ 需更新 |
| **Alwyzon** | `https://go.uukk.de/alwyzon` | `https://alwyzon.com` | ⚠️ 需更新 |
| **DediRock** | `https://go.uukk.de/dedirock` | `https://dedirock.com` | ⚠️ 需更新 |
| **Onidel** | `https://go.uukk.de/onidel` | `https://onidel.com` | ⚠️ 需更新 |

### B-Tier Providers

| Provider | 当前 shortUrl | 原始 targetUrl | 状态 |
|----------|---------------|----------------|------|
| **TierHive** | `https://go.uukk.de/tierhive` | `https://tierhive.com` | ⚠️ 需更新 |
| **Gullos** | `https://go.uukk.de/gullos` | `https://gullos.com` | ⚠️ 需更新 |
| **WebHorizon** | `https://go.uukk.de/webhorizon` | `https://webhorizon.in` | ⚠️ 需更新 |

---

## 📝 参考其他补货站点

### 示例 1: HostLoc 补货监控
```
# 典型格式
https://example.com/go/buyvm?pid=123
https://example.com/aff/racknerd?ref=stock123
```

### 示例 2: LowEndBox
```
# WHMCS affiliate 格式
https://provider.com/aff.php?aff=123&pid=456
```

### 示例 3: 短链接服务
```
# 使用短链接服务 + 参数传递
https://go.uukk.de/buyvm?pid=YOUR_PID
```

---

## 🔧 需要的信息

请提供以下信息以完成配置:

1. **你的 PID** (用户 ID / Affiliate ID)
   - 示例: `pid=12345` 或 `aff=67890`

2. **每个 Provider 的 affiliate 参数格式**
   - BandwagonHost: `aff.php?aff=xxx&pid=yyy`
   - BuyVM: `aff.php?aff=xxx`
   - 其他...

3. **参考站点**
   - 提供一个你参考的补货站点链接,我查看他们的格式

---

## 🎯 实施步骤

### 步骤 1: 收集真实 affiliate 链接
```bash
# 示例
BandwagonHost: https://bandwagonhost.com/aff.php?aff=12345
BuyVM: https://my.frantech.ca/aff.php?aff=12345
RackNerd: https://my.racknerd.com/aff.php?aff=67890
```

### 步骤 2: 更新 seed.ts
修改 `packages/database/prisma/seed.ts` 中的 `affiliateLinks` 数组

### 步骤 3: 更新数据库
```bash
cd packages/database
pnpm db:seed
```

### 步骤 4: 部署到生产环境
```bash
# 远程执行
cd /opt/vpsknow/vpsknow-stock
docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U vpsknow -d vpsknow_stock < update-affiliate-links.sql
```

---

## ⚠️ 注意事项

1. **不要公开真实 affiliate ID** - 使用占位符
2. **测试链接有效性** - 每个链接手动点击测试
3. **记录转化追踪** - 使用 `AffiliateLink.clicks` 字段
4. **定期检查** - 部分 provider 的 aff 链接可能变更

---

## 📊 当前状态

- [x] 数据库 schema 已定义 (`AffiliateLink` 表)
- [x] Seed 脚本已包含 22 个 provider
- [ ] **待更新**: 替换 `YOUR_ID` 为真实 affiliate ID
- [ ] **待更新**: 为无 aff 参数的 provider 获取 affiliate 链接
- [ ] **待测试**: 所有链接点击后跳转正确

---

**下一步**: 请提供你的 PID 和参考站点链接,我帮你生成完整的配置。
