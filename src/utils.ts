import bcrypt from 'bcrypt';
import { CommandException } from 'telebuilder/exceptions';
import { UserSession } from './models/user-session.model.js';

export function getPasswordValidationFn(userSession: UserSession) {
  return async (input: string): Promise<boolean> => {
    if (!(await bcrypt.compare(input, userSession.hashedPassword))) throw new CommandException('Invalid passphrase');
    return true;
  };
}

export * as Utils from './utils.js';
