import { Bot } from 'grammy';

let bot: Bot | null = null;

function getBot(): Bot {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
    bot = new Bot(token);
  }
  return bot;
}

export async function sendChannelMessage(
  channelId: string,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'MarkdownV2';
    disableWebPagePreview?: boolean;
  },
): Promise<number> {
  const b = getBot();

  const maxRetries = 3;
  const backoffMs = 5_000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const msg = await b.api.sendMessage(channelId, text, {
        parse_mode: options?.parseMode,
        link_preview_options: options?.disableWebPagePreview
          ? { is_disabled: true }
          : undefined,
      });
      return msg.message_id;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, backoffMs * attempt));
    }
  }

  throw new Error('Unreachable');
}
