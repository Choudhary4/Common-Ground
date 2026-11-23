import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type HostelStatus = 'ACTIVE' | 'INACTIVE';

export interface IHostel extends Document {
  name: string;
  slug: string;
  city: string;
  address: string;
  status: HostelStatus;
  isDemo: boolean;
  createdAt: Date;
}

const hostelSchema = new Schema<IHostel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    address: { type: String, required: true, trim: true, maxlength: 250 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Hostel: Model<IHostel> =
  mongoose.models.Hostel || mongoose.model<IHostel>('Hostel', hostelSchema);
