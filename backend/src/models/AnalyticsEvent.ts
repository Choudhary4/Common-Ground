import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type AnalyticsEventType =
  | 'QR_SCAN'
  | 'TRAVELLER_ONBOARDED'
  | 'SOCIAL_STATUS_SET'
  | 'ACTIVITY_CREATED'
  | 'ACTIVITY_JOINED'
  | 'JOIN_REQUEST_ACCEPTED'
  | 'ACTIVITY_COMPLETED';

export interface IAnalyticsEvent extends Document {
  hostelId: Types.ObjectId;
  userId?: Types.ObjectId | null;
  eventType: AnalyticsEventType;
  isDemo: boolean;
  createdAt: Date;
}

const analyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    eventType: { type: String, required: true, index: true },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

analyticsEventSchema.index({ hostelId: 1, eventType: 1, isDemo: 1, createdAt: -1 });

export const AnalyticsEvent: Model<IAnalyticsEvent> =
  mongoose.models.AnalyticsEvent ||
  mongoose.model<IAnalyticsEvent>('AnalyticsEvent', analyticsEventSchema);
