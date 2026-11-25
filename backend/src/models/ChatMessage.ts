import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IChatReplyRef {
  messageId: Types.ObjectId;
  senderNickname: string;
  text: string;
}

export interface IChatReaction {
  emoji: string;
  userId: Types.ObjectId;
}

export interface IChatMessage extends Document {
  roomId: Types.ObjectId;
  hostelId: Types.ObjectId;
  senderId: Types.ObjectId;
  text: string;
  replyTo?: IChatReplyRef | null;
  reactions: IChatReaction[];
  createdAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'ChatRoom', required: true, index: true },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    replyTo: {
      type: {
        messageId: { type: Schema.Types.ObjectId, required: true },
        senderNickname: { type: String, required: true, maxlength: 60 },
        text: { type: String, required: true, maxlength: 160 },
      },
      default: null,
      _id: false,
    },
    reactions: {
      type: [
        {
          emoji: { type: String, required: true, maxlength: 16 },
          userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        },
      ],
      default: [],
      _id: false,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

chatMessageSchema.index({ roomId: 1, createdAt: 1 });

export const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage || mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
