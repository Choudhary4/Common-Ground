import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IChatMessage extends Document {
  roomId: Types.ObjectId;
  hostelId: Types.ObjectId;
  senderId: Types.ObjectId;
  text: string;
  createdAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true, index: true },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

chatMessageSchema.index({ roomId: 1, createdAt: 1 });

export const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage || mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
