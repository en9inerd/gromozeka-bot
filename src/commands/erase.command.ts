import bigInt from 'big-integer';
import { TelegramUserClient } from 'telebuilder';
import { buttonsReg, client, command, handler, inject, params } from 'telebuilder/decorators';
import { CommandException } from 'telebuilder/exceptions';
import { CommandHelper, EncryptionHelper } from 'telebuilder/helpers';
import { userState } from 'telebuilder/states';
import { Buttons, Command, CommandParamsSchema, CommandScope, ExtendedMessage, HandlerTypes } from 'telebuilder/types';
import { Api, TelegramClient } from 'telegram';
import { NewMessageEvent } from 'telegram/events';
import { CallbackQueryEvent } from 'telegram/events/CallbackQuery.js';
import { Button } from 'telegram/tl/custom/button.js';
import { Dialog } from 'telegram/tl/custom/dialog.js';
import { UserSessionService } from '../services/index.js';
import { EntityType, EraseParams, ShortEntity } from '../types.js';
import { getPasswordValidationFn } from '../utils.js';

@command
export class EraseCommand implements Command {
  command = 'erase';
  description = 'Deletes all messages in the selected chat';
  scopes: CommandScope[] = [{ name: 'Default' }];
  langCodes = [];
  @params params: CommandParamsSchema = {
    peers: {
      type: 'string',
      required: false,
    },
    type: {
      type: 'enum',
      required: false,
      enumValues: Object.values(EntityType),
    },
    pw: {
      type: 'string',
      required: false,
    },
    wipeAll: {
      type: 'boolean',
      required: false,
    },
  };
  dialogPageSize = 10;

  @buttonsReg paginationButtons: Buttons = [
    [Button.inline('< Prev', Buffer.from('prevPage:1')), Button.inline('Next >', Buffer.from('nextPage:1'))]
  ];

  @inject(UserSessionService)
  userSessionService!: UserSessionService;

  @client client!: TelegramClient;

  @handler()
  public async entryHandler(event: NewMessageEvent) {
    if (!event.client || !event?.message?.senderId) return;

    const senderId = event.message.senderId;
    const params: EraseParams = (<ExtendedMessage>event.message).params || {};
    const userSession = await this.userSessionService.getById(senderId);

    if (userSession?.encryptedSession && userSession?.hashedPassword) {
      let password: string;
      if (params?.pw) {
        password = (params.pw.startsWith('||') && params.pw.endsWith('||')) ? params.pw.slice(2, -2) : params.pw;
        await (getPasswordValidationFn(userSession)(password));
      } else {
        password = await CommandHelper.tryInputThreeTimes(
          senderId,
          { message: 'Enter your passphrase:' },
          getPasswordValidationFn(userSession)
        );
      }
      if (!password) return;

      const session = EncryptionHelper.decrypt(userSession.encryptedSession, password);
      const userClient = new TelegramUserClient(session, senderId, event.client);

      try {
        await userClient.connect();
        let entities = <ShortEntity[]>[];
        const dialogs = await userClient.getDialogs();

        if (params?.peers && params?.wipeAll) {
          throw new CommandException('You can\'t use both "peers" and "wipe" parameters at the same time');
        } else if (params?.peers) {
          entities = this.getEntitiesbyIds(dialogs, params.peers);
          await this.deleteMessagesFromEntities(
            userClient,
            senderId,
            entities
          );
        } else if (params?.wipeAll) {
          entities = this.filterDialogs(
            dialogs,
            params?.type || EntityType.Chat,
          );
          await this.deleteMessagesFromEntities(
            userClient,
            senderId,
            entities
          );
        } else {
          entities = this.filterDialogs(
            dialogs,
            params?.type || EntityType.Chat,
          );
          await this.deleteMessagesFromSelectedChat(userClient, senderId, entities);
        }
      } finally {
        await userClient.destroy();
      }
    } else {
      await event.client.sendMessage(senderId, { message: 'You need to create a session first using /session command.' });
    }
  }

