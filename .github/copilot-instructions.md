# GitHub Copilot Instructions for VPSKnow Stock

> 本项目的完整开发指南请参考根目录的 `CLAUDE.md`

## 项目概述

VPSKnow Stock 是一个实时 VPS 补货监控和 LowEndTalk 优惠聚合平台。

- **Website**: stock.vpsknow.com
- **Alerts Channel**: @vpsknow_offers

## 技术栈

- **语言**: TypeScript (strict mode) + Node.js >=22
- **前端**: Next.js 15 (App Router) + React 19 + Tailwind 4
- **后端**: PostgreSQL + Prisma + Redis + BullMQ
- **Telegram**: grammy library
- **Monorepo**: Turborepo + pnpm workspaces

## 常用命令

```bash
# 开发
pnpm install
pnpm dev

# 测试
pnpm test
pnpm typecheck
pnpm lint

# 数据库
cd packages/database
pnpm db:generate
pnpm db:migrate
pnpm db:push
```

## 架构模式

### Provider Adapter 模式

所有 provider 适配器实现统一接口：

```typescript
interface ProviderAdapter {
  slug: string;
  name: string;
  check(): Promise<StockResult[]>;
}
```

位置：`packages/providers/src/adapters/`

### Stock Check 生命周期

1. Worker 调度 BullMQ 任务
2. Provider adapter 抓取库存
3. Stock engine 处理结果
4. 连续 2 次确认 → 触发补货事件
5. 通知 Telegram 频道 + 订阅用户

### 核心包结构

```
packages/
├── database/     # Prisma schema & client（所有服务依赖）
├── providers/    # Provider 适配器（registry 模式）
├── parsers/      # LowEndTalk HTML 解析
├── telegram/     # 消息格式化和发送工具
├── shared/       # 类型、常量、工具函数
└── config/       # ESLint、TypeScript 共享配置
```

## 开发规范

- **代码风格**: 遵循项目的 ESLint 配置（`packages/config/eslint.cjs`）
- **类型安全**: 启用 strict mode，避免 `any`
- **测试**: 使用 Vitest，集成测试用真实 Prisma client
- **提交**: 遵循 Conventional Commits 规范

## 添加新功能

### 添加新 Provider

1. 创建适配器文件
2. 实现 `ProviderAdapter` 接口
3. 注册到 registry
4. 配置检查间隔（S/A/B tier: 90-300s）
5. 添加种子数据
6. 编写测试

### 修改数据库 Schema

1. 编辑 `packages/database/prisma/schema.prisma`
2. 运行 `pnpm db:migrate` 创建 migration
3. 更新相关的 TypeScript 类型

---

**详细文档**: 完整的架构说明、数据流、环境变量、部署流程等信息请参考项目根目录的 `CLAUDE.md`。
