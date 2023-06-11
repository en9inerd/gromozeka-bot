import bcrypt from 'bcrypt';
import { EncryptionHelper } from 'telebuilder/helpers';
import { UserCreds } from '../types';
import { UserSession } from '../models';
import { collections } from './database.service';
import { ReturnDocument } from 'mongodb';

export class UserSessionService {
  private async buildUser(userSession: UserSession, creds?: UserCreds): Promise<UserSession> {
    userSession.userId = userSession.userId.toString();
    if (creds?.password) {
      userSession.hashedPassword = await bcrypt.hash(creds.password, 10);
      if (creds?.session) userSession.encryptedSession = EncryptionHelper.encrypt(creds.session, creds.password);
    }
    return userSession;
  }
  public async create(userSession: UserSession, creds: UserCreds): Promise<UserSession | null> {
    const newUserSession = await this.buildUser(userSession, creds);
    const result = await collections.userSessions.findOneAndUpdate(
      { userId: newUserSession.userId },
      newUserSession,
      { returnDocument: ReturnDocument.AFTER, upsert: true }
    );
    return result.value;
  }

  public async update(user: UserSession, creds?: UserCreds): Promise<UserSession | null> {
    const newUserSession = await this.buildUser(user, creds);
    const result = await collections.userSessions.findOneAndUpdate(
      { userId: newUserSession.userId },
      newUserSession,
      { returnDocument: ReturnDocument.AFTER }
    );
    return result.value;
  }

  public async getByIdAndDecrypt(
    userId: bigInt.BigInteger | string,
    password: string,
  ): Promise<{ userSession: UserSession | null; session: string }> {
    const userSession = await collections.userSessions.findOne({ id: userId.toString() });
    let session = '';
    if (userSession?.encryptedSession && userSession?.hashedPassword) {
      if (!(await bcrypt.compare(password, userSession.hashedPassword))) throw new Error('Invalid password');
      session = EncryptionHelper.decrypt(userSession.encryptedSession, password);
    }
    return { userSession, session };
  }

  public async getById(userId: bigInt.BigInteger | string): Promise<UserSession | null> {
    return await collections.userSessions.findOne({ id: userId.toString() });
  }

  public async delete(userId: bigInt.BigInteger | string): Promise<{ deletedCount: number }> {
    return await collections.userSessions.deleteOne({ id: userId.toString() });
  }
}
