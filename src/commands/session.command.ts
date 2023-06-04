
import bcrypt from 'bcrypt';
import { NewMessageEvent } from 'telegram/events';
import { CallbackQueryEvent } from 'telegram/events/CallbackQuery';
import { Button } from 'telegram/tl/custom/button';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram';
import { UserSessionService } from '../services';
import { UserSession } from '../models';
import { Command, CommandScope } from 'telebuilder/types';
import { TelegramUserClient, Utils, boundAndLocked } from 'telebuilder';
import { EncryptionHelper } from 'telebuilder/helpers';

export class SessionCommand implements Command {
  command = 'session';
  description = 'Creates and saves a new session';
  usage = '';
  scopes: CommandScope[] = [{ name: 'Default' }];
  langCodes = [];
  woSessionButtons = [
    [Button.inline('Create session', Buffer.from('createSession'))]
  ];
  withSessionButtons = [
    [Button.inline('Change Passphrase', Buffer.from('changePassphrase'))],
    [Button.inline('Revoke session', Buffer.from('revokeSession'))],
    [Button.inline('Delete session', Buffer.from('deleteSession'))]
  ];
  private userSessionService = new UserSessionService();

  @boundAndLocked
  public async defaultHandler(event: NewMessageEvent) {
    if (!event.client || !event?.message?.senderId) return;

    const userSession = await this.userSessionService.getById(event.message.senderId);
    const buttons = [
      ...(userSession?.encryptedSession ? this.withSessionButtons : this.woSessionButtons)
    ];

    await event.client.sendMessage(event.message.senderId, {
      message: userSession?.encryptedSession
        ? `You already have "${userSession?.sessionName}" session.`
        : "You don't have a session yet. Please create one.",
      buttons,
    });
  }

  @boundAndLocked
  public async createSession(event: CallbackQueryEvent) {
    await event.answer();
    if (!event.client || !event?.senderId) return;

    const userSession = await this.userSessionService.getById(event.senderId);
    let message = `You already have "${userSession?.sessionName}" session. Please revoke it first.`;

    if (!userSession?.encryptedSession) {
      const userClient = new TelegramUserClient(new StringSession(''), event.senderId, event.client);

      try {
        await userClient.init();
      } catch (err) {
        event.client.logger.error('User ID: ' + event.senderId + ' Error: ' + (<Error>err).message);
        return;
      }

      const password = await Utils.tryInputThreeTimes(
        event.client,
        'Please enter your passphrase to encrypt session:',
        event.senderId,
        async (input: string): Promise<boolean> => {
          return input !== '';
        }
      );

      const sessionName = (<Api.User>(await userClient.getMe())).firstName;

      const newUserSession = {
        sessionName,
        id: event.senderId,
      } as UserSession;

      const userCreds = {
        password,
        session: <string><unknown>userClient.session.save(),
      };

      if (userSession?.id) {
        await this.userSessionService.update(newUserSession, userCreds);
      } else {
        await this.userSessionService.create(newUserSession, userCreds);
      }

      await userClient.destroy();

      message = 'Your session has been created.';
    }

    await event.client.sendMessage(event.senderId, { message });
  }

  @boundAndLocked
  public async revokeSession(event: CallbackQueryEvent) {
    await event.answer();
    if (!event.client || !event?.senderId) return;

    const userSession = await this.userSessionService.getById(event.senderId);
    let message = "You don't have a session yet. Please create one.";

    if (userSession?.encryptedSession && userSession?.hashedPassword) {
      const password = await Utils.tryInputThreeTimes(
        event.client,
        'Please enter your passphrase to revoke session:',
        event.senderId,
        async (input: string): Promise<boolean> => {
          if (!(await bcrypt.compare(input, userSession.hashedPassword))) throw new Error('Invalid passphrase');
          return true;
        }
      );
      const session = EncryptionHelper.decrypt(userSession.encryptedSession, password);

      const userClient = new TelegramUserClient(new StringSession(session), event.senderId, event.client);
      await userClient.connect();

      if (await userClient.checkAuthorization()) {
        await userClient.invoke(new Api.auth.LogOut());
      }
      await this.userSessionService.delete(event.senderId);
      await userClient.destroy();

      message = 'Your session has been revoked.';
    }

    await event.client.sendMessage(event.senderId, { message });
  }

  @boundAndLocked
  public async changePassphrase(event: CallbackQueryEvent) {
    await event.answer();
    if (!event.client || !event?.senderId) return;

    const userSession = await this.userSessionService.getById(event.senderId);
    let message = "You don't have a session yet. Please create one.";

    if (userSession?.encryptedSession && userSession?.hashedPassword) {
      const currentPassword = await Utils.tryInputThreeTimes(
        event.client,
        'Please enter your current passphrase:',
        event.senderId,
        async (input: string): Promise<boolean> => {
          if (!(await bcrypt.compare(input, userSession.hashedPassword))) throw new Error('Invalid passphrase');
          return true;
        }
      );
      const session = EncryptionHelper.decrypt(userSession.encryptedSession, currentPassword);

      const newPassword = await Utils.tryInputThreeTimes(
        event.client,
        'Please enter your new passphrase:',
        event.senderId,
        async (input: string): Promise<boolean> => {
          return input !== '';
        }
      );

      const userCreds = {
        password: newPassword,
        session
      };

      await this.userSessionService.update(userSession, userCreds);
      message = 'Your passphrase has been changed.';
    }

    await event.client.sendMessage(event.senderId, { message });
  }

  @boundAndLocked
  public async deleteSession(event: CallbackQueryEvent) {
    await event.answer();
    if (!event.client || !event?.senderId) return;

    const message = 'Your session has been deleted in the database.';

    await this.userSessionService.delete(event.senderId);

    await event.client.sendMessage(event.senderId, { message });
  }

  callbackQueryHandlers = [
    {
      pattern: new RegExp('createSession'),
      callback: this.createSession,
    },
    {
      pattern: new RegExp('revokeSession'),
      callback: this.revokeSession,
    },
    {
      pattern: new RegExp('deleteSession'),
      callback: this.deleteSession,
    },
    {
      pattern: new RegExp('changePassphrase'),
      callback: this.changePassphrase,
    }
  ];
}
