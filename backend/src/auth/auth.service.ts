import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import * as bcrypt from 'bcryptjs';
import * as crypto from "crypto";
import { Model, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { MailService } from "../mail/mail.service";
import { ResetToken } from "../schemas/reset-token.schema";
import { Session } from "../schemas/session.schema";
import { User, UserRole } from "../schemas/user.schema";
import { UsersService } from "../users/users.service";
import { RegisterDto } from "./dto/register.dto";
import { RevokedTokenService } from "./revoked-token.service";
import { RefreshTokenService } from "./refresh-token.service";
import { SessionService } from "./session.service";
import { AuthConstants } from "./auth.constants";
import { isValidObjectId } from "mongoose";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly loginAttempts = new Map<
    string,
    {
      attempts: number;
      lastAttempt: Date;
      ttl: Date;
    }
  >();
  private readonly MAX_CACHE_SIZE = 1000;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly mailService: MailService,
    private readonly revokedTokenService: RevokedTokenService,
    private readonly refreshTokenService: RefreshTokenService,
    @InjectModel(ResetToken.name)
    private readonly resetTokenModel: Model<ResetToken>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<Session>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  private convertObjectIdToString(id: any): string {
  if (!id) {
    throw new Error("ID utilisateur manquant");
  }

  if (id instanceof Types.ObjectId) {
    return id.toString();
  }

  if (typeof id === "string") {
    // SOLUTION : Utiliser isValidObjectId de mongoose
    if (isValidObjectId(id)) {
      return id;
    }
    throw new Error(`Format ID string invalide.`);
  }

  const stringId = String(id);
  // SOLUTION : Utiliser isValidObjectId de mongoose
  if (isValidObjectId(stringId)) {
    return stringId;
  }

  throw new Error(`Impossible de convertir l'ID.`);
}

  // Gestion des tentatives de connexion
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
    current.ttl = new Date(
      Date.now() + AuthConstants.LOGIN_ATTEMPTS_TTL_MINUTES * 60 * 1000,
    );

    // Limiter la taille du cache
    if (this.loginAttempts.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.loginAttempts.entries())
        .sort((a, b) => a[1].ttl.getTime() - b[1].ttl.getTime())[0]?.[0];
      if (oldestKey) {
        this.loginAttempts.delete(oldestKey);
      }
    }

    this.loginAttempts.set(email, current);
    this.logger.warn(
      `Tentative de connexion échouée pour ${this.maskEmail(email)}. Tentatives: ${current.attempts}`,
    );
  }

  private cleanupExpiredAttempts(): void {
    const now = new Date();
    for (const [email, data] of this.loginAttempts.entries()) {
      if (data.ttl < now) {
        this.loginAttempts.delete(email);
      }
    }
  }

  private resetLoginAttempts(email: string): void {
    this.loginAttempts.delete(email);
    this.logger.log(`Réinitialisation des tentatives pour ${this.maskEmail(email)}`);
  }

