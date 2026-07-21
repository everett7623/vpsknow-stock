import * as cheerio from "cheerio";
import type { ProviderAdapter, StockResult } from "../types.js";
import type { BillingCycle, ProductCategory } from "@vpsknow/shared";

const CATEGORIES: { slug: string; url: string; category: ProductCategory }[] = [
  { slug: "budget-kvm-sale", url: "https://greencloudvps.com/billing/store/budget-kvm-sale", category: "vps" },
  { slug: "ssd-kvm-vps", url: "https://greencloudvps.com/billing/store/ssd-kvm-vps", category: "vps" },
  { slug: "storage-kvm-sale", url: "https://greencloudvps.com/billing/store/storage-kvm-sale", category: "storage" },
  { slug: "cn-premium-optimized", url: "https://greencloudvps.com/billing/store/cn-premium-optimized", category: "vps" },
];

function parseBillingCycle(text: string): BillingCycle {
  const t = text.toLowerCase();
  if (t.includes("monthly")) return "monthly";
  if (t.includes("quarterly")) return "quarterly";
  if (t.includes("semi-annually")) return "semi-annually";
  if (t.includes("triennially")) return "triennially";
  if (t.includes("biennially")) return "biennially";
  return "annually";
}

function parseMemoryMb(value: string): number {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  if (!match) return 0;
  const amount = parseFloat(match[1]!);
  return match[2]!.toLowerCase() === "gb" ? Math.round(amount * 1024) : Math.round(amount);
}

function parseStorageGb(value: string): number {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(GB|TB)/i);
  if (!match) return 0;
  const amount = parseFloat(match[1]!);
  return match[2]!.toLowerCase() === "tb" ? Math.round(amount * 1024) : Math.round(amount);
}

function parseBandwidthTb(value: string): number {
  const match = value.match(/(\d+(?:\.\d+)?)\s*(TB|GB)/i);
  if (!match) return 0;
  const amount = parseFloat(match[1]!);
  return match[2]!.toLowerCase() === "gb" ? Math.round((amount / 1024) * 1000) / 1000 : amount;
}

function parsePriceCents(text: string): number {
  const match = text.replace(/,/g, "").match(/\$([\d]+(?:\.\d{2})?)/);
  return match ? Math.round(parseFloat(match[1]!) * 100) : 0;
}

function storageType(value: string): string {
  if (value.match(/NVMe/i)) return "NVMe";
  if (value.match(/SSD/i)) return "SSD";
  if (value.match(/HDD|SATA/i)) return "HDD";
  return "Unknown";
}

export class GreenCloudVPSAdapter implements ProviderAdapter {
  slug = "greencloudvps";
  name = "GreenCloudVPS";

  async check(): Promise<StockResult[]> {
    const results: StockResult[] = [];
    const seen = new Set<string>();

    for (const cat of CATEGORIES) {
      const res = await fetch(cat.url, {
        headers: { "User-Agent": "VPSKnow-Stock/1.0" },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        throw new Error(`GreenCloudVPS HTTP ${res.status} for ${cat.slug}`);
      }

      const html = await res.text();
      const parsed = this.parse(html, cat.category);
      for (const p of parsed) {
        if (!seen.has(p.productId)) {
          seen.add(p.productId);
          results.push(p);
        }
      }
    }

    return results;
  }

  parse(html: string, category: ProductCategory): StockResult[] {
    const $ = cheerio.load(html);
    const results: StockResult[] = [];

    $(".product").each((_, el) => {
      const card = $(el);
      const idAttr = card.attr("id") || "";
      const productIdMatch = idAttr.match(/product(\d+)/);
      const productId = productIdMatch ? productIdMatch[1] : idAttr;
      if (!productId) return;

      const name = card.find("span")
        .filter((_, e) => $(e).attr("id")?.endsWith("-name") ?? false)
        .first()
        .text()
        .trim();
      if (!name) return;

      const qtyText = card.find(".qty").text().trim();
      const orderBtn = card.find(".btn-order-now").first();
      const orderHref = orderBtn.attr("href");

      const qtyMatch = qtyText.match(/(\d+)\s+Available/i);
      const outOfStock =
        /out\s*of\s*stock|sold\s*out/i.test(qtyText) ||
        (qtyMatch !== null && parseInt(qtyMatch[1]!) === 0);

      const inStock = !outOfStock && (orderBtn.length > 0 || orderHref !== undefined);

      const features: Record<string, string> = {};
      card.find(".product-desc li").each((_, li) => {
        const value = $(li).find(".feature-value").text().trim();
        const label = $(li).text().replace(value, "").trim().toLowerCase();
        if (label && value) features[label] = value;
      });

      const cpu = features["cpu"] || "Unknown";
      const ramMb = parseMemoryMb(features["ram"] || "");
      const storageGb = parseStorageGb(features["hard drive"] || features["storage"] || "");
      const bandwidthTb = parseBandwidthTb(features["bandwidth"] || "");
      const location = features["location"] || "Unknown";
      const ipv4 = parseInt((features["ipv4"] || "0").match(/\d+/)?.[1] || "0") > 0;
      const ipv6 = features["ipv6"] ? features["ipv6"].toLowerCase() !== "n/a" && features["ipv6"].toLowerCase() !== "no" : false;

      const priceText = card.find(".product-pricing").text();
      const price = parsePriceCents(priceText);
      const billingCycle = parseBillingCycle(priceText);

      results.push({
        provider: this.slug,
        productId: "gc-" + productId,
        planName: name,
        location,
        category,
        cpu,
        ramMb,
        storageGb,
        storageType: storageType(features["hard drive"] || features["storage"] || ""),
        bandwidthTb,
        ipv4,
        ipv6,
        price,
        currency: "USD",
        billingCycle,
        inStock,
        orderUrl: orderHref ? new URL(orderHref, "https://greencloudvps.com").href : "https://greencloudvps.com/billing/store/",
      });
    });

    return results;
  }
}