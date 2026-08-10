# VPSKnow Stock 项目状态报告

> 更新时间：2026-08-10 21:00 (UTC+8)
> 代码基线：`main` @ `ecf92e8`（远程）+ 本地未提交：CF 补货精度 / 列表排序 + 共享 allowlist
> 生产环境：`stock.vpsknow.com`；监控白名单 **21 家 active**（Clouvider / LiteServer / Evoxt / Onidel / TierHive 已停用）

---

## 总体状态

| 阶段 | 状态 | 当前结论 |
|------|------|----------|
| Phase 1 - MVP | 验收中 | 核心链路和生产部署已完成，等待正式稳定性与误报率统计 |
| Phase 2 - Offer + 首批 Provider | 已完成 | 8 个 S-Tier adapter 与三来源 Offer 发现/解析/推送已上线 |
| Phase 3 - Bot + 订阅 | 已完成 | Telegram 订阅、过滤、静音与个性化推送已实现；地区已改粗粒度匹配 |
| Phase 4 - 扩展 | 进行中 | 监控白名单 **21 家**；共享 `MONITORED_PROVIDERS`；PLACEHOLDER aff / HighEndNetwork 仍休眠 |

## 2026-08-07…08-10 进度

已在 `origin/main`（至 `ecf92e8`）：

| 提交 | 内容 |
|------|------|
| `9ec1cec`…`355179c` | 26 家激活、规格筛选、Bot/aff、Unknown/IPv4 |
| `9337781` | 进度文档 |
| `08c55fc` | 对照竞品补齐 BWH/BuyVM/ZGO/V.PS/CCS 覆盖 |
| `e19ea14` | 停用扫不到的 5 家（→ 21 家）；Providers 侧栏滚动 |
| `22d25f5` | 优化线路 `lineType` 分类 |
| `ecf92e8` | BandwagonHost promo VPS 目录补全 |

本地未提交（已恢复自损坏 commit `3962f4b`）：

| 改动 | 内容 |
|------|------|
| VMISS | 分类被 CF 挡住时，对高信号 PID 做 cart 探针；可选 `VMISS_PROXY_URL` / `PROVIDER_PROXY_URL` |
| Stock engine | OOS stub 不覆盖已有规格 |
| Providers 列表 | Regular 优先；沉底 $0 / 缺规格 junk |
| BWH | 过滤脏购物车 OS 名 / $0 stub |
| Shared | **`MONITORED_PROVIDERS` 统一 seed / worker / bot allowlist** |

## 本地与 GitHub

- 远程 `origin/main` = `ecf92e8`；本地曾 ahead 1 但对象损坏，已 soft-reset 并把改动保留在工作区。
- 常规开发交付只更新文档/代码、提交并 push；除非用户在当前任务明确要求部署，否则不得连接 VPS、运行 Docker、重建容器、重启服务或执行其他生产变更。
- HighEndNetwork 的 provider 与 affiliate 记录已录入并保持 inactive。

## 已知运行限制

- VMISS / DMIT：机房 IP 上 Cloudflare 仍常 403；PID-watch + 可选住宅代理用于提高召回，目录回退仍不宣称库存。
- LowEndTalk：Offer 详情可能 403。
- HighEndNetwork：官方 store 停留在 Cloudflare 托管验证页。

## 下一步

### P0

- [ ] 完成连续 24 小时稳定性观察，并记录容器重启、内存趋势和队列积压。
- [ ] 完成 48 小时误报率统计，目标低于 5%。
- [ ] 提交并推送本地 CF 精度 + 共享 allowlist 改动（待用户确认）。

### P1

- [x] 共享 allowlist 常量，消除 seed/worker/bot 漂移。
- [ ] 配置并验收 VMISS 住宅代理 / PID-watch 生产召回（有代理凭证后再做）。
- [ ] 实现 HighEndNetwork adapter（前置：官方稳定入口）。
- [ ] 手工验收 Telegram Bot `/start`、`/subscribe` 和 provider/region 过滤完整流程。

### P2

- [ ] FlareSolverr / sticky cookie 层（硬 CF 商家）。
- [ ] Hetzner Server Auction 特殊库存监控。
- [ ] 冷备切换演练。

---

详细路线图见 `docs/TASKS.md`，生产操作见 `docs/DEPLOYMENT.md`。
