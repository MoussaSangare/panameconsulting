import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthConstants } from "../../auth/auth.constants";

@Injectable()
export class LocalAuthGuard extends AuthGuard("local") {
  private readonly logger = new Logger(LocalAuthGuard.name);

  constructor() {
    super();
  }

  /**
   * Surcharge de handleRequest pour personnaliser les messages d'erreur
   */
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const email = request.body?.email;
    
    // ✅ GÉRER D'ABORD LES ERREURS SPÉCIFIQUES DU BACKEND
    if (err) {
      this.logger.error(`Erreur dans LocalAuthGuard: ${err.message}`, err.stack);
      
      // ✅ DÉTECTER LES ERREURS STRUCTURÉES (avec code)
      if (err.response && err.response.code) {
        const errorCode = err.response.code;
        const errorMessage = err.response.message || err.message;
        
        this.logger.warn(`Erreur structurée détectée: ${errorCode} - ${this.maskEmail(email)}`);
        
        // ✅ PASSWORD_RESET_REQUIRED - C'EST LE VOTRE PROBLÈME
        if (errorCode === AuthConstants.ERROR_MESSAGES.PASSWORD_RESET_REQUIRED) {
          this.logger.warn(`Password reset required for: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Un mot de passe doit être défini pour ce compte. Utilisez 'Mot de passe oublié'.",
            code: AuthConstants.ERROR_MESSAGES.PASSWORD_RESET_REQUIRED,
            requiresPasswordReset: true,
            email: email
          });
        }
        
        if (errorCode === AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE) {
          this.logger.warn(`Account disabled: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Votre compte a été désactivé. Contactez l'administrateur.",
            code: AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE,
            requiresAdmin: true
          });
        }
        
        if (errorCode === AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE) {
          this.logger.warn(`Temporary disconnect: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Déconnexion administrative en cours. Réessayez plus tard.",
            code: AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE,
            duration: AuthConstants.GLOBAL_LOGOUT_DURATION
          });
        }
        
        if (errorCode === AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE) {
          this.logger.warn(`Maintenance mode: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Mode maintenance activé. Réessayez plus tard.",
            code: AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE
          });
        }
      }
      
      // ✅ Pour toutes les autres erreurs UnauthorizedException
      if (err instanceof UnauthorizedException) {
        // ✅ DÉTECTION DIRECTE DU MESSAGE "Un mot de passe doit être défini pour ce compte"
        if (err.message.includes("mot de passe doit être défini") || 
            err.message.includes("PASSWORD RESET REQUIRED")) {
          this.logger.warn(`Password reset detected from message: ${this.maskEmail(email)}`);
          throw new UnauthorizedException({
            message: "Un mot de passe doit être défini pour ce compte. Utilisez 'Mot de passe oublié'.",
            code: AuthConstants.ERROR_MESSAGES.PASSWORD_RESET_REQUIRED,
            requiresPasswordReset: true,
            email: email
          });
        }
        
        // Propager les autres UnauthorizedException
        throw err;
      }
      
      // Pour les autres erreurs, utiliser le message par défaut
      this.logger.error(`Erreur authentification: ${err?.message || info?.message}`);
      throw err;
    }
    
    if (!user) {
      this.logger.warn(`Authentification échouée: ${this.maskEmail(email)}`);
      throw new UnauthorizedException({
        message: "Email ou mot de passe incorrect",
        code: "INVALID_CREDENTIALS"
      });
    }
    
    return user;
  }

  /**
   * Surcharge de canActivate pour ajouter une logique supplémentaire
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const email = request.body?.email;
      
      this.logger.log(`🔐 Tentative de connexion pour: ${this.maskEmail(email)}`);

      // Vérifier que le body contient email et password
      if (!email || !request.body?.password) {
        this.logger.warn("Requête de connexion incomplète");
        throw new UnauthorizedException("Email et mot de passe requis");
      }

      // Appel de la méthode parent
      const result = (await super.canActivate(context)) as boolean;
      
      this.logger.log(`✅ Authentification locale réussie pour: ${this.maskEmail(email)}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Erreur activation guard local: ${error.message}`, error.stack);
      throw error;
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