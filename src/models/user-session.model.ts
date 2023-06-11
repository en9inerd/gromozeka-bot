import { model } from 'telebuilder';

const jsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'sessionName', 'encryptedSession', 'hashedPassword'],
    additionalProperties: false,
    properties: {
      _id: {},
      userId: {
        bsonType: 'string',
        description: 'must be a string and is required',
      },
      sessionName: {
        bsonType: 'string',
        description: 'must be a string and is required',
      },
      encryptedSession: {
        bsonType: 'string',
        description: 'must be a string and is required',
      },
      hashedPassword: {
        bsonType: 'string',
        description: 'must be a string and is required',
      },
    },
  },
};

@model({
  collectionName: 'user_sessions',
  jsonSchema
})
export class UserSession {
  userId!: bigInt.BigInteger | string;
  sessionName!: string;
  encryptedSession!: string;
  hashedPassword!: string;
}
