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
        '- This bot has experimental feature that allows you to delete all messages in the selected chat/channel/conversation. ' +
        'This feature is not safe since it needs to store your encrypted (aes-256-cbc with passphrase) session in the database. ' +
        'You shouldn\'t use this feature if you don\'t trust the bot owner.\n' +
        '- You can manage your session using /session command.\n' +
        '- To delete all messages in the selected chat use /erase command. It can be used with the following parameters:\n' +
        '    * *peers*: comma separated list of peer ids/usernames. If not specified, the bot will ask you to select an entity.\n' +
        '    * *type*: type of the entities to list. By default, \'chat\'.\n' +
        '    * *pw*: passphrase to encrypt your session. If not specified, the bot will ask you to enter one.\n' +
        '    * *wipeAll*: if true, all messages from specified type (\'chat\' by default) of entities will be deleted. If false, only messages from the selected entities will be deleted.'
    });
  }
}
