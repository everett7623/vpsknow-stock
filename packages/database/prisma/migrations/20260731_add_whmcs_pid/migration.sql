-- AddWhmcsPidToProduct
-- 为 Product 表添加 whmcsPid 字段,用于存储 WHMCS 产品 ID

-- Step 1: 添加新字段 (nullable)
ALTER TABLE products ADD COLUMN "whmcsPid" TEXT;

-- Step 2: 创建索引 (可选,用于加速查询)
CREATE INDEX "products_whmcsPid_idx" ON products("whmcsPid");

-- Step 3: 示例数据更新 (需要手动填入真实 WHMCS PID)
-- UPDATE products SET "whmcsPid" = '95' WHERE "productId" = 'bwg-the-plan-dc6';
-- UPDATE products SET "whmcsPid" = '87' WHERE "productId" = 'bwg-20g-kvm-dc6';

-- 注释: whmcsPid 是 WHMCS 系统的数字产品 ID
-- 示例: https://bandwagonhost.com/aff.php?aff=68376&pid=95
--       其中 pid=95 就是 whmcsPid
