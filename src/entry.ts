#!/usr/bin/env node
import { TelegramBotClient } from 'telebuilder';
import { DatabaseService } from './services/database.service.js';
import { EraseCommand } from './commands/erase.command.js';
import { SessionCommand } from './commands/session.command.js';
import { StartCommand } from './commands/start.command.js';

const client = new TelegramBotClient({
  commands: [StartCommand, EraseCommand, SessionCommand],
  dbService: DatabaseService,
});
await client.init();
