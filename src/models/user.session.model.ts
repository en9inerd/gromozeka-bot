import { Schema, model } from 'mongoose';
import { UserSession } from '../types';

const schema = new Schema<UserSession>({
  id: { type: String, required: true, unique: true },
  sessionName: { type: String },
  encryptedSession: { type: String },
  hashedPassword: { type: String },
});

export const UserSessionModel = model<UserSession>('UserSession', schema);
