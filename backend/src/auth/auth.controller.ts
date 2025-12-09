import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "../shared/guards/jwt-auth.guard";
import { RolesGuard } from "../shared/guards/roles.guard";
import { LocalAuthGuard } from "../shared/guards/local-auth.guard";
import { ThrottleGuard } from "../shared/guards/throttle.guard";
import { LoggingInterceptor } from "../shared/interceptors/logging.interceptor";
import { Roles } from "../shared/decorators/roles.decorator";
import { UserRole } from "../schemas/user.schema";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { LoginDto } from "./dto/login.dto";
import { AuthConstants } from "./auth.constants";

interface CustomRequest extends Request {
  cookies?: {
    refresh_token?: string;
  };
}

@ApiTags("Authentication")
@Controller("auth")
@UseInterceptors(LoggingInterceptor)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  // ==================== 🔐 ENDPOINTS D'AUTHENTIFICATION ====================

  private getCookieOptions(req?: any): any {
    const isProduction = process.env.NODE_ENV === 'production';
    const isVercelApp =req?.headers?.host?.includes('panameconsulting.vercel.app') || 
                       req?.headers?.origin?.includes('panameconsulting.vercel.app');
    
    if (!isProduction || isVercelApp) {
      return {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      };
    }

    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: '.panameconsulting.com',
      path: '/',
    };
  }

@Post("login")
@UseGuards(ThrottleGuard, LocalAuthGuard)
@ApiOperation({ summary: "Connexion utilisateur" })
@ApiResponse({ status: 200, description: "Connexion réussie" })
@ApiResponse({ status: 401, description: "Identifiants invalides" })
async login(@Body() loginDto: LoginDto, @Request() req: { user: any }, @Res() res: Response) {
  this.logger.log(`🔐 Tentative de connexion pour: ${this.maskEmail(loginDto.email)}`);
  
  // ✅ GÉRER LE CAS SPÉCIAL PASSWORD_RESET_REQUIRED
   if (!req.user) {
    return res.status(401).json({
      message: "Email ou mot de passe incorrect",
      code: "INVALID_CREDENTIALS",
      timestamp: new Date().toISOString()
    });
      
  }
  
  // ✅ CAS NORMAL : connexion réussie
  const result = await this.authService.login(req.user);
  
  const cookieOptions = this.getCookieOptions(req);

  res.cookie("refresh_token", result.refresh_token, {
    ...cookieOptions,
    maxAge: AuthConstants.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000,
  });

  res.cookie("access_token", result.access_token, {
    ...cookieOptions,
    httpOnly: false,
    maxAge: AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS * 1000,
  });

  this.logger.log(`✅ Connexion réussie pour: ${this.maskEmail(loginDto.email)}`);

  return res.json({
    access_token: result.access_token,
    user: {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role,
      isAdmin: result.user.role === UserRole.ADMIN,
    },
    message: "Connexion réussie",
  });
}

  @Post("refresh")
  @ApiOperation({ summary: "Rafraîchir le token" })
  @ApiResponse({ status: 200, description: "Token rafraîchi" })
  @ApiResponse({ status: 401, description: "Refresh token invalide" })
  async refresh(
    @Request() req: CustomRequest,
    @Body() body: any,
    @Res() res: Response,
  ) {
    this.logger.log("🔄 Requête de rafraîchissement de token reçue");

    const refresh_token = req.cookies?.refresh_token || body?.refresh_token;

    if (!refresh_token) {
      this.logger.warn("❌ Refresh token manquant dans les cookies et body");
      this.clearAuthCookies(res);
      return res.status(401).json({
        message: "Refresh token manquant",
        loggedOut: true,
      });
    }

    try {
      const result = await this.authService.refresh(refresh_token);

      if (result.sessionExpired) {
        this.logger.log("🔒 Session expirée - nettoyage cookies");
        this.clearAuthCookies(res);
        return res.status(401).json({
          loggedOut: true,
          sessionExpired: true,
          message: "Session expirée après 25 minutes",
        });
      }

      if (!result.access_token) {
        this.logger.error("❌ Access token non généré");
        throw new BadRequestException("Access token non généré");
      }

      const cookieOptions = this.getCookieOptions(req);

      if (result.refresh_token) {
        res.cookie("refresh_token", result.refresh_token, {
          ...cookieOptions,
          maxAge: AuthConstants.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000,
        });
        this.logger.log("✅ Refresh token cookie mis à jour");
      }

      res.cookie("access_token", result.access_token, {
        ...cookieOptions,
        httpOnly: false,
        maxAge: AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS * 1000,
      });

      this.logger.log("✅ Tokens rafraîchis avec succès");

      return res.json({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        message: "Tokens rafraîchis avec succès",
        expiresIn: AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS,
      });

    } catch (error: any) {
      this.logger.error(`❌ Erreur rafraîchissement: ${error.message}`);
      this.clearAuthCookies(res);

      let errorMessage = "Session expirée - veuillez vous reconnecter";
      let statusCode = 401;

      if (error instanceof BadRequestException) {
        errorMessage = error.message;
        statusCode = 400;
      }

      return res.status(statusCode).json({
        message: errorMessage,
        loggedOut: true,
        requiresReauth: true,
      });
    }
  }

  @Post("register")
