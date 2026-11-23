import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface ISession extends Document {
  userId: Types.ObjectId;
  hostelId: Types.ObjectId | null;
  tokenHash: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', default: null, index: true },
    tokenHash: { type: String, required: true, unique: true },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index for eventual cleanup; access control always checks expiresAt & revokedAt explicitly
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, revokedAt: 1 });

export const Session: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>('Session', sessionSchema);
