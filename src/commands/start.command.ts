import { NewMessageEvent } from 'telegram/events';
import type { Command, CommandScope } from 'telebuilder/types';
import { UserSessionService } from '../services';
import { command, inject } from 'telebuilder/decorators';

@command
export class StartCommand implements Command {
  command = 'start';
  description = 'Start the bot';
  usage = '';
  scopes: CommandScope[] = [];
  langCodes = [];

  @inject(UserSessionService)
  userSessionService!: UserSessionService;

  public async defaultHandler(event: NewMessageEvent): Promise<void> {
    const client = event.client;

  }
}
