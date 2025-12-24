import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Logger } from "@nestjs/common";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  // Masquer les chemins sensibles
  private readonly SENSITIVE_PATHS = [
    'password',
    'token',
    'secret',
    'credit-card',
    'auth',
    'login',
    'register'
  ];

  // Masquer les IDs spécifiques
  private maskSensitiveInfo(url: string): string {
    let maskedUrl = url;
    
    // Masquer les IDs dans l'URL (ex: /users/123 -> /users/***)
    maskedUrl = maskedUrl.replace(/\/\d+(?=\/|$)/g, '/***');
    
    // Masquer les tokens JWT-like
    maskedUrl = maskedUrl.replace(/[A-Za-z0-9_-]{20,}/g, '***');
    
    // Vérifier les chemins sensibles
    const isSensitive = this.SENSITIVE_PATHS.some(path => 
      url.toLowerCase().includes(path)
    );
    
    if (isSensitive) {
      return '[SENSITIVE PATH MASKED]';
    }
    
    return maskedUrl;
  }

  // Masquer l'ID utilisateur
  private maskUserId(userId: string | number): string {
    if (!userId) return 'anonymous';
    const idStr = userId.toString();
    if (idStr.length <= 3) return '***';
    return `${idStr.substring(0, 2)}***${idStr.substring(idStr.length - 2)}`;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;

    // URLs masquées
    const maskedUrl = this.maskSensitiveInfo(url);
    const maskedUserId = user?.userId ? this.maskUserId(user.userId) : "anonymous";

    this.logger.log(
      `Request: ${method} ${maskedUrl} by ${maskedUserId}`,
    );

    return next.handle().pipe(
      tap(() => {
        if (["POST", "PUT", "DELETE"].includes(method)) {
          this.logger.log(`Critical action performed: ${method} ${maskedUrl}`);
        }
      }),
    );
  }
}