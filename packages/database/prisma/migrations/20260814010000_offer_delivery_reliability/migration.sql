ALTER TABLE "offers"
  ADD COLUMN IF NOT EXISTS "priceAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "priceText" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriberDeliveriesQueued" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "offers"
SET "subscriberDeliveriesQueued" = TRUE
WHERE "pushed" = TRUE;

CREATE TABLE IF NOT EXISTS "offer_subscriber_deliveries" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "messageId" INTEGER,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "offer_subscriber_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "offer_subscriber_deliveries_offerId_subscriptionId_key"
  ON "offer_subscriber_deliveries"("offerId", "subscriptionId");
CREATE INDEX IF NOT EXISTS "offer_subscriber_deliveries_status_nextAttemptAt_idx"
  ON "offer_subscriber_deliveries"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "offer_subscriber_deliveries_subscriptionId_status_idx"
  ON "offer_subscriber_deliveries"("subscriptionId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'offer_subscriber_deliveries_offerId_fkey'
  ) THEN
    ALTER TABLE "offer_subscriber_deliveries"
      ADD CONSTRAINT "offer_subscriber_deliveries_offerId_fkey"
      FOREIGN KEY ("offerId") REFERENCES "offers"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'offer_subscriber_deliveries_subscriptionId_fkey'
  ) THEN
    ALTER TABLE "offer_subscriber_deliveries"
      ADD CONSTRAINT "offer_subscriber_deliveries_subscriptionId_fkey"
      FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
