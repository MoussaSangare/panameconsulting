// local.strategy.ts - CORRIGÉ
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
      this.logger.log(`Attempting local authentication for email: ${this.maskEmail(email)}`);

      // ✅ Normaliser l'email
      const normalizedEmail = email.toLowerCase().trim();
      
      // ✅ Appeler validateUser qui peut lancer des exceptions spécifiques
      const user = await this.authService.validateUser(normalizedEmail, password);

      if (!user) {
        // ✅ C'est le cas où validateUser retourne null (credentials invalides)
        this.logger.warn(`Invalid credentials for: ${this.maskEmail(email)}`);
        throw new UnauthorizedException({
          message: "Email ou mot de passe incorrect",
          code: "INVALID_CREDENTIALS"
        });
      }

      this.logger.log(`Local authentication successful for user: ${this.maskEmail(email)}`);
      return user;

    } catch (error) {
      // ✅ PROPAGER DIRECTEMENT si c'est déjà une UnauthorizedException
      if (error instanceof UnauthorizedException) {
        // ✅ Distinguer les différents types d'erreurs
        const errorMessage = error.message;
        
        // ✅ PASSWORD_RESET_REQUIRED est un cas spécial, pas une erreur d'authentification
        if (errorMessage === AuthConstants.ERROR_MESSAGES.PASSWORD_RESET_REQUIRED) {
          this.logger.log(`Password reset required for user: ${this.maskEmail(email)}`);
          // ⚠️ IMPORTANT : Lancer une nouvelle exception avec plus de contexte
          throw new UnauthorizedException({
            message: "Un mot de passe doit être défini pour ce compte",
            code: AuthConstants.ERROR_MESSAGES.PASSWORD_RESET_REQUIRED,
            requiresPasswordReset: true,
            email: email // On peut envoyer l'email pour faciliter la récupération
          });
        }
        
        // ✅ Les autres erreurs spécifiques
        if (errorMessage === AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE) {
          this.logger.warn(`Account disabled for: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Votre compte a été désactivé",
            code: AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE,
            requiresAdmin: true
          });
        }
        
        if (errorMessage === AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE) {
          this.logger.warn(`Account temporarily disconnected for: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Votre compte est temporairement déconnecté",
            code: AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE,
            duration: AuthConstants.GLOBAL_LOGOUT_DURATION
          });
        }
        
        if (errorMessage === AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE) {
          this.logger.warn(`Maintenance mode for: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Système en maintenance",
            code: AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE
          });
        }
        
        // ✅ Pour les autres UnauthorizedException, propager telles quelles
        this.logger.warn(`Authentication error for ${this.maskEmail(email)}: ${errorMessage}`);
        throw error;
      }

      // ✅ Pour les autres erreurs, logger et retourner une erreur générique
      this.logger.error(`LocalStrategy unexpected error for ${this.maskEmail(email)}: ${error.message}`, error.stack);
      throw new UnauthorizedException({
        message: "Email ou mot de passe incorrect",
        code: "AUTH_ERROR"
      });
    }
  }

  private maskEmail(email: string): string {
    if (!email) return '***@***';
    const [name, domain] = email.split('@');
    if (!name || !domain) return '***@***';
    
    const maskedName = name.length <= 2 
      ? name.charAt(0) + '*'
      : name.charAt(0) + '***' + (name.length > 1 ? name.charAt(name.length - 1) : '');
    
    return `${maskedName}@${domain}`;
  }
}