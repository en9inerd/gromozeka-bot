#!/usr/bin/env node
import { TelegramBotClient } from 'telebuilder';
import { DatabaseService } from './services/database.service';
import { EraseCommand } from './commands/erase.command';
import { SessionCommand } from './commands/session.command';
import { StartCommand } from './commands/start.command';

(async () => {
  const client = new TelegramBotClient({
    commands: [StartCommand, EraseCommand, SessionCommand],
    dbService: DatabaseService,
  });
  await client.init();
})();
