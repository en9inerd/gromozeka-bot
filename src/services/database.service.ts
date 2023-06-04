import { Collection, MongoServerError } from 'mongodb';
import { DBService } from 'telebuilder/services';
import { UserSession, UserSessionsJSONSchema } from '../models';
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

  override async applyOwnSchemaValidation(): Promise<void> {
    await this.dbInstance.command({
      collMod: config.get('dbConfig.collections.userSessions'),
      validator: UserSessionsJSONSchema
    }).catch(async (error: MongoServerError) => {
      if (error.codeName === 'NamespaceNotFound') {
        await this.dbInstance.createCollection(config.get('dbConfig.collections.handlers'), { validator: UserSessionsJSONSchema });
      }
    });
  }
}
