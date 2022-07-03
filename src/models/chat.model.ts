import { Schema, model } from 'mongoose';
import { Chat } from '../types';

const schema = new Schema<Chat>({
  id: { type: String, required: true, unique: true },
});

export const ChatModel = model<Chat>('Chat', schema);
