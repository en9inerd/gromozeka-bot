import bcrypt from 'bcrypt';
import { NewMessageEvent } from 'telegram/events';
import { UserSessionService } from '../services/index.js';
import { Buttons, Command, CommandScope, HandlerTypes } from 'telebuilder/types';
import { userState } from 'telebuilder/states';
import { buttonsReg, command, handler, inject } from 'telebuilder/decorators';
import { EncryptionHelper, CommandHelper } from 'telebuilder/helpers';
import { TelegramUserClient } from 'telebuilder';
import { Button } from 'telegram/tl/custom/button.js';
import { CallbackQueryEvent } from 'telegram/events/CallbackQuery.js';
import { Dialog } from 'telegram/tl/custom/dialog.js';
import { DialogEntity } from '../types.js';
import { DialogType } from '../keys.js';
import { CommandError } from 'telebuilder/exceptions';

@command
export class EraseCommand implements Command {
  command = 'erase';
  description = 'Deletes all messages in the selected chat';
  usage = '';
  scopes: CommandScope[] = [{ name: 'Default' }];
  langCodes = [];
  dialogPageSize = 3;

  @buttonsReg paginationButtons: Buttons = [
    [Button.inline('< Prev', Buffer.from('prevPage:1')), Button.inline('Next >', Buffer.from('nextPage:1'))]
  ];

  @inject(UserSessionService)
  userSessionService!: UserSessionService;

  @handler()
  public async entryHandler(event: NewMessageEvent) {
    if (!event.client || !event?.message?.senderId) return;
    const senderId = event.message.senderId;

    const userSession = await this.userSessionService.getById(senderId);
    let message = 'You need to create a session first using /session command.';

    if (userSession?.encryptedSession && userSession?.hashedPassword) {
      const password = await CommandHelper.tryInputThreeTimes(
        event.client,
        senderId,
        { message: 'Enter your passphrase:' },
        async (input: string): Promise<boolean> => {
          if (!(await bcrypt.compare(input, userSession.hashedPassword))) throw new CommandError('Invalid passphrase');
          return true;
        }
      );
      if (!password) return;

      const session = EncryptionHelper.decrypt(userSession.encryptedSession, password);

      const userClient = new TelegramUserClient(session, senderId, event.client);
      await userClient.connect();

      const allDialogs = await userClient.getDialogs();
      const filteresEntities = this.filterDialogs(DialogType.Chat, allDialogs);
      const entitiesByPage = this.getEntitiesByPage(filteresEntities, 1);
      userState.set(senderId.toString(), 'dialogEntities', filteresEntities);

      message = 'Enter chat number:\n\n';
      message += entitiesByPage.reduce((msg, e, i) => {
        msg += `${i + 1}. ${e.title} (${e.id.abs()})\n`;
        return msg;
      }, '');

      try {
        const selectedEntityStr = await CommandHelper.userInputHandler(event.client, senderId, { message, buttons: this.paginationButtons }, false);

        const selectedEntityNumber = parseInt(selectedEntityStr);
        if (isNaN(selectedEntityNumber)) throw new CommandError('Invalid chat number');

        const selectedDialog = filteresEntities[selectedEntityNumber - 1];
        if (!selectedDialog) throw new CommandError('Chat number is out of range');

        const msgs = await userClient.getMessages(selectedDialog.id, {
          fromUser: 'me',
        });
        const msgIds = msgs.map(m => m.id);
        const affectedMsgs = await userClient.deleteMessages(selectedDialog.id, msgIds, { revoke: true });

        let numberOfDeletedMsgs = 0;
        affectedMsgs.forEach((affectedMsg) => numberOfDeletedMsgs += affectedMsg.ptsCount);

        message = `Deleted ${numberOfDeletedMsgs} messages of ${msgIds.length} in "${selectedDialog.title}" chat.` + ((msgIds.length - numberOfDeletedMsgs) > 0 ?
          ` Remaining ${msgIds.length - numberOfDeletedMsgs} messages can't be deleted without admin rights because they are service messages.` : '');
      } catch (err) {
        event.client.logger.error('User ID: ' + senderId + ' Error: ' + (<Error>err).message);
        if ((<Error>err).message !== 'Timeout') {
          message = (<Error>err).message;
        } else {
          message = '';
        }
      }

      userState.deleteStateProperty(senderId.toString(), 'dialogEntities');
      await userClient.destroy();
    }

    if (message) await event.client.sendMessage(senderId, { message });
  }

  @handler(HandlerTypes.CallbackQuery, false)
  public async nextPage(event: CallbackQueryEvent) {
    await event.answer();
    await this.handlePagination(event, 1);
  }

  @handler(HandlerTypes.CallbackQuery, false)
  public async prevPage(event: CallbackQueryEvent) {
    await event.answer();
    await this.handlePagination(event, -1);
  }

  private async handlePagination(event: CallbackQueryEvent, direction: number) {
    if (!event.client || !event?.senderId || !event.data) return;

    const senderId = event.senderId;
    const dialogEntities = userState.get<DialogEntity[]>(senderId.toString(), 'dialogEntities');
    if (!dialogEntities) return;

    const { extraData } = CommandHelper.getDataFromButtonCallback(event.data);
    const page = parseInt(extraData) + direction;
    if (page < 1) return;

    const entitiesByPage = this.getEntitiesByPage(dialogEntities, page);
    if (entitiesByPage.length === 0) return;

    const pageOffset = (page - 1) * this.dialogPageSize;
    const message = 'Enter chat number:\n\n' + entitiesByPage.reduce((msg, e, i) => {
      msg += `${i + 1 + pageOffset}. ${e.title} (${e.id.abs()})\n`;
      return msg;
    }, '');

    await event.client.editMessage(senderId, {
      message: event.messageId,
      text: message,
      buttons: [this.paginationButtons[0].map(b => CommandHelper.setDataToButtonCallback(b, page))]
    });
  }

  private filterDialogs(type: DialogType, dialogs: Dialog[]): DialogEntity[] {
    return dialogs.reduce((chats, d) => {
      if ((
        (d.isGroup && type === DialogType.Chat) ||
        (d.isChannel && type === DialogType.Channel) ||
        (d.isUser && type === DialogType.User)) && d?.id
      ) {
        chats.push({
          id: d.id,
          title: d.title || 'undefined title',
        });
      }
      return chats;
    }, <DialogEntity[]>[]);
  }

  private getEntitiesByPage(entities: DialogEntity[], page: number): DialogEntity[] {
    return entities.slice((page - 1) * this.dialogPageSize, page * this.dialogPageSize);
  }
}
