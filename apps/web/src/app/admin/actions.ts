'use server';

import { prisma } from '@vpsknow/database';
import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/admin-auth';

function required(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== 'string' || !value) throw new Error(`Missing ${key}`);
  return value;
}

export async function setProviderActive(formData: FormData): Promise<void> {
  await assertAdmin();
  const providerId = required(formData, 'providerId');
  const isActive = required(formData, 'isActive') === 'true';
  await prisma.provider.update({ where: { id: providerId }, data: { isActive } });
  revalidatePath('/admin');
  revalidatePath('/providers');
}

export async function overrideProductStock(formData: FormData): Promise<void> {
  await assertAdmin();
  const productId = required(formData, 'productId');
  const inStock = required(formData, 'inStock') === 'true';
  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: {
        inStock,
        consecutiveConfirm: 0,
        lastStockChangeAt: new Date(),
      },
    }),
    prisma.stockEvent.create({
      data: {
        productId,
        eventType: 'manual_override',
        metadata: { source: 'admin', inStock },
      },
    }),
  ]);
  revalidatePath('/admin');
  revalidatePath('/providers');
  revalidatePath('/provider/[slug]', 'page');
  revalidatePath('/provider/[slug]/[plan]', 'page');
}
