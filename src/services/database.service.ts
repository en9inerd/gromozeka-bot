import { Collection } from 'mongodb';
import { DBService } from 'telebuilder/services';
import { UserSession } from '../models/index.js';
import { injectable } from 'telebuilder/decorators';

export const myCollections = {} as {
  userSessions: Collection<UserSession>,
};

@injectable
export class DatabaseService extends DBService {
  constructor() {
    super();
  }

  override initOwnCollections(): void {
    myCollections.userSessions = this.dbInstance.collection<UserSession>(this.getCollName(UserSession));
    myCollections.userSessions.createIndex({ userId: 1 }, { unique: true });
  }
}
