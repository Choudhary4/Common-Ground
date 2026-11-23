import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type ActivityCreatorType = 'TRAVELLER' | 'HOSTEL_MANAGER';
export type ActivityCategory = 'GAMES' | 'SOCIAL' | 'EXPLORATION' | 'FOOD' | 'OTHER';
export type ActivityJoinMode = 'PUBLIC' | 'APPROVAL';
export type ActivityStatus = 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED';

export interface IActivity extends Document {
  hostelId: Types.ObjectId;
  creatorId: Types.ObjectId;
  creatorType: ActivityCreatorType;
  title: string;
  description: string;
  category: ActivityCategory;
  scheduledAt: Date;
  endsAt: Date;
  meetingPoint: string;
  maxParticipants: number;
  confirmedCount: number;
  joinMode: ActivityJoinMode;
  status: ActivityStatus;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    creatorType: { type: String, enum: ['TRAVELLER', 'HOSTEL_MANAGER'], required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 600 },
    category: {
      type: String,
      enum: ['GAMES', 'SOCIAL', 'EXPLORATION', 'FOOD', 'OTHER'],
      default: 'SOCIAL',
    },
    scheduledAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    meetingPoint: { type: String, required: true, trim: true, maxlength: 120 },
    maxParticipants: { type: Number, required: true, min: 2, max: 100 },
    confirmedCount: { type: Number, default: 1, min: 0 },
    joinMode: { type: String, enum: ['PUBLIC', 'APPROVAL'], default: 'PUBLIC' },
    status: {
      type: String,
      enum: ['OPEN', 'FULL', 'CANCELLED', 'COMPLETED', 'EXPIRED'],
      default: 'OPEN',
    },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

activitySchema.index({ hostelId: 1, status: 1, scheduledAt: 1 });
activitySchema.index({ hostelId: 1, creatorId: 1, status: 1 });

export const Activity: Model<IActivity> =
  mongoose.models.Activity || mongoose.model<IActivity>('Activity', activitySchema);
