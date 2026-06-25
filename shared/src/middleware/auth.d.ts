import { Request, Response, NextFunction } from 'express';
import { JwtPayload, UserRole } from '../types';
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
export declare function authenticate(req: Request, _res: Response, next: NextFunction): void;
/**
 * RBAC guard middleware factory.
 * Usage: router.get('/admin/users', authenticate, requireRole('admin'), handler)
 */
export declare function requireRole(...roles: UserRole[]): (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Object ownership check — ensures the authenticated user owns the resource.
 */
export declare function requireOwnership(getOwnerId: (req: Request) => string | undefined): (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map