import { Schema, Document, model } from 'mongoose';

export const UserSchema = new Schema({
  name: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roles: [{ type: String }],
});

export interface User extends Document {
  name: string;
  email: string;
  password: string;
  roles: string[];
}

export const UserModel = model<User>('User', UserSchema);
