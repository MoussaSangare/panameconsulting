import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "../../schemas/user.schema";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si aucune role n'est requis, autoriser l'accès
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Vérifier que l'utilisateur existe
    if (!user) {
      this.logger.warn("Accès refusé : utilisateur non authentifié");
      return false;
    }

    // Vérifier que l'utilisateur a un rôle
    if (!user.role) {
      this.logger.warn(`Accès refusé : utilisateur ${this.maskUserId(user.sub)} n'a pas de rôle défini`);
      return false;
    }

    // Vérifier si le rôle de l'utilisateur correspond à l'un des rôles requis
    const hasRequiredRole = requiredRoles.some((role) => user.role === role);

    if (!hasRequiredRole) {
      this.logger.warn(
        `Accès refusé : utilisateur ${this.maskUserId(user.sub)} (role: ${user.role}) ` +
        `n'a pas les rôles requis: ${requiredRoles.join(', ')}`
      );
    } else {
      this.logger.debug(
        `Accès autorisé pour utilisateur ${this.maskUserId(user.sub)} (role: ${user.role})`
      );
    }

    return hasRequiredRole;
  }

  private maskUserId(userId: string): string {
    if (!userId) return 'user_***';
    if (userId.length <= 8) return userId;
    return `${userId.substring(0, 4)}***${userId.substring(userId.length - 4)}`;
  }
}