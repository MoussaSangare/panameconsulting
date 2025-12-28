import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RevokedToken } from "../schemas/revoked-token.schema";

@Injectable()
export class RevokedTokenService {
  // Le logger reste défini mais on n'utilisera que des niveaux "silencieux"
  private readonly logger = new Logger(RevokedTokenService.name);

  constructor(
    @InjectModel(RevokedToken.name)
    private revokedTokenModel: Model<RevokedToken>,
    private jwtService: JwtService,
  ) {}

  async revokeToken(access_token: string, expiresAt: Date): Promise<void> {
    try {
      // Extraction sécurisée du userId
      let userId = null;
      try {
        const decoded = this.jwtService.decode(access_token) as any;
        userId = decoded?.sub || decoded?.id;
      } catch (e) {
        // Erreur de décodage silencieuse
      }

      // Utilisation de .debug ou .verbose pour masquer les logs
      this.logger.debug(`Attempting revocation for user: ${userId || 'unknown'}`);

      const exists = await this.revokedTokenModel.findOne({ token: access_token }).lean();
      
      if (!exists) {
        await this.revokedTokenModel.create({
          token: access_token,
          userId,
          expiresAt,
        });
        this.logger.verbose(`Token stored in blacklist`);
      }
    } catch (error) {
      // Même l'erreur est passée en debug pour un silence total
      this.logger.debug(`Silent error during revocation: ${error.message}`);
    }
  }

  async isTokenRevoked(access_token: string): Promise<boolean> {
    // Suppression de tout log visible
    const found = await this.revokedTokenModel.findOne({ token: access_token }).select('_id').lean();
    return !!found;
  }

  async revokeAllTokens(): Promise<{ message: string; revokedCount: number }> {
    const result = await this.revokedTokenModel.deleteMany({}).exec();
    
    this.logger.verbose(`Flush database: ${result.deletedCount} items removed`);
    
    return {
      message: `Opération réussie`,
      revokedCount: result.deletedCount,
    };
  }

  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.revokedTokenModel
      .deleteMany({
        expiresAt: { $lt: new Date() },
      })
      .exec();

    this.logger.verbose(`Cleanup completed: ${result.deletedCount} items`);
  }

  async revokeTokensForUser(userId: string): Promise<void> {
    await this.revokedTokenModel.deleteMany({ userId }).exec();
    this.logger.verbose(`User ${userId} tokens cleared`);
  }
}