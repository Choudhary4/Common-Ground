import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type QRStatus = 'ACTIVE' | 'REVOKED';

export interface IHostelQR extends Document {
  hostelId: Types.ObjectId;
  tokenHash: string;
  tokenEncrypted: string;
  status: QRStatus;
  scanCount: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  revokedAt: Date | null;
}

const hostelQRSchema = new Schema<IHostelQR>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    tokenEncrypted: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'REVOKED'], default: 'ACTIVE', index: true },
    scanCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

hostelQRSchema.index({ hostelId: 1, status: 1 });

export const HostelQR: Model<IHostelQR> =
  mongoose.models.HostelQR || mongoose.model<IHostelQR>('HostelQR', hostelQRSchema);
