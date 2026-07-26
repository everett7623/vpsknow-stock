import type { Product } from "@vpsknow/database";

export function formatPrice(product: Product): string {
  const amount = (product.priceCents / 100).toFixed(2);
  const cycle = product.billingCycle;
  const symbol = product.currency === "EUR" ? "€" : product.currency === "CNY" ? "¥" : "$";
  const suffix = cycle === "monthly" ? "mo" : cycle === "annually" ? "yr" : cycle;
  return `${symbol}${amount}/${suffix}`;
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "never";
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}
