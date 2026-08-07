-- Persist the normalized optimized-network route for precise filtering.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "lineType" TEXT;

CREATE INDEX IF NOT EXISTS "products_lineType_idx" ON "products"("lineType");
