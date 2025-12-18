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
    this.logger.log('Création d\'utilisateur par admin');

    // ✅ FORCER tous les comptes créés via API à être USER
    if (createUserDto.role === UserRole.ADMIN) {
      createUserDto.role = UserRole.USER;
      this.logger.warn('Rôle admin forcé en USER pour création via API');
    }

    try {
      const user = await this.usersService.create(createUserDto);
      this.logger.log('Utilisateur créé avec succès');
      return user;
    } catch (error) {
      this.logger.error('Erreur création utilisateur');
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll() {
    this.logger.log('Liste des utilisateurs demandée par admin');
    
    try {
      const users = await this.usersService.findAll();
      this.logger.log(`${users.length} utilisateurs récupérés`);
      return users;
    } catch (error) {
      this.logger.error('Erreur récupération utilisateurs');
      throw error;
    }
  }

  @Get("stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getStats() {
    this.logger.log('Statistiques utilisateurs demandées');
    
    try {
      const stats = await this.usersService.getStats();
      this.logger.log(`Statistiques générées - Total: ${stats.totalUsers}`);
      return stats;
    } catch (error) {
      this.logger.error('Erreur génération stats');
      throw error;
    }
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    this.logger.log('Suppression utilisateur demandée');
    
    try {
      await this.usersService.delete(id);
      this.logger.log('Utilisateur supprimé');
    } catch (error) {
      this.logger.error('Erreur suppression utilisateur');
      throw error;
    }
  }

  @Patch(":id/toggle-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async toggleStatus(@Param("id") id: string) {
    this.logger.log('Changement statut utilisateur');
    
    try {
      const user = await this.usersService.toggleStatus(id);
      this.logger.log(`Statut utilisateur modifié - Actif: ${user.isActive}`);
      return user;
    } catch (error) {
      this.logger.error('Erreur changement statut');
      throw error;
    }
  }

  @Get("maintenance-status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getMaintenanceStatus() {
    this.logger.log('Statut maintenance demandé');
    
    const status = await this.usersService.getMaintenanceStatus();
    
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
    this.logger.log(`Changement mode maintenance - Activé: ${body.enabled}`);
    
    await this.usersService.setMaintenanceMode(body.enabled);
    this.logger.log(`Mode maintenance ${body.enabled ? "activé" : "désactivé"}`);
    
    return {
      message: `Mode maintenance ${body.enabled ? "activé" : "désactivé"}`,
    };
  }

  @Get("check-access/:userId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async checkUserAccess(@Param("userId") userId: string) {
    this.logger.log('Vérification accès utilisateur');
    
    const accessCheck = await this.usersService.checkUserAccess(userId);
    this.logger.log(`Accès utilisateur: ${accessCheck.canAccess}`);
    return accessCheck;
  }

  // === ENDPOINTS PUBLIC (Pour l'utilisateur connecté) ===
  @Patch("profile/me")
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const userId = req.user.id;
    
    this.logger.log('Mise à jour profil utilisateur');

    // Validation améliorée
    if (
      updateUserDto.email === undefined &&
      updateUserDto.telephone === undefined
    ) {
      this.logger.warn('Aucun champ fourni pour mise à jour');
      throw new BadRequestException(
        "Au moins un champ (email ou téléphone) doit être fourni",
      );
    }

    // Validation de l'email si fourni
    if (updateUserDto.email !== undefined) {
      if (updateUserDto.email.trim() === "") {
        this.logger.warn('Email vide fourni');
        throw new BadRequestException("L'email ne peut pas être vide");
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateUserDto.email)) {
        this.logger.warn('Format email invalide');
        throw new BadRequestException("Format d'email invalide");
      }
    }

    // Validation du téléphone si fourni
    if (updateUserDto.telephone !== undefined) {
      if (updateUserDto.telephone.trim().length < 5) {
        this.logger.warn('Téléphone trop court');
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
      this.logger.warn('Aucune donnée valide après validation');
      throw new BadRequestException("Aucune donnée valide à mettre à jour");
    }

    this.logger.log(`Données validées pour mise à jour - Champs: ${Object.keys(allowedUpdate).join(', ')}`);

    try {
      const updatedUser = await this.usersService.update(
        userId,
        allowedUpdate,
      );

      this.logger.log('Profil mis à jour avec succès');

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
      this.logger.error('Erreur mise à jour profil');
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
  this.logger.log('Réinitialisation mot de passe admin');
  
  // ✅ EMPÊCHER RÉINITIALISATION ADMIN SI NON ADMIN CONNECTÉ
  const adminEmail = process.env.EMAIL_USER;
  const currentUser = await this.usersService.findById(userId);
  
  if (currentUser.email === adminEmail && currentUser.role === UserRole.ADMIN) {
    // Vérifier que l'admin connecté est bien l'admin unique
    const requestingUser = await this.usersService.findByRole(UserRole.ADMIN);
    if (!requestingUser || requestingUser.email !== adminEmail) {
      this.logger.warn(`❌ TENTATIVE DE RÉINITIALISATION ADMIN NON AUTORISÉE`);
      throw new BadRequestException("Seul l'administrateur principal peut réinitialiser son mot de passe");
    }
  }
  
  // Validation
  if (body.newPassword !== body.confirmNewPassword) {
    throw new BadRequestException("Les mots de passe ne correspondent pas");
  }
  
  if (body.newPassword.length < 8) {
    throw new BadRequestException("Le mot de passe doit contenir au moins 8 caractères");
  }
  
  await this.usersService.resetPassword(userId, body.newPassword);
  
  this.logger.log(`Mot de passe réinitialisé par admin pour: ${this.maskUserId(userId)}`);
  return { message: "Mot de passe réinitialisé avec succès" };
}



  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateUser(
    @Param("id") userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    this.logger.log('Mise à jour utilisateur par admin');

    try {
      const updatedUser = await this.usersService.update(userId, updateUserDto);
      this.logger.log('Utilisateur mis à jour par admin');

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
      this.logger.error('Erreur mise à jour utilisateur par admin');
      throw error;
    }
  }

  @Get("profile/me")
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    
    if (!userId) {
      this.logger.warn('ID utilisateur manquant dans la requête');
      throw new BadRequestException("ID utilisateur manquant");
    }

    this.logger.log('Récupération profil utilisateur');

    try {
      const user = await this.usersService.findById(userId);
      this.logger.log('Profil récupéré avec succès');

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
      this.logger.error('Erreur récupération profil');
      throw error;
    }
  }

  private maskUserId(userId: string): string {
    if (!userId || typeof userId !== 'string' || userId.length === 0) {
      return 'user_***';
    }
    
    if (userId.length <= 6) {
      return 'user_***';
    }
    
    return `user_${userId.substring(0, 3)}***${userId.substring(userId.length - 3)}`;
  }


}