import { describe, expect, it } from 'vitest';
import type { StockResult } from '@vpsknow/providers';
import {
  formatDailyStockDigest,
  formatOfferMessage,
  formatRestockMessage,
  formatSoldOutEditMessage,
} from './formatter.js';

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
  it('formats Chinese restock messages with Beijing time', () => {
    const message = formatRestockMessage(
      stockResult,
      'https://stock.vpsknow.com/go/buyvm-slice-1024-lv',
      new Date('2026-08-04T05:28:00.000Z'),
    );

    expect(message).toContain('🟢 补货 · BuyVM');
    expect(message).toContain('📦 Slice 1024');
    expect(message).toContain('• 机房：Las Vegas');
    expect(message).toContain('• 配置：1Core / 1GB / 20GB-SSD / 1TB');
    expect(message).toContain('• 价格：月付 $3.50');
    expect(message).toContain('• 状态：有货');
    expect(message).toContain('🔗 购买：https://stock.vpsknow.com/go/buyvm-slice-1024-lv');
    expect(message).toContain('⏱ 北京时间 2026/08/04 13:28:00');
    expect(message).toContain('#补货 #BuyVM #Las_Vegas #vps');
    expect(message.endsWith(footer)).toBe(true);
  });

  it.each([
    ['USD', '月付 $3.50'],
    ['EUR', '月付 €3.50'],
    ['GBP', '月付 £3.50'],
    ['CAD', '月付 CA$3.50'],
    ['CNY', '月付 CN¥3.50'],
    ['AED', '月付 AED 3.50'],
  ])('formats merchant currency %s without relabeling it as USD', (currency, expected) => {
    const message = formatRestockMessage({ ...stockResult, currency });

    expect(message).toContain(`• 价格：${expected}`);
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

    expect(message).toContain('• 线路：CN2 GIA');
    expect(message).toContain('• 配置：1core@EPYCMilan / 2GB / 20GB NVMe RAID-10 / 500Mbps / 500GB');
    expect(message).toContain('• 价格：月付 $25.00');
    expect(message).not.toContain('0.488 TB');
  });

  it('builds an HTML sold-out edit that strikes through the original restock', () => {
    const original = formatRestockMessage(
      stockResult,
      'https://stock.vpsknow.com/go/buyvm-slice-1024-lv',
      new Date('2026-08-04T05:28:00.000Z'),
    );
    const edited = formatSoldOutEditMessage(original);

    expect(edited).toContain('🔴 <b>已售罄</b> · 原补货通知已划掉');
    expect(edited).toContain('<s>');
    expect(edited).toContain('• 状态：已售罄');
    expect(edited).toContain('BuyVM');
  });

  it('escapes HTML when striking through sold-out content', () => {
    const edited = formatSoldOutEditMessage('价格 < $5 & more');
    expect(edited).toContain('价格 &lt; $5 &amp; more');
  });

  it('formats Chinese offers with merchant order and forum source URLs', () => {
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

    expect(message).toContain('🔥 新优惠 · ExampleHost');
    expect(message).toContain(`🔗 购买：${orderUrl}`);
    expect(message).toContain(`🔗 来源：${originalUrl}`);
    expect(message).toContain('📍 机房：Los Angeles');
    expect(message).toContain('💰 价格：起 $12.00/年');
    expect(message).toContain('🎟 优惠码：FLASH26');
    expect(message).toContain('#优惠 #ExampleHost #VPS #Los_Angeles');
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

    expect(message).not.toContain('🔗 购买：');
    expect(message).toContain(`🔗 来源：${originalUrl}`);
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

    expect(message).toContain('🔗 购买：https://example.com/order');
    expect(message).not.toContain('🔗 来源：');
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

    expect(message).toContain('#优惠 #JUST_HOSTING #VPS');
    expect(message).not.toContain('#Los_Angeles');
  });

  it('rejects an invalid restock detection date', () => {
    expect(() => formatRestockMessage(stockResult, undefined, new Date('invalid'))).toThrow(
      'detectedAt must be a valid date',
    );
  });

  it('formats a daily in-stock digest grouped by provider', () => {
    const message = formatDailyStockDigest(
      [
        {
          provider: 'BuyVM',
          planName: 'Slice 1024',
          location: 'Las Vegas',
          specs: '1C / 1GB / 20GB',
          price: '月付 $3.50',
          orderUrl: 'https://stock.vpsknow.com/go/buyvm',
        },
        {
          provider: 'BandwagonHost',
          planName: 'THE PLAN',
          location: 'DC6',
          lineType: 'CN2 GIA-E',
          specs: '2C / 2GB / 40GB',
          price: '年付 $49.99',
          orderUrl: 'https://stock.vpsknow.com/go/bwg',
        },
      ],
      new Date('2026-11-25T03:00:00.000Z'),
    );

    expect(message).toContain('💻 每日有货汇总');
    expect(message).toContain('有货：2');
    expect(message).toContain('—— BandwagonHost（1）——');
    expect(message).toContain('• 线路：CN2 GIA-E');
    expect(message).toContain('—— BuyVM（1）——');
    expect(message.endsWith(footer)).toBe(true);
  });
});
