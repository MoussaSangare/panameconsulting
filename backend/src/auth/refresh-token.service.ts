import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RefreshToken } from "../schemas/refresh-token.schema";

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectModel(RefreshToken.name)
    private refreshTokenModel: Model<RefreshToken>,
  ) {}

  async create(
    userId: string,
    refresh_token: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    this.logger.log(`Creating refresh token for user ${this.maskUserId(userId)}`);
    
    const refreshToken = await this.refreshTokenModel.create({
      user: userId,
      token: refresh_token,
      expiresAt,
      isActive: true,
    });

    this.logger.log(`Refresh token created successfully for user ${this.maskUserId(userId)}`);
    return refreshToken;
  }

  async deactivateAllForUser(userId: string): Promise<void> {
    this.logger.log(`Deactivating all refresh tokens for user ${this.maskUserId(userId)}`);
    
    const result = await this.refreshTokenModel
      .updateMany(
        { user: userId, isActive: true },
        { 
          isActive: false, 
          deactivatedAt: new Date(),
          revocationReason: "user_logout_all"
        }
      )
      .exec();

    this.logger.log(`Deactivated ${result.modifiedCount} refresh tokens for user ${this.maskUserId(userId)}`);
  }

  // ✅ NOUVELLE MÉTHODE : Désactiver les refresh tokens pour plusieurs utilisateurs
  async deactivateByUserIds(userIds: string[]): Promise<{ deactivatedCount: number }> {
    if (!userIds || userIds.length === 0) {
      this.logger.log("Aucun userId fourni pour la désactivation");
      return { deactivatedCount: 0 };
    }

    this.logger.log(`Deactivating refresh tokens for ${userIds.length} users`);
    
    const result = await this.refreshTokenModel
      .updateMany(
        { 
          user: { $in: userIds },
          isActive: true 
        },
        { 
          isActive: false, 
          deactivatedAt: new Date(),
          revocationReason: "admin_bulk_deactivate"
        }
      )
      .exec();

    const maskedIds = userIds.map(id => this.maskUserId(id)).join(', ');
    this.logger.log(`Deactivated ${result.modifiedCount} refresh tokens for users: ${maskedIds}`);
    
    return { deactivatedCount: result.modifiedCount };
  }

  async isValid(refresh_token: string): Promise<boolean> {
    this.logger.debug(`Validating refresh token: ${this.maskToken(refresh_token)}`);
    
    const doc = await this.refreshTokenModel
      .findOne({
        token: refresh_token,
        isActive: true,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    const isValid = !!doc;
    this.logger.debug(`Refresh token validation result: ${isValid}`);
    
    return isValid;
  }

  async deactivateByToken(refresh_token: string): Promise<void> {
    this.logger.log(`Deactivating refresh token: ${this.maskToken(refresh_token)}`);
    
    const result = await this.refreshTokenModel
      .updateOne(
        { token: refresh_token },
        { 
          isActive: false, 
          deactivatedAt: new Date(),
          revocationReason: "token_refresh"
        }
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(`Successfully deactivated refresh token: ${this.maskToken(refresh_token)}`);
    } else {
      this.logger.warn(`No refresh token found to deactivate: ${this.maskToken(refresh_token)}`);
    }
  }

  async deleteByToken(refresh_token: string): Promise<void> {
    this.logger.log(`Deleting refresh token: ${this.maskToken(refresh_token)}`);
    
    const result = await this.refreshTokenModel.deleteOne({ token: refresh_token }).exec();

    if (result.deletedCount > 0) {
      this.logger.log(`Successfully deleted refresh token: ${this.maskToken(refresh_token)}`);
    } else {
      this.logger.warn(`No refresh token found to delete: ${this.maskToken(refresh_token)}`);
    }
  }

  async deleteAllForUser(userId: string): Promise<void> {
    this.logger.log(`Deleting all refresh tokens for user ${this.maskUserId(userId)}`);
    
    const result = await this.refreshTokenModel.deleteMany({ user: userId }).exec();

    this.logger.log(`Deleted ${result.deletedCount} refresh tokens for user ${this.maskUserId(userId)}`);
  }

  // ✅ Méthodes utilitaires pour le logging sécurisé
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