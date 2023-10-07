import bcrypt from 'bcrypt';
import { TelegramClient } from 'telegram';
import { NewMessageEvent } from 'telegram/events';
import { UserSessionService } from '../services/index.js';
import { Buttons, Command, CommandParamsSchema, CommandScope, ExtendedMessage, HandlerTypes } from 'telebuilder/types';
import { userState } from 'telebuilder/states';
import { buttonsReg, command, handler, inject, params } from 'telebuilder/decorators';
import { EncryptionHelper, CommandHelper } from 'telebuilder/helpers';
import { TelegramUserClient } from 'telebuilder';
import { Button } from 'telegram/tl/custom/button.js';
import { CallbackQueryEvent } from 'telegram/events/CallbackQuery.js';
import { Dialog } from 'telegram/tl/custom/dialog.js';
import { DialogEntity } from '../types.js';
import { DialogType } from '../keys.js';
import { CommandError } from 'telebuilder/exceptions';
import { Api } from 'telegram';
import { formatErrorMessage } from 'telebuilder/utils';
import bigInt from 'big-integer';

@command
export class EraseCommand implements Command {
  command = 'erase';
  description = 'Deletes all messages in the selected chat';
  scopes: CommandScope[] = [{ name: 'Default' }];
  langCodes = [];
  @params params: CommandParamsSchema = {
    peers: {
      type: 'string',
      required: true,
    },
    pw: {
      type: 'string',
      required: true,
    },
  };
  dialogPageSize = 10;

  @buttonsReg paginationButtons: Buttons = [
    [Button.inline('< Prev', Buffer.from('prevPage:1')), Button.inline('Next >', Buffer.from('nextPage:1'))]
  ];

  @inject(UserSessionService)
  userSessionService!: UserSessionService;

  @handler()
  public async entryHandler(event: NewMessageEvent) {
    if (!event.client || !event?.message?.senderId) return;

    const senderId = event.message.senderId;
    const params = (<ExtendedMessage>event.message).params;
    const userSession = await this.userSessionService.getById(senderId);

    if (userSession?.encryptedSession && userSession?.hashedPassword) {
      let password: string;
      if (params?.pw) {
        password = params.pw as string;
      } else {
        password = await CommandHelper.tryInputThreeTimes(
          event.client,
          senderId,
          { message: 'Enter your passphrase:' },
          async (input: string): Promise<boolean> => {
            if (!(await bcrypt.compare(input, userSession.hashedPassword))) throw new CommandError('Invalid passphrase');
            return true;
          }
        );
      }
      if (!password) return;

      const session = EncryptionHelper.decrypt(userSession.encryptedSession, password);
      const userClient = new TelegramUserClient(session, senderId, event.client);

      try {
        await userClient.connect();
        if (params?.peers && params?.pw) {
          await this.deleteMessagesFromPeers(userClient, senderId, event.client, <string>params.peers);
        } else {
          await this.deleteMessagesFromSelectedChat(userClient, senderId, event.client);
        }
      } catch (err) {
        if ((<Error>err).message !== 'Timeout') {
          event.client.logger.error('User ID: ' + senderId + ' Error: ' + (<Error>err).message);
          await event.client.sendMessage(senderId, { message: formatErrorMessage(<Error>err) });
        }
      }

      await userClient.destroy();
    } else {
      await event.client.sendMessage(senderId, { message: 'You need to create a session first using /session command.' });
    }
  }

  private async deleteMessagesFromSelectedChat(
    userClient: TelegramUserClient,
    senderId: bigInt.BigInteger,
    botClient: TelegramClient
  ) {
    const allDialogs = await userClient.getDialogs();
    const filteresEntities = this.filterDialogs(DialogType.Chat, allDialogs);
    const entitiesByPage = this.getEntitiesByPage(filteresEntities, 1);

    userState.set(senderId.toString(), 'dialogEntities', filteresEntities);

    let message = 'Enter chat number:\n\n';
    message += entitiesByPage.reduce((msg, e, i) => {
      msg += `${i + 1}. ${e.title} (${e.id.abs()})\n`;
      return msg;
    }, '');

    const selectedEntityStr = await CommandHelper.userInputHandler(botClient, senderId, { message, buttons: this.paginationButtons }, false);

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

    await botClient.sendMessage(senderId, { message });

    userState.deleteStateProperty(senderId.toString(), 'dialogEntities');
  }

  private async deleteMessagesFromPeers(
    userClient: TelegramUserClient,
    senderId: bigInt.BigInteger,
    botClient: TelegramClient,
    peers: string
  ) {
    const peersArr = (peers).split(',').map(p => {
      return isNaN(Number(p)) ? p : bigInt(p.trim());
    });

    if (peers.length === 0) throw new CommandError('Invalid peers');

    for (const peer of peersArr) {
      let numberOfDeletedMsgs = 0;
      const entity = <Api.Chat>(await userClient.getEntity(peer));

      const msgs = await userClient.getMessages(peer, {
        fromUser: 'me',
      });
      const msgIds = msgs.map(m => m.id);
      const affectedMsgs = await userClient.deleteMessages(peer, msgIds, { revoke: true });

      affectedMsgs.forEach((affectedMsg) => numberOfDeletedMsgs += affectedMsg.ptsCount);

      const message = `Deleted ${numberOfDeletedMsgs} messages of ${msgIds.length} in "${entity.title}" chat.` + ((msgIds.length - numberOfDeletedMsgs) > 0 ?
        ` Remaining ${msgIds.length - numberOfDeletedMsgs} messages can't be deleted without admin rights because they are service messages.` : '');

      await botClient.sendMessage(senderId, { message });
    }
  }

  private async deleteMessagesFromAllDialogs(
    userClient: TelegramUserClient,
    senderId: bigInt.BigInteger,
    botClient: TelegramClient
  ) {
    const allDialogs = await userClient.getDialogs();

    let numberOfDeletedMsgs = 0;
    for (const entity of allDialogs) {
      const msgs = await userClient.getMessages(entity.id, {
        fromUser: 'me',
      });
      const msgIds = msgs.map(m => m.id);
      const affectedMsgs = await userClient.deleteMessages(entity.id, msgIds, { revoke: true });

      affectedMsgs.forEach((affectedMsg) => numberOfDeletedMsgs += affectedMsg.ptsCount);
    }

    const message = `Deleted ${numberOfDeletedMsgs} messages.`;

    await botClient.sendMessage(senderId, { message });
  }

  @handler({
    type: HandlerTypes.CallbackQuery,
    lock: false,
  })
  public async nextPage(event: CallbackQueryEvent) {
    await event.answer();
    await this.handlePagination(event, 1);
  }

  @handler({
    type: HandlerTypes.CallbackQuery,
    lock: false,
  })
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
