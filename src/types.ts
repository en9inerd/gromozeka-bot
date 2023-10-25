export type UserCreds = {
  password: string;
  session: string;
};

export enum EntityType {
  User = 'user',
  Chat = 'chat',
  Channel = 'channel',
  Any = 'any',
}

export type ShortEntity = {
  id: bigInt.BigInteger;
  title: string;
  type: EntityType;
};

export type EraseParams = {
  peers?: string;
  wipeAll?: boolean;
  type?: EntityType;
  pw?: string;
};
