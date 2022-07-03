#!/usr/bin/env node
import { TelegramBotClient } from 'telebuilder';

(async () => {
  const client = new TelegramBotClient();
  await client.init();
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => handleSignal(client));
})();

async function handleSignal(client: TelegramBotClient) {
  await client.destroy();
  process.exit(0);
}