@ApiOperation({ summary: "Inscription utilisateur" })
@ApiResponse({ status: 201, description: "Utilisateur créé" })
@ApiResponse({ status: 400, description: "Données invalides" })
async register(@Body() registerDto: RegisterDto, @Res() res: Response) {
  const maskedEmail = this.maskEmail(registerDto.email);
  this.logger.log(`📝 Tentative d'inscription pour: ${maskedEmail}`);

  try {
    const result = await this.authService.register(registerDto);
    const cookieOptions = this.getCookieOptions();

    res.cookie("refresh_token", result.refresh_token, {
      ...cookieOptions,
      maxAge: AuthConstants.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000,
    });

    res.cookie("access_token", result.access_token, {
      ...cookieOptions,
      httpOnly: false,
      maxAge: AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS * 1000,
    });

    this.logger.log(`✅ Inscription réussie pour: ${maskedEmail}`);

    return res.status(201).json({
      access_token: result.access_token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        isAdmin: result.user.role === UserRole.ADMIN,
        isActive: result.user.isActive,
      },
      message: "Inscription réussie",
    });

  } catch (error: any) {
    // ✅ Log plus précis
    this.logger.error(`❌ Erreur inscription pour ${maskedEmail}: ${error.message}`);
    
    // ✅ Propager l'erreur telle quelle (elle contient déjà le bon message)
    if (error instanceof BadRequestException) {
      throw error;
    }

    // ✅ Message d'erreur générique seulement si nécessaire
    throw new BadRequestException(
      error.message || "Une erreur est survenue lors de l'inscription"
    );
  }
}

// Dans auth.controller.ts - POST logout
@Post("logout")
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: "Déconnexion" })
async logout(@Request() req: any, @Res() res: Response) {
  // ✅ Standardiser sur 'sub' pour l'ID utilisateur
  const userId = req.user?.sub;
  const token = req.headers.authorization?.split(" ")[1] || 
                req.cookies?.access_token || "";

  this.logger.log(`🚪 Déconnexion pour l'utilisateur ID: ${this.maskUserId(userId)}`);

  if (userId && token) {
    // ✅ Utiliser la même raison partout
    await this.authService.logoutWithSessionDeletion(userId, token);
  }

  this.clearAuthCookies(res);

  this.logger.log(`✅ Déconnexion réussie pour l'utilisateur ID: ${this.maskUserId(userId)}`);

  return res.json({ 
    message: "Déconnexion réussie",
    timestamp: new Date().toISOString()
  });
}


  // CORRECTION : Ajouter la réponse manquante
