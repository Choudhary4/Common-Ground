import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type AccessCodeStatus = 'ACTIVE' | 'REVOKED';

export interface IAccessCode extends Document {
  hostelId: Types.ObjectId;
  codeHash: string;
  codeEncrypted: string;
  status: AccessCodeStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  expiresAt: Date | null;
}

const accessCodeSchema = new Schema<IAccessCode>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    codeHash: { type: String, required: true },
    codeEncrypted: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'REVOKED'], default: 'ACTIVE', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

accessCodeSchema.index({ hostelId: 1, status: 1 });

export const AccessCode: Model<IAccessCode> =
  mongoose.models.AccessCode || mongoose.model<IAccessCode>('AccessCode', accessCodeSchema);
