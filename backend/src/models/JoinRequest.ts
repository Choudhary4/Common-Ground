import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export interface IJoinRequest extends Document {
  activityId: Types.ObjectId;
  hostelId: Types.ObjectId;
  requesterId: Types.ObjectId;
  status: JoinRequestStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}

const joinRequestSchema = new Schema<IJoinRequest>(
  {
    activityId: { type: Schema.Types.ObjectId, ref: 'Activity', required: true },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING',
    },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

joinRequestSchema.index({ activityId: 1, requesterId: 1 });
joinRequestSchema.index({ activityId: 1, status: 1 });

export const JoinRequest: Model<IJoinRequest> =
  mongoose.models.JoinRequest || mongoose.model<IJoinRequest>('JoinRequest', joinRequestSchema);
