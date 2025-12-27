import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { AuthConstants } from '../auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    const strategyOptions: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    };

    super(strategyOptions);
  }

  async validate(payload: any): Promise<any> {
    try {
      if (!payload.sub) {
        throw new UnauthorizedException('Token invalide: ID utilisateur manquant');
      }

      const accessCheck = await this.usersService.checkUserAccess(payload.sub);
      
      if (!accessCheck.canAccess) {
        const reason = accessCheck.reason || '';
        
        if (reason.includes('Compte désactivé')) {
          throw new UnauthorizedException(AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE);
        } else if (reason.includes('Mode maintenance')) {
          throw new UnauthorizedException(AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE);
        } else if (reason.includes('Déconnecté temporairement')) {
          const remainingHours = (accessCheck.details as any)?.remainingHours || 24;
          throw new UnauthorizedException(
            `${AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE}:${remainingHours}`
          );
        } else {
          throw new UnauthorizedException(reason || "Accès refusé");
        }
      }

      const userData = {
        id: accessCheck.user.id || payload.sub, 
        sub: payload.sub,
        userId: payload.sub,
        email: accessCheck.user.email,
        role: accessCheck.user.role,
        firstName: accessCheck.user.firstName,
        lastName: accessCheck.user.lastName,
        isActive: accessCheck.user.isActive,
        telephone: accessCheck.user.telephone, 
        iat: payload.iat,
        exp: payload.exp,
      };

      return userData;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
      const errorStack = error instanceof Error 
        ? error.stack 
        : undefined;
      
      console.error(`JWT Validation Error: ${errorMessage}`, {
        userId: payload?.sub || 'unknown',
        error: errorStack
      });
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}