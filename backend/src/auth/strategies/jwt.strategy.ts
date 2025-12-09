// jwt.strategy.ts - VERSION HYPER SÉCURISÉE
import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { UsersService } from "../../users/users.service";
import { Types } from "mongoose";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => {
          const authHeader = request.headers.authorization;
          if (authHeader && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
          }
          return request.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    // ✅ Log sécurisé
    const maskedId = this.maskSensitiveData(payload.sub);
    this.logger.log(`Validation token - User: ${maskedId}`);

    // Vérifier que c'est bien un access token
    if (payload.tokenType && payload.tokenType !== "access") {
      this.logger.warn(`Invalid token type: ${payload.tokenType} for user: ${maskedId}`);
      throw new UnauthorizedException("Type de token invalide");
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      this.logger.warn(`User not found - ID: ${maskedId}`);
      throw new UnauthorizedException("Utilisateur non trouvé");
    }

    if (!user.isActive) {
      this.logger.warn(`Inactive account - ID: ${maskedId}`);
      throw new UnauthorizedException("Compte utilisateur inactif");
    }

    this.logger.log(`User validated - ID: ${maskedId}, Role: ${user.role}`);

    // ✅ Retourner sub pour compatibilité
    return {
      sub: (user._id as Types.ObjectId).toString(), // ✅ Toujours sub
      userId: (user._id as Types.ObjectId).toString(), // Pour compatibilité
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      jti: payload.jti, // Inclure le JTI pour le tracking
    };
  }

  private maskSensitiveData(data: string): string {
    if (!data || data.length < 8) return "***";
    return data.substring(0, 4) + "***" + data.substring(data.length - 4);
  }
}