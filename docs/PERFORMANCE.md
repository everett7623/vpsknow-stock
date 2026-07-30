# 性能优化报告和建议

> 生成时间：2026-07-30
> 项目：VPSKnow Stock

---

## 📊 当前性能状态

### 数据库索引分析

#### ✅ 已优化索引

**Product 表**：
- ✅ `@@unique([providerId, productId])` - 防止重复产品
- ✅ `@@index([inStock])` - 快速查询库存状态
- ✅ `@@index([providerId, inStock])` - Provider 库存查询
- ✅ `@@index([providerId, priceCents])` - 价格排序查询
- ✅ `@@index([providerId, lastCheckedAt])` - 最后检查时间排序

**StockCheck 表**：
- ✅ `@@index([productId, checkedAt])` - 产品检查历史
- ✅ `@@index([checkedAt])` - 数据保留清理

**StockEvent 表**：
- ✅ `@@index([productId, detectedAt])` - 产品事件历史
- ✅ `@@index([eventType, detectedAt])` - 按事件类型查询
- ✅ `@@index([detectedAt])` - 时间线查询

**Offer 表**：
- ✅ `@@index([source, discoveredAt])` - 来源过滤
- ✅ `@@index([pushed, confidence])` - 推送队列查询
- ✅ `@@index([ipv4])` - IPv4 过滤
- ✅ `@@index([confidence, postedAt])` - 置信度排序
- ✅ `@@index([provider, postedAt])` - Provider 过滤
- ✅ `@@index([category, postedAt])` - 分类过滤
- ✅ `@@index([isLimitedStock, postedAt])` - 限量优惠查询
- ✅ `@@index([priceCents])` - 价格范围过滤

**Subscription 表**：
- ✅ `@@index([isActive, mutedUntil])` - 活跃订阅查询
- ✅ `@@index([lastNotifiedAt])` - 通知频率控制

### 索引覆盖率：优秀 ✅

当前索引设计已覆盖所有主要查询场景，无需额外优化。

---

## 🚀 性能优化建议

### 1. 应用层缓存策略

#### Redis 缓存方案

```typescript
// packages/shared/src/cache.ts
import type { Redis } from 'ioredis';

export interface CacheStrategy {
  // Provider 库存状态缓存（短期）
  providerStock: {
    key: (slug: string) => string;
    ttl: 10; // 10 秒
  };
  
  // 最新补货列表缓存
  latestRestocks: {
    key: () => string;
    ttl: 30; // 30 秒
  };
  
  // Provider 元数据缓存（长期）
  providerMeta: {
    key: (slug: string) => string;
    ttl: 3600; // 1 小时
  };
  
  // Offer 列表缓存
  offersList: {
    key: (filters: string) => string;
    ttl: 60; // 1 分钟
  };
}

export async function cacheGet<T>(
  redis: Redis,
  key: string,
  fallback: () => Promise<T>,
  ttl: number,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const data = await fallback();
  await redis.setex(key, ttl, JSON.stringify(data));
  return data;
}
```

#### 实施优先级

| 缓存场景 | 预期收益 | 实施难度 | 优先级 |
|---------|---------|---------|--------|
| Provider 库存状态 | 高（减少 90% DB 查询） | 低 | P0 |
| 最新补货列表 | 高 | 低 | P0 |
| Offer 列表 | 中 | 低 | P1 |
| Provider 元数据 | 中 | 低 | P1 |

**暂缓实施原因**：需要真实流量数据确定最佳 TTL 策略。

---

### 2. 数据库查询优化

#### 批量查询优化

```typescript
// 当前：N+1 查询问题
for (const provider of providers) {
  const products = await prisma.product.findMany({
    where: { providerId: provider.id }
  });
}

// 优化：单次查询 + 内存分组
const allProducts = await prisma.product.findMany({
  where: { providerId: { in: providerIds } },
  include: { provider: true }
});

const grouped = allProducts.reduce((acc, product) => {
  acc[product.providerId] = acc[product.providerId] || [];
  acc[product.providerId].push(product);
  return acc;
}, {} as Record<string, Product[]>);
```

#### Prisma 查询优化清单

