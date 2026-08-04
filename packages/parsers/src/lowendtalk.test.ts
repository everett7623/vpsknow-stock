import { describe, expect, it } from 'vitest';
import { parseLetListing, parseLetOffer, parseLetRss } from './lowendtalk.js';

describe('LowEndTalk parsers', () => {
  it('extracts valid discussions from an RSS feed using discussion IDs', () => {
    const discussions = parseLetRss(`
      <rss xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
        <item>
          <title>Provider Flash Sale</title>
          <link>https://lowendtalk.com/discussion/12345/provider-flash-sale</link>
          <dc:creator>ExampleHost</dc:creator>
          <pubDate>Mon, 21 Jul 2026 12:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Missing identifier</title>
          <link>https://lowendtalk.com/categories/offers</link>
          <pubDate>Mon, 21 Jul 2026 12:00:00 GMT</pubDate>
        </item>
      </channel></rss>
    `);

    expect(discussions).toEqual([
      {
        discussionId: '12345',
        title: 'Provider Flash Sale',
        author: 'ExampleHost',
        postedAt: new Date('2026-07-21T12:00:00.000Z'),
        url: 'https://lowendtalk.com/discussion/12345/provider-flash-sale',
      },
    ]);
  });

  it('extracts unique discussions from an HTML listing', () => {
    const discoveredAt = new Date('2026-07-21T12:00:00.000Z');
    const discussions = parseLetListing(
      `
      <a href="/discussion/12345/flash-sale">ExampleHost Flash Sale</a>
      <a href="/discussion/12345/flash-sale?page=2">Duplicate</a>
      <a href="https://lowendtalk.com/discussion/67890/storage-sale">Storage Sale</a>
    `,
      discoveredAt,
    );

    expect(discussions).toEqual([
      {
        discussionId: '12345',
        title: 'ExampleHost Flash Sale',
        author: '',
        postedAt: discoveredAt,
        url: 'https://lowendtalk.com/discussion/12345/flash-sale',
      },
      {
        discussionId: '67890',
        title: 'Storage Sale',
        author: '',
        postedAt: discoveredAt,
        url: 'https://lowendtalk.com/discussion/67890/storage-sale',
      },
    ]);
  });

  it('extracts structured offer fields and flags from a post', () => {
    const offer = parseLetOffer(
      'ExampleHost Limited VPS Flash Sale',
      `<a href="https://datawagon.com/billing/link.php?id=1">Page advertisement</a>
      <div class="Item">
        <a class="Username">ExampleHost</a>
        <div class="Item-Body">
          <p>2 GB RAM KVM VPS in Los Angeles. $12.00 / annual. 1 IPv4 included.</p>
          <p>Use coupon code: FLASH26</p>
          <a href="https://example.com/billing/cart.php?a=add&pid=1">Order now</a>
        </div>
      </div>`,
      '',
    );

    expect(offer).toMatchObject({
      provider: 'ExampleHost',
      title: 'ExampleHost Limited VPS Flash Sale',
      category: 'vps',
      locations: ['Los Angeles'],
      priceCents: 1200,
      currency: 'USD',
      billingCycle: 'annually',
      couponCode: 'FLASH26',
      orderUrl: 'https://example.com/billing/cart.php?a=add&pid=1',
      ipv4: true,
      isLimitedStock: true,
      isRecurring: false,
      isPreorder: false,
    });
    expect(offer.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('supports euro prices and keeps the category and locations tied to the first offer', () => {
    const offer = parseLetOffer(
      'DeluxHost VPS Offers from €6/year in NL/DE',
      `<div class="Item">
        <a class="Username">DeluxHost</a>
        <div class="Item-Body">
          <p>VPS locations: Amsterdam and Frankfurt.</p>
          <p>Storage plans are also available later in this post.</p>
          <a href="https://deluxhost.net/cart?add=f-0">ORDER F-0</a>
        </div>
      </div>`,
      '',
    );

    expect(offer).toMatchObject({
      provider: 'DeluxHost',
      category: 'vps',
      locations: ['Amsterdam', 'Frankfurt'],
      priceCents: 600,
      currency: 'EUR',
      billingCycle: 'annually',
      orderUrl: 'https://deluxhost.net/cart?add=f-0',
    });
  });

  it('ignores giveaway credits, regular prices, and optional fees when selecting a price', () => {
    const offer = parseLetOffer(
      'FiberState Dedicated Server Flash Sale',
      `<div class="Item-Body">
        <p>Giveaway: $100 / $50 / $25 in account credits.</p>
        <p>10Gbps network port with 660TB transfer.</p>
        <p>Regular Price: $249.95/mo -> $199.95/mo promo price.</p>
        <p>Optional additional IPv4 + $8/yr fee.</p>
        <a href="https://fiberstate.com/dedicated-servers">Order Now</a>
      </div>`,
      'fiberstate',
    );

    expect(offer).toMatchObject({
      priceCents: 19995,
      currency: 'USD',
      billingCycle: 'monthly',
      orderUrl: 'https://fiberstate.com/dedicated-servers',
    });
  });

  it('supports currency symbols after the amount', () => {
    const offer = parseLetOffer(
      'Summer VPS Sale 9.99€/yr',
      '<div class="Item-Body">KVM VPS in Amsterdam.</div>',
      'Chunkserve',
    );

    expect(offer).toMatchObject({
      priceCents: 999,
      currency: 'EUR',
      billingCycle: 'annually',
    });
  });

  it('keeps unavailable structured fields null instead of fabricating data', () => {
    const offer = parseLetOffer(
      'General announcement',
      '<article>Welcome to our community.</article>',
      '',
    );

    expect(offer).toMatchObject({
      provider: null,
      category: null,
      locations: [],
      priceCents: null,
      currency: null,
      billingCycle: null,
      couponCode: null,
      orderUrl: null,
      ipv4: null,
      confidence: 0,
    });
  });

  it('distinguishes IPv6-only offers from posts with unknown IP details', () => {
    expect(parseLetOffer('IPv6 VPS', '<article>IPv6 only, no IPv4.</article>', 'Host').ipv4).toBe(
      false,
    );
    expect(
      parseLetOffer('VPS offer', '<article>Network details on order page.</article>', 'Host').ipv4,
    ).toBeNull();
  });
});
