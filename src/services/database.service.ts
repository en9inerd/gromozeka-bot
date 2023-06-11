import { Collection } from 'mongodb';
import { DBService } from 'telebuilder/services';
import { UserSession } from '../models';
import config from 'config';

export const collections = {} as {
  userSessions: Collection<UserSession>,
};

export class DatabaseService extends DBService {
  constructor() {
    super();
  }

  override initOwnCollections(): void {
    collections.userSessions = this.dbInstance.collection<UserSession>(config.get('dbConfig.collections.userSessions'));
  }
}
