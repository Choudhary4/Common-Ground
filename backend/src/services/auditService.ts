import type { Types } from 'mongoose';
import { AuditLog } from '../models/index.js';

export async function recordAuditLog(params: {
  actorId: Types.ObjectId;
  actorRole: string;
  hostelId: Types.ObjectId | null;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await AuditLog.create({
    actorId: params.actorId,
    actorRole: params.actorRole,
    hostelId: params.hostelId,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    metadata: params.metadata,
  });
}
