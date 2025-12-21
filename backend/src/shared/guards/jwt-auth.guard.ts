import { Injectable, UnauthorizedException, Logger, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

 async canActivate(context: ExecutionContext): Promise<boolean> {
  try {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.split(" ")[1] || 
                  request.cookies?.access_token;
    
    // ✅ PERMETTRE LE LOGOUT MÊME AVEC TOKEN EXPIRÉ
    if (request.url.includes('/auth/logout')) {
      this.logger.debug('Route logout détectée - validation spéciale');
      
      // Si pas de token, c'est peut-être un logout sans session active
      if (!token) {
        this.logger.log('Logout sans token - autorisé pour nettoyage');
        return true;
      }
      
      // Si on a un token, essayer de le valider
      try {
        // Essayer la validation normale
        const result = await super.canActivate(context);
        return result as boolean;
      } catch (validationError) {
        // Si le token est expiré ou invalide, autoriser quand même le logout
        this.logger.log(`Token invalide pour logout: ${validationError.message} - autorisé pour nettoyage`);
        return true;
      }
    }
    
    // ✅ POUR LES AUTRES ROUTES, VALIDATION NORMALE
    if (!token) {
      throw new UnauthorizedException({
        message: "Authentification requise",
        code: "AUTH_REQUIRED"
      });
    }

    const result = await super.canActivate(context);
    return result as boolean;
    
  } catch (error) {
    this.logger.debug(`Erreur validation JWT: ${error.message}`);
    
    // ✅ Gestion améliorée des erreurs sans logs sensibles
    if (error instanceof UnauthorizedException) {
      const errorResponse = error.getResponse();
      
      // Vérifier si c'est une route de logout
      const request = context.switchToHttp().getRequest();
      if (request.url.includes('/auth/logout')) {
        this.logger.log('Logout avec token invalide - autorisé pour nettoyage');
        return true;
      }
      
      throw error; // Garder l'erreur originale si déjà Unauthorized
    }
    
    if (error.name === 'TokenExpiredError') {
      // Pour les routes autres que logout, traiter normalement
      const request = context.switchToHttp().getRequest();
      if (!request.url.includes('/auth/logout')) {
        throw new UnauthorizedException({
          message: "Votre session a expiré. Veuillez vous reconnecter.",
          code: "SESSION_EXPIRED",
          requiresReauth: true
        });
      } else {
        // Pour logout, autoriser même avec token expiré
        this.logger.log('Logout avec token expiré - autorisé');
        return true;
      }
    }
    
    if (error.name === 'JsonWebTokenError') {
      // Pour les routes autres que logout, traiter normalement
      const request = context.switchToHttp().getRequest();
      if (!request.url.includes('/auth/logout')) {
        throw new UnauthorizedException({
          message: "Authentification invalide",
          code: "INVALID_TOKEN"
        });
      } else {
        // Pour logout, autoriser même avec token invalide
        this.logger.log('Logout avec token invalide - autorisé pour nettoyage');
        return true;
      }
    }
    
    // Pour logout, toujours autoriser même en cas d'erreur inconnue
    const request = context.switchToHttp().getRequest();
    if (request.url.includes('/auth/logout')) {
      this.logger.log(`Erreur inattendue pendant logout: ${error.message} - autorisé pour nettoyage`);
      return true;
    }
    
    // Pour les autres routes, erreur générique
    throw new UnauthorizedException({
      message: "Erreur d'authentification",
      code: "AUTH_ERROR"
    });
  }
}

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      // Gestion des erreurs JWT spécifiques
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          message: "Votre session a expiré. Veuillez vous reconnecter.",
          code: "SESSION_EXPIRED",
          requiresReauth: true
        });
      }
      
      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException({
          message: "Authentification invalide",
          code: "INVALID_TOKEN"
        });
      }
      
      if (err?.message?.includes('Compte désactivé')) {
        throw new UnauthorizedException({
          message: "Compte désactivé",
          code: "ACCOUNT_DISABLED",
          requiresAdmin: true
        });
      }
      
      if (err?.message?.includes('Mode maintenance')) {
        throw new UnauthorizedException({
          message: "Système en maintenance",
          code: "MAINTENANCE_MODE"
        });
      }
      
      if (err?.message?.includes('Déconnecté temporairement')) {
        const hoursMatch = err.message.match(/:(\d+)/);
        const hours = hoursMatch ? hoursMatch[1] : "24";
        
        throw new UnauthorizedException({
          message: `Déconnexion temporaire (${hours}h restantes)`,
          code: "TEMPORARY_LOGOUT",
          remainingHours: parseInt(hours)
        });
      }
      
      // Erreur générique pour les sessions invalides/expirées
      if (info?.message?.includes('invalid') || info?.message?.includes('expired')) {
        throw new UnauthorizedException({
          message: "Session expirée ou invalide",
          code: "SESSION_INVALID",
          requiresReauth: true
        });
      }
      
      // Message par défaut
      throw new UnauthorizedException({
        message: "Accès non autorisé",
        code: "UNAUTHORIZED"
      });
    }

    // Vérification simple si isActive existe et est faux
    if (user.isActive === false) {
      throw new UnauthorizedException({
        message: "Compte désactivé",
        code: "ACCOUNT_DISABLED",
        requiresAdmin: true
      });
    }

    // Vérification du type de token
    if (user.tokenType && user.tokenType !== "access") {
      throw new UnauthorizedException({
        message: "Type de token invalide",
        code: "INVALID_TOKEN_TYPE"
      });
    }

    this.logger.debug(`Utilisateur authentifié: ${this.maskUserId(user.id)} (role: ${user.role})`);
    return user;
  }

  private maskUserId(userId: string): string {
    if (!userId) return 'user_***';
    if (userId.length <= 8) return userId;
    return `${userId.substring(0, 4)}***${userId.substring(userId.length - 4)}`;
  }
}