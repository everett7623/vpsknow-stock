import { Bot, InlineKeyboard } from 'grammy';
import { prisma } from '@vpsknow/database';
import { formatSubscriptionStatus, parseMuteHours } from './subscriptions.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
}

const bot = new Bot(token);

const providerNames = [
  'BandwagonHost',
  'DMIT',
  'BuyVM',
  'GreenCloudVPS',
  'HostHatch',
  'SpartanHost',
  'VMISS',
  'V.PS',
  'SaltyFish',
  'AkileCloud',
];

bot.command('start', (ctx) =>
  ctx.reply([
    'Welcome to VPSKnow Stock Bot! 🖥️',
    '',
    'Get personalized VPS restock and LowEndTalk offer alerts.',
    '',
    '/subscribe — Set up alerts',
    '/providers — See monitored providers',
    '/status — View your subscription',
    '/help — Show all commands',
  ].join('\n')),
);

bot.command('providers', (ctx) =>
  ctx.reply([
    '📋 Currently monitored providers:',
    '',
    ...providerNames.map((name, index) => `${index + 1}. ${name}`),
    '',
    'Netcup is offers-only and is not monitored for stock.',
  ].join('\n')),
);

bot.command('subscribe', (ctx) => {
  const keyboard = new InlineKeyboard()
    .text('Restocks + Offers', 'events:both').row()
    .text('Restocks only', 'events:restock')
    .text('Offers only', 'events:offers');

  return ctx.reply(
    'Choose which alerts you want. This initial subscription includes all providers, regions, and categories.',
    { reply_markup: keyboard },
  );
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
    `✅ Subscribed to ${selection === 'both' ? 'restocks and offers' : selection}. All providers and regions are enabled.`,
  );
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
    '/status — Show subscription filters',
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
