import { Bot, InlineKeyboard } from 'grammy';
import { prisma } from '@vpsknow/database';
import {
  formatSubscriptionStatus,
  parseMaxPriceCents,
  parseMuteHours,
  CATEGORIES,
  PROVIDERS,
  REGIONS,
  toggleFilter,
  toggleProvider,
} from './subscriptions.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
}

const bot = new Bot(token);

function providerKeyboard(selected: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  PROVIDERS.forEach(([slug, name], index) => {
    keyboard.text(`${selected.includes(slug) ? '✓ ' : ''}${name}`, `provider:${slug}`);
    if (index % 2 === 1) keyboard.row();
  });
  return keyboard
    .text(selected.length === 0 ? '✓ All providers' : 'All providers', 'provider:all')
    .row()
    .text('Done', 'provider:done');
}

function filterKeyboard(
  prefix: 'region' | 'category',
  options: ReadonlyArray<readonly [string, string]>,
  selected: string[],
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  options.forEach(([value, label], index) => {
    keyboard.text(`${selected.includes(value) ? '✓ ' : ''}${label}`, `${prefix}:${value}`);
    if (index % 2 === 1) keyboard.row();
  });
  return keyboard
    .text(selected.length === 0 ? '✓ All' : 'All', `${prefix}:all`)
    .row()
    .text('Done', `${prefix}:done`);
}

function subscribePrompt() {
  const keyboard = new InlineKeyboard()
    .text('Restocks + Offers', 'events:both').row()
    .text('Restocks only', 'events:restock')
    .text('Offers only', 'events:offers');

  return {
    text: 'Choose which alerts you want. This initial subscription includes all providers, regions, and categories.',
    reply_markup: keyboard,
  };
}

bot.command('start', async (ctx) => {
  const payload = ctx.match?.trim().toLowerCase() ?? '';
  if (payload === 'subscribe') {
    const prompt = subscribePrompt();
    await ctx.reply(prompt.text, { reply_markup: prompt.reply_markup });
    return;
  }

  await ctx.reply([
    'Welcome to VPSKnow Stock Bot!',
    '',
    'Get personalized VPS restock and curated offer alerts.',
    '',
    '/subscribe — Set up alerts',
    '/providers — See monitored providers',
    '/status — View your subscription',
    '/settings — Shortcut to subscription status',
    '/help — Show all commands',
  ].join('\n'));
});

bot.command('providers', (ctx) =>
  ctx.reply([
    'Currently monitored providers:',
    '',
    ...PROVIDERS.map(([, name], index) => `${index + 1}. ${name}`),
    '',
    `Total: ${PROVIDERS.length} providers.`,
  ].join('\n')),
);

bot.command('subscribe', (ctx) => {
  const prompt = subscribePrompt();
  return ctx.reply(prompt.text, { reply_markup: prompt.reply_markup });
});

bot.command('settings', async (ctx) => {
  if (!ctx.from) return;
  const subscription = await prisma.subscription.findUnique({
    where: { telegramUserId: BigInt(ctx.from.id) },
  });
  await ctx.reply([
    formatSubscriptionStatus(subscription),
    '',
    'Adjust filters with /subscribe, /regions, /categories, /maxprice.',
  ].join('\n'));
});

bot.callbackQuery(/^events:(both|restock|offers)$/, async (ctx) => {
  const selection = ctx.match[1]!;
  const eventTypes = selection === 'both' ? ['restock', 'offers'] : [selection];
  const telegramUserId = BigInt(ctx.from.id);
  const chatId = BigInt(ctx.chat?.id ?? ctx.from.id);

  await prisma.subscription.upsert({
    where: { telegramUserId },
    update: {
      chatId,
      eventTypes,
      isActive: true,
      mutedUntil: null,
    },
    create: {
      telegramUserId,
      chatId,
      providers: [],
      regions: [],
      categories: [],
      maxPriceCents: null,
      eventTypes,
    },
  });

  await ctx.answerCallbackQuery({ text: 'Subscription saved' });
  await ctx.editMessageText(
    `Subscribed to ${selection === 'both' ? 'restocks and offers' : selection}.\n\nSelect provider filters, or keep all providers enabled:`,
    { reply_markup: providerKeyboard([]) },
  );
});

