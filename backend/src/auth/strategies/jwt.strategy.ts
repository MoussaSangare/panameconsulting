// local.strategy.ts - Version simplifiée
import { Strategy } from "passport-local";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { AuthService } from "../auth.service";
import { AuthConstants } from "../auth.constants";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private authService: AuthService) {
    super({
      usernameField: "email",
      passwordField: "password",
    });
  }

  async validate(email: string, password: string): Promise<any> {
    try {
      // ✅ Normaliser l'email
      const normalizedEmail = email.toLowerCase().trim();
      
      // ✅ Appeler validateUser qui peut lancer des exceptions spécifiques
      const user = await this.authService.validateUser(normalizedEmail, password);

      if (!user) {
        throw new UnauthorizedException({
          message: "Email ou mot de passe incorrect",
          code: "INVALID_CREDENTIALS"
        });
      }

      return user;

    } catch (error) {
      // ✅ PROPAGER DIRECTEMENT si c'est déjà une UnauthorizedException
      if (error instanceof UnauthorizedException) {
        const errorMessage = error.message;
        
        if (errorMessage === AuthConstants.ERROR_MESSAGES.PASSWORD_RESET_REQUIRED) {
          throw new UnauthorizedException({
            message: "Un mot de passe doit être défini pour ce compte",
            code: AuthConstants.ERROR_MESSAGES.PASSWORD_RESET_REQUIRED,
            requiresPasswordReset: true,
            email: email
          });
        }
        
        if (errorMessage === AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE) {
          throw new UnauthorizedException({
            message: "Votre compte a été désactivé",
            code: AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE,
            requiresAdmin: true
          });
        }
        
        if (errorMessage === AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE) {
          throw new UnauthorizedException({
            message: "Votre compte est temporairement déconnecté",
            code: AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE,
            duration: "30 minutes"
          });
        }
        
        if (errorMessage === AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE) {
          throw new UnauthorizedException({
            message: "Système en maintenance",
            code: AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE
          });
        }
        
        throw error;
      }

      throw new UnauthorizedException({
        message: "Email ou mot de passe incorrect",
        code: "AUTH_ERROR"
      });
    }
  }
}