  private async deleteMessagesFromSelectedChat(
    userClient: TelegramUserClient,
    senderId: bigInt.BigInteger,
    entities: ShortEntity[]
  ) {
    const dialogsByPage = this.getDialogsByPage(entities, 1);

    userState.set(senderId.toString(), 'dialogEntities', entities);

    let message = 'Enter entity number:\n\n';
    message += dialogsByPage.reduce((msg, e, i) => {
      msg += `${i + 1}. ${e.title} (${e.id?.abs()})\n`;
      return msg;
    }, '');

    const selectedEntityStr = await CommandHelper.userInputHandler(senderId, { message, buttons: this.paginationButtons }, false);

    const selectedEntityNumber = parseInt(selectedEntityStr);
    if (isNaN(selectedEntityNumber)) throw new CommandException('Invalid entity number');

    const selectedDialog = entities[selectedEntityNumber - 1];
    if (!selectedDialog) throw new CommandException('Entity number is out of range');

    await this.deleteMessagesFromEntities(userClient, senderId, [selectedDialog]);

    userState.deleteStateProperty(senderId.toString(), 'dialogEntities');
  }

  private async deleteMessagesFromEntities(
    userClient: TelegramUserClient,
    senderId: bigInt.BigInteger,
    entities: ShortEntity[]
  ) {
    for (const entity of entities) {
      if (entity.type === EntityType.User) {
        const affectedMsgs = await userClient.invoke(new Api.messages.DeleteHistory({
          peer: entity.id,
          revoke: true,
        }));
        await this.client.sendMessage(senderId, { message: `Deleted ${affectedMsgs.ptsCount} messages from conversation with "${entity.title}"` });
      } else {
        let numberOfDeletedMsgs = 0;

        const msgs = await userClient.getMessages(entity.id, {
          fromUser: 'me',
        });
        const msgIds = msgs.map(m => m.id);
        const affectedMsgs = await userClient.deleteMessages(entity.id, msgIds, { revoke: true });

        affectedMsgs.forEach((affectedMsg) => numberOfDeletedMsgs += affectedMsg.ptsCount);

        const message = `Deleted ${numberOfDeletedMsgs} messages of ${msgIds.length} in "${entity.title}" chat.` + ((msgIds.length - numberOfDeletedMsgs) > 0 ?
          ` Remaining ${msgIds.length - numberOfDeletedMsgs} messages can't be deleted without admin rights because they are service messages.` : '');

        await this.client.sendMessage(senderId, { message });
      }
    }
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
    const dialogEntities = userState.get<ShortEntity[]>(senderId.toString(), 'dialogEntities');
    if (!dialogEntities) return;

    const { extraData } = CommandHelper.getDataFromButtonCallback(event.data);
    const page = parseInt(extraData) + direction;
    if (page < 1) return;

    const dialogsByPage = this.getDialogsByPage(dialogEntities, page);
    if (dialogsByPage.length === 0) return;

    const pageOffset = (page - 1) * this.dialogPageSize;
    const message = 'Enter entity number:\n\n' + dialogsByPage.reduce((msg, e, i) => {
      msg += `${i + 1 + pageOffset}. ${e.title} (${e.id?.abs()})\n`;
      return msg;
    }, '');

    await event.client.editMessage(senderId, {
      message: event.messageId,
      text: message,
      buttons: [this.paginationButtons[0].map(b => CommandHelper.setDataToButtonCallback(b, page))]
    });
  }

  private filterDialogs(dialogs: Dialog[], type: EntityType): ShortEntity[] {
    return dialogs.reduce((entities, d) => {
      if ((
        (type === EntityType.Any) ||
        (d.isGroup && type === EntityType.Chat) ||
        (d.isChannel && type === EntityType.Channel) ||
        (d.isUser && type === EntityType.User)) && d?.id
      ) {
        entities.push({
          id: d.id,
          title: d.title || 'undefined title',
          type
        });
      }
      return entities;
    }, <ShortEntity[]>[]);
  }

  private getEntitiesbyIds(dialogs: Dialog[], peerIds: string): ShortEntity[] {
    return peerIds.split(',').map((peer) => {
      const id = isNaN(Number(peer)) ? peer : bigInt(peer.trim());
      const dialog = dialogs.find(d => d.id?.equals(id));

      if (!dialog) throw new CommandException(`Entity with id "${id}" not found in your dialogs`);

      return {
        id: dialog.id || bigInt(0),
        title: dialog.title || 'undefined title',
        type: dialog.isGroup ? EntityType.Chat : dialog.isChannel ? EntityType.Channel : EntityType.User,
      };
    });
  }

  private getDialogsByPage(entities: ShortEntity[], page: number): ShortEntity[] {
    return entities.slice((page - 1) * this.dialogPageSize, page * this.dialogPageSize);
  }
}
