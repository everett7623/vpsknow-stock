# 短链接系统部署指南

> 快速部署 DigVPS 风格的短链接系统

---

## 🚀 快速开始

### 1. 注册 Affiliate 计划 (必须)

你需要先注册各 provider 的 affiliate 计划获取 ID:

**重点 Provider (S-Tier)**:
- [BandwagonHost](https://bandwagonhost.com) - 查找页脚 "Affiliate" 链接
- [BuyVM](https://my.frantech.ca/affiliates.php) - 20% 循环佣金
- [RackNerd](https://my.racknerd.com) - 查找 "Affiliates" 链接

**其他 Provider**:
- 访问各 provider 官网
- 查找 "Affiliate" / "Partners" / "Reseller" 链接
- 注册并获取你的 `aff=xxxxx` ID

---

## 📝 配置步骤

### 步骤 1: 更新 Affiliate ID

编辑 `packages/shared/src/affiliate-config.ts`:

```typescript
// 示例: BandwagonHost
bandwagonhost: {
  provider: 'bandwagonhost',
  affId: '74016',  // ⚠️ 替换为你的真实 ID
  urlTemplate: 'https://bwh81.net/aff.php?aff={affId}&pid={pid}',
  supportsPid: true,
},

// 示例: BuyVM
buyvm: {
  provider: 'buyvm',
  affId: '12345',  // ⚠️ 替换为你的真实 ID
  urlTemplate: 'https://my.frantech.ca/aff.php?aff={affId}',
  supportsPid: false,
},
```

**注意**: 将所有 `YOUR_AFF_ID` 替换为真实 ID。

---

### 步骤 2: 本地测试

```bash
cd D:/EvenFrank/Workspace/Github/vpsknow-stock

# 构建项目
pnpm install
pnpm build

# 生成 Prisma Client
cd packages/database
pnpm db:generate

# 测试更新脚本 (本地数据库)
cd ../..
npx tsx scripts/update-affiliate-links.ts
```

**预期输出**:
```
🔄 Updating affiliate links...

✅ BandwagonHost: Provider link updated
   └─ 6 product links generated
✅ BuyVM: Provider link updated
...

📊 Summary:
   ✨ Created: 15
   ✅ Updated: 5
   ⚠️  Skipped: 2
```

---

### 步骤 3: 提交代码

```bash
git add .
git commit -m "feat: 实现短链接系统(DigVPS模式)

- 添加 /go/[id] 路由 (服务器端 302 重定向)
- 配置 21 个 provider 的 affiliate 链接
- 更新 Telegram 通知使用短链接
- 添加点击统计功能"

git push origin main
```

---

### 步骤 4: 部署到生产环境

#### 4.1 通过 Hetzner Console VNC 连接 VPS

1. 登录 [Hetzner Cloud Console](https://console.hetzner.cloud/)
2. 选择 VPS: `Debian-2gb-falkenstein`
3. 点击 **Console** 打开 VNC
4. 登录: `root` / `9dyQogHUyAQ5uR`
5. 修复防火墙 (如果 SSH 仍然无法连接):

```bash
# 禁用 UFW
ufw disable

# 或者允许 SSH
ufw allow 22/tcp
ufw reload

# 确认 SSH 可用
systemctl status ssh
```

#### 4.2 SSH 连接并部署

```bash
# 从本地连接
ssh root@168.119.246.220

# 进入项目目录
cd /opt/vpsknow/vpsknow-stock

# 拉取最新代码
git pull origin main

# 重新构建并启动
docker compose -f docker-compose.production.yml up -d --build

# 等待构建完成 (约 5-10 分钟)
docker compose -f docker-compose.production.yml logs -f
```

#### 4.3 运行短链接更新脚本

```bash
# 在 worker 容器中执行
docker compose -f docker-compose.production.yml exec worker \
  npx tsx /app/scripts/update-affiliate-links.ts

# 查看生成的短链接
docker compose -f docker-compose.production.yml exec postgres \
  psql -U vpsknow -d vpsknow_stock -c \
  "SELECT slug, \"shortUrl\", clicks FROM affiliate_links LIMIT 10;"
```

---

### 步骤 5: 测试短链接

#### 5.1 测试重定向

```bash
# 测试 provider 级别链接
curl -I https://stock.vpsknow.com/go/buyvm

# 预期输出:
# HTTP/2 302
# location: https://my.frantech.ca/aff.php?aff=YOUR_ID

# 测试 product 级别链接
curl -I https://stock.vpsknow.com/go/bwg-dc6-95

# 预期输出:
# HTTP/2 302
# location: https://bwh81.net/aff.php?aff=YOUR_ID&pid=95
```

#### 5.2 浏览器测试

1. 访问: https://stock.vpsknow.com/go/buyvm
2. 观察浏览器地址栏:
   - ✅ 应该直接跳转到 BuyVM 产品页面
   - ✅ 地址栏不显示 affiliate 链接
   - ✅ 最终 URL 类似: `https://buyvm.net/` 或产品页面

#### 5.3 验证 Affiliate 追踪

1. 登录各 provider 的 affiliate 后台
2. 查看点击统计
3. 确认追踪正常工作

---

## 📊 查询和监控

### 查询所有短链接

```bash
docker compose -f docker-compose.production.yml exec postgres \
  psql -U vpsknow -d vpsknow_stock -c "
SELECT
  al.slug,
  p.name as provider,
  al.\"shortUrl\",
  al.clicks
FROM affiliate_links al
JOIN providers p ON al.\"providerId\" = p.id
ORDER BY p.name, al.slug
LIMIT 30;
"
```

### 点击统计 Top 10

```bash
docker compose -f docker-compose.production.yml exec postgres \
  psql -U vpsknow -d vpsknow_stock -c "
SELECT
  al.slug,
  p.name,
  al.clicks,
  al.\"shortUrl\"
FROM affiliate_links al
JOIN providers p ON al.\"providerId\" = p.id
WHERE al.clicks > 0
ORDER BY al.clicks DESC
LIMIT 10;
"
```

### 实时查看 Worker 日志 (补货通知)

```bash
docker compose -f docker-compose.production.yml logs -f worker | grep "RESTOCK"
```

---

## 🐛 故障排查

### 短链接返回 404

**原因**: 数据库中不存在该 slug

**解决**:
```bash
# 重新运行更新脚本
docker compose -f docker-compose.production.yml exec worker \
  npx tsx /app/scripts/update-affiliate-links.ts
```

### 重定向到错误的 URL

**原因**: affiliate-config.ts 中的 urlTemplate 配置错误

**解决**:
1. 检查 `packages/shared/src/affiliate-config.ts`
2. 修正 `urlTemplate`
3. 重新构建: `docker compose up -d --build`
4. 重新运行更新脚本

### Telegram 通知仍显示旧链接

**原因**: Worker 缓存或未重启

**解决**:
```bash
# 重启 Worker
docker compose -f docker-compose.production.yml restart worker

# 查看最新日志
docker compose -f docker-compose.production.yml logs --tail=50 worker
```

### 点击统计不增加

**原因**: 数据库更新失败 (异步操作)

**解决**:
```bash
# 查看 Web 日志
docker compose -f docker-compose.production.yml logs web | grep "Failed to update click count"

# 检查数据库连接
docker compose -f docker-compose.production.yml exec postgres \
  psql -U vpsknow -d vpsknow_stock -c "SELECT 1;"
```

---

## ✅ 验证清单

部署后验证:

- [ ] 所有 provider 的 affiliate ID 已配置
- [ ] 更新脚本执行成功,无错误
- [ ] 数据库中有 22+ 条 affiliate_links 记录
- [ ] 至少测试 5 个短链接重定向正常
- [ ] Telegram 补货通知使用短链接
- [ ] 浏览器访问短链接,地址栏不显示 affiliate 参数
- [ ] Provider affiliate 后台能看到点击统计
- [ ] `/go/invalid-link` 返回 404

---

## 📈 后续优化

### 1. 添加更多 Provider

编辑 `packages/shared/src/affiliate-config.ts`,添加新 provider:

```typescript
newprovider: {
  provider: 'newprovider',
  affId: 'YOUR_AFF_ID',
  urlTemplate: 'https://newprovider.com/aff.php?aff={affId}',
  supportsPid: false,
},
```

重新运行更新脚本即可生成链接。

### 2. 监控点击率

```sql
-- 每日点击统计
SELECT
  DATE(NOW()) as date,
  SUM(clicks) as total_clicks
FROM affiliate_links;
```

### 3. A/B 测试

对比不同消息格式的点击率,优化转化。

---

**部署完成后,短链接系统将自动工作!** 🎉

用户点击 Telegram 补货通知中的链接,会无感知地通过你的 affiliate 链接跳转,追踪佣金。
