import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IBroadcast extends Document {
  hostelId: Types.ObjectId;
  createdBy: Types.ObjectId;
  senderNickname: string;
  title: string;
  message: string;
  active: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const broadcastSchema = new Schema<IBroadcast>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    senderNickname: { type: String, required: true, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    message: { type: String, required: true, trim: true, maxlength: 240 },
    active: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

broadcastSchema.index({ hostelId: 1, active: 1, expiresAt: -1 });

export const Broadcast: Model<IBroadcast> =
  mongoose.models.Broadcast || mongoose.model<IBroadcast>('Broadcast', broadcastSchema);
