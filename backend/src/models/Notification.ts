import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type NotificationType =
  | 'ACTIVITY_CREATED'
  | 'ACTIVITY_UPDATED'
  | 'ACTIVITY_CANCELLED'
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'JOIN_REQUEST_RECEIVED'
  | 'JOIN_REQUEST_ACCEPTED'
  | 'JOIN_REQUEST_DECLINED'
  | 'ACTIVITY_FULL'
  | 'ACTIVITY_INVITE'
  | 'HOST_TRANSFERRED'
  | 'GROUP_ADDED'
  | 'GROUP_REMOVED'
  | 'LOBBY_BROADCAST';

export interface INotification extends Document {
  userId: Types.ObjectId;
  hostelId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: Types.ObjectId | null;
  readAt: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 300 },
    referenceId: { type: Schema.Types.ObjectId, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ hostelId: 1, userId: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', notificationSchema);