@Post("logout-all")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiOperation({ summary: "Déconnexion de tous les utilisateurs non-admin" })
async logoutAll(@Request() req: any, @Res() res: Response) {
  const currentAdmin = req.user;
  this.logger.log(`🛡️ Admin initie une déconnexion globale: ${this.maskEmail(currentAdmin.email)}`);

  try {
    const result = await this.authService.logoutAll();

    this.logger.log(`✅ Déconnexion globale réussie: ${result.stats.usersLoggedOut} utilisateurs déconnectés`);

    // ✅ CORRECTION : Retourner la structure attendue par le frontend
    return res.json({
      success: result.success,
      message: result.message,
      stats: {
        usersLoggedOut: result.stats.usersLoggedOut,
        adminPreserved: result.stats.adminPreserved,
        duration: result.stats.duration || "24h",
        timestamp: result.stats.timestamp || new Date().toISOString(),
        userEmails: result.stats.userEmails || []
      },
    });
  } catch (error: any) {
    this.logger.error(`❌ Erreur déconnexion globale: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la déconnexion globale",
    });
  }
}

  // ==================== 👤 ENDPOINTS PROFIL UTILISATEUR ====================

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Récupérer le profil utilisateur" })
  async getProfile(@Request() req: any) {
    // ✅ Standardiser sur 'sub' pour l'ID utilisateur
    const userId = req.user?.sub;

    if (!userId) {
      this.logger.error("❌ ID utilisateur manquant dans la requête");
      throw new BadRequestException("ID utilisateur manquant dans le token");
    }

    this.logger.log(`📋 Récupération du profil pour l'utilisateur ID: ${this.maskUserId(userId)}`);

    try {
      const user = await this.authService.getProfile(userId);

      this.logger.log(`✅ Profil récupéré avec succès pour: ${this.maskEmail(user.email)}`);

      return {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isAdmin: user.role === UserRole.ADMIN,
        telephone: user.telephone,
        isActive: user.isActive,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur récupération profil pour ID ${this.maskUserId(userId)}: ${error.message}`);
      throw error;
    }
  }

  @Post("update-password")
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: "Mettre à jour le mot de passe" })
async updatePassword(
  @Request() req: any,
  @Body()
  body: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  },
) {
  const userId = req.user?.sub;
  const maskedId = this.maskUserId(userId);

  this.logger.log(`🔑 Mise à jour mot de passe pour l'utilisateur ID: ${maskedId}`);

  // ✅ Validation améliorée
  if (!body.currentPassword || body.currentPassword.trim() === '') {
    throw new BadRequestException("Le mot de passe actuel est requis");
  }

  if (body.newPassword !== body.confirmNewPassword) {
    this.logger.warn("❌ Les mots de passe ne correspondent pas");
    throw new BadRequestException("Les mots de passe ne correspondent pas");
  }

  // ✅ Validation de la force du mot de passe
  if (body.newPassword.length < 8) {
    throw new BadRequestException("Le mot de passe doit contenir au moins 8 caractères");
  }

  try {
    await this.usersService.updatePassword(userId, {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmNewPassword: body.confirmNewPassword,
    });

    this.logger.log(`✅ Mot de passe mis à jour avec succès pour l'utilisateur ID: ${maskedId}`);

    return { 
      success: true,
      message: "Mot de passe mis à jour avec succès",
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    this.logger.error(`❌ Erreur mise à jour mot de passe: ${error.message}`);
    
    // ✅ Messages d'erreur plus clairs
    if (error.message.includes('mot de passe actuel incorrect')) {
      throw new BadRequestException("Le mot de passe actuel est incorrect");
    }
    
    if (error.message.includes('Configuration du compte invalide')) {
      throw new BadRequestException(
        "Problème technique avec votre compte. Contactez l'administrateur."
      );
    }
    
    throw error;
  }
}

  @Post("forgot-password")
  @ApiOperation({ summary: "Demande de réinitialisation de mot de passe" })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    this.logger.log(`📧 Demande de réinitialisation pour: ${this.maskEmail(forgotPasswordDto.email)}`);

    await this.authService.sendPasswordResetEmail(forgotPasswordDto.email);

    this.logger.log(`✅ Email de réinitialisation envoyé à: ${this.maskEmail(forgotPasswordDto.email)}`);

    return {
      message: "Si votre email est enregistré, vous recevrez un lien de réinitialisation",
    };
  }

  @Post("reset-password")
  @ApiOperation({ summary: "Réinitialiser le mot de passe" })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    this.logger.log("🔄 Réinitialisation du mot de passe");

    await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );

    this.logger.log("✅ Mot de passe réinitialisé avec succès");

    return { message: "Mot de passe réinitialisé avec succès" };
  }

  // ==================== 🔧 MÉTHODES UTILITAIRES PRIVÉES ====================

  private clearAuthCookies(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const cookieOptions: any = {
      httpOnly: true,
      path: '/',
    };

    if (isProduction) {
      cookieOptions.secure = true;
      cookieOptions.sameSite = 'none';
    } else {
      cookieOptions.secure = true;
      cookieOptions.sameSite = 'none';
    }

    res.clearCookie("refresh_token", cookieOptions);
    res.clearCookie("access_token", { 
      ...cookieOptions, 
      httpOnly: false 
    });

    this.logger.log("🍪 Cookies d'authentification nettoyés");
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

  private maskUserId(userId: string): string {
    if (!userId) return 'user_***';
    if (userId.length <= 8) return userId;
    return `${userId.substring(0, 4)}***${userId.substring(userId.length - 4)}`;
  }
}