async register(registerDto: RegisterDto) {
  try {
    const existingAdmin = await this.usersService.findByRole(UserRole.ADMIN);
    if (existingAdmin) {
      registerDto.role = UserRole.USER;
    } else {
      registerDto.role = UserRole.ADMIN;
    }

    // ✅ Le service users gère maintenant toutes les validations
    const newUser = await this.usersService.create(registerDto);
    const userId = this.convertObjectIdToString(newUser._id);

    const jtiAccess = uuidv4();
    const jtiRefresh = uuidv4();

    // Access Token
    const access_token = this.jwtService.sign(
      {
        sub: userId,
        email: newUser.email,
        role: newUser.role,
        jti: jtiAccess,
        tokenType: "access",
      },
      {
        expiresIn: AuthConstants.JWT_EXPIRATION,
      },
    );

    // Refresh Token
    const refresh_token = this.jwtService.sign(
      {
        sub: userId,
        email: newUser.email,
        role: newUser.role,
        jti: jtiRefresh,
        tokenType: "refresh",
      },
      {
        expiresIn: AuthConstants.REFRESH_TOKEN_EXPIRATION,
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );

    // Créer session avec durée synchronisée
    await this.sessionService.create(
      userId,
      access_token,
      new Date(Date.now() + AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS * 1000),
    );

    await this.refreshTokenService.deactivateAllForUser(userId);
    const decodedRefresh = this.jwtService.decode(refresh_token) as any;
    const refreshExp = new Date(
      (decodedRefresh?.exp || 0) * 1000 || Date.now() + AuthConstants.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000,
    );
    await this.refreshTokenService.create(userId, refresh_token, refreshExp);

    // Email de bienvenue
    try {
      await this.mailService.sendWelcomeEmail(
        newUser.email,
        newUser.firstName,
      );
    } catch (emailError) {
      this.logger.warn(`Échec envoi email bienvenue: ${emailError.message}`);
    }

    this.logger.log(`Nouvel utilisateur enregistré: ${this.maskEmail(newUser.email)}`);

    return {
      access_token,
      refresh_token,
      user: {
        id: userId,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isAdmin: newUser.role === UserRole.ADMIN,
        isActive: newUser.isActive,
      },
    };

  } catch (error) {
    // ✅ Log plus détaillé
    this.logger.error(`Erreur lors de l'enregistrement: ${error.message}`, error.stack);
    
    // ✅ Propager l'erreur telle quelle (elle contient déjà le bon message)
    throw error;
  }
}
  async login(user: User) {
    const jtiAccess = uuidv4();
    const jtiRefresh = uuidv4();

    const userId = this.convertObjectIdToString(user._id);

    const accessPayload = {
      sub: userId,
      email: user.email,
      role: user.role,
      jti: jtiAccess,
      tokenType: "access",
    };

    const refreshPayload = {
      sub: userId,
      email: user.email,
      role: user.role,
      jti: jtiRefresh,
      tokenType: "refresh",
    };

    const access_token = this.jwtService.sign(accessPayload, {
      expiresIn: AuthConstants.JWT_EXPIRATION,
    });

    const refresh_token = this.jwtService.sign(refreshPayload, {
      expiresIn: AuthConstants.REFRESH_TOKEN_EXPIRATION,
      secret: process.env.JWT_REFRESH_SECRET,
    });

    // ✅ Créer session avec durée synchronisée
    await this.sessionService.create(
      userId,
      access_token,
      new Date(Date.now() + AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS * 1000),
    );

    // Whitelist refresh token
    try {
      await this.refreshTokenService.deactivateAllForUser(userId);
      const decodedRefresh = this.jwtService.decode(refresh_token) as any;
      const refreshExp = new Date(
        (decodedRefresh?.exp || 0) * 1000 ||
          Date.now() + AuthConstants.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000,
      );
      await this.refreshTokenService.create(userId, refresh_token, refreshExp);
    } catch (error) {
      this.logger.warn(
        `Impossible d'enregistrer le refresh token: ${error.message}`,
      );
    }

    return {
      access_token,
      refresh_token,
      user: {
        id: userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async refresh(refresh_token: string): Promise<{
    access_token: string;
    refresh_token?: string;
    sessionExpired?: boolean;
  }> {
    if (!refresh_token) {
      throw new UnauthorizedException("Refresh token manquant");
    }

    try {
      const isWhitelisted = await this.refreshTokenService.isValid(refresh_token);
      if (!isWhitelisted) {
        throw new UnauthorizedException("Refresh token non autorisé");
      }

      const payload = this.jwtService.verify(refresh_token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException("Utilisateur non trouvé");
      }

      const userId = this.convertObjectIdToString(user._id);

      const jtiAccess = uuidv4();
      const jtiRefresh = uuidv4();

      const new_access_token = this.jwtService.sign(
        {
          sub: userId,
          email: user.email,
          role: user.role,
          jti: jtiAccess,
          tokenType: "access",
        },
        {
          expiresIn: AuthConstants.JWT_EXPIRATION,
        },
      );

      const new_refresh_token = this.jwtService.sign(
        {
          sub: userId,
          email: user.email,
          role: user.role,
          jti: jtiRefresh,
          tokenType: "refresh",
        },
        {
          expiresIn: AuthConstants.REFRESH_TOKEN_EXPIRATION,
          secret: process.env.JWT_REFRESH_SECRET,
        },
      );

      // ✅ Créer session avec durée synchronisée
      await this.sessionService.create(
        userId,
        new_access_token,
        new Date(Date.now() + AuthConstants.ACCESS_TOKEN_EXPIRATION_SECONDS * 1000),
      );

      const decodedNewRefresh = this.jwtService.decode(new_refresh_token) as any;
      const newExp = new Date(
        (decodedNewRefresh?.exp || 0) * 1000 || Date.now() + AuthConstants.REFRESH_TOKEN_EXPIRATION_SECONDS * 1000,
      );
      await this.refreshTokenService.create(userId, new_refresh_token, newExp);

      await this.refreshTokenService.deactivateByToken(refresh_token);

      this.logger.log(`✅ Tokens rafraîchis pour l'utilisateur ${this.maskUserId(userId)}`);

      return {
        access_token: new_access_token,
        refresh_token: new_refresh_token,
      };
    } catch (error: any) {
      this.logger.error(`❌ Erreur refresh token: ${error.message}`);

      if (
        error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError"
      ) {
        try {
          await this.refreshTokenService.deactivateByToken(refresh_token);
        } catch (deactivateError) {
          this.logger.warn(
            `Impossible de désactiver le refresh token invalide: ${deactivateError.message}`,
          );
        }
      }

      throw new UnauthorizedException("Refresh token invalide");
    }
  }

 

async logoutAll(): Promise<{
  success: boolean;
  message: string;
  stats: {
    usersLoggedOut: number;
    adminPreserved: boolean;
    duration: string;
    timestamp: string;
    userEmails: string[];
  };
}> {
  const startTime = Date.now();
  
  try {
    this.logger.log("🚀 Début déconnexion temporaire (24h) des utilisateurs NON-ADMIN");

    // 🔐 VÉRIFICATION DE SÉCURITÉ : S'assurer qu'au moins un admin reste actif
    const activeAdmins = await this.userModel.countDocuments({
      role: UserRole.ADMIN,
      isActive: true
    }).exec();

    if (activeAdmins === 0) {
      this.logger.error("❌ Bloqué : Aucun administrateur actif trouvé");
      throw new BadRequestException(
        "Opération bloquée : Aucun administrateur actif dans le système"
      );
    }

    // 📊 Récupérer les utilisateurs non-admin actifs
    const activeNonAdminUsers = await this.userModel
      .find({
        role: { $ne: UserRole.ADMIN },
        isActive: true,
      })
      .select('_id email firstName lastName')
      .lean()
      .exec();

    this.logger.log(`📊 ${activeNonAdminUsers.length} utilisateurs non-admin actifs trouvés`);

    if (activeNonAdminUsers.length === 0) {
      return {
        success: true,
        message: "Aucun utilisateur non-admin à déconnecter",
        stats: {
          usersLoggedOut: 0,
          adminPreserved: true,
          duration: "24h",
          timestamp: new Date().toISOString(),
          userEmails: []
        }
      };
    }

    const userIds = activeNonAdminUsers.map(user => user._id.toString());
    const userObjectIds = activeNonAdminUsers.map(user => user._id);
    const userEmails = activeNonAdminUsers.map(user => this.maskEmail(user.email));

    // ⏱️ Calculer la date d'expiration (24 heures)
    const logoutUntilDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 🔄 MISE À JOUR ATOMIQUE EN PARALLÈLE
    await Promise.all([
      // 1. Bloquer les utilisateurs pour 24h (NE PAS désactiver isActive)
      this.userModel.updateMany(
        { _id: { $in: userObjectIds } },
        {
          $set: {
            logoutUntil: logoutUntilDate,
            lastLogout: new Date(),
          }
        }
      ).exec(),

      // 2. Désactiver toutes leurs sessions actives
      this.sessionModel.updateMany(
        { user: { $in: userIds }, isActive: true },
        {
          isActive: false,
          deactivatedAt: new Date(),
          revocationReason: "admin global logout 24h"
        }
      ).exec(),

      // 3. Désactiver tous leurs refresh tokens
      this.refreshTokenService.deactivateByUserIds(userIds),

      // 4. Supprimer leurs tokens de reset
      this.resetTokenModel.deleteMany({ user: { $in: userObjectIds } }).exec(),
    ]);

    // 📈 Nettoyer le cache des utilisateurs
    await this.usersService.clearAllCache();

    // 📊 Calcul des métriques
    const executionTime = Date.now() - startTime;

    this.logger.log(`✅ DÉCONNEXION GLOBALE RÉUSSIE : ${activeNonAdminUsers.length} utilisateurs déconnectés pour 24h`);

    // 🎯 Log détaillé pour audit
    activeNonAdminUsers.forEach(user => {
      this.logger.debug(`🔒 Utilisateur déconnecté`, {
        userId: this.maskUserId(user._id.toString()),
        email: this.maskEmail(user.email),
        name: `${user.firstName} ${user.lastName}`,
        logoutUntil: logoutUntilDate.toLocaleString('fr-FR'),
      });
    });

    return {
      success: true,
      message: `${activeNonAdminUsers.length} utilisateurs non-admin déconnectés avec succès pour 24 heures`,
      stats: {
        usersLoggedOut: activeNonAdminUsers.length,
        adminPreserved: true,
        duration: "24 heures",
        timestamp: new Date().toISOString(),
        userEmails,
      }
    };

  } catch (error) {
    this.logger.error(`❌ ÉCHEC déconnexion globale`, {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    if (error instanceof BadRequestException) {
      throw error;
    }

    throw new BadRequestException(
      `Échec de la déconnexion globale: ${error.message || 'Erreur technique'}`
    );
  }
}

  async revokeToken(token: string, expiresAt: Date): Promise<void> {
    try {
      await this.revokedTokenService.revokeToken(token, expiresAt);
      this.logger.log(`Token révoqué: ${this.maskToken(token)}`);
    } catch (error) {
      if (error?.code === 11000) {
        this.logger.warn("Token déjà révoqué");
        return;
      }
      this.logger.error(`Erreur de révocation du token: ${error.message}`);
      throw error;
    }
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    return await this.revokedTokenService.isTokenRevoked(token);
  }

  async revokeAllTokens(): Promise<{
    message: string;
    revokedCount: number;
    sessionsCleared: number;
  }> {
    const tokensResult = await this.revokedTokenService.revokeAllTokens();
    
    // ✅ Désactiver plutôt que supprimer les sessions
    await this.sessionModel.updateMany(
      { isActive: true },
      { 
        isActive: false, 
        deactivatedAt: new Date(),
        revocationReason: "admin_revoke_all"
      },
    );

    const activeSessionsCount = await this.sessionModel.countDocuments({ isActive: true });

    return {
      message: "Tokens révoqués et sessions désactivées",
      revokedCount: tokensResult.revokedCount,
      sessionsCleared: activeSessionsCount,
    };
  }

  async logoutWithSessionDeletion(
    userId: string,
    token: string,
  ): Promise<void> {
    try {
      // ✅ Désactiver la session plutôt que la supprimer
      await this.sessionModel.updateOne(
        { token, user: userId },
        { 
          isActive: false, 
          deactivatedAt: new Date(),
          revocationReason: "user_logout"
        },
      );
      
      try {
        const decoded = this.jwtService.decode(token) as any;
        if (decoded && decoded.exp) {
          await this.revokeToken(token, new Date(decoded.exp * 1000));
        }
      } catch (error) {
        this.logger.warn(`Erreur lors de la révocation du token: ${error.message}`);
      }
      
      this.loginAttempts.delete(userId);
      this.logger.log(`Déconnexion avec désactivation de session pour l'utilisateur ${this.maskUserId(userId)}`);
    } catch (error) {
      this.logger.error(`Erreur lors de la déconnexion: ${error.message}`);
      throw error;
    }
  }
  async validateUser(email: string, password: string): Promise<User | null> {
  try {
    const attempts = this.getLoginAttempts(email);

    // Vérifier les tentatives de connexion
    if (attempts.attempts >= AuthConstants.MAX_LOGIN_ATTEMPTS) {
      const timeSinceLastAttempt =
        (Date.now() - attempts.lastAttempt.getTime()) / (1000 * 60);
      if (timeSinceLastAttempt < AuthConstants.LOGIN_ATTEMPTS_TTL_MINUTES) {
        throw new UnauthorizedException(
          `Trop de tentatives. Réessayez dans ${Math.ceil(
            AuthConstants.LOGIN_ATTEMPTS_TTL_MINUTES - timeSinceLastAttempt,
          )} minutes`,
        );
      } else {
        this.resetLoginAttempts(email);
      }
    }

    // ✅ LOGS DE DÉBUGAGE AJOUTÉS
    this.logger.debug(`[DEBUG] validateUser appelé pour: ${this.maskEmail(email)}`);
    this.logger.debug(`[DEBUG] Password fourni: ${!!password}, Longueur: ${password?.length || 0}`);

    // ✅ CORRECTION CRITIQUE: Toujours inclure .select('+password')
    const user = await this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .exec();
    
    if (!user) {
      this.logger.warn(`Utilisateur non trouvé: ${this.maskEmail(email)}`);
      this.incrementLoginAttempts(email);
      return null;
    }

    // ✅ LOGS DÉTAILLÉS
    this.logger.debug(`[DEBUG] Utilisateur trouvé: ${this.maskEmail(email)}`);
    this.logger.debug(`[DEBUG] User ID: ${user._id}`);
    this.logger.debug(`[DEBUG] User role: ${user.role}`);
    this.logger.debug(`[DEBUG] User isActive: ${user.isActive}`);
    this.logger.debug(`[DEBUG] User password présent: ${!!user.password}`);
    this.logger.debug(`[DEBUG] User password longueur: ${user.password?.length || 0}`);
    
    // ✅ VÉRIFIER QUE LE MOT DE PASSE EST DÉFINI DANS LA BASE
    if (!user.password || user.password.trim() === '') {
      this.logger.error(`❌ CRITICAL: User ${this.maskEmail(email)} has no password in database`);
      
      // CORRECTION: Si c'est un utilisateur existant sans mot de passe
      // (peut arriver si créé par admin ou importé)
      if (user.role === UserRole.ADMIN) {
        // Pour les admins, autoriser à créer un mot de passe
        this.logger.warn(`Admin ${this.maskEmail(email)} n'a pas de mot de passe - réinitialisation requise`);
        throw new UnauthorizedException(
          AuthConstants.ERROR_MESSAGES.PASSWORD_RESET_REQUIRED,
          {
            description: "PASSWORD_RESET_REQUIRED",
            cause: "NO_PASSWORD_IN_DB"
          }
        );
      } else {
        // Pour les utilisateurs normaux, c'est une erreur
        this.incrementLoginAttempts(email);
        return null;
      }
    }

    // ✅ VÉRIFIER QUE LE MOT DE PASSE FOURNI N'EST PAS VIDE
    if (!password || password.trim() === '') {
      this.logger.warn(`Mot de passe vide fourni pour: ${this.maskEmail(email)}`);
      this.incrementLoginAttempts(email);
      return null;
    }

    // ✅ COMPARER LES MOTS DE PASSE
    let isPasswordValid = false;
    try {
      this.logger.debug(`[DEBUG] Début comparaison bcrypt pour: ${this.maskEmail(email)}`);
      
      // Nettoyer les espaces
      const cleanPassword = password.trim();
      
      // Vérifier que les deux paramètres sont valides
      if (!user.password || !cleanPassword) {
        this.logger.error(`Arguments manquants pour bcrypt.compare`);
        throw new Error('Arguments manquants pour la comparaison');
      }
      
      // Log partiel pour débogage (ne pas logger le mot de passe complet)
      this.logger.debug(`[DEBUG] Hash bcrypt: ${user.password.substring(0, 10)}...`);
      
      isPasswordValid = await bcrypt.compare(cleanPassword, user.password);
      
      this.logger.debug(`[DEBUG] Résultat bcrypt.compare: ${isPasswordValid}`);
      
    } catch (bcryptError) {
      this.logger.error(`❌ Erreur bcrypt.compare pour ${this.maskEmail(email)}: ${bcryptError.message}`);
      
      if (bcryptError.message.includes('data and hash arguments required')) {
        this.logger.error(`❌ BCrypt arguments manquants - user.password: ${!!user.password}, password: ${!!password}`);
      }
      
      this.incrementLoginAttempts(email);
      return null;
    }

    if (!isPasswordValid) {
      this.logger.warn(`Mot de passe incorrect pour: ${this.maskEmail(email)}`);
      this.incrementLoginAttempts(email);
      return null;
    }

    // ✅ VÉRIFIER L'ACCÈS UTILISATEUR
    const userId = this.convertObjectIdToString(user._id);
    const accessCheck = await this.usersService.checkUserAccess(userId);
    
    if (!accessCheck.canAccess) {
      this.logger.warn(`Accès refusé pour ${this.maskEmail(email)}: ${accessCheck.reason}`);
      
      if (accessCheck.reason?.includes('Compte désactivé')) {
        throw new UnauthorizedException(AuthConstants.ERROR_MESSAGES.COMPTE_DESACTIVE);
      } else if (accessCheck.reason?.includes('Déconnecté temporairement')) {
        // Extraire les heures restantes si disponibles
        const remainingHours = accessCheck.details?.remainingHours || 24;
        throw new UnauthorizedException(
          `${AuthConstants.ERROR_MESSAGES.COMPTE_TEMPORAIREMENT_DECONNECTE}:${remainingHours}`
        );
      } else if (accessCheck.reason?.includes('Mode maintenance')) {
        throw new UnauthorizedException(AuthConstants.ERROR_MESSAGES.MAINTENANCE_MODE);
      } else {
        throw new UnauthorizedException(accessCheck.reason || "Accès refusé");
      }
    }

    // ✅ RÉINITIALISER LES TENTATIVES EN CAS DE SUCCÈS
    this.resetLoginAttempts(email);
    
    // ✅ Retourner l'utilisateur SANS le mot de passe
    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;
    
    this.logger.log(`✅ Connexion réussie pour: ${this.maskEmail(email)}`);
    return userWithoutPassword;

  } catch (error) {
    // ✅ PROPAGER LES EXCEPTIONS DE BLOCAGE (compte désactivé, maintenance, etc.)
    if (error instanceof UnauthorizedException) {
      this.logger.log(`Blocage connexion pour ${this.maskEmail(email)}: ${error.message}`);
      throw error;
    }
    
    // ✅ LOG DES ERREURS INATTENDUES
    this.logger.error(
      `❌ Erreur inattendue validateUser ${this.maskEmail(email)}: ${error.message}`,
      error.stack
    );
    
    // Pour les autres erreurs, retourner null (pas d'utilisateur)
    return null;
  }
}

  async validateToken(token: string): Promise<boolean> {
    try {
      const payload = this.jwtService.verify(token);
      const [isRevoked, isActive] = await Promise.all([
        this.isTokenRevoked(token),
        this.sessionService.isTokenActive(token),
      ]);
      const userExists = await this.usersService.exists(payload.sub);
      return !isRevoked && isActive && userExists;
    } catch (error) {
      this.logger.warn(`Token invalide: ${error.message}`);
      return false;
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      const resetToken = await (this.resetTokenModel as any).findOne({
        token,
        expiresAt: { $gt: new Date() },
      });

      if (!resetToken) {
        throw new UnauthorizedException("Token invalide ou expiré");
      }

      const user = await this.usersService.findById(resetToken.user.toString());
      if (!user) {
        throw new NotFoundException("Utilisateur non trouvé");
      }

      const userId = this.convertObjectIdToString(user._id);
      await this.usersService.resetPassword(userId, newPassword);

      await this.resetTokenModel.deleteOne({ _id: resetToken._id });
      this.logger.log(`Mot de passe réinitialisé pour ${this.maskEmail(user.email)}`);
    } catch (error) {
      this.logger.error(`Erreur de réinitialisation: ${error.message}`);
      throw error;
    }
  }

  private getFrontendUrl(): string {
    let url = process.env.FRONTEND_URL;
    const nodeEnv = process.env.NODE_ENV || "development";

    if (url && url.includes(",")) {
      this.logger.warn("⚠️ URL frontend malformée détectée, nettoyage en cours");
      url = url.split(",")[0].trim();
    }

    if (!url) {
      url = nodeEnv === "production"
        ? "https://panameconsulting.com"
        : "https://panbameconsulting.vercel.app";
    }

    return url.replace(/\/$/, "");
  }

  private buildResetUrl(token: string): string {
    const baseUrl = this.getFrontendUrl();

    this.logger.log(`🔧 URL frontend nettoyée: ${baseUrl}`);

    if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
      throw new Error(
        `URL frontend invalide: "${baseUrl}" - doit commencer par http:// ou https://`,
      );
    }

    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    this.logger.log(`🔧 URL de reset finale résolue: ${resetUrl.substring(0, 50)}...`);

    return resetUrl;
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        this.logger.warn(`Demande de réinitialisation pour un email inexistant: ${this.maskEmail(email)}`);
        return;
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(
        Date.now() + AuthConstants.RESET_TOKEN_EXPIRATION_MS,
      );

      await this.resetTokenModel.deleteMany({
        user: user._id,
      });

      await this.resetTokenModel.create({
        token: resetToken,
        user: user._id,
        expiresAt,
      });

      const resetUrl = this.buildResetUrl(resetToken);

      this.logger.log(`🔗 URL de reset générée pour ${this.maskEmail(email)}`);

      try {
        await this.mailService.sendPasswordResetEmail(user.email, resetUrl);
        this.logger.log(`✅ Email de réinitialisation envoyé à ${this.maskEmail(email)}`);
      } catch (emailError) {
        this.logger.error(`❌ Échec envoi email pour ${this.maskEmail(email)}: ${emailError.message}`);
        this.logger.warn(`🔑 Token de réinitialisation généré pour ${this.maskEmail(email)}`);
      }
    } catch (error) {
      this.logger.error(`❌ Erreur lors de la demande de réinitialisation: ${error.message}`);
    }
  }

  async getProfile(userId: string): Promise<User> {
    try {
      this.logger.log(`🛠️ getProfile appelé avec userId: ${this.maskUserId(userId)}`);

      if (!userId || userId === "undefined" || userId === "null" || userId === "") {
        this.logger.warn("⚠️ userId manquant ou invalide dans getProfile");
        throw new BadRequestException("ID utilisateur manquant");
      }

      const cleanUserId = userId.trim();

      // CORRECTION 1 : Utiliser isValidObjectId importé de mongoose
      if (isValidObjectId(cleanUserId)) {
        const user = await this.usersService.findById(cleanUserId);

        if (!user) {
          this.logger.warn(`❌ Utilisateur non trouvé pour l'ID: ${this.maskUserId(cleanUserId)}`);
          throw new NotFoundException("Utilisateur non trouvé");
        }

        this.logger.log(`✅ Profil récupéré avec succès pour l'ID: ${this.maskUserId(cleanUserId)}`);
        return user;
      }

      this.logger.log(`🔍 Recherche par email: ${this.maskEmail(cleanUserId)}`);

      if (cleanUserId.includes("@")) {
        const userByEmail = await this.usersService.findByEmail(cleanUserId);
        if (userByEmail) {
          this.logger.log(`✅ Utilisateur trouvé par email: ${this.maskEmail(cleanUserId)}`);
          return userByEmail;
        }
      }

      this.logger.error(`❌ Aucun utilisateur trouvé avec l'identifiant: ${this.maskUserId(cleanUserId)}`);
      throw new NotFoundException("Utilisateur non trouvé");
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`❌ Erreur critique dans getProfile: ${error.message}`, error.stack);
      throw new BadRequestException("Erreur lors de la récupération du profil");
    }
  }

  async logoutUser(
    userId: string,
    reason: string = "Logout automatique",
  ): Promise<void> {
    try {
      const activeSessions = await this.sessionService.getActiveSessionsByUser(userId);

      for (const session of activeSessions) {
        try {
          const decoded = this.jwtService.decode(session.token) as any;
          if (decoded && decoded.exp) {
            await this.revokeToken(session.token, new Date(decoded.exp * 1000));
          }
        } catch (error) {
          this.logger.warn(`Erreur lors de la révocation du token: ${error.message}`);
        }
      }

      // ✅ Désactiver plutôt que supprimer
      await this.sessionModel.updateMany(
        { user: userId, isActive: true },
        { 
          isActive: false, 
          deactivatedAt: new Date(),
          revocationReason: reason 
        },
      );
      
      this.loginAttempts.delete(userId);

      this.logger.log(`Logout complet pour l'utilisateur ${this.maskUserId(userId)}: ${reason}`);
    } catch (error) {
      this.logger.error(`Erreur lors du logout pour ${this.maskUserId(userId)}: ${error.message}`);
      throw error;
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      const expiredSessions = await this.sessionService.getExpiredSessions();

      for (const session of expiredSessions) {
        try {
          const decoded = this.jwtService.decode(session.token) as any;
          if (decoded && decoded.exp) {
            await this.revokeToken(session.token, new Date(decoded.exp * 1000));
          }
        } catch (error) {
          this.logger.warn(`Erreur lors de la révocation du token expiré: ${error.message}`);
        }
      }

      // ✅ Désactiver les sessions expirées plutôt que les supprimer
      await this.sessionModel.updateMany(
        { expiresAt: { $lt: new Date() }, isActive: true },
        { 
          isActive: false, 
          deactivatedAt: new Date(),
          revocationReason: "session_expired" 
        },
      );
      
      this.logger.log(`Nettoyage de ${expiredSessions.length} sessions expirées`);
    } catch (error) {
      this.logger.error(`Erreur lors du nettoyage des sessions: ${error.message}`);
      throw error;
    }
  }

  async cleanupUserSessions(userId: string): Promise<void> {
    try {
      // ✅ Désactiver plutôt que supprimer
      await this.sessionModel.updateMany(
        { user: userId, isActive: true },
        { 
          isActive: false, 
          deactivatedAt: new Date(),
          revocationReason: "admin_cleanup" 
        },
      );
      
      this.logger.log(`Sessions désactivées pour l'utilisateur ${this.maskUserId(userId)}`);
    } catch (error) {
      this.logger.error(`Erreur lors du nettoyage des sessions pour ${this.maskUserId(userId)}: ${error.message}`);
      throw error;
    }
  }

  // ✅ Méthodes de masquage unifiées
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

  private maskToken(token: string): string {
    if (!token || token.length < 10) return '***';
    return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
  }
}