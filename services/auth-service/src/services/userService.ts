// ============================================================
// Auth Service — User Service (Prisma/PostgreSQL)
// ============================================================

import { PrismaClient } from '@prisma/client';
import { User, UserRole, generateId } from '@parkly/shared';

const prisma = new PrismaClient();

export class UserService {
  /**
   * Find a user by phone number.
   */
  async findByPhone(phone: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { phone } });
    return user ? this.mapUser(user) : null;
  }

  /**
   * Find a user by ID.
   */
  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? this.mapUser(user) : null;
  }

  /**
   * Create a new user (driver by default).
   */
  async createUser(phone: string, name: string, role: UserRole = 'driver'): Promise<User> {
    const user = await prisma.user.create({
      data: {
        id: generateId(),
        phone,
        name,
        role,
        isActive: true,
      },
    });
    return this.mapUser(user);
  }

  /**
   * Find or create a user by phone (used during OTP verification).
   */
  async findOrCreate(phone: string, name?: string): Promise<{ user: User; isNew: boolean }> {
    const existing = await this.findByPhone(phone);
    if (existing) return { user: existing, isNew: false };

    const user = await this.createUser(phone, name || 'Parkly User');
    return { user, isNew: true };
  }

  /**
   * Update user profile.
   */
  async updateUser(id: string, data: Partial<Pick<User, 'name' | 'email'>>): Promise<User> {
    const user = await prisma.user.update({
      where: { id },
      data,
    });
    return this.mapUser(user);
  }

  private mapUser(raw: {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    role: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return {
      id: raw.id,
      phone: raw.phone,
      name: raw.name,
      email: raw.email || undefined,
      role: raw.role as UserRole,
      isActive: raw.isActive,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString(),
    };
  }
}

export const userService = new UserService();
