// strategies/jwt.strategy.ts
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { AuthConstants } from '../auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    try {
      // ✅ Vérifier d'abord l'accès avec la méthode complète
      const accessCheck = await this.usersService.checkUserAccess(payload.sub);
      
      if (!accessCheck.canAccess) {
        // Gérer les différents types d'erreurs d'accès
        if (accessCheck.reason?.includes('Compte désactivé')) {
          throw new UnauthorizedException(AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE);
        } else if (accessCheck.reason?.includes('Mode maintenance')) {
          throw new UnauthorizedException(AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE);
        } else if (accessCheck.reason?.includes('Déconnecté temporairement')) {
          throw new UnauthorizedException(AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE);
        } else {
          throw new UnauthorizedException(accessCheck.reason || "Accès refusé");
        }
      }

      // ✅ Retourner les informations utilisateur formatées
      return {
        sub: payload.sub, // ID utilisateur
        email: accessCheck.user.email,
        role: accessCheck.user.role,
        firstName: accessCheck.user.firstName,
        lastName: accessCheck.user.lastName,
        userId: payload.sub, // Alias pour compatibilité
      };
    } catch (error) {
      // ✅ Log détaillé des erreurs
      console.error(`JWT Validation Error: ${error.message}`, {
        userId: payload.sub,
        error: error.stack
      });
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}