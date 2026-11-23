import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type ParticipantStatus = 'CONFIRMED' | 'LEFT' | 'REMOVED';

export interface IActivityParticipant extends Document {
  activityId: Types.ObjectId;
  hostelId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ParticipantStatus;
  joinedAt: Date;
}

const activityParticipantSchema = new Schema<IActivityParticipant>({
  activityId: { type: Schema.Types.ObjectId, ref: 'Activity', required: true },
  hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['CONFIRMED', 'LEFT', 'REMOVED'], default: 'CONFIRMED' },
  joinedAt: { type: Date, default: Date.now },
});

activityParticipantSchema.index({ activityId: 1, userId: 1 }, { unique: true });
activityParticipantSchema.index({ userId: 1, status: 1 });

export const ActivityParticipant: Model<IActivityParticipant> =
  mongoose.models.ActivityParticipant ||
  mongoose.model<IActivityParticipant>('ActivityParticipant', activityParticipantSchema);
