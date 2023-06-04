#!/usr/bin/env node
import { TelegramBotClient } from 'telebuilder';
import { DatabaseService } from './services/database.service';

(async () => {
  const client = new TelegramBotClient(new DatabaseService());
  await client.init();
})();
