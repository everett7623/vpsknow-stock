import { describe, expect, it } from 'vitest';
import type { StockResult } from '@vpsknow/providers';
import { formatOfferMessage, formatRestockMessage } from './formatter.js';

const footer = ['🌐 vpsknow.com', '💬@vpsknow | 📢@vpsknow_channel | 🤖@vpsknow_bot'].join('\n');

const stockResult: StockResult = {
  provider: 'BuyVM',
  productId: 'slice-1024-lv',
  planName: 'Slice 1024',
  location: 'Las Vegas',
  category: 'vps',
  cpu: '1 Core',
  ramMb: 1024,
  storageGb: 20,
  storageType: 'SSD',
  bandwidthTb: 1,
  ipv4: true,
  ipv6: true,
  price: 350,
  currency: 'USD',
  billingCycle: 'monthly',
  inStock: true,
  orderUrl: 'https://buyvm.net/order',
};

describe('Telegram message formatters', () => {
  it('appends the common footer to restock messages', () => {
    const message = formatRestockMessage(
      stockResult,
      'https://stock.vpsknow.com/go/buyvm-slice-1024-lv',
      new Date('2026-08-04T05:28:00.000Z'),
    );

    expect(message).toContain('🔗 Order: https://stock.vpsknow.com/go/buyvm-slice-1024-lv');
    expect(message).toContain('⚙️ Specifications');
    expect(message).toContain('├ IPv4: Yes');
    expect(message).toContain('├ IPv6: Yes');
    expect(message).toContain('⏱ Detected: 2026-08-04 05:28:00 UTC');
    expect(message).toContain('#Restock #BuyVM #Las_Vegas #vps');
    expect(message.endsWith(footer)).toBe(true);
  });

  it('formats offers with only the original LowEndTalk URL and the common footer', () => {
    const originalUrl = 'https://lowendtalk.com/discussion/12345/example-offer';
    const message = formatOfferMessage({
      provider: 'ExampleHost',
      title: 'ExampleHost VPS Flash Sale',
      locations: 'Los Angeles',
      price: '$12.00',
      category: 'VPS',
      billing: 'year',
      postedAt: '2026-08-04',
      couponCode: 'FLASH26',
      originalUrl,
    });

    expect(message).toContain(`🔗 View offer: ${originalUrl}`);
    expect(message).toContain('📍 Locations: Los Angeles');
    expect(message).toContain('💰 Price: From $12.00/year');
    expect(message).toContain('🎟 Coupon: FLASH26');
    expect(message).toContain('#Offer #ExampleHost #VPS #Los_Angeles');
    expect(message).not.toContain('🔗 Order:');
    expect(message).not.toContain('go.uukk.de');
    expect(message).not.toContain('stock.vpsknow.com/go/');
    expect(message.endsWith(footer)).toBe(true);
  });

  it('limits multi-location offers to event, provider, and category tags', () => {
    const message = formatOfferMessage({
      provider: 'JUST.HOSTING',
      title: 'HOT Summer Sale',
      locations: 'Los Angeles, New York, Tokyo, Singapore',
      price: '$8.00',
      category: 'VPS',
      billing: 'month',
      postedAt: '2026-08-03',
      couponCode: 'HOTSS50',
      originalUrl: 'https://lowendtalk.com/discussion/219764/example',
    });

    expect(message).toContain('#Offer #JUST_HOSTING #VPS');
    expect(message).not.toContain('#Los_Angeles');
  });

  it('rejects an invalid restock detection date', () => {
    expect(() => formatRestockMessage(stockResult, undefined, new Date('invalid'))).toThrow(
      'detectedAt must be a valid date',
    );
  });
});
