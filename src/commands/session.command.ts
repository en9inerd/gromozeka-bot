import { TelegramUserClient } from 'telebuilder';
import { buttonsReg, command, handler, inject } from 'telebuilder/decorators';
import { EncryptionHelper, tryInputThreeTimes } from 'telebuilder/helpers';
import { Buttons, Command, CommandScope, HandlerTypes } from 'telebuilder/types';
import { Api } from 'telegram';
import { NewMessageEvent } from 'telegram/events';
import { CallbackQueryEvent } from 'telegram/events/CallbackQuery.js';
import { Button } from 'telegram/tl/custom/button.js';
import { UserSession } from '../models/index.js';
import { UserSessionService } from '../services/index.js';
import { getPasswordValidationFn } from '../utils.js';

@command
export class SessionCommand implements Command {
  command = 'session';
  description = 'Creates and saves a new session';
  scopes: CommandScope[] = [{ name: 'Default' }];
  langCodes = [];

  @inject(UserSessionService)
  private userSessionService!: UserSessionService;

  @buttonsReg woSessionButtons: Buttons = [
    [Button.inline('Create session', Buffer.from('createSession'))]
  ];

  @buttonsReg withSessionButtons: Buttons = [
    [Button.inline('Change Passphrase', Buffer.from('changePassphrase'))],
    [Button.inline('Revoke session', Buffer.from('revokeSession'))],
    [Button.inline('Delete session', Buffer.from('deleteSession'))]
  ];

  @handler()
  public async entryHandler(event: NewMessageEvent) {
    if (!event.client || !event?.message?.senderId) return;
    const senderId = event.message.senderId;

    const userSession = await this.userSessionService.getById(senderId);
    const buttons = [
      ...(userSession?.encryptedSession ? this.withSessionButtons : this.woSessionButtons)
    ];

    await event.client.sendMessage(senderId, {
      message: userSession?.encryptedSession
        ? `You already have "${userSession?.sessionName}" session.`
        : "You don't have a session yet. Please create one.",
      buttons
    });
  }

  @handler({ type: HandlerTypes.CallbackQuery })
  public async createSession(event: CallbackQueryEvent) {
    await event.answer();

    if (!event.client || !event?.senderId) return;
    const senderId = event.senderId;

    const userSession = await this.userSessionService.getById(senderId);
    let message = `You already have "${userSession?.sessionName}" session. Please revoke it first.`;

    if (!userSession?.encryptedSession) {
      const userClient = new TelegramUserClient('', senderId, event.client);

      try {
        await userClient.init();

        const password = await tryInputThreeTimes(
          senderId,
          { message: 'Please enter your passphrase to encrypt session:' }
        );
        if (!password) return;

        const sessionName = (<Api.User>(await userClient.getMe())).firstName;

        const newUserSession = {
          sessionName,
          userId: senderId,
        } as UserSession;

        const userCreds = {
          password,
          session: <string><unknown>userClient.session.save(),
        };

        if (userSession?.userId) {
          await this.userSessionService.update(newUserSession, userCreds);
        } else {
          await this.userSessionService.create(newUserSession, userCreds);
        }

        message = 'Your session has been created.';
      } finally {
        await userClient.destroy();
      }
    }

    await event.client.sendMessage(senderId, { message });
  }

  @handler({ type: HandlerTypes.CallbackQuery })
  public async revokeSession(event: CallbackQueryEvent) {
    await event.answer();
    if (!event.client || !event?.senderId) return;
    const senderId = event.senderId;

    const userSession = await this.userSessionService.getById(senderId);
    let message = "You don't have a session yet. Please create one.";

    if (userSession?.encryptedSession && userSession?.hashedPassword) {
      const password = await tryInputThreeTimes(
        senderId,
        { message: 'Please enter your passphrase to revoke session:' },
        getPasswordValidationFn(userSession)
      );
      if (!password) return;

      const session = EncryptionHelper.decrypt(userSession.encryptedSession, password);
      const userClient = new TelegramUserClient(session, senderId, event.client);
      try {
        await userClient.connect();

        if (await userClient.checkAuthorization()) {
          await userClient.invoke(new Api.auth.LogOut());
        }
        await this.userSessionService.delete(senderId);

        message = 'Your session has been revoked.';
      } finally {
        await userClient.destroy();
      }
    }

    await event.client.sendMessage(senderId, { message });
  }

  @handler({ type: HandlerTypes.CallbackQuery })
  public async changePassphrase(event: CallbackQueryEvent) {
    await event.answer();
    if (!event.client || !event?.senderId) return;
    const senderId = event.senderId;

    const userSession = await this.userSessionService.getById(senderId);
    let message = "You don't have a session yet. Please create one.";

    if (userSession?.encryptedSession && userSession?.hashedPassword) {
      const currentPassword = await tryInputThreeTimes(
        senderId,
        { message: 'Please enter your current passphrase:' },
        getPasswordValidationFn(userSession)
      );
      if (!currentPassword) return;

      const session = EncryptionHelper.decrypt(userSession.encryptedSession, currentPassword);

      const newPassword = await tryInputThreeTimes(
        senderId,
        { message: 'Please enter your new passphrase:' }
      );
      if (!newPassword) return;

      const userCreds = {
        password: newPassword,
        session
      };

      await this.userSessionService.update(userSession, userCreds);
      message = 'Your passphrase has been changed.';
    }

    await event.client.sendMessage(senderId, { message });
  }

  @handler({ type: HandlerTypes.CallbackQuery })
  public async deleteSession(event: CallbackQueryEvent) {
    await event.answer();
    if (!event.client || !event?.senderId) return;
    const senderId = event.senderId;

    const message = 'Your session has been deleted in the database.';

    await this.userSessionService.delete(senderId);

    await event.client.sendMessage(senderId, { message });
  }
}