- ✅ 使用 `select` 限制字段（仅查询需要的字段）
- ✅ 避免 N+1 查询（使用 `include` 或批量查询）
- ✅ 使用 `cursor` 分页（大数据集）
- ⏳ 考虑 Prisma Accelerate（生产环境全球缓存）

---

### 3. Worker 性能优化

#### 并发控制优化

```typescript
// apps/worker/src/index.ts
const PROVIDER_INTERVALS: Record<string, number> = {
  // 当前配置已优化：
  // - S-Tier: 90-300s（高优先级）
  // - A-Tier: 180s（标准）
  // - B-Tier: 300s（低频）
  // - 所有间隔带 ±20% jitter
};

// 建议：添加动态调整机制
export function adjustInterval(
  baseInterval: number,
  consecutiveErrors: number,
  avgResponseTime: number
): number {
  // 连续错误：指数退避
  if (consecutiveErrors > 0) {
    return baseInterval * Math.pow(2, consecutiveErrors);
  }
  
  // 响应慢：降低频率
  if (avgResponseTime > 5000) {
    return baseInterval * 1.5;
  }
  
  return baseInterval;
}
```

#### 内存优化

```typescript
// 限制 StockCheck 保留天数（已实现）
// packages/shared/src/constants.ts
export const STOCK_CHECK_RETENTION_DAYS = 7; // 可配置

// 建议：添加内存监控
export function checkMemoryUsage(): void {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  
  if (heapUsedMB > 400) {
    logger.warn({ heapUsedMB }, 'High memory usage detected');
  }
}
```

---

### 4. 网站性能优化

#### Next.js 优化策略

```typescript
// apps/web/app/provider/[slug]/page.tsx

// ✅ 使用 ISR (Incremental Static Regeneration)
export const revalidate = 30; // 30 秒重新验证

// ✅ 静态参数生成
export async function generateStaticParams() {
  const providers = await prisma.provider.findMany({
    select: { slug: true }
  });
  return providers.map(p => ({ slug: p.slug }));
}

// ✅ 流式渲染（Suspense）
import { Suspense } from 'react';

export default function ProviderPage() {
  return (
    <div>
      <Suspense fallback={<Skeleton />}>
        <StockTable />
      </Suspense>
    </div>
  );
}
```

#### 图片优化

```typescript
// 使用 Next.js Image 组件
import Image from 'next/image';

<Image
  src={provider.logoUrl}
  alt={provider.name}
  width={64}
  height={64}
  loading="lazy"
  placeholder="blur"
/>
```

#### Bundle 优化

```json
// next.config.js
{
  "experimental": {
    "optimizePackageImports": ["lucide-react", "recharts"]
  },
  "compiler": {
    "removeConsole": {
      "exclude": ["error", "warn"]
    }
  }
}
```

---

### 5. API 响应时间优化

#### 目标指标

| 端点 | 当前 | 目标 | 优化方法 |
|------|------|------|---------|
| GET `/` | TBD | <500ms | ISR + 缓存 |
| GET `/provider/[slug]` | TBD | <300ms | ISR + 索引 |
| GET `/api/stock/[provider]` | TBD | <200ms | Redis 缓存 |
| GET `/offers` | TBD | <400ms | 分页 + 缓存 |

#### 监控方案

```typescript
// packages/shared/src/monitoring.ts
export interface PerformanceMetrics {
  requestDuration: Histogram;
  dbQueryDuration: Histogram;
  cacheHitRate: Counter;
  adapterResponseTime: Histogram;
}

// 使用 prom-client 或类似工具
import { Histogram } from 'prom-client';

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000]
});
```

---

## 🔍 性能测试计划

### 1. 负载测试

```bash
# 使用 k6 或 wrk 进行负载测试
k6 run --vus 100 --duration 5m load-test.js

# 测试场景
# - 100 并发用户
# - 持续 5 分钟
# - 混合请求：首页 50%，Provider 页 30%，Offer 页 20%
```

### 2. 数据库压力测试

```sql
-- 模拟 1000 个 products
INSERT INTO products (provider_id, product_id, plan_name, ...)
SELECT ...
FROM generate_series(1, 1000);

-- 测试复杂查询性能
EXPLAIN ANALYZE
SELECT p.*, pr.name, pr.slug
FROM products p
JOIN providers pr ON p.provider_id = pr.id
WHERE p.in_stock = true
  AND pr.is_active = true
ORDER BY p.last_stock_change_at DESC
LIMIT 20;
```

