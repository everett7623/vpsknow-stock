# VPSKnow Stock 项目状态报告

> 更新时间：2026-08-12 (UTC+8)
> 代码基线：`main`（2026-08-12 发布）
> 生产环境：`stock.vpsknow.com`；监控白名单 **20 家 active**
> 验收：T0 基线已采集（见 `docs/ACCEPTANCE_BASELINE_2026-08-10.md`），24h/48h 窗口进行中

---

## 总体状态

| 阶段 | 状态 | 当前结论 |
|------|------|----------|
| Phase 1 - MVP | **验收中** | T0 健康；待 24h 稳定 + 48h 误报抽检 |
| Phase 2 - Offer + 首批 Provider | 已完成 | Offer 三来源上线；LET 详情常 403 |
| Phase 3 - Bot + 订阅 | 已完成 | 粗粒度地区 + `subscribe_{slug}` |
| Phase 4 - 扩展 | 进行中 | 20 家监控（新增 Evoxt；去 ZgoCloud；VMISS 站内隐藏，TG 旁路补货）；短链分时段统计已上线 |

## 验收 T0（2026-08-10 14:46 UTC）

- Health：web/worker/DB/Redis ✅；磁盘 58%
- Worker RSS ≈ 560 MiB；部署后约 1h uptime（稳定性从部署时刻起算）
- 24h：restock 8（TG sent 8）、sold_out 15；无 manual override
- 关注：VMISS catalog + 无代理 PID-watch=0；V.PS 多分类 403；LET offer 403；`bull:*:failed` 存量 36/70

复检：`python scripts/acceptance-snapshot.py`

## 下一步

### P0（当前）

- [ ] **T+24h** 稳定性复检（容器未异常重建、内存/队列）
- [ ] **T+48h** 通知补货抽检，误报率目标 &lt;5%

### P1（验收后）

- [ ] 配置 `VMISS_PROXY_URL` / `PROVIDER_PROXY_URL` 并验收 PID-watch
- [ ] Bot 手工验收 `/start`、`/subscribe`
- [ ] HighEndNetwork（仍卡 CF）

### P2

- [ ] FlareSolverr / sticky cookie
- [ ] Hetzner Auction
- [ ] 冷备演练

---

详细路线图见 `docs/TASKS.md`，生产操作见 `docs/DEPLOYMENT.md`。
