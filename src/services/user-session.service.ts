import bcrypt from 'bcrypt';
import { ReturnDocument } from 'mongodb';
import { injectable } from 'telebuilder/decorators';
import { EncryptionHelper } from 'telebuilder/helpers';
import { UserSession } from '../models/index.js';
import { UserCreds } from '../types.js';
import { myCollections } from './database.service.js';

@injectable
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
    const result = await myCollections.userSessions.findOneAndUpdate(
      { userId: newUserSession.userId },
      { $setOnInsert: newUserSession },
      { returnDocument: ReturnDocument.AFTER, upsert: true }
    );
    return result;
  }

  public async update(user: UserSession, creds?: UserCreds): Promise<UserSession | null> {
    const newUserSession = await this.buildUser(user, creds);
    const result = await myCollections.userSessions.findOneAndUpdate(
      { userId: newUserSession.userId },
      { $set: newUserSession },
      { returnDocument: ReturnDocument.AFTER }
    );
    return result;
  }

  public async getById(userId: bigInt.BigInteger | string): Promise<UserSession | null> {
    return await myCollections.userSessions.findOne({ userId: userId.toString() });
  }

  public async delete(userId: bigInt.BigInteger | string): Promise<{ deletedCount: number }> {
    return await myCollections.userSessions.deleteOne({ userId: userId.toString() });
  }
}
