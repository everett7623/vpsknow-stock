import { describe, expect, it } from 'vitest';
import type { StockResult } from '@vpsknow/providers';
import { formatOfferMessage, formatRestockMessage } from './formatter.js';

const footer = [
  '🌐 stock.vpsknow.com',
  '📢 @vpsknow_offers',
  '🤖 @vpsknow_stock_bot',
].join('\n');

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
    expect(message).toContain('├ Storage: 20 GB SSD');
    expect(message).toContain('├ Bandwidth: 1 TB');
    expect(message).toContain('├ IPv4: Yes');
    expect(message).toContain('├ IPv6: Yes');
    expect(message).not.toContain('├ Port:');
    expect(message).toContain('⏱ Detected: 2026-08-04 05:28:00 UTC');
    expect(message).toContain('#Restock #BuyVM #Las_Vegas #vps');
    expect(message.endsWith(footer)).toBe(true);
  });

  it('formats optional VPS specifications with provider source units', () => {
    const message = formatRestockMessage(
      {
        ...stockResult,
        provider: 'greencloudvps',
        productId: 'gc-2305',
        planName: 'CN Premium Optimized Plan Mini (Singapore)',
        location: 'Singapore Premium Line (CN2GIA/CU PREMIUM/CMI)',
        cpu: '1 core @ EPYC Milan',
        ramMb: 2048,
        storageGb: 20,
        storageType: 'NVMe',
        bandwidthTb: 0.488,
        price: 2500,
        displaySpecs: {
          storage: '20GB NVMe RAID-10',
          bandwidth: '500GB',
          port: '500Mbps',
          remark:
            'OS: Linux; Control Panel: Virtfusion; Backup/Snapshot: Daily Backups; Note: No refund/Money back on this plan.',
        },
        lineType: 'CN2 GIA',
      },
      'https://stock.vpsknow.com/go/greencloudvps-gc-2305',
      new Date('2026-08-05T06:51:15.000Z'),
    );

    expect(message).toContain('├ Storage: 20GB NVMe RAID-10');
    expect(message).toContain('├ Bandwidth: 500GB');
    expect(message).toContain('├ Port: 500Mbps');
    expect(message).toContain('├ Line: CN2 GIA');
    expect(message).not.toContain('├ OS:');
    expect(message).not.toContain('├ Control Panel:');
    expect(message).not.toContain('├ Backup/Snapshot:');
    expect(message).not.toContain('├ Note:');
    expect(message).toContain(
      '├ Remark: OS: Linux; Control Panel: Virtfusion; Backup/Snapshot: Daily Backups; Note: No refund/Money back on this plan.',
    );
    expect(message).toContain('└ Price: $25.00/mo');
    expect(message).not.toContain('0.488 TB');
  });

  it('formats offers with merchant order and forum source URLs', () => {
    const orderUrl = 'https://example.com/order';
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
      orderUrl,
    });

    expect(message).toContain(`🔗 Order: ${orderUrl}`);
    expect(message).toContain(`🔗 Source: ${originalUrl}`);
    expect(message).toContain('📍 Locations: Los Angeles');
    expect(message).toContain('💰 Price: From $12.00/year');
    expect(message).toContain('🎟 Coupon: FLASH26');
    expect(message).toContain('#Offer #ExampleHost #VPS #Los_Angeles');
    expect(message).not.toContain('View offer');
    expect(message).not.toContain('go.uukk.de');
    expect(message.endsWith(footer)).toBe(true);
  });

  it('keeps the forum source when no merchant order URL is available', () => {
    const originalUrl = 'https://lowendtalk.com/discussion/12345/example-offer';
    const message = formatOfferMessage({
      provider: 'ExampleHost',
      title: 'ExampleHost VPS Flash Sale',
      locations: 'Los Angeles',
      price: '$12.00',
      category: 'VPS',
      billing: 'year',
      postedAt: '2026-08-04',
      couponCode: null,
      originalUrl,
      orderUrl: null,
    });

    expect(message).not.toContain('🔗 Order:');
    expect(message).toContain(`🔗 Source: ${originalUrl}`);
    expect(message.endsWith(footer)).toBe(true);
  });

  it('omits Source for non-approved forum hosts', () => {
    const message = formatOfferMessage({
      provider: 'ExampleHost',
      title: 'ExampleHost VPS Flash Sale',
      locations: 'Los Angeles',
      price: '$12.00',
      category: 'VPS',
      billing: 'year',
      postedAt: '2026-08-04',
      couponCode: null,
      originalUrl: 'https://poorvps.com/deal/123',
      orderUrl: 'https://example.com/order',
    });

    expect(message).toContain('🔗 Order: https://example.com/order');
    expect(message).not.toContain('🔗 Source:');
    expect(message).not.toContain('poorvps');
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
      orderUrl: 'https://just.hosting/order',
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
