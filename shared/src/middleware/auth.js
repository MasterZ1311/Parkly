"use strict";
// ============================================================
// Parkly — Auth Middleware (JWT + RBAC)
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.requireOwnership = requireOwnership;
const jwt = __importStar(require("jsonwebtoken"));
const config_1 = require("../config");
const errors_1 = require("../errors");
/**
 * JWT validation middleware.
 * Attaches decoded payload to req.user.
 */
function authenticate(req, _res, next) {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errors_1.AuthenticationError('Missing or invalid Authorization header');
        }
        const token = authHeader.slice(7);
        const config = (0, config_1.getConfig)();
        const payload = jwt.verify(token, config.jwtAccessSecret);
        req.user = payload;
        next();
    }
    catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            next(new errors_1.AuthenticationError('Access token expired'));
        }
        else if (err instanceof jwt.JsonWebTokenError) {
            next(new errors_1.AuthenticationError('Invalid access token'));
        }
        else {
            next(err);
        }
    }
}
/**
 * RBAC guard middleware factory.
 * Usage: router.get('/admin/users', authenticate, requireRole('admin'), handler)
 */
function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user) {
            next(new errors_1.AuthenticationError('Not authenticated'));
            return;
        }
        if (!roles.includes(req.user.role)) {
            next(new errors_1.AuthorizationError(`Required role: ${roles.join(' or ')}`));
            return;
        }
        next();
    };
}
/**
 * Object ownership check — ensures the authenticated user owns the resource.
 */
function requireOwnership(getOwnerId) {
    return (req, _res, next) => {
        if (!req.user) {
            next(new errors_1.AuthenticationError('Not authenticated'));
            return;
        }
        const ownerId = getOwnerId(req);
        if (!ownerId) {
            next(); // ownership couldn't be determined, skip check
            return;
        }
        if (req.user.sub !== ownerId && req.user.role !== 'admin') {
            next(new errors_1.AuthorizationError('Access denied: not the owner'));
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map