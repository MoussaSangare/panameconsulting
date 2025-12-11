// src/shared/interfaces/authenticated-user.interface.ts
export interface AuthenticatedUser {
  id: string;           // ID MongoDB de l'utilisateur (propriété principale)
  sub?: string;         // Alias pour id (compatibilité JWT standard)
  userId?: string;      // Autre alias
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  telephone?: string;
  isActive?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}