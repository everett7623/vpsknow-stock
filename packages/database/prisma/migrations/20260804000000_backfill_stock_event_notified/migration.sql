UPDATE "stock_events" AS se
SET "notified" = TRUE
WHERE se."eventType" = 'restock'
  AND se."notified" = FALSE
  AND EXISTS (
    SELECT 1
    FROM "telegram_messages" AS tm
    WHERE tm."stockEventId" = se."id"
  );
