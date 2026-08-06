-- Persist IPv4, bandwidth display labels, and catalog-vs-live availability source.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bandwidthLabel" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "ipv4" BOOLEAN;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "availabilitySource" TEXT NOT NULL DEFAULT 'live';

CREATE INDEX IF NOT EXISTS "products_ipv4_idx" ON "products"("ipv4");
