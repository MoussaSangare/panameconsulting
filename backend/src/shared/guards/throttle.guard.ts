import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { AuthConstants } from "../../auth/auth.constants";

@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly logger = new Logger(ThrottleGuard.name);
  private readonly loginAttempts = new Map<
    string,
    {
      attempts: number;
      lastAttempt: Date;
      ttl: Date;
    }
  >();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { email } = request.body;

    if (!email) {
      throw new HttpException(
        "Email is required for rate limiting",
        HttpStatus.BAD_REQUEST,
      );
    }

    const key = this.normalizeEmail(email);
    const attempts = this.getLoginAttempts(key);
    const now = new Date();
    const timeSinceLastAttempt = attempts.lastAttempt
      ? (now.getTime() - attempts.lastAttempt.getTime()) / (1000 * 60)
      : 999; // en minutes

    // ✅ Utiliser les constantes définies
    const windowMinutes = AuthConstants.RATE_LIMIT_WINDOW_MS / (1000 * 60); // Convertir ms en minutes
    const maxAttempts = AuthConstants.MAX_LOGIN_ATTEMPTS;

    // Vérifier les tentatives
    if (attempts.attempts >= maxAttempts && timeSinceLastAttempt < windowMinutes) {
      const remainingTime = Math.ceil(windowMinutes - timeSinceLastAttempt);
      
      this.logger.warn(
        `Trop de tentatives de connexion pour ${this.maskEmail(email)}: ${attempts.attempts} tentatives`
      );
      
      throw new HttpException(
        {
          status: HttpStatus.TOO_MANY_REQUESTS,
          error: "Too many login attempts",
          message: `Please try again in ${remainingTime} minutes`,
          retryAfter: `${remainingTime} minutes`,
          attempts: attempts.attempts,
          maxAttempts,
          windowMinutes,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Réinitialiser le compteur si la dernière tentative date de plus de la fenêtre
    if (timeSinceLastAttempt >= windowMinutes) {
      this.resetLoginAttempts(key);
    }

    this.incrementLoginAttempts(key);
    return true;
  }

  private getLoginAttempts(email: string): {
    attempts: number;
    lastAttempt: Date;
  } {
    this.cleanupExpiredAttempts();
    const data = this.loginAttempts.get(email);
    return data
      ? {
          attempts: data.attempts,
          lastAttempt: data.lastAttempt,
        }
      : { attempts: 0, lastAttempt: new Date(0) };
  }

  private incrementLoginAttempts(email: string): void {
    const current = this.loginAttempts.get(email) || {
      attempts: 0,
      lastAttempt: new Date(0),
      ttl: new Date(),
    };

    current.attempts++;
    current.lastAttempt = new Date();
    // ✅ Utiliser la constante LOGIN_ATTEMPTS_TTL_MINUTES
    current.ttl = new Date(
      Date.now() + AuthConstants.LOGIN_ATTEMPTS_TTL_MINUTES * 60 * 1000
    );

    // Limiter la taille du cache pour éviter les fuites mémoire
    if (this.loginAttempts.size >= 1000) {
      const oldestKey = Array.from(this.loginAttempts.entries())
        .sort((a, b) => a[1].ttl.getTime() - b[1].ttl.getTime())[0]?.[0];
      if (oldestKey) {
        this.loginAttempts.delete(oldestKey);
      }
    }

    this.loginAttempts.set(email, current);
  }

  private resetLoginAttempts(email: string): void {
    this.loginAttempts.delete(email);
    this.logger.debug(`Reset login attempts for ${this.maskEmail(email)}`);
  }

  private cleanupExpiredAttempts(): void {
    const now = new Date();
    for (const [email, data] of this.loginAttempts.entries()) {
      if (data.ttl < now) {
        this.loginAttempts.delete(email);
      }
    }
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
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