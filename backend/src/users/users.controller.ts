import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { RegisterDto } from "../auth/dto/register.dto";
import { UpdateUserDto } from "../auth/dto/update-user.dto";
import { UserRole } from "../schemas/user.schema";
import { Roles } from "../shared/decorators/roles.decorator";
import { JwtAuthGuard } from "../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../shared/guards/roles.guard";
import { UsersService } from "./users.service";
import { AuthenticatedRequest } from "../shared/interfaces/authenticated-user.interface";

@Controller("users")
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}
  
  // === ENDPOINTS ADMIN ===
 @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() createUserDto: RegisterDto) {
    const requestId = this.generateRequestId();
    this.logger.log(`[${requestId}] Création d'utilisateur par admin - Email: ${this.maskEmail(createUserDto.email)}`);

    // Empêcher la création d'autres admins via l'API
    if (createUserDto.role === UserRole.ADMIN) {
      const existingAdmin = await this.usersService.findByRole(UserRole.ADMIN);
      if (existingAdmin) {
        this.logger.warn(`[${requestId}] Tentative de création d'un deuxième admin`);
        throw new BadRequestException(
          "Il ne peut y avoir qu'un seul administrateur",
        );
      }
    }

    // Empêcher la création d'un utilisateur avec l'email admin spécifique
    const adminEmail = process.env.EMAIL_USER;
    if (createUserDto.email === adminEmail) {
      this.logger.warn(`[${requestId}] Tentative d'utilisation de l'email admin réservé`);
      throw new BadRequestException(
        "Cet email est réservé à l'administrateur principal",
      );
    }

    try {
      const user = await this.usersService.create(createUserDto);
      this.logger.log(`[${requestId}] Utilisateur créé avec succès - ID: ${user._id}`);
      return user;
    } catch (error) {
      this.logger.error(`[${requestId}] Erreur création utilisateur: ${error.message}`);
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll() {
    const requestId = this.generateRequestId();
    this.logger.log(`[${requestId}] Liste des utilisateurs demandée par admin`);
    
    try {
      const users = await this.usersService.findAll();
      this.logger.log(`[${requestId}] ${users.length} utilisateurs récupérés`);
      return users;
    } catch (error) {
      this.logger.error(`[${requestId}] Erreur récupération utilisateurs: ${error.message}`);
      throw error;
    }
  }

  @Get("stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getStats() {
    const requestId = this.generateRequestId();
    this.logger.log(`[${requestId}] Statistiques utilisateurs demandées`);
    
    try {
      const stats = await this.usersService.getStats();
      this.logger.log(`[${requestId}] Statistiques générées - Total: ${stats.totalUsers}`);
      return stats;
    } catch (error) {
      this.logger.error(`[${requestId}] Erreur génération stats: ${error.message}`);
      throw error;
    }
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    const requestId = this.generateRequestId();
    this.logger.log(`[${requestId}] Suppression utilisateur demandée - ID: ${id}`);
    
    try {
      await this.usersService.delete(id);
      this.logger.log(`[${requestId}] Utilisateur supprimé - ID: ${id}`);
    } catch (error) {
      this.logger.error(`[${requestId}] Erreur suppression utilisateur: ${error.message}`);
      throw error;
    }
  }

  @Patch(":id/toggle-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async toggleStatus(@Param("id") id: string) {
    const requestId = this.generateRequestId();
    this.logger.log(`[${requestId}] Changement statut utilisateur - ID: ${id}`);
    
    try {
      const user = await this.usersService.toggleStatus(id);
      this.logger.log(`[${requestId}] Statut utilisateur modifié - ID: ${id}, Actif: ${user.isActive}`);
      return user;
    } catch (error) {
      this.logger.error(`[${requestId}] Erreur changement statut: ${error.message}`);
      throw error;
    }
  }

  @Get("maintenance-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getMaintenanceStatus() {
    const requestId = this.generateRequestId();
    this.logger.log(`[${requestId}] Statut maintenance demandé`);
    
    // ✅ Récupérer le statut complet
    const status = await this.usersService.getMaintenanceStatus();
    
    // ✅ Retourner un objet conforme
    return {
      isActive: status.isActive,
      enabledAt: status.enabledAt,
      message: status.message,
    };
  }

  @Post("maintenance-mode")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async setMaintenanceMode(@Body() body: { enabled: boolean }) {
    const requestId = this.generateRequestId();
    this.logger.log(`[${requestId}] Changement mode maintenance - Activé: ${body.enabled}`);
    
    await this.usersService.setMaintenanceMode(body.enabled);
    this.logger.log(`[${requestId}] Mode maintenance ${body.enabled ? "activé" : "désactivé"}`);
    
    return {
      message: `Mode maintenance ${body.enabled ? "activé" : "désactivé"}`,
    };
  }

  @Get("check-access/:userId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async checkUserAccess(@Param("userId") userId: string) {
    const requestId = this.generateRequestId();
    this.logger.log(`[${requestId}] Vérification accès utilisateur - ID: ${userId}`);
    
    const accessCheck = await this.usersService.checkUserAccess(userId);
    this.logger.log(`[${requestId}] Accès utilisateur ${userId}: ${accessCheck.canAccess}`);
    return accessCheck;
  }

  // === ENDPOINTS PUBLIC (Pour l'utilisateur connecté) ===
  @Patch("profile/me")
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const requestId = this.generateRequestId();
    const userId = req.user.id; // ← Utiliser id directement
    
    this.logger.log(`[${requestId}] Mise à jour profil - Utilisateur: ${this.maskUserId(userId)}`);

    // Validation améliorée
    if (
      updateUserDto.email === undefined &&
      updateUserDto.telephone === undefined
    ) {
      this.logger.warn(`[${requestId}] Aucun champ fourni pour mise à jour`);
      throw new BadRequestException(
        "Au moins un champ (email ou téléphone) doit être fourni",
      );
    }

    // Validation de l'email si fourni
    if (updateUserDto.email !== undefined) {
      if (updateUserDto.email.trim() === "") {
        this.logger.warn(`[${requestId}] Email vide fourni`);
        throw new BadRequestException("L'email ne peut pas être vide");
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateUserDto.email)) {
        this.logger.warn(`[${requestId}] Format email invalide: ${this.maskEmail(updateUserDto.email)}`);
        throw new BadRequestException("Format d'email invalide");
      }
    }

    // Validation du téléphone si fourni
    if (updateUserDto.telephone !== undefined) {
      if (updateUserDto.telephone.trim().length < 5) {
        this.logger.warn(`[${requestId}] Téléphone trop court`);
        throw new BadRequestException(
          "Le téléphone doit contenir au moins 5 caractères",
        );
      }
    }

    const allowedUpdate: any = {};

    if (
      updateUserDto.email !== undefined &&
      updateUserDto.email.trim() !== ""
    ) {
      allowedUpdate.email = updateUserDto.email.trim().toLowerCase();
    }

    if (
      updateUserDto.telephone !== undefined &&
      updateUserDto.telephone.trim() !== ""
    ) {
      allowedUpdate.telephone = updateUserDto.telephone.trim();
    }

    if (Object.keys(allowedUpdate).length === 0) {
      this.logger.warn(`[${requestId}] Aucune donnée valide après validation`);
      throw new BadRequestException("Aucune donnée valide à mettre à jour");
    }

    this.logger.log(`[${requestId}] Données validées pour mise à jour - Champs: ${Object.keys(allowedUpdate).join(', ')}`);

    try {
      const updatedUser = await this.usersService.update(
        userId,
        allowedUpdate,
      );

      this.logger.log(`[${requestId}] Profil mis à jour avec succès - Utilisateur: ${this.maskUserId(userId)}`);

      return {
        id: updatedUser._id?.toString(),
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        telephone: updatedUser.telephone,
        isActive: updatedUser.isActive,
        isAdmin: updatedUser.role === UserRole.ADMIN,
      };
    } catch (error) {
      this.logger.error(`[${requestId}] Erreur mise à jour profil: ${error.message}`);
      throw error;
    }
  }

  @Patch(":id/admin-reset-password")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminResetPassword(
    @Param("id") userId: string,
    @Body() body: { newPassword: string; confirmNewPassword: string },
  ) {
    const requestId = this.generateRequestId();
    this.logger.log(`[${requestId}] Réinitialisation mot de passe admin - Utilisateur: ${userId}`);
    
    // Validation
    if (body.newPassword !== body.confirmNewPassword) {
      throw new BadRequestException("Les mots de passe ne correspondent pas");
    }
    
    if (body.newPassword.length < 8) {
      throw new BadRequestException("Le mot de passe doit contenir au moins 8 caractères");
    }
    
    await this.usersService.resetPassword(userId, body.newPassword);
    
    this.logger.log(`[${requestId}] Mot de passe réinitialisé par admin - Utilisateur: ${userId}`);
    return { message: "Mot de passe réinitialisé avec succès" };
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateUser(
    @Param("id") userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const requestId = this.generateRequestId();
    this.logger.log(`[${requestId}] Mise à jour utilisateur par admin - ID: ${userId}`);

    try {
      const updatedUser = await this.usersService.update(userId, updateUserDto);
      this.logger.log(`[${requestId}] Utilisateur mis à jour par admin - ID: ${userId}`);

      return {
        id: updatedUser._id?.toString(),
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        telephone: updatedUser.telephone,
        isActive: updatedUser.isActive,
      };
    } catch (error) {
      this.logger.error(`[${requestId}] Erreur mise à jour utilisateur par admin: ${error.message}`);
      throw error;
    }
  }

  @Get("profile/me")
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Request() req: AuthenticatedRequest) {
    const requestId = this.generateRequestId();
    const userId = req.user.id; // ← Utiliser id directement
    
    if (!userId) {
      this.logger.warn(`[${requestId}] ID utilisateur manquant dans la requête`);
      throw new BadRequestException("ID utilisateur manquant");
    }

    this.logger.log(`[${requestId}] Récupération profil - Utilisateur: ${this.maskUserId(userId)}`);

    try {
      const user = await this.usersService.findById(userId);
      this.logger.log(`[${requestId}] Profil récupéré avec succès - Utilisateur: ${this.maskUserId(userId)}`);

      return {
        id: user._id?.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        telephone: user.telephone,
        isActive: user.isActive,
        isAdmin: user.role === UserRole.ADMIN,
      };
    } catch (error) {
      this.logger.error(`[${requestId}] Erreur récupération profil: ${error.message}`);
      throw error;
    }
  }

  // === MÉTHODES PRIVÉES POUR LA SÉCURITÉ ===
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private maskEmail(email: string): string {
    if (!email) return 'email_inconnu';
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return 'email_invalide';
    
    const maskedLocal = localPart.length <= 2 
      ? localPart.charAt(0) + '*'
      : localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1);
    
    return `${maskedLocal}@${domain}`;
  }

  private maskUserId(userId: string): string {
    if (!userId) return 'user_inconnu';
    return userId.length <= 8 ? userId : userId.substring(0, 4) + '***' + userId.substring(userId.length - 4);
  }
}