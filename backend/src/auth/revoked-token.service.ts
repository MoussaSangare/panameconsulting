import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { RevokedToken } from "../schemas/revoked-token.schema";

@Injectable()
export class RevokedTokenService {
  private readonly logger = new Logger(RevokedTokenService.name);

  constructor(
    @InjectModel(RevokedToken.name)
    private revokedTokenModel: Model<RevokedToken>,
    private jwtService: JwtService,
  ) {}

  async revokeToken(access_token: string, expiresAt: Date): Promise<void> {
    try {
      this.logger.log(`Revoking token for user`);
      
      const decoded = this.jwtService.decode(access_token) as any;
      const userId = decoded?.sub;

      this.logger.debug(`Decoded token for user ID: ${userId}`);

      const exists = await this.revokedTokenModel.findOne({ token: access_token });
      if (!exists) {
        await this.revokedTokenModel.create({
          token: access_token,
          userId,
          expiresAt,
        });
        this.logger.log(`Token successfully revoked for user ${userId}`);
      } else {
        this.logger.debug(`Token was already revoked for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Erreur revocation token: ${error.message}`, error.stack);
    }
  }

  async isTokenRevoked(access_token: string): Promise<boolean> {
    this.logger.debug(`Checking if token is revoked`);
    
    const found = await this.revokedTokenModel.findOne({ token: access_token }).exec();
    const isRevoked = !!found;
    
    this.logger.debug(`Token revocation check result: ${isRevoked}`);
    return isRevoked;
  }

  async revokeAllTokens(): Promise<{
    [x: string]: any;
    message: string;
    revokedCount: number;
  }> {
    this.logger.warn(`Revoking ALL tokens - this will clear the entire revoked tokens collection`);
    
    const result = await this.revokedTokenModel.deleteMany({}).exec();
    
    this.logger.log(`Successfully revoked all tokens: ${result.deletedCount} tokens removed`);
    
    return {
      message: `${result.deletedCount} tokens révoqués`,
      revokedCount: result.deletedCount,
    };
  }

  async cleanupExpiredTokens(): Promise<void> {
    this.logger.log(`Cleaning up expired revoked tokens`);
    
    const result = await this.revokedTokenModel
      .deleteMany({
        expiresAt: { $lt: new Date() },
      })
      .exec();

    this.logger.log(`Cleaned up ${result.deletedCount} expired revoked tokens`);
  }

  async revokeTokensForUser(userId: string): Promise<void> {
    this.logger.log(`Revoking all tokens for user ${userId}`);
    
    const result = await this.revokedTokenModel.deleteMany({ userId }).exec();
    
    this.logger.log(`Revoked ${result.deletedCount} tokens for user ${userId}`);
  }
}