
export class UserSession {
  id!: bigInt.BigInteger | string;
  sessionName!: string;
  encryptedSession!: string;
  hashedPassword!: string;
};

export const UserSessionsJSONSchema = {
  bsonType: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: {
    _id: {},
    id: {
      bsonType: 'string',
      description: 'must be a string and is required',
    },
    sessionName: {
      bsonType: 'string',
      description: 'must be a string',
    },
    encryptedSession: {
      bsonType: 'string',
      description: 'must be a string',
    },
    hashedPassword: {
      bsonType: 'string',
      description: 'must be a string',
    }
  },
};
