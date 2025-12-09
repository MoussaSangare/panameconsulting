import { UserRole } from "../../enums/user-role.enum";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}