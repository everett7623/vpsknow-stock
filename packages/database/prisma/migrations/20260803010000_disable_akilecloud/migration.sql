-- AkileCloud 已从监控列表移除；保留历史产品和事件数据。
UPDATE "providers"
SET "isActive" = false
WHERE "slug" = 'akilecloud';
