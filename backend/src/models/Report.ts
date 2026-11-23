import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type ReportStatus = 'OPEN' | 'DISMISSED' | 'ACTION_TAKEN';

export interface IReport extends Document {
  hostelId: Types.ObjectId;
  reporterId: Types.ObjectId;
  reportedUserId?: Types.ObjectId | null;
  activityId?: Types.ObjectId | null;
  reason: string;
  description: string;
  status: ReportStatus;
  resolutionNote?: string;
  resolvedBy?: Types.ObjectId | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

const reportSchema = new Schema<IReport>(
  {
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', required: true, index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    activityId: { type: Schema.Types.ObjectId, ref: 'Activity', default: null },
    reason: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', trim: true, maxlength: 600 },
    status: { type: String, enum: ['OPEN', 'DISMISSED', 'ACTION_TAKEN'], default: 'OPEN' },
    resolutionNote: { type: String, trim: true, maxlength: 300 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

reportSchema.index({ hostelId: 1, status: 1, createdAt: -1 });

export const Report: Model<IReport> =
  mongoose.models.Report || mongoose.model<IReport>('Report', reportSchema);