bot.callbackQuery(/^provider:(.+)$/, async (ctx) => {
  const action = ctx.match[1]!;
  const telegramUserId = BigInt(ctx.from.id);
  const subscription = await prisma.subscription.findUnique({ where: { telegramUserId } });
  if (!subscription) {
    await ctx.answerCallbackQuery({ text: 'Use /subscribe first', show_alert: true });
    return;
  }

  if (action === 'done') {
    await ctx.answerCallbackQuery({ text: 'Provider filters saved' });
    await ctx.editMessageText([
      '✅ Subscription saved.',
      `Events: ${subscription.eventTypes.join(', ')}`,
      `Providers: ${subscription.providers.length > 0 ? subscription.providers.join(', ') : 'All'}`,
      '',
      'Next: use /regions and /categories for optional filters.',
      'Use /status at any time to review your filters.',
    ].join('\n'));
    return;
  }

  if (action !== 'all' && !PROVIDERS.some(([slug]) => slug === action)) {
    await ctx.answerCallbackQuery({ text: 'Unknown provider', show_alert: true });
    return;
  }

  const providers = action === 'all'
    ? []
    : toggleProvider(subscription.providers, action);
  await prisma.subscription.update({
    where: { telegramUserId },
    data: { providers },
  });
  await ctx.answerCallbackQuery({ text: providers.length === 0 ? 'All providers enabled' : 'Filters updated' });
  await ctx.editMessageReplyMarkup({ reply_markup: providerKeyboard(providers) });
});

bot.command('regions', async (ctx) => {
  if (!ctx.from) return;
  const subscription = await prisma.subscription.findUnique({
    where: { telegramUserId: BigInt(ctx.from.id) },
  });
  if (!subscription) {
    await ctx.reply('Use /subscribe first.');
    return;
  }
  const options = REGIONS.map((region) => [region, region] as const);
  await ctx.reply('Select regions, or keep all regions enabled:', {
    reply_markup: filterKeyboard('region', options, subscription.regions),
  });
});

bot.callbackQuery(/^region:(.+)$/, async (ctx) => {
  const action = ctx.match[1]!;
  const telegramUserId = BigInt(ctx.from.id);
  const subscription = await prisma.subscription.findUnique({ where: { telegramUserId } });
  if (!subscription) {
    await ctx.answerCallbackQuery({ text: 'Use /subscribe first', show_alert: true });
    return;
  }
  if (action === 'done') {
    await ctx.answerCallbackQuery({ text: 'Region filters saved' });
    await ctx.editMessageText(`✅ Regions: ${subscription.regions.join(', ') || 'All'}`);
    return;
  }
  if (action !== 'all' && !REGIONS.some((region) => region === action)) {
    await ctx.answerCallbackQuery({ text: 'Unknown region', show_alert: true });
    return;
  }
  const regions = action === 'all' ? [] : toggleFilter(subscription.regions, action);
  await prisma.subscription.update({ where: { telegramUserId }, data: { regions } });
  const options = REGIONS.map((region) => [region, region] as const);
  await ctx.answerCallbackQuery({ text: regions.length === 0 ? 'All regions enabled' : 'Filters updated' });
  await ctx.editMessageReplyMarkup({ reply_markup: filterKeyboard('region', options, regions) });
});

bot.command('categories', async (ctx) => {
  if (!ctx.from) return;
  const subscription = await prisma.subscription.findUnique({
    where: { telegramUserId: BigInt(ctx.from.id) },
  });
  if (!subscription) {
    await ctx.reply('Use /subscribe first.');
    return;
  }
  await ctx.reply('Select product categories, or keep all categories enabled:', {
    reply_markup: filterKeyboard('category', CATEGORIES, subscription.categories),
  });
});

