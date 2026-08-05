-- Register the monitored providers that were added after the original production seed.
INSERT INTO "providers" (
  "id",
  "slug",
  "name",
  "website",
  "tier",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'provider_chicagovps',
    'chicagovps',
    'ChicagoVPS',
    'https://www.chicagovps.net',
    'B',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'provider_lightlayer',
    'lightlayer',
    'LightLayer',
    'https://lightlayer.net',
    'B',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'provider_speedypage',
    'speedypage',
    'SpeedyPage',
    'https://speedypage.com',
    'B',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "website" = EXCLUDED."website",
  "tier" = EXCLUDED."tier",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "affiliate_links" (
  "id",
  "providerId",
  "slug",
  "targetUrl",
  "shortUrl",
  "clicks"
)
SELECT
  approved."id",
  provider."id",
  approved."slug",
  approved."targetUrl",
  approved."shortUrl",
  0
FROM (
  VALUES
    (
      'affiliate_chicagovps',
      'chicagovps',
      'https://billing.chicagovps.net/aff.php?aff=2611',
      'https://go.uukk.de/chicagovps'
    ),
    (
      'affiliate_lightlayer',
      'lightlayer',
      'https://account.lightlayer.net/?affid=647',
      'https://go.uukk.de/lightlayer'
    ),
    (
      'affiliate_speedypage',
      'speedypage',
      'https://my.speedypage.com/aff.php?aff=405',
      'https://go.uukk.de/speedy'
    )
) AS approved("id", "slug", "targetUrl", "shortUrl")
JOIN "providers" AS provider ON provider."slug" = approved."slug"
ON CONFLICT ("slug") DO UPDATE
SET
  "providerId" = EXCLUDED."providerId",
  "targetUrl" = EXCLUDED."targetUrl",
  "shortUrl" = EXCLUDED."shortUrl";
