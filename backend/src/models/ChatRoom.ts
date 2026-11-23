import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type ChatRoomType = 'DIRECT' | 'GROUP';

export interface IChatRoom extends Document {
  hostelId: Types.ObjectId;
  type: ChatRoomType;
  name: string | null;
  description: string;
  avatar: string | null;
  memberIds: Types.ObjectId[];
  createdBy: Types.ObjectId;
  lastMessageText: string;
  lastMessageAt: Date;
  lastReadAt: Map<string, Date>;
  createdAt: Date;
  updatedAt: Date;
}

const chatRoomSchema = new Schema<IChatRoom>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    type: { type: String, enum: ['DIRECT', 'GROUP'], required: true },
    name: { type: String, default: null, trim: true, maxlength: 60 },
    description: { type: String, default: '', trim: true, maxlength: 200 },
    avatar: { type: String, default: null, maxlength: 300 },
    memberIds: { type: [Schema.Types.ObjectId], ref: 'User', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessageText: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    lastReadAt: { type: Map, of: Date, default: {} },
  },
  { timestamps: true }
);

chatRoomSchema.index({ hostelId: 1, memberIds: 1, lastMessageAt: -1 });

export const ChatRoom: Model<IChatRoom> =
  mongoose.models.ChatRoom || mongoose.model<IChatRoom>('ChatRoom', chatRoomSchema);
