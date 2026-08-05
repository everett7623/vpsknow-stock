# VPSKnow Stock 项目状态报告

> 更新时间：2026-08-06 05:32 (UTC+8)
> 代码基线：`main` (`4097059`)
> 生产 Worker：`main` (`4097059`)

---

## 总体状态

| 阶段 | 状态 | 当前结论 |
|------|------|----------|
| Phase 1 - MVP | 验收中 | 核心链路和生产部署已完成，等待正式稳定性与误报率统计 |
| Phase 2 - Offer + 首批 Provider | 已完成 | 8 个 S-Tier adapter 与三来源 Offer 发现/解析/推送已上线 |
| Phase 3 - Bot + 订阅 | 已完成 | Telegram 订阅、过滤、静音与个性化推送已实现 |
| Phase 4 - 扩展 | 进行中 | 监控范围已收紧为 21 家白名单：20 家已有 adapter，1 家待实现 |

## 本地与 GitHub

- `main` 已推送到 `origin/main`；`4097059` 包含生产迁移修复和 DMIT Playwright 回退。
- Adapter registry 保留 31 个现有 adapter；seed 保留 32 个 provider 目录记录，但 Worker 只调度用户批准且已有 adapter 的 20 家。
- Worker 启动时会删除白名单外旧调度器，并在任务入口再次拒绝白名单外 provider；生产 Redis 中已只保留 20 个 provider scheduler。
- 第 7 个 migration 会幂等注册 ChicagoVPS、LightLayer、SpeedyPage 及其 affiliate link；production `migrate` 服务会在 migration 成功后自动执行幂等 seed。
- HighEndNetwork 的 provider 与 affiliate 记录已录入并保持 inactive；官方 Cloudflare 托管验证无法稳定通过前不启用 adapter。
- Provider 详情页支持库存/售罄分组、价格排序、最后检查时间、affiliate 下单链接和 Telegram 订阅入口。

## 生产环境快照

2026-08-06 部署与验收结果：

| 项目 | 状态 |
|------|------|
| Git | 生产仓库 `main` 为 `4097059`，工作区干净 |
| 数据库备份 | `backups/postgres-20260805T194852Z.dump`，27 MiB，SHA-256 `fb3093aa...a7490` 已校验 |
| Compose | Bot、Caddy、PostgreSQL、Redis、Web、Worker 均为 running |
| 健康检查 | PostgreSQL、Redis、Web、Worker healthy；官方 `verify-production.sh` 通过 |
| 公开网站 | `https://stock.vpsknow.com/api/health` 返回 HTTP 200，数据库 healthy |
| 资源 | Worker 约 520 MiB，Web 约 193 MiB，Bot 约 105 MiB |

数据库只读统计：

| 指标 | 数值 |
|------|------|
| Prisma migrations | 7 completed / 0 incomplete |
| Providers | 34 total / 20 active |
| Products | 1,061 |
| Stock checks (24h) | 287,275 |
| Telegram messages | 201 total / 7 in 24h |
| Notified restock events | 194 |

部署期间首次构建的 Playwright Worker 无法启动：Prisma Client 在 Alpine build stage 只生成了 `linux-musl` 引擎，而 Ubuntu Worker runtime 需要 `debian-openssl-3.0.x`。Worker 先回滚到已知健康镜像，再通过 `binaryTargets` 和 Dockerfile 构建断言修复；修复镜像已在 Ubuntu 容器内以 UID 1001 连接 PostgreSQL 验证，并部署为 `27de7c9` 之后的 Worker 基线。

第 6 个 migration 原先只在 active allowlist 中引用 ChicagoVPS、LightLayer、SpeedyPage，没有在旧生产库中创建这 3 条记录，因此首次部署后只有 17 家 active。生产先执行幂等 seed 恢复为 20 家；随后新增 `20260806010000_register_remaining_monitored_providers` 并让 Compose migrate 自动 seed。隔离 PostgreSQL 17 和生产库均验证为 7/7 migration、20 家 active、HighEndNetwork inactive。

## 质量验证

2026-08-06 本地验证：

