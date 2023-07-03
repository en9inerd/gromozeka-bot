import bcrypt from 'bcrypt';
import { NewMessageEvent } from 'telegram/events';
import { UserSessionService } from '../services';
import type { Command, CommandScope } from 'telebuilder/types';
import { boundAndLocked, command, inject } from 'telebuilder/decorators';
import { EncryptionHelper } from 'telebuilder/helpers';
import { tryInputThreeTimes } from 'telebuilder/utils';
import { TelegramUserClient } from 'telebuilder';
import { StringSession } from 'telegram/sessions';

@command
export class EraseCommand implements Command {
  command = 'erase';
  description = 'Deletes all messages in the selected chat';
  usage = '';
  scopes: CommandScope[] = [{ name: 'Default' }];
  langCodes = [];

  @inject(UserSessionService)
  userSessionService!: UserSessionService;

  @boundAndLocked
  public async defaultHandler(event: NewMessageEvent) {
    if (!event.client || !event?.message?.senderId) return;

    const userSession = await this.userSessionService.getById(event.message.senderId);
    let message = 'You need to create a session first using /session command.';

    if (userSession?.encryptedSession && userSession?.hashedPassword) {
      const password = await tryInputThreeTimes(
        event.client,
        'Please enter your passphrase to revoke session:',
        event.message.senderId,
        async (input: string): Promise<boolean> => {
          if (!(await bcrypt.compare(input, userSession.hashedPassword))) throw new Error('Invalid passphrase');
          return true;
        }
      );
      const session = EncryptionHelper.decrypt(userSession.encryptedSession, password);

      const userClient = new TelegramUserClient(new StringSession(session), event.message.senderId, event.client);
      await userClient.connect();
      message = `Your session "${userSession.sessionName}" has been revoked.`;
    }

    await event.client.sendMessage(event.message.senderId, { message });
  }

  private async getDialogs() {
    return [];
  }
}
