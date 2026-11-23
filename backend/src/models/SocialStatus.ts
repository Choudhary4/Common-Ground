import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type SocialStatusValue =
  | 'OPEN_TO_MEETING'
  | 'UP_FOR_ACTIVITIES'
  | 'LOOKING_FOR_COMPANY'
  | 'JUST_CHILLING';

export interface ISocialStatus extends Document {
  userId: Types.ObjectId;
  hostelId: Types.ObjectId;
  status: SocialStatusValue;
  createdAt: Date;
  expiresAt: Date;
}

const socialStatusSchema = new Schema<ISocialStatus>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true },
    status: {
      type: String,
      enum: ['OPEN_TO_MEETING', 'UP_FOR_ACTIVITIES', 'LOOKING_FOR_COMPANY', 'JUST_CHILLING'],
      required: true,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

socialStatusSchema.index({ userId: 1 }, { unique: true });
socialStatusSchema.index({ hostelId: 1, expiresAt: 1 });
socialStatusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SocialStatus: Model<ISocialStatus> =
  mongoose.models.SocialStatus || mongoose.model<ISocialStatus>('SocialStatus', socialStatusSchema);
