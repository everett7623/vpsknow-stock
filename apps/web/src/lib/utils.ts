import type { Product } from "@vpsknow/database";

export function formatPrice(product: Product): string {
  const amount = (product.priceCents / 100).toFixed(2);
  const cycle = product.billingCycle;
  if (cycle === "monthly") return "$" + amount + "/mo";
  if (cycle === "annually") return "$" + amount + "/yr";
  return "$" + amount + "/" + cycle;
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "never";
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}