bot.callbackQuery(/^category:(.+)$/, async (ctx) => {
  const action = ctx.match[1]!;
  const telegramUserId = BigInt(ctx.from.id);
  const subscription = await prisma.subscription.findUnique({ where: { telegramUserId } });
  if (!subscription) {
    await ctx.answerCallbackQuery({ text: 'Use /subscribe first', show_alert: true });
    return;
  }
  if (action === 'done') {
    await ctx.answerCallbackQuery({ text: 'Category filters saved' });
    await ctx.editMessageText(`✅ Categories: ${subscription.categories.join(', ') || 'All'}`);
    return;
  }
  if (action !== 'all' && !CATEGORIES.some(([category]) => category === action)) {
    await ctx.answerCallbackQuery({ text: 'Unknown category', show_alert: true });
    return;
  }
  const categories = action === 'all' ? [] : toggleFilter(subscription.categories, action);
  await prisma.subscription.update({ where: { telegramUserId }, data: { categories } });
  await ctx.answerCallbackQuery({ text: categories.length === 0 ? 'All categories enabled' : 'Filters updated' });
  await ctx.editMessageReplyMarkup({
    reply_markup: filterKeyboard('category', CATEGORIES, categories),
  });
});

bot.command('maxprice', async (ctx) => {
  if (!ctx.from) return;
  const maxPriceCents = parseMaxPriceCents(ctx.match);
  if (maxPriceCents === undefined) {
    await ctx.reply('Usage: /maxprice [USD amount|off]. Examples: /maxprice 12.50 or /maxprice off');
    return;
  }
  const result = await prisma.subscription.updateMany({
    where: { telegramUserId: BigInt(ctx.from.id) },
    data: { maxPriceCents },
  });
  if (result.count === 0) {
    await ctx.reply('You do not have a subscription yet. Use /subscribe first.');
    return;
  }
  await ctx.reply(maxPriceCents === null
    ? '✅ Price limit removed.'
    : `✅ Maximum price set to USD ${(maxPriceCents / 100).toFixed(2)}.`);
});

bot.command('status', async (ctx) => {
  if (!ctx.from) return;
  const subscription = await prisma.subscription.findUnique({
    where: { telegramUserId: BigInt(ctx.from.id) },
  });
  await ctx.reply(formatSubscriptionStatus(subscription));
});

bot.command('mute', async (ctx) => {
  if (!ctx.from) return;
  const hours = parseMuteHours(ctx.match);
  if (hours === null) {
    await ctx.reply('Usage: /mute [hours], from 1 to 168. Example: /mute 8');
    return;
  }

  const mutedUntil = new Date(Date.now() + hours * 60 * 60 * 1_000);
  const result = await prisma.subscription.updateMany({
    where: { telegramUserId: BigInt(ctx.from.id) },
    data: { mutedUntil },
  });
  await ctx.reply(result.count === 0
    ? 'You do not have a subscription yet. Use /subscribe first.'
    : `🔕 Alerts muted until ${mutedUntil.toISOString()}.`);
});

bot.command('unmute', async (ctx) => {
  if (!ctx.from) return;
  const result = await prisma.subscription.updateMany({
    where: { telegramUserId: BigInt(ctx.from.id) },
    data: { mutedUntil: null, isActive: true },
  });
  await ctx.reply(result.count === 0
    ? 'You do not have a subscription yet. Use /subscribe first.'
    : '🔔 Alerts resumed.');
});

bot.command('unsubscribe', async (ctx) => {
  if (!ctx.from) return;
  const result = await prisma.subscription.updateMany({
    where: { telegramUserId: BigInt(ctx.from.id) },
    data: { isActive: false, mutedUntil: null },
  });
  await ctx.reply(result.count === 0 ? 'No subscription was found.' : 'Subscription disabled.');
});

bot.command('help', (ctx) =>
  ctx.reply([
    '📖 Available commands:',
    '',
    '/start — Welcome and setup guide',
    '/subscribe — Choose alert types',
    '/providers — List monitored providers',
    '/regions — Choose region filters',
    '/categories — Choose product categories',
    '/maxprice [amount|off] — Set or clear maximum USD price',
    '/status — Show subscription filters',
    '/settings — Alias for /status with filter tips',
    '/mute [hours] — Pause alerts (default: 8 hours)',
    '/unmute — Resume alerts',
    '/unsubscribe — Disable your subscription',
    '/help — Show this message',
  ].join('\n')),
);

bot.catch(({ error }) => {
  console.error('Bot update failed', error);
});

bot.start();
console.log('Bot is running...');
