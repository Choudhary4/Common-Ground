import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export type UserRole = 'CENTRAL_ADMIN' | 'HOSTEL_MANAGER' | 'HOSTEL_STAFF' | 'TRAVELLER';
export type UserStatus = 'ACTIVE' | 'RESTRICTED' | 'DISABLED';

export interface IUser extends Document {
  nickname: string;
  email?: string;
  passwordHash?: string;
  role: UserRole;
  hostelId: Types.ObjectId | null;
  status: UserStatus;
  avatar?: string | null;
  interests: string[];
  blockedUserIds: Types.ObjectId[];
  isDemo: boolean;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    nickname: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    passwordHash: { type: String, select: false },
    role: {
      type: String,
      enum: ['CENTRAL_ADMIN', 'HOSTEL_MANAGER', 'HOSTEL_STAFF', 'TRAVELLER'],
      required: true,
      index: true,
    },
    hostelId: { type: Schema.Types.ObjectId, ref: 'Hostel', default: null, index: true },
    status: { type: String, enum: ['ACTIVE', 'RESTRICTED', 'DISABLED'], default: 'ACTIVE', index: true },
    avatar: { type: String, default: null, maxlength: 200 },
    interests: { type: [String], default: [] },
    blockedUserIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    isDemo: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

userSchema.index({ hostelId: 1, role: 1, status: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema);
