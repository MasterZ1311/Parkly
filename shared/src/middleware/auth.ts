// ============================================================
// Parkly — Auth Middleware (JWT + RBAC)
// ============================================================

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

import { getConfig } from '../config';
import { JwtPayload, UserRole } from '../types';
import { AuthenticationError, AuthorizationError } from '../errors';

// Extend Express Request with Parkly user context
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      requestId?: string;
    }
  }
}

/**
 * JWT validation middleware.
 * Attaches decoded payload to req.user.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    const config = getConfig();

    const payload = jwt.verify(token, config.jwtAccessSecret) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Access token expired'));
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Invalid access token'));
    } else {
      next(err);
    }
  }
}

/**
 * RBAC guard middleware factory.
 * Usage: router.get('/admin/users', authenticate, requireRole('admin'), handler)
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError('Not authenticated'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AuthorizationError(`Required role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}

/**
 * Object ownership check — ensures the authenticated user owns the resource.
 */
export function requireOwnership(getOwnerId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError('Not authenticated'));
      return;
    }
    const ownerId = getOwnerId(req);
    if (!ownerId) {
      next(); // ownership couldn't be determined, skip check
      return;
    }
    if (req.user.sub !== ownerId && req.user.role !== 'admin') {
      next(new AuthorizationError('Access denied: not the owner'));
      return;
    }
    next();
  };
}
