import { describe, expect, it } from 'vitest';
import { parseLetListing, parseLetOffer, parseLetRss } from './lowendtalk.js';

describe('LowEndTalk parsers', () => {
  it('extracts valid discussions from an RSS feed using discussion IDs', () => {
    const discussions = parseLetRss(`
      <rss><channel>
        <item>
          <title>Provider Flash Sale</title>
          <link>https://lowendtalk.com/discussion/12345/provider-flash-sale</link>
          <creator>ExampleHost</creator>
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
    const discussions = parseLetListing(`
      <a href="/discussion/12345/flash-sale">ExampleHost Flash Sale</a>
      <a href="/discussion/12345/flash-sale?page=2">Duplicate</a>
      <a href="https://lowendtalk.com/discussion/67890/storage-sale">Storage Sale</a>
    `, discoveredAt);

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
      `<article>
        <p>2 GB RAM KVM VPS in Los Angeles. $12.00 / annual.</p>
        <p>Use coupon code: FLASH26</p>
        <a href="https://example.com/billing/cart.php?a=add&pid=1">Order now</a>
      </article>`,
      'ExampleHost',
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
      isLimitedStock: true,
      isRecurring: false,
      isPreorder: false,
    });
    expect(offer.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('keeps unavailable structured fields null instead of fabricating data', () => {
    const offer = parseLetOffer('General announcement', '<article>Welcome to our community.</article>', '');

    expect(offer).toMatchObject({
      provider: null,
      category: null,
      locations: [],
      priceCents: null,
      currency: null,
      billingCycle: null,
      couponCode: null,
      orderUrl: null,
      confidence: 0,
    });
  });
});
