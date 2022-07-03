export type UserSession = {
  id: bigInt.BigInteger | string;
  sessionName: string;
  encryptedSession: string;
  hashedPassword: string;
};

export type UserCreds = {
  password: string;
  session: string;
};

export type Chat = {
  id: bigInt.BigInteger | string;
};
