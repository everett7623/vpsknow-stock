CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "logoUrl" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'S',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "cpu" TEXT,
    "ramMb" INTEGER,
    "storageGb" INTEGER,
    "storageType" TEXT,
    "bandwidthTb" DOUBLE PRECISION,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "inStock" BOOLEAN NOT NULL DEFAULT false,
    "lastStockChangeAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "consecutiveConfirm" INTEGER NOT NULL DEFAULT 0,
    "orderUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_checks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inStock" BOOLEAN NOT NULL,
    "priceCents" INTEGER,
    "responseMs" INTEGER,
    "error" TEXT,
    "raw" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_events" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    CONSTRAINT "stock_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "affiliate_links" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "shortUrl" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "telegram_messages" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "stockEventId" TEXT,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent',
    CONSTRAINT "telegram_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "provider" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "category" TEXT,
    "locations" TEXT[],
    "priceCents" INTEGER,
    "currency" TEXT,
    "billingCycle" TEXT,
    "couponCode" TEXT,
    "orderUrl" TEXT,
    "threadUrl" TEXT,
    "ipv4" BOOLEAN,
    "isLimitedStock" BOOLEAN NOT NULL DEFAULT false,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "isPreorder" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pushed" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "telegramUserId" BIGINT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "providers" TEXT[],
    "regions" TEXT[],
    "categories" TEXT[],
    "maxPriceCents" INTEGER,
    "eventTypes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mutedUntil" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "providers_slug_key" ON "providers"("slug");
CREATE INDEX "products_inStock_idx" ON "products"("inStock");
CREATE INDEX "products_providerId_inStock_idx" ON "products"("providerId", "inStock");
CREATE INDEX "products_providerId_priceCents_idx" ON "products"("providerId", "priceCents");
CREATE INDEX "products_providerId_lastCheckedAt_idx" ON "products"("providerId", "lastCheckedAt");
CREATE UNIQUE INDEX "products_providerId_productId_key" ON "products"("providerId", "productId");
CREATE INDEX "stock_checks_productId_checkedAt_idx" ON "stock_checks"("productId", "checkedAt");
CREATE INDEX "stock_checks_checkedAt_idx" ON "stock_checks"("checkedAt");
CREATE INDEX "stock_events_productId_detectedAt_idx" ON "stock_events"("productId", "detectedAt");
CREATE INDEX "stock_events_eventType_detectedAt_idx" ON "stock_events"("eventType", "detectedAt");
CREATE INDEX "stock_events_detectedAt_idx" ON "stock_events"("detectedAt");
CREATE UNIQUE INDEX "affiliate_links_slug_key" ON "affiliate_links"("slug");
CREATE INDEX "telegram_messages_channelId_sentAt_idx" ON "telegram_messages"("channelId", "sentAt");
CREATE INDEX "telegram_messages_sentAt_idx" ON "telegram_messages"("sentAt");
CREATE UNIQUE INDEX "offers_sourceId_key" ON "offers"("sourceId");
CREATE INDEX "offers_source_discoveredAt_idx" ON "offers"("source", "discoveredAt");
CREATE INDEX "offers_pushed_confidence_idx" ON "offers"("pushed", "confidence");
CREATE INDEX "offers_ipv4_idx" ON "offers"("ipv4");
CREATE INDEX "offers_confidence_postedAt_idx" ON "offers"("confidence", "postedAt");
CREATE INDEX "offers_provider_postedAt_idx" ON "offers"("provider", "postedAt");
CREATE INDEX "offers_category_postedAt_idx" ON "offers"("category", "postedAt");
CREATE INDEX "offers_isLimitedStock_postedAt_idx" ON "offers"("isLimitedStock", "postedAt");
CREATE INDEX "offers_priceCents_idx" ON "offers"("priceCents");
CREATE UNIQUE INDEX "subscriptions_telegramUserId_key" ON "subscriptions"("telegramUserId");
CREATE INDEX "subscriptions_isActive_mutedUntil_idx" ON "subscriptions"("isActive", "mutedUntil");
CREATE INDEX "subscriptions_lastNotifiedAt_idx" ON "subscriptions"("lastNotifiedAt");

ALTER TABLE "products" ADD CONSTRAINT "products_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_checks" ADD CONSTRAINT "stock_checks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_events" ADD CONSTRAINT "stock_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "telegram_messages" ADD CONSTRAINT "telegram_messages_stockEventId_fkey" FOREIGN KEY ("stockEventId") REFERENCES "stock_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
