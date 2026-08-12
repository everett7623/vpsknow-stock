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
VALUES (
  'provider_evoxt',
  'evoxt',
  'Evoxt',
  'https://evoxt.com',
  'A',
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "website" = EXCLUDED."website",
  "tier" = EXCLUDED."tier",
  "isActive" = TRUE,
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
  'affiliate_evoxt',
  provider."id",
  'evoxt',
  'https://console.evoxt.com/aff.php?aff=994',
  'https://go.uukk.de/evoxt',
  0
FROM "providers" AS provider
WHERE provider."slug" = 'evoxt'
ON CONFLICT ("slug") DO UPDATE
SET
  "providerId" = EXCLUDED."providerId",
  "targetUrl" = EXCLUDED."targetUrl",
  "shortUrl" = EXCLUDED."shortUrl";
