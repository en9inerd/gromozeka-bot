import { NewMessageEvent } from 'telegram/events';
import type { Command, CommandScope } from 'telebuilder/types';
import { command, handler } from 'telebuilder/decorators';

@command
export class StartCommand implements Command {
  command = 'start';
  description = 'Start the bot';
  scopes: CommandScope[] = [];
  langCodes = [];

  @handler()
  public async entryHandler(event: NewMessageEvent): Promise<void> {
    if (!event.client || !event?.message?.senderId) return;

    const client = event.client;

    client.sendMessage(event.message.senderId, {
      message: '**Please, pay attention to the following information:**\n\n' +
        '- This bot has experimental feature that allows you to delete all messages in the selected chat. ' +
        'This feature is not safe since it needs to store your encrypted (aes-256-cbc with passphrase) session in the database.\n' +
        '- You can manage your session using /session command.\n' +
        '- To delete all messages in the selected chat use /erase command.'
    });
  }
}
