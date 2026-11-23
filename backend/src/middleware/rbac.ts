import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../models/index.js';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/**
 * Ensures non-CENTRAL_ADMIN users have an assigned hostelId and never allows
 * accessing a different hostelId passed in params/query/body.
 */
export function requireHostelScope(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.auth.role === 'CENTRAL_ADMIN') {
    next();
    return;
  }

  if (!req.auth.hostelId) {
    res.status(403).json({ error: 'User is not assigned to a hostel' });
    return;
  }

  const clientHostelId =
    (req.params?.hostelId as string | undefined) ||
    (req.query?.hostelId as string | undefined) ||
    (req.body?.hostelId as string | undefined);

  if (clientHostelId && clientHostelId !== req.auth.hostelId.toString()) {
    res.status(403).json({ error: 'Cross-hostel access is forbidden' });
    return;
  }

  next();
}
