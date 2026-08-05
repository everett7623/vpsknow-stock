# VPSKnow Stock 项目状态报告

> 更新时间：2026-08-06 03:39 (UTC+8)
> 本地分支：`main` (`1efea71`)
> 生产版本：`main` (`055d690`)

---

## 总体状态

| 阶段 | 状态 | 当前结论 |
|------|------|----------|
| Phase 1 - MVP | 验收中 | 核心链路和生产部署已完成，等待正式稳定性与误报率统计 |
| Phase 2 - Offer + 首批 Provider | 已完成 | 8 个 S-Tier adapter 与三来源 Offer 发现/解析/推送已上线 |
| Phase 3 - Bot + 订阅 | 已完成 | Telegram 订阅、过滤、静音与个性化推送已实现 |
| Phase 4 - 扩展 | 进行中 | 监控范围已收紧为 21 家白名单：20 家已有 adapter，1 家待实现 |

## 本地与 GitHub

- 本地 `main` 与 `origin/main` 均为 `b60476c`，工作开始时无未提交改动。
- Adapter registry 保留 31 个现有 adapter；seed 保留 32 个 provider 目录记录，其中包括未启用的 HighEndNetwork，但只启用白名单中已有可靠 adapter 的 20 家。
- Worker 只为这 20 家注册定时器，并在任务执行入口再次拒绝白名单外 provider；启动时会清除旧的白名单外定时器。
- Production migration 会注册 BestVM、Neburst、HNCloud 以及 inactive HighEndNetwork，把现有数据库同步为 20 家 active，并更新相应 affiliate 目标地址，不依赖手工执行 seed。
- 白名单尚缺 1 个 adapter：HighEndNetwork；provider 与 affiliate 记录已录入且明确保持 inactive，adapter 完成前不会加入 worker 调度。
- 未合入的 `origin/codex/integrate-origin-main` 是旧集成测试分支；当前 `main` 已包含并持续维护更新后的 `stock-pipeline.integration.test.ts`。
- Provider 详情页已支持库存/售罄分组、价格排序、最后检查时间、affiliate 下单链接和 Telegram 订阅入口。

## 生产环境快照

2026-08-05 只读检查结果：

| 项目 | 状态 |
|------|------|
| Git | `055d690`，工作区干净，比 GitHub 当前 `origin/main` 少 2 个提交 |
| Compose | Bot、Caddy、PostgreSQL、Redis、Web、Worker 均为 running |
| 健康检查 | PostgreSQL、Redis、Web、Worker healthy |
| 公开网站 | `https://stock.vpsknow.com` 返回 HTTP 200 |
| 健康 API | `/api/health` 返回 HTTP 200，数据库 healthy |
| 资源 | Worker 约 121 MiB，Web 约 180 MiB，Bot 约 104 MiB |

数据库只读统计：

| 指标 | 数值 |
|------|------|
| Prisma migrations | 4 completed / 0 incomplete |
| Providers | 27 total / 25 active |
| Products | 553 |
| Stock checks (24h) | 286,818 |
| Telegram messages | 199 total / 5 in 24h |
| Notified restock events | 7 |

生产环境尚未包含以下本地提交：

1. `bcbc2e6` - 完善 DediRock 监控与 VPS 补货模板
2. `b60476c` - 新增 ChicagoVPS、LightLayer 和 SpeedyPage 监控

本次只读取生产状态，没有执行 pull、重建或重启。

## 质量验证

2026-08-06 本地验证：

- `pnpm test`：17 个测试文件，144 个测试全部通过。
- `pnpm typecheck`：13 个 Turbo 任务全部通过。
- `pnpm lint`：13 个 Turbo 任务全部通过。
- `pnpm build`：8 个 Turbo 任务全部通过，Next.js 生产构建成功。
- Fixture → BuyVM adapter → stock engine → Telegram delivery 集成测试通过。
- 三来源 Offer 推送测试已同步当前 `View offer` 消息文案。
- HNCloud 官网 dry-run：仅解析 4 个限量活动套餐；当前均为“即将开售”，0 个被判定为有货。
- New offer dry-run：LowEndBox 与 LowEndSpirit 官方 RSS 均返回 200，分别使用 VPS/Dedicated 子分类 feed，外部 source ID 已命名空间化。
- HighEndNetwork 验证：四个公开 store 分类均返回 Cloudflare `403` challenge；真实浏览器等待后仍停留在托管验证页，无法取得可重复的官方库存信号。搜索索引暴露的非官方源站别名证书不可信，且绕过站点安全层，不作为 adapter 数据源。
- 20 家 active adapter 基线 dry-run：13 家成功，BandwagonHost、SpartanHost、VMISS、V.PS、SaltyFish、RackNerd、VMRack 失败；全程未写数据库、未发 Telegram。
- SpartanHost 已改用 7 个可直连的官方 WHMCS VPS/Storage 分类，以 `N Available` 为唯一库存权威信号。修复后官网 dry-run 解析 70 个商品、21 个有货、0 warning，并保留稳定商品 slug 与 WHMCS PID。
- SpartanHost 修复后重新 dry-run 全部 20 家：14 家成功；当时失败范围收敛为 BandwagonHost、VMISS、V.PS、SaltyFish、RackNerd、VMRack 6 家。
- V.PS 正常 HostBill 订单页会加载 Cloudflare Turnstile 结账脚本；旧 adapter 因匹配页面中的 `cloudflare`/`captcha` 字样而误判 challenge。本地已改用精确 challenge 校验并要求每个分类至少解析出 1 个商品，回归测试覆盖 Turnstile 页面。
- V.PS 修复后官网 dry-run 解析新加坡、东京共 8 个商品，当前 8 个有货；随后重跑全部 20 家，15 家成功，剩余失败为 BandwagonHost、VMISS、SaltyFish、RackNerd、VMRack 5 家。
- BandwagonHost 主域从当前网络直连与 curl 均超时；本地 adapter 已增加官方知识库公开的 `bwh81.net` 镜像作为串行回退，仍把商品订单规范化到 `bandwagonhost.com`。官网 dry-run 解析 55 个商品、当前 55 个有货。
- BandwagonHost 修复后再次重跑全部 20 家：16 家成功；剩余失败为 VMISS、SaltyFish、RackNerd、VMRack 4 家。全程未写数据库、未发 Telegram。
- SaltyFish 已增加 HTTP `403` 后的串行 Playwright 回退；6 个官方 WHMCS 分类官网 dry-run 共解析 19 个商品，当前全部售罄，0 warning。
- RackNerd 已从过期的按机房分类切换到官网当前 8 个 VPS/Dedicated 分类，并增加 HTTP 失败后的单次串行 Playwright 回退；官网 dry-run 共解析 59 个商品，当前 51 个有货，0 warning。
- 修复后再次重跑全部 20 家：18 家成功；剩余失败仅为 VMISS（14/14 官方分类均返回 Cloudflare `403` challenge）和 VMRack（官方边缘节点重置连接）。两者均保持失败关闭，不推断库存；全程未写数据库、未发 Telegram。
- Prisma schema 与 production Compose 配置校验通过；本次 migration 尚未在本地 PostgreSQL 实际执行。
- Playwright `worker-runtime` 已在 Docker Desktop 29.6.2 上实际构建：镜像以 `pwuser`（UID 1001）运行，Chromium 151 可启动并渲染页面。容器内官网 dry-run 再次解析 SaltyFish 19 个商品、RackNerd 59 个商品，库存结果与宿主机一致且均为 0 warning。

