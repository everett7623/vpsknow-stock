-- Register approved provider records before applying the active adapter allowlist.
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
  'provider_bestvm',
  'bestvm',
  'BestVM',
  'https://bestvm.cloud',
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
  "updatedAt" = CURRENT_TIMESTAMP;

-- Keep the final approved provider in the directory while its adapter remains blocked.
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
  'provider_highendnetwork',
  'highendnetwork',
  'HighEndNetwork',
  'https://billing.highendnetwork.com',
  'B',
  FALSE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "website" = EXCLUDED."website",
  "tier" = EXCLUDED."tier",
  "updatedAt" = CURRENT_TIMESTAMP;

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
  'provider_hncloud',
  'hncloud',
  'HNCloud',
  'https://www.hncloud.com',
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
  "updatedAt" = CURRENT_TIMESTAMP;

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
  'provider_neburst',
  'neburst',
  'Neburst',
  'https://neburst.com',
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
  "updatedAt" = CURRENT_TIMESTAMP;

-- Restrict production monitoring to the approved providers with implemented adapters.
UPDATE "providers"
SET
  "isActive" = "slug" IN (
    'bandwagonhost',
    'dmit',
    'buyvm',
    'greencloudvps',
    'spartanhost',
    'vmiss',
    'vps',
    'saltyfish',
    'racknerd',
    'dedirock',
    'bagevm',
    'vmrack',
    'gomami',
    'colocrossing',
    'chicagovps',
    'lightlayer',
    'speedypage',
    'bestvm',
    'neburst',
    'hncloud'
  ),
  "updatedAt" = CURRENT_TIMESTAMP;

-- Apply the approved affiliate destinations to existing provider records.
UPDATE "affiliate_links" AS link
SET "targetUrl" = approved."targetUrl"
FROM (
  VALUES
    ('bandwagonhost', 'https://bandwagonhost.com/aff.php?aff=68376'),
    ('dmit', 'https://www.dmit.io/aff.php?aff=6077'),
    ('buyvm', 'https://my.frantech.ca/aff.php?aff=6836'),
    ('spartanhost', 'https://billing.spartanhost.net/aff.php?aff=2459'),
    ('vmiss', 'https://app.vmiss.com/aff.php?aff=1922'),
    ('vps', 'https://vps.hosting/?affid=723'),
    ('saltyfish', 'https://portal.saltyfish.io/aff.php?aff=575'),
    ('greencloudvps', 'https://greencloudvps.com/billing/aff.php?aff=6807'),
    ('racknerd', 'https://my.racknerd.com/aff.php?aff=5550'),
    ('dedirock', 'https://billing.dedirock.com/aff.php?aff=77'),
    ('bagevm', 'https://www.bagevm.com/aff.php?aff=10'),
    ('vmrack', 'https://www.vmrack.net?ref_code=5YrpHKG16xf'),
    ('gomami', 'https://gomami.io/aff.php?aff=209'),
    ('colocrossing', 'https://cloud.colocrossing.com/aff.php?aff=467'),
    ('chicagovps', 'https://billing.chicagovps.net/aff.php?aff=2611'),
    ('lightlayer', 'https://account.lightlayer.net/?affid=647'),
    ('speedypage', 'https://my.speedypage.com/aff.php?aff=405'),
    ('hncloud', 'https://www.hncloud.com?k=7940T0')
) AS approved("slug", "targetUrl")
WHERE link."slug" = approved."slug";

INSERT INTO "affiliate_links" (
  "id",
  "providerId",
  "slug",
  "targetUrl",
  "shortUrl",
  "clicks"
)
SELECT
  'affiliate_bestvm',
  provider."id",
  'bestvm',
  'https://bestvm.cloud/aff.php?aff=225',
  'https://go.uukk.de/bestvm',
  0
FROM "providers" AS provider
WHERE provider."slug" = 'bestvm'
ON CONFLICT ("slug") DO UPDATE
SET
  "providerId" = EXCLUDED."providerId",
  "targetUrl" = EXCLUDED."targetUrl",
  "shortUrl" = EXCLUDED."shortUrl";

INSERT INTO "affiliate_links" (
  "id",
  "providerId",
  "slug",
  "targetUrl",
  "shortUrl",
  "clicks"
)
SELECT
  'affiliate_highendnetwork',
  provider."id",
  'highendnetwork',
  'https://billing.highendnetwork.com/aff.php?aff=68',
  'https://go.uukk.de/highendnetwork',
  0
FROM "providers" AS provider
WHERE provider."slug" = 'highendnetwork'
ON CONFLICT ("slug") DO UPDATE
SET
  "providerId" = EXCLUDED."providerId",
  "targetUrl" = EXCLUDED."targetUrl",
  "shortUrl" = EXCLUDED."shortUrl";

INSERT INTO "affiliate_links" (
  "id",
  "providerId",
  "slug",
  "targetUrl",
  "shortUrl",
  "clicks"
)
SELECT
  'affiliate_hncloud',
  provider."id",
  'hncloud',
  'https://www.hncloud.com?k=7940T0',
  'https://go.uukk.de/hncloud',
  0
FROM "providers" AS provider
WHERE provider."slug" = 'hncloud'
ON CONFLICT ("slug") DO UPDATE
SET
  "providerId" = EXCLUDED."providerId",
  "targetUrl" = EXCLUDED."targetUrl",
  "shortUrl" = EXCLUDED."shortUrl";

INSERT INTO "affiliate_links" (
  "id",
  "providerId",
  "slug",
  "targetUrl",
  "shortUrl",
  "clicks"
)
SELECT
  'affiliate_neburst',
  provider."id",
  'neburst',
  'https://neburst.com/auth/sign-up/?aff=3cvoo',
  'https://go.uukk.de/neburst',
  0
FROM "providers" AS provider
WHERE provider."slug" = 'neburst'
ON CONFLICT ("slug") DO UPDATE
SET
  "providerId" = EXCLUDED."providerId",
  "targetUrl" = EXCLUDED."targetUrl",
  "shortUrl" = EXCLUDED."shortUrl";
