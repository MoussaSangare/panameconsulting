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
      ignoreExpiration: false, // IMPORTANT: JWT vérifie déjà l'expiration
      secretOrKey: configService.get('JWT_SECRET'),
      passReqToCallback: false, // Pas besoin de la requête
    });
  }

  async validate(payload: any) {
    try {
      // ✅ Vérification minimaliste - seulement l'ID utilisateur
      if (!payload.sub || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Token invalide');
      }

      // ✅ Récupérer l'utilisateur SANS vérifier la session ici
      // La vérification de session se fait dans le guard/session.service
      const user = await this.usersService.findById(payload.sub);
      
      if (!user) {
        throw new UnauthorizedException('Utilisateur non trouvé');
      }

      // ✅ Vérifications simples de base (sans accès à la session)
      if (!user.isActive) {
        throw new UnauthorizedException(AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE);
      }

      // ✅ Vérification de l'email admin (optionnel, si nécessaire)
      if (user.role === 'admin') {
        const adminEmail = process.env.EMAIL_USER;
        if (adminEmail && user.email !== adminEmail) {
          throw new UnauthorizedException('Accès admin non autorisé');
        }
      }

      // ✅ Retourner l'utilisateur avec les informations nécessaires
      return {
        id: payload.sub,           // ID principal
        userId: payload.sub,       // Alias pour compatibilité
        sub: payload.sub,          // Standard JWT
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        telephone: user.telephone,
        isActive: user.isActive,
        // Transmettre le jti pour le tracking
        jti: payload.jti,
        tokenType: payload.tokenType || 'access'
      };
      
    } catch (error) {
      // ✅ Log minimal sans informations sensibles
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      // Erreur générique pour tout problème technique
      throw new UnauthorizedException('Échec de validation du token');
    }
  }
}