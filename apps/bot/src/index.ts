import { Bot } from 'grammy';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
}

const bot = new Bot(token);

bot.command('start', (ctx) =>
  ctx.reply(
    [
      'Welcome to VPSKnow Stock Bot! 🖥️',
      '',
      "I'll send you personalized VPS restock alerts and LET offers based on your preferences.",
      '',
      'Quick setup:',
      '/subscribe — Set up your filters',
      '/providers — See monitored providers',
      '/help — All commands',
    ].join('\n'),
  ),
);

bot.command('providers', (ctx) =>
  ctx.reply(
    [
      '📋 Currently monitored providers:',
      '',
      '1. BandwagonHost — Limited plans, CN2 GIA',
      '2. DMIT — PVM, Premium, Eyeball',
      '3. BuyVM — KVM Slices, Storage',
      '',
      'More providers coming in Phase 2!',
    ].join('\n'),
  ),
);

bot.command('help', (ctx) =>
  ctx.reply(
    [
      '📖 Available commands:',
      '',
      '/start — Welcome message',
      '/subscribe — Set up notification filters',
      '/providers — List monitored providers',
      '/status — Your subscription status',
      '/mute — Mute notifications for 8h',
      '/unmute — Resume notifications',
      '/unsubscribe — Remove all filters',
      '/help — This message',
    ].join('\n'),
  ),
);

// TODO (Phase 3): /subscribe flow with inline keyboards

bot.start();
console.log('Bot is running...');
