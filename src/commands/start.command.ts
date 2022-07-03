import { NewMessageEvent } from 'telegram/events';
import type { Command, CommandScope } from 'telebuilder/types';

export class StartCommand implements Command {
  command = 'start';
  description = 'Start the bot';
  usage = '';
  scopes: CommandScope[] = [];
  langCodes = [];
  public async defaultHandler(event: NewMessageEvent): Promise<void> {
    const client = event.client;
  }
}
