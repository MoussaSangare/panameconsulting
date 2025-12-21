import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Session } from "../schemas/session.schema";
import { AuthConstants } from "./auth.constants";

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectModel(Session.name)
    private sessionModel: Model<Session>,
  ) {}

  async create(userId: string, access_token: string, expiresAt: Date): Promise<Session> {
    this.logger.log(`Creating session for user ${this.maskUserId(userId)}`);
    
    const session = await this.sessionModel.create({ 
      user: userId, 
      token: access_token, 
      expiresAt, 
      isActive: true,
      createdAt: new Date()
    });

    this.logger.log(`Session created successfully for user ${this.maskUserId(userId)}`);
    return session;
  }

  async revoke(access_token: string, reason?: string): Promise<void> {
    this.logger.log(`Revoking session with token: ${this.maskToken(access_token)}`);
    
    const result = await this.sessionModel.updateOne(
      { token: access_token }, 
      { 
        isActive: false,
        deactivatedAt: new Date(),
        revocationReason: reason || AuthConstants.REVOCATION_REASONS.MANUAL_REVOKE
      }
    );
    
    if (result.modifiedCount > 0) {
      this.logger.log(`Session revoked successfully: ${this.maskToken(access_token)}`);
    } else {
      this.logger.warn(`No active session found to revoke: ${this.maskToken(access_token)}`);
    }
  }

  async revokeAll(userId: string, reason?: string): Promise<void> {
    this.logger.log(`Revoking all sessions for user ${this.maskUserId(userId)}`);
    
    const result = await this.sessionModel.updateMany(
      { user: userId, isActive: true }, 
      { 
        isActive: false,
        deactivatedAt: new Date(),
        revocationReason: reason || AuthConstants.REVOCATION_REASONS.REVOKE_ALL
      }
    );

    this.logger.log(`Revoked ${result.modifiedCount} sessions for user ${this.maskUserId(userId)}`);
  }

  async deleteSession(access_token: string): Promise<void> {
    this.logger.log(`Deleting session with token: ${this.maskToken(access_token)}`);
    
    const result = await this.sessionModel.deleteOne({ token: access_token });

    if (result.deletedCount > 0) {
      this.logger.log(`Session deleted successfully: ${this.maskToken(access_token)}`);
    } else {
      this.logger.warn(`No session found to delete: ${this.maskToken(access_token)}`);
    }
  }

  async deleteAllSessions(): Promise<{ deletedCount: number }> {
    this.logger.warn(`Deleting ALL sessions - this will clear the entire sessions collection`);
    
    const result = await this.sessionModel.deleteMany({}).exec();
    
    this.logger.log(`Deleted all sessions: ${result.deletedCount} sessions removed`);
    return { deletedCount: result.deletedCount };
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    this.logger.log(`Deleting all sessions for user ${this.maskUserId(userId)}`);
    
    const result = await this.sessionModel.deleteMany({ user: userId });
    
    this.logger.log(`Deleted ${result.deletedCount} sessions for user ${this.maskUserId(userId)}`);
  }

  async deleteExpiredSessions(): Promise<void> {
    this.logger.log(`Deleting expired sessions`);
    
    const result = await this.sessionModel.deleteMany({ 
      expiresAt: { $lt: new Date() } 
    });

    this.logger.log(`Deleted ${result.deletedCount} expired sessions`);
  }

  async getOldestSession(userId: string): Promise<Session | null> {
    this.logger.debug(`Getting oldest session for user ${this.maskUserId(userId)}`);
    
    const result = await this.sessionModel
      .findOne({
        user: userId,
        isActive: true,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: 1 })
      .exec();
    
    this.logger.debug(`Oldest session query completed for user ${this.maskUserId(userId)}`);
    return result;
  }

  async countActiveSessions(userId: string): Promise<number> {
    this.logger.debug(`Counting active sessions for user ${this.maskUserId(userId)}`);
    
    const count = await this.sessionModel.countDocuments({
      user: userId,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).exec();

    this.logger.debug(`User ${this.maskUserId(userId)} has ${count} active sessions`);
    return count;
  }

  async isTokenActive(access_token: string): Promise<boolean> {
    this.logger.debug(`Checking if token is active: ${this.maskToken(access_token)}`);
    
    const session = await this.sessionModel.findOne({ 
      token: access_token 
    }).exec();
    
    const isActive = !!session?.isActive && new Date(session.expiresAt) > new Date();
    
    this.logger.debug(`Token active status: ${isActive} for ${this.maskToken(access_token)}`);
    return isActive;
  }

  async getActiveSessionsByUser(userId: string): Promise<Session[]> {
    this.logger.debug(`Getting active sessions for user ${this.maskUserId(userId)}`);
    
    const sessions = await this.sessionModel
      .find({
        user: userId,
        isActive: true,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    this.logger.debug(`Found ${sessions.length} active sessions for user ${this.maskUserId(userId)}`);
    return sessions;
  }

  async getExpiredSessions(): Promise<Session[]> {
    this.logger.debug(`Getting expired sessions`);
    
    const sessions = await this.sessionModel
      .find({
        expiresAt: { $lt: new Date() },
        isActive: true,
      })
      .exec();

    this.logger.debug(`Found ${sessions.length} expired sessions`);
    return sessions;
  }

  async cleanupExpiredSessions(): Promise<void> {
    this.logger.log(`Cleaning up expired sessions (deactivating)`);
    
    const result = await this.sessionModel.updateMany(
      { 
        expiresAt: { $lt: new Date() },
        isActive: true 
      },
      { 
        isActive: false,
        deactivatedAt: new Date(),
        revocationReason: AuthConstants.REVOCATION_REASONS.SESSION_EXPIRED
      }
    );

    this.logger.log(`Cleaned up ${result.modifiedCount} expired sessions`);
  }

  async getSessionByToken(access_token: string): Promise<Session | null> {
    this.logger.debug(`Getting session by token: ${this.maskToken(access_token)}`);
    
    const session = await this.sessionModel.findOne({ 
      token: access_token 
    }).exec();
    
    this.logger.debug(`Session lookup completed for token: ${this.maskToken(access_token)}`);
    return session;
  }

  async updateSessionActivity(access_token: string): Promise<void> {
    this.logger.debug(`Updating session activity for token: ${this.maskToken(access_token)}`);
    
    const result = await this.sessionModel.updateOne(
      { token: access_token }, 
      { lastActivity: new Date() }
    );

    if (result.modifiedCount > 0) {
      this.logger.debug(`Session activity updated for token: ${this.maskToken(access_token)}`);
    } else {
      this.logger.warn(`No session found to update activity for token: ${this.maskToken(access_token)}`);
    }
  }

  async cleanupUserSessions(userId: string, reason?: string): Promise<number> {
    this.logger.log(`Cleaning up sessions for user ${this.maskUserId(userId)}`);
    
    const result = await this.sessionModel.updateMany(
      { 
        user: userId, 
        isActive: true 
      },
      { 
        isActive: false,
        deactivatedAt: new Date(),
        revocationReason: reason || AuthConstants.REVOCATION_REASONS.ADMIN_CLEANUP
      }
    );

    this.logger.log(`Cleaned up ${result.modifiedCount} sessions for user ${this.maskUserId(userId)}`);
    return result.modifiedCount;
  }

  async hasTooManyActiveSessions(userId: string): Promise<boolean> {
    const activeCount = await this.countActiveSessions(userId);
    return activeCount >= AuthConstants.MAX_ACTIVE_SESSIONS_PER_USER;
  }

  async getOldestUserSession(userId: string): Promise<Session | null> {
    return await this.sessionModel
      .findOne({ user: userId, isActive: true })
      .sort({ createdAt: 1 })
      .exec();
  }

  // ✅ Méthodes de masquage pour cohérence
  private maskUserId(userId: string): string {
    if (!userId) return 'user_***';
    if (userId.length <= 8) return userId;
    return `${userId.substring(0, 4)}***${userId.substring(userId.length - 4)}`;
  }

  private maskToken(token: string): string {
    if (!token || token.length < 10) return '***';
    return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
  }
}