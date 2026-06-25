"use strict";
// ============================================================
// Parkly — Shared Package Entry Point
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOwnership = exports.requireRole = exports.authenticate = exports.notFoundHandler = exports.errorHandler = exports.requestLogger = exports.securityHeaders = void 0;
__exportStar(require("./types"), exports);
__exportStar(require("./config"), exports);
__exportStar(require("./errors"), exports);
__exportStar(require("./logger"), exports);
__exportStar(require("./utils"), exports);
__exportStar(require("./aws/clients"), exports);
__exportStar(require("./middleware/auth"), exports);
__exportStar(require("./middleware/errorHandler"), exports);
__exportStar(require("./middleware/requestLogger"), exports);
var requestLogger_1 = require("./middleware/requestLogger");
Object.defineProperty(exports, "securityHeaders", { enumerable: true, get: function () { return requestLogger_1.securityHeaders; } });
Object.defineProperty(exports, "requestLogger", { enumerable: true, get: function () { return requestLogger_1.requestLogger; } });
var errorHandler_1 = require("./middleware/errorHandler");
Object.defineProperty(exports, "errorHandler", { enumerable: true, get: function () { return errorHandler_1.errorHandler; } });
Object.defineProperty(exports, "notFoundHandler", { enumerable: true, get: function () { return errorHandler_1.notFoundHandler; } });
var auth_1 = require("./middleware/auth");
Object.defineProperty(exports, "authenticate", { enumerable: true, get: function () { return auth_1.authenticate; } });
Object.defineProperty(exports, "requireRole", { enumerable: true, get: function () { return auth_1.requireRole; } });
Object.defineProperty(exports, "requireOwnership", { enumerable: true, get: function () { return auth_1.requireOwnership; } });
//# sourceMappingURL=index.js.map