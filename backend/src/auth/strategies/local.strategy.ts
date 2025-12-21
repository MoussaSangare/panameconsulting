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
      this.logger.debug(`Tentative d'authentification pour: ${this.maskEmail(email)}`);

      const normalizedEmail = email.toLowerCase().trim();
      const user = await this.authService.validateUser(normalizedEmail, password);

      if (!user) {
        this.logger.warn(`Identifiants incorrects pour: ${this.maskEmail(email)}`);
        throw new UnauthorizedException({
          message: "Email ou mot de passe incorrect",
          code: "INVALID_CREDENTIALS",
          timestamp: new Date().toISOString()
        });
      }

      this.logger.log(`Authentification réussie pour: ${this.maskEmail(email)}`);
      return user;

    } catch (error) {
      if (error instanceof UnauthorizedException) {
        // ✅ Transmettre directement l'erreur sans modification excessive
        const errorData = error.getResponse();
        
        if (typeof errorData === 'object' && errorData['code']) {
          // Erreur déjà formatée, la propager
          this.logger.debug(`Erreur d'authentification formatée: ${errorData['code']}`);
          throw error;
        }
        
        const errorMessage = error.message;
        
        if (errorMessage === AuthConstants.ERROR_MESSAGES.PASSWORD_RESET_REQUIRED) {
          this.logger.log(`Réinitialisation de mot de passe requise: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Un mot de passe doit être défini pour ce compte",
            code: AuthConstants.ERROR_MESSAGES.PASSWORD_RESET_REQUIRED,
            requiresPasswordReset: true
          });
        }
        
        if (errorMessage === AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE) {
          this.logger.warn(`Compte désactivé: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Votre compte a été désactivé",
            code: AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE,
            requiresAdmin: true
          });
        }
        
        if (errorMessage.includes(AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE)) {
          const hoursMatch = errorMessage.match(/:(\d+)/);
          const hours = hoursMatch ? hoursMatch[1] : "24";
          
          this.logger.warn(`Compte déconnecté temporairement: ${this.maskEmail(email)} (${hours}h)`);
          throw new UnauthorizedException({
            message: `Votre compte est temporairement déconnecté (${hours}h restantes)`,
            code: AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE,
            remainingHours: parseInt(hours)
          });
        }
        
        if (errorMessage === AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE) {
          this.logger.warn(`Mode maintenance: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Système en maintenance",
            code: AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE
          });
        }
        
        // Pour les autres messages, créer une erreur formatée
        throw new UnauthorizedException({
          message: errorMessage,
          code: "AUTHENTICATION_ERROR",
          timestamp: new Date().toISOString()
        });
      }

      // Erreur inattendue
      this.logger.error(`Erreur inattendue dans LocalStrategy: ${error.message}`, error.stack);
      throw new UnauthorizedException({
        message: "Erreur d'authentification",
        code: "AUTH_SYSTEM_ERROR",
        timestamp: new Date().toISOString()
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