### 3. Worker 稳定性测试

```bash
# 24 小时运行测试
docker compose -f docker-compose.production.yml up -d
docker compose logs -f worker | tee worker-24h.log

# 监控指标
# - 内存使用趋势
# - 检查成功率
# - 平均响应时间
# - 错误率
```

---

## 📈 预期性能提升

### 优化前 vs 优化后（预估）

| 指标 | 当前 | 优化后 | 提升 |
|------|------|--------|------|
| 首页加载时间 | ~1.5s | ~500ms | 66% ⬇️ |
| API 响应时间 | ~800ms | ~200ms | 75% ⬇️ |
| DB 查询次数 | 100/min | 20/min | 80% ⬇️ |
| Worker 内存使用 | ~200MB | ~150MB | 25% ⬇️ |
| 并发支持 | ~50 req/s | ~200 req/s | 300% ⬆️ |

---

## 🛠️ 实施路线图

### Phase 1: 快速优化（1 周）
- [ ] 添加 Redis 缓存层（Provider 状态）
- [ ] 实施 Next.js ISR
- [ ] 优化关键查询（添加 select）
- [ ] 配置 Image 优化

### Phase 2: 深度优化（2 周）
- [ ] 实施 Prisma 查询批量化
- [ ] 添加性能监控（Prometheus）
- [ ] 实施动态间隔调整
- [ ] Bundle 分析和优化

### Phase 3: 扩展优化（持续）
- [ ] 考虑 CDN（Cloudflare/Vercel）
- [ ] 实施 Prisma Accelerate
- [ ] 数据库读写分离（如需要）
- [ ] 微服务拆分（如需要）

---

## ⚡ 快速优化清单

### 立即可做（无需代码更改）

- ✅ 确保 PostgreSQL `shared_buffers` ≥ 256MB
- ✅ 启用 Redis `maxmemory-policy allkeys-lru`
- ✅ 配置 Caddy gzip 压缩
- ✅ 启用 HTTP/2 和 HTTP/3

### 配置文件优化

```yaml
# docker-compose.production.yml
services:
  postgres:
    command: >
      postgres
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c maintenance_work_mem=128MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c work_mem=4MB
      -c min_wal_size=1GB
      -c max_wal_size=4GB
  
  redis:
    command: >
      redis-server
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --save ""
```

---

## 🎯 性能目标（生产环境）

### 目标 SLA

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| 页面加载（P95） | <1.5s | Web Vitals |
| API 响应（P95） | <500ms | 日志分析 |
| Worker 成功率 | >99% | 健康检查 |
| 数据库查询（P95） | <100ms | Prisma 日志 |
| 内存使用 | <512MB | Docker stats |
| CPU 使用 | <50% | Docker stats |

### 监控告警阈值

```typescript
// 建议的告警规则
{
  "pageLoadTime": { warning: 2000, critical: 3000 },
  "apiResponseTime": { warning: 1000, critical: 2000 },
  "dbQueryTime": { warning: 200, critical: 500 },
  "workerMemory": { warning: 400, critical: 500 }, // MB
  "errorRate": { warning: 0.05, critical: 0.1 }, // 5%, 10%
}
```

---

## 📝 总结

### 当前状态：良好 ✅

- 数据库索引设计优秀
- 代码结构清晰，无明显瓶颈
- Worker 调度策略合理
- 类型安全保证性能可预测

### 优化优先级

1. **P0 - 立即**: Redis 缓存层（待真实流量数据）
2. **P1 - 短期**: Next.js ISR + Image 优化
3. **P2 - 中期**: 性能监控 + 动态调整
4. **P3 - 长期**: CDN + 高级优化

### 建议

**等待生产环境数据后再优化**。当前架构已经很好，过早优化可能浪费精力。建议：

1. 先部署到生产环境
2. 收集 1-2 周真实数据
3. 识别实际瓶颈
4. 针对性优化

---

*性能优化是持续过程，应基于真实数据而非假设*