- `pnpm test`：17 个测试文件，145 个测试全部通过；DMIT 浏览器回退新增 1 条回归测试。
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
- Prisma schema 与 production Compose 配置校验通过。全部 7 个 migration 与当前 seed 已在隔离 PostgreSQL 17 容器实际执行：32 家 provider 中正好 20 家 active，HighEndNetwork 保持 inactive，32 条 affiliate link 均完成写入；新增 migration SQL 与 seed 均完成重复执行幂等验证，临时容器已删除。
- Playwright `worker-runtime` 已在 Docker Desktop 29.6.2 上实际构建：镜像以 `pwuser`（UID 1001）运行，Chromium 151 可启动并渲染页面。容器内官网 dry-run 再次解析 SaltyFish 19 个商品、RackNerd 59 个商品，库存结果与宿主机一致且均为 0 warning。
- 白名单部署后的初始 35 分钟窗口中，17 家 provider 持续完成库存检查；DMIT 回退部署后恢复为 18/20。SpartanHost 每次解析 70 个商品、V.PS 8 个、SaltyFish 19 个、RackNerd 59 个，VMRack 已在生产网络恢复并解析 3 个商品。
- DMIT 生产直连持续返回 Cloudflare `403`，但生产 Worker 内 Playwright 可加载 14 个官方 `.plan-group`。浏览器回退已部署，宿主机与生产容器 dry-run 均解析 88 个商品、当前 78 个有货；正常调度随后连续 4 次完成 88 个商品检查且 0 错误。
- LightLayer 使用的 PoorVPS 公共缓存 URL 已返回 `404`，adapter 保持失败关闭；需改为可验证的官方库存入口后才能恢复有效监控。
- 生产 New Offer 调度持续完成 LowEndBox 与 LowEndSpirit 两个 RSS 来源，最近轮次均无新条目；LowEndTalk 详情请求仍返回 `403`，但不会阻断另外两个来源。

## 已知运行限制

生产只调度 20 家 approved provider；当前剩余限制集中在以下来源：

- VMISS：14/14 官方分类均返回 Cloudflare `403` challenge，保持失败关闭，不推断库存。
- LightLayer：PoorVPS 公共缓存入口已 `404`；当前没有可重复验证的官方目录库存源，保持失败关闭。
- LowEndTalk：Offer 详情请求持续 `403`；LowEndBox 与 LowEndSpirit 独立运行，不受该来源失败影响。
- HighEndNetwork：四个官方 store 分类均停留在 Cloudflare 托管验证页，因此 provider 保持 inactive。

DMIT 的直连 `403` 已通过单页串行 Playwright 回退处理；SpartanHost、V.PS、SaltyFish、RackNerd 和 VMRack 已在生产持续成功。断路器在连续失败后暂停 5 分钟，并在半开状态做单次恢复探测；Redis 中的高失败计数会跨 Worker 重启保留，不代表暂停逻辑失效。

## 下一步

### P0

- [x] 审核并提交 21 家监控白名单、20 家 active seed 与 affiliate 更新。
- [x] 部署白名单、Playwright Worker、7 个 migration 与自动 seed 到生产环境。
- [x] 确认仅 20 家已有 adapter 处于 active，Worker 只保留 20 个 provider scheduler。
- [ ] 完成连续 24 小时稳定性观察，并记录容器重启、内存趋势和队列积压。
- [ ] 完成 48 小时误报率统计，目标低于 5%。

### P1

- [x] 实现华纳云限量活动 adapter，以活动卡库存、已售数量和真实购买按钮共同判定库存。
- [x] 修复 SpartanHost adapter：顺序抓取官方 WHMCS 分类，以明确库存数量判定状态，并允许单分类失败降级为 warning。
- [x] 修复 V.PS adapter：区分正常订单页内嵌的 Turnstile 与真实 challenge，并完成官网 dry-run。
- [x] 修复 BandwagonHost adapter：主域失败时串行回退官方镜像，并保持主域商品订单链接。
- [x] 为 SaltyFish、RackNerd 引入 worker 专用的串行 Playwright 回退，并完成 fixture 与即时官网 dry-run。
- [x] 为 DMIT 增加官方定价页 `403` 后的单页 Playwright 回退，并在生产容器完成即时 dry-run。
- [ ] 为 LightLayer 替换失效的 PoorVPS 缓存入口，改用可验证的官方库存信号并补 fixture/dry-run。
- [ ] 为 VMISS 寻找可验证的官方库存入口；无法绕过托管验证时继续失败关闭。
- [ ] 实现 HighEndNetwork adapter，并完成 fixture、dry-run 和启用验收；前置条件是官方提供稳定 API/白名单入口，或受支持浏览器可正常通过托管验证。
- [ ] 为白名单内其余失败 adapter 修复可验证的官方库存入口；不再扩展白名单外 provider。
- [ ] 部署前完成 Playwright 回退的 24 小时 dry-run，确认资源占用、失败率与库存信号稳定。
- [ ] 手工验收 Telegram Bot `/start`、`/subscribe` 和 provider 过滤完整流程。
- [ ] 根据真实流量决定缓存层和查询性能调优策略。

### P2

- [ ] Hetzner Server Auction 特殊库存监控。
- [ ] 代理轮换与更细粒度业务指标。

---

详细路线图见 `docs/TASKS.md`，生产操作见 `docs/DEPLOYMENT.md`。