## 已知运行限制

生产日志显示正常工作的 adapter 持续产出库存检查，但部分 provider 长期处于半开探测/失败状态：

- 403 或 challenge：SpartanHost、Crunchbits、Alwyzon、SaltyFish、VMISS、V.PS、DediRock、RackNerd；DMIT 偶发 403 后可恢复。
- DNS 失效：Clouvider、LiteServer、ServaRICA、Onidel、TierHive、WebHorizon。
- TLS SNI 错误：Gullos。
- 产品页 404：Evoxt。

SpartanHost 的上述 403 来自生产旧版本使用的官网营销页；本地 adapter 已切换官方 billing 分类并通过 dry-run。V.PS 的生产失败来自旧版 challenge 误判，本地也已修复并通过 dry-run。BandwagonHost 本地已增加官方镜像回退，SaltyFish 与 RackNerd 已增加 Playwright 回退并通过即时官网 dry-run。这些改动均等待合入和部署；当前仍无法取得可验证官方库存信号的是 VMISS 与 VMRack。

断路器会在连续失败后暂停 5 分钟，并在半开状态做单次恢复探测；日志中的高失败计数是 Redis 中跨重启保留的连续失败次数，并不表示暂停逻辑失效。

上述快照来自尚未应用新白名单的生产版本。白名单部署后，Clouvider、LiteServer、Crunchbits、ServaRICA、Evoxt、Alwyzon、Onidel、TierHive、Gullo's、WebHorizon、ZgoCloud 将停止调度外部库存检查。

## 下一步

### P0

- [ ] 审核并提交 21 家监控白名单、20 家 active seed 与 affiliate 更新。
- [ ] 审核并部署 `bcbc2e6..b60476c` 到生产环境。
- [ ] 部署后确认仅 20 家已有 adapter 处于 active，非白名单 provider 不再执行外部检查。
- [ ] 完成连续 24 小时稳定性观察，并记录容器重启、内存趋势和队列积压。
- [ ] 完成 48 小时误报率统计，目标低于 5%。

### P1

- [x] 实现华纳云限量活动 adapter，以活动卡库存、已售数量和真实购买按钮共同判定库存。
- [x] 修复 SpartanHost adapter：顺序抓取官方 WHMCS 分类，以明确库存数量判定状态，并允许单分类失败降级为 warning。
- [x] 修复 V.PS adapter：区分正常订单页内嵌的 Turnstile 与真实 challenge，并完成官网 dry-run。
- [x] 修复 BandwagonHost adapter：主域失败时串行回退官方镜像，并保持主域商品订单链接。
- [x] 为 SaltyFish、RackNerd 引入 worker 专用的串行 Playwright 回退，并完成 fixture 与即时官网 dry-run。
- [ ] 实现 HighEndNetwork adapter，并完成 fixture、dry-run 和启用验收；前置条件是官方提供稳定 API/白名单入口，或受支持浏览器可正常通过托管验证。
- [ ] 为白名单内现有失败 adapter 修复可验证的官方库存入口；不再扩展白名单外 provider。
- [ ] 部署前完成 Playwright 回退的 24 小时 dry-run，确认资源占用、失败率与库存信号稳定。
- [ ] 手工验收 Telegram Bot `/start`、`/subscribe` 和 provider 过滤完整流程。
- [ ] 根据真实流量决定缓存层和查询性能调优策略。

### P2

- [ ] Hetzner Server Auction 特殊库存监控。
- [ ] 代理轮换与更细粒度业务指标。

---

详细路线图见 `docs/TASKS.md`，生产操作见 `docs/DEPLOYMENT.md`。
