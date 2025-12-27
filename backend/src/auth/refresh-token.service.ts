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
    // ✅ Pas besoin d'extraire - userId est déjà une string
    this.logger.log(`🆕 Création d'un refresh token pour l'utilisateur ${this.maskUserId(userId)}`);
    
    const refreshToken = await this.refreshTokenModel.create({
      user: userId, // ✅ userId est déjà une string id
      token: refresh_token,
      expiresAt,
      isActive: true,
    });

    this.logger.log(`✅ Refresh token créé avec succès pour l'utilisateur ${this.maskUserId(userId)}`);
    return refreshToken;
  }

  async deactivateAllForUser(userId: string): Promise<void> {
    this.logger.log(`🔐 Désactivation de tous les refresh tokens pour l'utilisateur ${this.maskUserId(userId)}`);
    
    const result = await this.refreshTokenModel
      .updateMany(
        { user: userId, isActive: true }, // ✅ userId est déjà une string id
        { 
          isActive: false, 
          deactivatedAt: new Date(),
          revocationReason: "logout all"
        }
      )
      .exec();

    this.logger.log(`✅ ${result.modifiedCount} refresh token(s) désactivé(s) pour l'utilisateur ${this.maskUserId(userId)}`);
  }

  async deactivateByUserIds(userIds: string[]): Promise<{ deactivatedCount: number }> {
    if (!userIds || userIds.length === 0) {
      this.logger.log("📭 Aucun userId fourni pour la désactivation");
      return { deactivatedCount: 0 };
    }

    this.logger.log(`🔐 Désactivation des refresh tokens pour ${userIds.length} utilisateur(s)`);
    
    const result = await this.refreshTokenModel
      .updateMany(
        { 
          user: { $in: userIds }, // ✅ userIds sont déjà des string id
          isActive: true 
        },
        { 
          isActive: false, 
          deactivatedAt: new Date(),
          revocationReason: "admin bulk deactivate"
        }
      )
      .exec();

    const maskedIds = userIds.map(id => this.maskUserId(id)).join(', ');
    this.logger.log(`✅ ${result.modifiedCount} refresh token(s) désactivé(s) pour les utilisateurs: ${maskedIds}`);
    
    return { deactivatedCount: result.modifiedCount };
  }

  async isValid(refresh_token: string): Promise<boolean> {
    this.logger.debug(`🔍 Validation du refresh token: ${this.maskToken(refresh_token)}`);
    
    const doc = await this.refreshTokenModel
      .findOne({
        token: refresh_token,
        isActive: true,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    const isValid = !!doc;
    this.logger.debug(`Résultat de validation du refresh token: ${isValid ? 'VALIDE' : 'INVALIDE'}`);
    
    return isValid;
  }

  async deactivateByToken(refresh_token: string): Promise<void> {
    this.logger.log(`🔐 Désactivation du refresh token: ${this.maskToken(refresh_token)}`);
    
    const result = await this.refreshTokenModel
      .updateOne(
        { token: refresh_token },
        { 
          isActive: false, 
          deactivatedAt: new Date(),
          revocationReason: "token refresh"
        }
      )
      .exec();

    if (result.modifiedCount > 0) {
      this.logger.log(`✅ Refresh token désactivé avec succès: ${this.maskToken(refresh_token)}`);
    } else {
      this.logger.warn(`⚠️ Aucun refresh token trouvé pour désactivation: ${this.maskToken(refresh_token)}`);
    }
  }

  async deleteByToken(refresh_token: string): Promise<void> {
    this.logger.log(`🗑️ Suppression du refresh token: ${this.maskToken(refresh_token)}`);
    
    const result = await this.refreshTokenModel.deleteOne({ token: refresh_token }).exec();

    if (result.deletedCount > 0) {
      this.logger.log(`✅ Refresh token supprimé avec succès: ${this.maskToken(refresh_token)}`);
    } else {
      this.logger.warn(`⚠️ Aucun refresh token trouvé pour suppression: ${this.maskToken(refresh_token)}`);
    }
  }

  async deleteAllForUser(userId: string): Promise<void> {
    this.logger.log(`🗑️ Suppression de tous les refresh tokens pour l'utilisateur ${this.maskUserId(userId)}`);
    
    const result = await this.refreshTokenModel.deleteMany({ user: userId }).exec();

    this.logger.log(`✅ ${result.deletedCount} refresh token(s) supprimé(s) pour l'utilisateur ${this.maskUserId(userId)}`);
  }

  // ✅ Suppression de extractUserId - plus nécessaire
  // private extractUserId(userId: any): string {
  //   // Supprimé car nous utilisons déjà id partout
  // }

  private maskUserId(userId: string): string {
    if (!userId || typeof userId !== 'string' || userId.length <= 6) {
      return 'user_***';
    }
    
    const firstPart = userId.substring(0, 3);
    const lastPart = userId.substring(userId.length - 3);
    const middle = '***';
    
    return `user_${firstPart}${middle}${lastPart}`;
  }

  private maskToken(token: string): string {
    if (!token || typeof token !== 'string' || token.length < 10) {
      return '***';
    }
    
    const firstPart = token.substring(0, 6);
    const lastPart = token.substring(token.length - 4);
    const middle = '...';
    
    return `${firstPart}${middle}${lastPart}`;
  }
}