/**
 * 缓存策略配置
 */
export const CACHE_KEYS = {
  providerStock: (slug: string) => `provider:stock:${slug}`,
  latestRestocks: () => 'restocks:latest',
  providerMeta: (slug: string) => `provider:meta:${slug}`,
  offersList: (filters: string) => `offers:list:${filters}`,
} as const;

export const CACHE_TTL = {
  providerStock: 10, // 10 秒 - 短期缓存，保持实时性
  latestRestocks: 30, // 30 秒 - 首页数据
  providerMeta: 3600, // 1 小时 - 静态元数据
  offersList: 60, // 1 分钟 - Offer 列表
} as const;

/**
 * Redis 连接接口（兼容 ioredis）
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  pipeline(): RedisPipeline;
}

export interface RedisPipeline {
  setex(key: string, seconds: number, value: string): RedisPipeline;
  exec(): Promise<unknown>;
}

/**
 * 通用缓存获取函数
 * @param redis Redis 连接
 * @param key 缓存键
 * @param fallback 缓存未命中时的回退函数
 * @param ttl 过期时间（秒）
 */
export async function cacheGet<T>(
  redis: RedisLike,
  key: string,
  fallback: () => Promise<T>,
  ttl: number,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    // 缓存读取失败，继续使用 fallback
    console.warn(`Cache get failed for key ${key}:`, err);
  }

  const data = await fallback();

  try {
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch (err) {
    // 缓存写入失败不影响主流程
    console.warn(`Cache set failed for key ${key}:`, err);
  }

  return data;
}

/**
 * 缓存失效函数
 * @param redis Redis 连接
 * @param pattern 键模式或具体键
 */
export async function cacheInvalidate(redis: RedisLike, pattern: string): Promise<void> {
  try {
    if (pattern.includes('*')) {
      // 模式匹配删除
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } else {
      // 单个键删除
      await redis.del(pattern);
    }
  } catch (err) {
    console.warn(`Cache invalidate failed for pattern ${pattern}:`, err);
  }
}

/**
 * 批量缓存设置
 * @param redis Redis 连接
 * @param entries 键值对数组
 */
export async function cacheSetBatch(
  redis: RedisLike,
  entries: Array<{ key: string; value: unknown; ttl: number }>,
): Promise<void> {
  const pipeline = redis.pipeline();

  for (const { key, value, ttl } of entries) {
    pipeline.setex(key, ttl, JSON.stringify(value));
  }

  try {
    await pipeline.exec();
  } catch (err) {
    console.warn('Batch cache set failed:', err);
  }
}
