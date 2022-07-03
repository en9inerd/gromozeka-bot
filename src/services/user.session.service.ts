import bcrypt from 'bcrypt';
import { EncryptionHelper } from 'telebuilder/helpers';
import { UserSessionModel } from '../models';
import { UserSession, UserCreds } from '../types';

export class UserSessionService {
  private async buildUser(userSession: UserSession, creds?: UserCreds): Promise<UserSession> {
    userSession.id = userSession.id.toString();
    if (creds?.password) {
      userSession.hashedPassword = await bcrypt.hash(creds.password, 10);
      if (creds?.session) userSession.encryptedSession = EncryptionHelper.encrypt(creds.session, creds.password);
    }
    return userSession;
  }
  public async create(userSession: UserSession, creds: UserCreds): Promise<UserSession | null> {
    const newUserSession = await this.buildUser(userSession, creds);
    return await UserSessionModel.findOneAndUpdate({ id: newUserSession.id }, newUserSession, { new: true, upsert: true });
  }

  public async update(user: UserSession, creds?: UserCreds): Promise<UserSession | null> {
    const newUserSession = await this.buildUser(user, creds);
    return await UserSessionModel.findOneAndUpdate({ id: newUserSession.id }, newUserSession, { new: true });
  }

  public async getByIdAndDecrypt(
    userId: bigInt.BigInteger | string,
    password: string,
  ): Promise<{ userSession: UserSession | null; session: string }> {
    const userSession = await UserSessionModel.findOne({ id: userId.toString() });
    let session = '';
    if (userSession?.encryptedSession && userSession?.hashedPassword) {
      if (!(await bcrypt.compare(password, userSession.hashedPassword))) throw new Error('Invalid password');
      session = EncryptionHelper.decrypt(userSession.encryptedSession, password);
    }
    return { userSession, session };
  }

  public async getById(userId: bigInt.BigInteger | string): Promise<UserSession | null> {
    return await UserSessionModel.findOne({ id: userId.toString() });
  }

  public async delete(userId: bigInt.BigInteger | string): Promise<{ deletedCount: number }> {
    return await UserSessionModel.deleteOne({ id: userId.toString() });
  }
}
