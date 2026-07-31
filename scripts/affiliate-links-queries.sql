-- 清理现有 affiliate links (可选,如果需要重新生成)
-- DELETE FROM affiliate_links;

-- 示例: 手动插入一个短链接 (用于测试)
INSERT INTO affiliate_links (id, "providerId", slug, "targetUrl", "shortUrl", clicks)
VALUES (
  'test_link_001',
  (SELECT id FROM providers WHERE slug = 'bandwagonhost' LIMIT 1),
  'bwg-test',
  'https://bwh81.net/aff.php?aff=YOUR_AFF_ID&pid=95',
  'https://stock.vpsknow.com/go/bwg-test',
  0
)
ON CONFLICT (slug) DO UPDATE SET
  "targetUrl" = EXCLUDED."targetUrl",
  "shortUrl" = EXCLUDED."shortUrl";

-- 查询所有 affiliate links
SELECT
  al.slug,
  p.name as provider,
  al."targetUrl",
  al."shortUrl",
  al.clicks
FROM affiliate_links al
JOIN providers p ON al."providerId" = p.id
ORDER BY p.name, al.slug;

-- 查询点击统计 Top 10
SELECT
  al.slug,
  p.name as provider,
  al.clicks,
  al."shortUrl"
FROM affiliate_links al
JOIN providers p ON al."providerId" = p.id
ORDER BY al.clicks DESC
LIMIT 10;
