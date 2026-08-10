-- Fine-grained short-link click events for admin period stats.
ALTER TABLE "affiliate_links" ADD COLUMN IF NOT EXISTS "lastClickedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "affiliateLinkId" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referer" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "affiliate_clicks_clickedAt_idx" ON "affiliate_clicks"("clickedAt");
CREATE INDEX IF NOT EXISTS "affiliate_clicks_affiliateLinkId_clickedAt_idx" ON "affiliate_clicks"("affiliateLinkId", "clickedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_clicks_affiliateLinkId_fkey'
  ) THEN
    ALTER TABLE "affiliate_clicks"
      ADD CONSTRAINT "affiliate_clicks_affiliateLinkId_fkey"
      FOREIGN KEY ("affiliateLinkId") REFERENCES "affiliate_links"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
