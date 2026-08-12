import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseLowEndBoxOffer,
  parseLowEndBoxRss,
  parseLowEndSpiritRss,
} from './external-offers.js';

function fixture(name: string): string {
  return readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
}

describe('external offer parsers', () => {
  it('extracts globally namespaced LowEndBox post IDs from the official RSS feed', () => {
    expect(parseLowEndBoxRss(fixture('lowendbox.rss.xml'))).toEqual([
      {
        discussionId: 'lowendbox:53296',
        title: 'ServerHost Cheap Ryzen VPS Deals',
        author: 'raindog308',
        postedAt: new Date('2026-07-31T11:00:25.000Z'),
        url: 'https://lowendbox.com/blog/serverhost-cheap-ryzen-vps-deals/',
        contentHtml: '<p>ServerHost KVM VPS from $22.99/year.</p>',
      },
    ]);
  });

  it('extracts globally namespaced LowEndSpirit discussion IDs and rejects mismatches', () => {
    expect(parseLowEndSpiritRss(fixture('lowendspirit.rss.xml'))).toEqual([
      {
        discussionId: 'lowendspirit:11151',
        title: 'New UK KVM VPS Annual Promo',
        author: 'ExampleHost',
        postedAt: new Date('2026-08-03T15:00:43.000Z'),
        url: 'https://lowendspirit.com/discussion/11151/new-uk-kvm-vps-annual-promo',
        contentHtml: '<p>UK KVM VPS from £18/year.</p>',
      },
    ]);
  });

  it('uses LowEndBox provider tags instead of the editorial author', () => {
    expect(
      parseLowEndBoxOffer(
        'ServerHost Cheap Ryzen VPS Deals',
        fixture('lowendbox-offer.html'),
      ),
    ).toMatchObject({
      provider: 'ServerHost',
      category: 'vps',
      locations: ['Los Angeles'],
      priceCents: 2299,
      currency: 'USD',
      billingCycle: 'annually',
      couponCode: 'LEB2026',
      orderUrl: 'https://serverhost.example/cart.php?a=add&pid=20',
      ipv4: true,
    });
  });
});
