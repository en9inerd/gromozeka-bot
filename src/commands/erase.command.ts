import { NewMessageEvent } from 'telegram/events';
import { MethodBuilder } from 'telebuilder/decorators';
import { UserSessionService } from '../services';
import type { Command, CommandScope } from 'telebuilder/types';

export class EraseCommand implements Command {
  command = 'erase';
  description = 'Deletes all messages in the selected chat';
  usage = '';
  scopes: CommandScope[] = [{ name: 'Users' }];
  langCodes = [];
  private userSessionService = new UserSessionService();

  @MethodBuilder
  public async defaultHandler(event: NewMessageEvent) {
    if (!event.client || !event?.message?.senderId) return;

    const userSession = await this.userSessionService.getById(event.message.senderId);
    let message = 'You need to create a session first.';

    if (userSession?.encryptedSession) {
      message = '';
    }

    await event.client.sendMessage(event.message.senderId, { message });
  }

  private async getDialogs() {
    return [];
  }
}
