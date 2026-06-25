// ============================================================
// Auth Service — JWT Service
// Issues and validates access + refresh tokens.
// ============================================================

import * as jwt from 'jsonwebtoken';

import { getConfig, JwtPayload, AuthTokens, UserRole, AuthenticationError, generateId } from '@parkly/shared';

export class JwtService {
  /**
   * Issue a new access + refresh token pair.
   */
  issueTokens(userId: string, phone: string, role: UserRole): AuthTokens {
    const config = getConfig();

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = { sub: userId, phone, role };

    const accessToken = jwt.sign(payload, config.jwtAccessSecret, {
      expiresIn: config.jwtAccessTtl,
    });

    const refreshToken = jwt.sign(
      { sub: userId, type: 'refresh', jti: generateId() },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshTtl },
    );

    return { accessToken, refreshToken, expiresIn: config.jwtAccessTtl };
  }

  /**
   * Verify an access token and return its payload.
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, getConfig().jwtAccessSecret) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Access token expired');
      }
      throw new AuthenticationError('Invalid access token');
    }
  }

  /**
   * Verify a refresh token and return the user ID.
   */
  verifyRefreshToken(token: string): { sub: string } {
    try {
      const payload = jwt.verify(token, getConfig().jwtRefreshSecret) as {
        sub: string;
        type: string;
      };
      if (payload.type !== 'refresh') {
        throw new AuthenticationError('Invalid token type');
      }
      return { sub: payload.sub };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Refresh token expired');
      }
      throw new AuthenticationError('Invalid refresh token');
    }
  }
}

export const jwtService = new JwtService();
