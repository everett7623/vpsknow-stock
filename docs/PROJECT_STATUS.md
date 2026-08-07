# VPSKnow Stock 项目状态报告

> 更新时间：2026-08-07 08:40 (UTC+8)
> 代码基线：`main` @ `355179c`（库存 Unknown / bandwidthLabel / IPv4 筛选）
> 生产环境：`stock.vpsknow.com`；监控白名单 **26 家 active**（含 Clouvider / LiteServer / Evoxt / Onidel / TierHive / ZgoCloud）

---

## 总体状态

| 阶段 | 状态 | 当前结论 |
|------|------|----------|
| Phase 1 - MVP | 验收中 | 核心链路和生产部署已完成，等待正式稳定性与误报率统计 |
| Phase 2 - Offer + 首批 Provider | 已完成 | 8 个 S-Tier adapter 与三来源 Offer 发现/解析/推送已上线 |
| Phase 3 - Bot + 订阅 | 已完成 | Telegram 订阅、过滤、静音与个性化推送已实现；地区已改粗粒度匹配 |
| Phase 4 - 扩展 | 进行中 | 监控白名单 **26 家**（均有 adapter）；PLACEHOLDER aff / HighEndNetwork 仍休眠 |

## 2026-08-07 进度（站点打磨 + Bot/Aff）

已合并到 `main` 的交付（`9ec1cec` … `355179c`）：

| 提交 | 内容 |
|------|------|
| `9ec1cec` | 激活 6 家休眠商家；Offers region / limited-only；seed aff 同步 |
| `bc53ae2` | Providers 规格筛选：RAM / Storage / Disk / Bandwidth / CPU |
| `6aac939` | Bot 订阅列表对齐 26 家；Clouvider/Evoxt/Onidel/TierHive 产品级 aff |
| `3177f7b` | Bot 地区粗粒度 `resolveRegion`；Notify Me `start=subscribe_{slug}` |
| `355179c` | Product `ipv4` / `bandwidthLabel` / `availabilitySource`；目录回退显示 Unknown |

仍待：

- [ ] 连续 24h 稳定性观察与 48h 误报率统计
- [ ] VMISS 生产 Playwright 回退验收（当前：目录 fail-closed + UI Unknown）
- [ ] HighEndNetwork adapter（官方 CF 托管验证未过）
- [ ] PLACEHOLDER aff 商家（Crunchbits / Servarica / Alwyzon / Gullos / WebHorizon）拿到真实 ID 后再启用
- [ ] 统一 seed / worker / bot 三处 allowlist 为共享常量（防漂移）

## 本地与 GitHub

- `main` 已推送到 `origin/main`；当前基线 `355179c`。
- 常规开发交付只更新文档/代码、提交并 push；除非用户在当前任务明确要求部署，否则不得连接 VPS、运行 Docker、重建容器、重启服务或执行其他生产变更。
- Adapter registry 保留现有 adapter；seed 保留完整 provider 目录，Worker 只调度 `PROVIDER_INTERVALS` 白名单（26 家）。
- Bot `PROVIDERS`、seed `ACTIVE_PROVIDER_SLUGS`、worker `PROVIDER_INTERVALS` 需保持同步。
- HighEndNetwork 的 provider 与 affiliate 记录已录入并保持 inactive；官方 Cloudflare 托管验证无法稳定通过前不启用 adapter。
- Provider 详情页支持库存/售罄/Unknown 分组、规格展示、affiliate 下单链接和带商家深链的 Telegram 订阅入口。

## 生产环境快照

2026-08-06 部署与验收结果（历史基线，部署后请以 compose ps / health 为准）：

| 项目 | 状态 |
|------|------|
| Git | 生产仓库跟随 `origin/main` |
| Compose | Bot、Caddy、PostgreSQL、Redis、Web、Worker 均为 running |
| 健康检查 | PostgreSQL、Redis、Web、Worker healthy |
| 公开网站 | `https://stock.vpsknow.com/api/health` |

部署期间首次构建的 Playwright Worker 无法启动：Prisma Client 在 Alpine build stage 只生成了 `linux-musl` 引擎，而 Ubuntu Worker runtime 需要 `debian-openssl-3.0.x`。已通过 `binaryTargets` 和 Dockerfile 构建断言修复。

生产磁盘曾因 Docker 镜像堆积打满；部署前可 `docker image prune -af`（勿删 volume）。

## 已知运行限制

- VMISS：官方分类常 Cloudflare `403`；目录回退只刷新 PID/套餐元数据，`availabilitySource=catalog`，站点显示 **Unknown**，不宣称有货/售罄。
- LowEndTalk：Offer 详情请求可能 `403`；LowEndBox 与 LowEndSpirit 独立运行。
- HighEndNetwork：官方 store 停留在 Cloudflare 托管验证页，provider 保持 inactive。
- TierHive 购物车 deep-link 无稳定 aff 参数时回退到 `/r/{code}` 落地页。

## 下一步

### P0

- [x] 审核并提交监控白名单、active seed 与 affiliate 更新（当前 26 家）。
- [x] 站点补货页左右结构与顶部导航。
- [x] Bot 订阅列表同步 active providers；`/start subscribe` / `subscribe_{slug}` 深链。
- [x] 站点 Order 统一为 `stock.vpsknow.com/go/...`。
- [x] 规格筛选（RAM/硬盘/带宽/CPU/IPv4）与相对时间、Notify Me。
- [x] VMISS 目录假有货阻断 + Unknown UI。
- [ ] 完成连续 24 小时稳定性观察，并记录容器重启、内存趋势和队列积压。
- [ ] 完成 48 小时误报率统计，目标低于 5%。

### P1

- [x] 多商家 adapter / Playwright 回退（DMIT、SaltyFish、RackNerd、LightLayer 等）已上线。
- [x] Bot 地区粗粒度匹配（与网站 `resolveRegion` 对齐）。
- [x] 产品级 aff 补齐（含新激活商家）。
- [ ] 为 VMISS 增加 HTTP `403` 后的串行 Playwright 回退并验收。
- [ ] 实现 HighEndNetwork adapter（前置：官方稳定入口）。
- [ ] 共享 allowlist 常量，消除 seed/worker/bot 漂移。
- [ ] 手工验收 Telegram Bot `/start`、`/subscribe` 和 provider/region 过滤完整流程。

### P2

- [ ] Hetzner Server Auction 特殊库存监控。
- [ ] 代理轮换与更细粒度业务指标。
- [ ] 冷备切换演练：离机 Postgres dump → 新 VPS Compose 恢复 → DNS 切换。

---

详细路线图见 `docs/TASKS.md`，生产操作见 `docs/DEPLOYMENT.md`。
