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
import { UserRole } from "../enums/user-role.enum";
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

  private getCookieOptions(): any {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    };
  }

  @Post("login")
  @UseGuards(ThrottleGuard, LocalAuthGuard)
  @ApiOperation({ summary: "Connexion utilisateur" })
  @ApiResponse({ status: 200, description: "Connexion réussie" })
  @ApiResponse({ status: 401, description: "Identifiants invalides" })
  async login(@Body() _loginDto: LoginDto, @Request() req: { user: any }, @Res() res: Response) {
    if (!req.user) {
      return res.status(401).json({
        message: "Email ou mot de passe incorrect",
        code: "INVALID_CREDENTIALS",
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await this.authService.login(req.user);
    
    const cookieOptions = this.getCookieOptions();

    res.cookie("refresh_token", result.refresh_token, {
      ...cookieOptions,
      maxAge: AuthConstants.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000, // 30 minutes
    });

    res.cookie("access_token", result.access_token, {
      ...cookieOptions,
      maxAge: AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS * 1000, // 15 minutes
    });

   return res.json({
    access_token: result.access_token,
    user: {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      telephone: result.user.telephone,
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
    const refresh_token = req.cookies?.refresh_token || body?.refresh_token;

    if (!refresh_token) {
      this.clearAuthCookies(res);
      return res.status(401).json({
        message: "Refresh token manquant",
        loggedOut: true,
      });
    }

    try {
      const result = await this.authService.refresh(refresh_token);

      if (result.sessionExpired) {
        this.clearAuthCookies(res);
        return res.status(401).json({
          loggedOut: true,
          sessionExpired: true,
          message: "Session expirée après 30 minutes",
        });
      }

      if (!result.access_token) {
        throw new BadRequestException("Access token non généré");
      }

      const cookieOptions = this.getCookieOptions();

      if (result.refresh_token) {
        res.cookie("refresh_token", result.refresh_token, {
          ...cookieOptions,
          maxAge: AuthConstants.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000, // 30 minutes
        });
      }

      res.cookie("access_token", result.access_token, {
        ...cookieOptions,
        maxAge: AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS * 1000, // 15 minutes
      });

      return res.json({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        message: "Tokens rafraîchis avec succès",
        expiresIn: AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS,
      });

    } catch (error: any) {
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
    try {
      const result = await this.authService.register(registerDto);
      const cookieOptions = this.getCookieOptions();

      res.cookie("refresh_token", result.refresh_token, {
        ...cookieOptions,
        maxAge: AuthConstants.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000, // 30 minutes
      });

      res.cookie("access_token", result.access_token, {
        ...cookieOptions,
        maxAge: AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS * 1000, // 15 minutes
      });

     return res.status(201).json({
      access_token: result.access_token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        telephone: result.user.telephone,
        role: result.user.role,
        isAdmin: result.user.role === UserRole.ADMIN,
        isActive: result.user.isActive,
      },
      message: "Inscription réussie",
    });

    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        error.message || "Une erreur est survenue lors de l'inscription"
      );
    }
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Déconnexion" })
  async logout(@Request() req: any, @Res() res: Response) {
    const userId = req.user?.id;
    const token = req.headers.authorization?.split(" ")[1] || 
                  req.cookies?.access_token || "";

    if (userId && token) {
      await this.authService.logoutWithSessionDeletion(userId, token);
    }

    this.clearAuthCookies(res);

    return res.json({ 
      message: "Déconnexion réussie",
      timestamp: new Date().toISOString()
    });
  }

  @Post("logout-all")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Déconnexion de tous les utilisateurs non-admin" })
  async logoutAll(@Request() _req: any, @Res() res: Response) {
    try {
      const result = await this.authService.logoutAll();

      return res.json({
        success: result.success,
        message: result.message,
        stats: {
          usersLoggedOut: result.stats.usersLoggedOut,
          adminPreserved: result.stats.adminPreserved,
          adminEmail: result.stats.adminEmail,
          duration: result.stats.duration || "30 minutes",
          timestamp: result.stats.timestamp || new Date().toISOString(),
          userEmails: result.stats.userEmails || []
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la déconnexion globale",
      });
    }
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Récupérer le profil utilisateur" })
  async getProfile(@Request() req: any) {
    const userId = req.user?.id;

    if (!userId) {
      this.logger.warn('ID utilisateur manquant dans le token');
      throw new BadRequestException("ID utilisateur manquant");
    }

    try {
      const user = await this.authService.getProfile(userId);

      return {
        id: user.id || userId, 
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isAdmin: user.role === UserRole.ADMIN,
        telephone: user.telephone,
        isActive: user.isActive,
      };
    } catch (error: any) {
      this.logger.error(`Erreur récupération profil: ${this.maskUserId(userId)}`);
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
    const userId = req.user?.id; 

    if (!body.currentPassword || body.currentPassword.trim() === '') {
      throw new BadRequestException("Le mot de passe actuel est requis");
    }

    if (body.newPassword !== body.confirmNewPassword) {
      throw new BadRequestException("Les mots de passe ne correspondent pas");
    }

    if (body.newPassword.length < 8) {
      throw new BadRequestException("Le mot de passe doit contenir au moins 8 caractères");
    }

    try {
      await this.usersService.updatePassword(userId, {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        confirmNewPassword: body.confirmNewPassword,
      });

      return { 
        success: true,
        message: "Mot de passe mis à jour avec succès",
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
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
    await this.authService.sendPasswordResetEmail(forgotPasswordDto.email);

    return {
      message: "Si votre email est enregistré, vous recevrez un lien de réinitialisation",
    };
  }

  @Post("reset-password")
  @ApiOperation({ summary: "Réinitialiser le mot de passe" })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );

    return { message: "Mot de passe réinitialisé avec succès" };
  }

  private clearAuthCookies(res: Response): void {
    const cookieOptions: any = {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    };

    res.clearCookie("refresh_token", cookieOptions);
    res.clearCookie("access_token", cookieOptions);
  }

  private maskUserId(userId: string): string {
    if (!userId || typeof userId !== 'string' || userId.length <= 6) return 'user_***';
    return `user_${userId.substring(0, 3)}***${userId.substring(userId.length - 3)}`;
  }
}