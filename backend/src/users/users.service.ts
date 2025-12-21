import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import * as bcrypt from 'bcryptjs';
import { Model, Types } from "mongoose";
import { RegisterDto } from "../auth/dto/register.dto";
import { UpdatePasswordDto } from "../auth/dto/update-password.dto";
import { UpdateUserDto } from "../auth/dto/update-user.dto";
import { User, UserRole } from "../schemas/user.schema";
import { AuthConstants } from "../auth/auth.constants";
import { isValidObjectId } from "mongoose"; // Déjà présente

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;

  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  private normalizeTelephone(input?: string): string | undefined {
    if (!input) return undefined;

    const trimmed = input.trim();
    if (trimmed === "") return "";

    const cleaned = trimmed.replace(/\s/g, '');
    
    const hasPlusPrefix = cleaned.startsWith('+');
    const digitsOnly = cleaned.replace(/\D/g, '');
    
    if (digitsOnly.length < 8) {
      return undefined;
    }

    return hasPlusPrefix ? `+${digitsOnly}` : digitsOnly;
  }

  private getCacheKey(method: string, identifier: string): string {
    return `${method}:${identifier}`;
  }

  private setCache(key: string, data: any): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private getCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private clearUserCache(userId?: string): void {
    if (userId) {
      for (const key of this.cache.keys()) {
        if (key.includes(userId)) {
          this.cache.delete(key);
        }
      }
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith("findAll:") || key.startsWith("getStats:")) {
        this.cache.delete(key);
      }
    }
  }

  async exists(userId: string): Promise<boolean> {
    const cacheKey = this.getCacheKey("exists", userId);
    const cached = this.getCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const user = await this.userModel
      .findById(userId)
      .select("_id")
      .lean()
      .exec();
    const exists = !!user;
    this.setCache(cacheKey, exists);
    return exists;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const cacheKey = this.getCacheKey("findByEmail", normalizedEmail);
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .select('+password')
      .exec();
    
    this.setCache(cacheKey, user);
    return user;
  }

  async findByRole(role: UserRole): Promise<User | null> {
  const cacheKey = this.getCacheKey("findByRole", role);
  const cached = this.getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const user = await this.userModel.findOne({ role }).exec();
  this.setCache(cacheKey, user);
  return user;
}

  async findOne(id: string): Promise<User | null> {
    if (!isValidObjectId(id)) {
      this.logger.warn('Tentative de recherche avec ID invalide');
      return null;
    }

    const cacheKey = this.getCacheKey("findOne", id);
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const user = await this.userModel.findById(id).exec();
    this.setCache(cacheKey, user);
    
    return user;
  }

  async findAll(): Promise<User[]> {
    const cacheKey = this.getCacheKey("findAll", "all");
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const users = await this.userModel.find().select("-password").exec();
    this.setCache(cacheKey, users);
    return users;
  }

  async findById(id: string): Promise<User> {
    const user = await this.findOne(id);
    if (!user) {
      this.logger.warn('Utilisateur non trouvé');
      throw new NotFoundException("Utilisateur non trouvé");
    }
    return user;
  }

  async setLogoutUntil(userId: string, durationHours: number = 24): Promise<void> {
    const logoutUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    await this.userModel.findByIdAndUpdate(userId, { logoutUntil });
  }

  async checkUserAccess(userId: string): Promise<{
    canAccess: boolean;
    reason?: string;
    user?: any;
    details?: any;
  }> {
    const cacheKey = this.getCacheKey("checkUserAccess", userId);
    const cached = this.getCache(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) {
      const result = { 
        canAccess: false, 
        reason: "Utilisateur non trouvé" 
      };
      this.setCache(cacheKey, result);
      return result;
    }

    const isMaintenance = await this.isMaintenanceMode();
    if (isMaintenance && user.role !== UserRole.ADMIN) {
      const result = {
        canAccess: false,
        reason: "Mode maintenance activé",
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          isAdmin: user.role === UserRole.ADMIN as any,
        },
        details: { maintenanceMode: true }
      };
      this.setCache(cacheKey, result);
      return result;
    }

    if (user.role !== UserRole.ADMIN && !user.isActive) {
      const result = {
        canAccess: false,
        reason: "Compte désactivé",
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          telephone: user.telephone,
          role: user.role,
          isActive: user.isActive,
          isAdmin: user.role === UserRole.ADMIN as any,
        }
      };
      this.setCache(cacheKey, result);
      return result;
    }

    if (user.logoutUntil && new Date() < new Date(user.logoutUntil)) {
      const remainingHours = Math.ceil(
        (new Date(user.logoutUntil).getTime() - Date.now()) / (1000 * 60 * 60)
      );
      const result = {
        canAccess: false,
        reason: `Déconnecté temporairement (reste ${remainingHours}h)`,
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isActive: user.isActive,
          logoutUntil: user.logoutUntil,
          isAdmin: user.role === UserRole.ADMIN
        },
        details: {
          logoutUntil: user.logoutUntil,
          remainingHours,
          isTemporarilyLoggedOut: true
        }
      };
      this.setCache(cacheKey, result);
      return result;
    }

    const result = {
      canAccess: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        logoutUntil: user.logoutUntil,
        isAdmin: user.role === UserRole.ADMIN
      },
      details: {
        isTemporarilyLoggedOut: false,
        canLogin: true,
        maintenanceMode: isMaintenance
      }
    };

    const cacheTTL = result.canAccess ? this.CACHE_TTL : 60000;
    this.setCache(cacheKey, result);
    
    setTimeout(() => {
      this.cache.delete(cacheKey);
    }, cacheTTL);

    return result;
  }

  async isMaintenanceMode(): Promise<boolean> {
    const cacheKey = this.getCacheKey("isMaintenanceMode", "status");
    const cached = this.getCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const isMaintenance = process.env.MAINTENANCE_MODE === "true";
    this.setCache(cacheKey, isMaintenance);
    return isMaintenance;
  }

  async setMaintenanceMode(enabled: boolean): Promise<void> {
    this.logger.log(`Changement mode maintenance: ${enabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    process.env.MAINTENANCE_MODE = enabled ? "true" : "false";
    this.clearUserCache();
  }

async create(createUserDto: RegisterDto): Promise<User> {
  this.logger.log('Début création utilisateur');

  try {
    const existingUserWithEmail = await this.findByEmail(createUserDto.email);
    if (existingUserWithEmail) {
      this.logger.warn('Email déjà utilisé');
      throw new BadRequestException("Cet email est déjà utilisé");
    }

    const adminEmail = process.env.EMAIL_USER;
    
    // ✅ VÉRIFIER SI UN ADMIN EXISTE DÉJÀ
    const existingAdmin = await this.findByRole(UserRole.ADMIN);
    
    // ✅ LOGIQUE : SEUL EMAIL_USER PEUT ÊTRE ADMIN, ET UNIQUEMENT SI AUCUN ADMIN N'EXISTE
    let userRole = UserRole.USER;
    
    if (createUserDto.email === adminEmail) {
      // Tentative de créer un compte avec l'email admin
      if (existingAdmin) {
        // Admin existe déjà → devient USER
        userRole = UserRole.USER;
        this.logger.warn(`⚠️ Email admin utilisé pour créer un USER (admin existe déjà)`);
      } else {
        // Premier admin → devient ADMIN
        userRole = UserRole.ADMIN;
        this.logger.log(`✅ Création du SEUL et UNIQUE admin: ${this.maskEmail(adminEmail)}`);
      }
    } else {
      // Tous les autres emails sont USER
      userRole = UserRole.USER;
      this.logger.log(`✅ Création d'utilisateur standard: ${this.maskEmail(createUserDto.email)}`);
    }

    const normalizedTelephone = this.normalizeTelephone(createUserDto.telephone);
    
    if (!normalizedTelephone) {
      this.logger.warn('Téléphone invalide');
      throw new BadRequestException("Le numéro de téléphone est invalide");
    }

    const existingUserWithPhone = await this.userModel
      .findOne({ telephone: normalizedTelephone })
      .select('_id email')
      .exec();

    if (existingUserWithPhone) {
      this.logger.warn('Téléphone déjà utilisé');
      throw new BadRequestException("Ce numéro de téléphone est déjà utilisé");
    }

    if (!createUserDto.password || createUserDto.password.trim().length < 8) {
      this.logger.warn('Mot de passe invalide');
      throw new BadRequestException("Le mot de passe doit contenir au moins 8 caractères");
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      AuthConstants.BCRYPT_SALT_ROUNDS,
    );

    if (!hashedPassword || hashedPassword.trim() === '') {
      this.logger.error('Mot de passe hashé vide');
      throw new BadRequestException("Erreur lors de la création du compte");
    }

    const userData = {
      firstName: createUserDto.firstName.trim(),
      lastName: createUserDto.lastName.trim(),
      email: createUserDto.email.toLowerCase().trim(),
      password: hashedPassword,
      telephone: normalizedTelephone,
      role: userRole, // ✅ TOUJOURS USER sauf premier EMAIL_USER
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const user = new this.userModel(userData);
    const savedUser = await user.save();

    const freshUser = await this.userModel.findById(savedUser._id).select('+password').exec();
    
    if (!freshUser?.password || freshUser.password.trim() === '') {
      this.logger.error('Mot de passe non enregistré');
      await this.userModel.findByIdAndDelete(savedUser._id);
      throw new BadRequestException("Erreur lors de la création du compte");
    }

    this.clearUserCache();

    this.logger.log(`Utilisateur créé avec succès (Rôle: ${userRole})`);
    
    const userWithoutPassword = savedUser.toObject();
    delete userWithoutPassword.password;
    
    return userWithoutPassword as User;
  } catch (error: any) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === "email") {
        this.logger.warn('Conflit email');
        throw new BadRequestException("Cet email est déjà utilisé");
      }
      if (field === "telephone") {
        this.logger.warn('Conflit téléphone');
        throw new BadRequestException("Ce numéro de téléphone est déjà utilisé");
      }
    }

    if (error instanceof BadRequestException) {
      throw error;
    }

    this.logger.error('Erreur création utilisateur');
    
    throw new BadRequestException(
      error.message.includes("téléphone") 
        ? "Ce numéro de téléphone est déjà utilisé" 
        : "Erreur lors de la création du compte"
    );
  }
}

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log('Début mise à jour utilisateur');

    if (!id || !isValidObjectId(id)) {
      this.logger.warn('ID utilisateur invalide');
      throw new BadRequestException("ID utilisateur invalide");
    }

    const filteredUpdate = this.filterAndValidateUpdateData(updateUserDto);

    try {
      await this.verifyUserExists(id);
      await this.checkForConflicts(id, filteredUpdate);

      const updatedUser = await this.userModel
        .findByIdAndUpdate(id, filteredUpdate, {
          new: true,
          runValidators: true,
          context: "query",
        })
        .select("-password")
        .exec();

      if (!updatedUser) {
        this.logger.error('Utilisateur non trouvé après mise à jour');
        throw new NotFoundException("Utilisateur non trouvé après mise à jour");
      }

      this.clearUserCache(id);
      this.logger.log('Utilisateur mis à jour avec succès');
      return updatedUser;
    } catch (error: any) {
      this.handleUpdateError(error);
    }
  }

  private filterAndValidateUpdateData(updateUserDto: UpdateUserDto): any {
    const allowedFields = ["email", "telephone"];
    const filteredUpdate: any = {};

    Object.keys(updateUserDto).forEach((key) => {
      if (
        allowedFields.includes(key) &&
        updateUserDto[key as keyof UpdateUserDto] !== undefined
      ) {
        const value = updateUserDto[key as keyof UpdateUserDto];
        if (value !== null && value !== "") {
          filteredUpdate[key] = value;
        }
      }
    });

    if (Object.keys(filteredUpdate).length === 0) {
      throw new BadRequestException("Aucune donnée valide à mettre à jour");
    }

    if (filteredUpdate.email) {
      filteredUpdate.email = filteredUpdate.email.toLowerCase().trim();
      this.validateEmail(filteredUpdate.email);
    }

    if (filteredUpdate.telephone) {
      filteredUpdate.telephone = this.normalizeTelephone(filteredUpdate.telephone);
      this.validateTelephone(filteredUpdate.telephone);
    }

    return filteredUpdate;
  }

  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException("Format d'email invalide");
    }
  }

  private validateTelephone(telephone: string | undefined): void {
    if (telephone && telephone.length < 5) {
      throw new BadRequestException(
        "Le téléphone doit contenir au moins 5 caractères",
      );
    }
  }

  private async verifyUserExists(userId: string): Promise<void> {
    const existingUser = await this.userModel
      .findById(userId)
      .select("_id")
      .exec();
    if (!existingUser) {
      this.logger.warn('Utilisateur non trouvé');
      throw new NotFoundException("Utilisateur non trouvé");
    }
  }

  private async checkForConflicts(
      userId: string,
      updateData: any,
    ): Promise<void> {
      const adminEmail = process.env.EMAIL_USER;
      
      // ✅ EMPÊCHER changement d'email vers l'email admin réservé
      if (updateData.email === adminEmail) {
        const existingUser = await this.userModel.findById(userId);
        if (existingUser?.email !== adminEmail) {
          this.logger.warn('Tentative d\'utilisation de l\'email admin réservé');
          throw new BadRequestException("Cet email est réservé à l'administrateur principal");
        }
      }

      if (updateData.email) {
        const existingUserWithEmail = await this.userModel
          .findOne({
            email: updateData.email,
            _id: { $ne: new  (isValidObjectId as any).constructor(userId)},
          })
          .select("_id")
          .exec();

        if (existingUserWithEmail) {
          this.logger.warn('Conflit email déjà utilisé');
          throw new BadRequestException("Cet email est déjà utilisé");
        }
      }

      if (updateData.telephone) {
        const existingUserWithPhone = await this.userModel
          .findOne({
            telephone: updateData.telephone,
            _id: { $ne: new  (isValidObjectId as any).constructor(userId) },
          })
          .select("_id")
          .exec();

        if (existingUserWithPhone) {
          this.logger.warn('Conflit téléphone déjà utilisé');
          throw new BadRequestException("Ce numéro de téléphone est déjà utilisé");
        }
      }
  }

  private handleUpdateError(error: any): never {
    if (error?.code === 11000) {
      const fields = Object.keys(error.keyPattern || {});
      if (fields.includes("email")) {
        this.logger.warn('Erreur duplication email');
        throw new BadRequestException("Cet email est déjà utilisé");
      }
      if (fields.includes("telephone")) {
        this.logger.warn('Erreur duplication téléphone');
        throw new BadRequestException("Ce numéro de téléphone est déjà utilisé");
      }
      throw new BadRequestException("Conflit de données");
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (err: any) => err.message,
      );
      this.logger.warn(`Erreur validation: ${messages.join(', ')}`);
      throw new BadRequestException(messages.join(", "));
    }

    if (error.name === "CastError") {
      this.logger.warn('ID utilisateur invalide');
      throw new BadRequestException("ID utilisateur invalide");
    }

    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    this.logger.error('Erreur inattendue lors de la mise à jour');
    throw new BadRequestException("Erreur lors de la mise à jour du profil");
  }

  async updatePassword(
    userId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    this.logger.log('Début changement mot de passe');

    const user = await this.userModel.findById(userId).select('+password').exec();
    if (!user) {
      this.logger.warn('Utilisateur non trouvé pour changement mot de passe');
      throw new NotFoundException("Utilisateur non trouvé");
    }

    if (!user.password || user.password.trim() === '') {
      this.logger.error('L\'utilisateur n\'a pas de mot de passe hashé enregistré');
      
      if (user.role === UserRole.ADMIN) {
        this.logger.log('Admin crée un nouveau mot de passe');
        
        user.password = await bcrypt.hash(
          updatePasswordDto.newPassword,
          AuthConstants.BCRYPT_SALT_ROUNDS,
        );
        
        await user.save();
        this.clearUserCache(userId);
        this.logger.log('Mot de passe créé avec succès pour admin');
        return;
      }
      
      throw new UnauthorizedException("Configuration du compte invalide. Contactez l'administrateur.");
    }

    if (!updatePasswordDto.currentPassword || updatePasswordDto.currentPassword.trim() === '') {
      this.logger.warn('Mot de passe actuel non fourni');
      throw new BadRequestException("Le mot de passe actuel est requis");
    }

    let isMatch = false;
    try {
      const cleanCurrentPassword = updatePasswordDto.currentPassword.trim();
      
      if (!user.password || !cleanCurrentPassword) {
        throw new Error('Arguments manquants pour la comparaison');
      }
      
      isMatch = await bcrypt.compare(cleanCurrentPassword, user.password);
    } catch (error) {
      this.logger.error('Erreur lors de la validation du mot de passe');
      
      if (error.message.includes('data and hash arguments required')) {
        throw new BadRequestException(
          "Erreur technique lors de la validation du mot de passe. Veuillez réessayer."
        );
      }
      
      throw error;
    }

    if (!isMatch) {
      this.logger.warn('Mot de passe actuel incorrect');
      throw new UnauthorizedException("Mot de passe actuel incorrect");
    }

    const isSamePassword = await bcrypt.compare(
      updatePasswordDto.newPassword,
      user.password
    );
    
    if (isSamePassword) {
      this.logger.warn('Nouveau mot de passe identique à l\'ancien');
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel");
    }

    user.password = await bcrypt.hash(
      updatePasswordDto.newPassword,
      AuthConstants.BCRYPT_SALT_ROUNDS,
    );

    await user.save();
    this.clearUserCache(userId);
    
    this.logger.log('Mot de passe changé avec succès');
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    this.logger.log('Réinitialisation mot de passe');

    const user = await this.userModel.findById(userId);
    if (!user) {
      this.logger.warn('Utilisateur non trouvé pour réinitialisation');
      throw new NotFoundException("Utilisateur non trouvé");
    }

    user.password = await bcrypt.hash(
      newPassword,
      AuthConstants.BCRYPT_SALT_ROUNDS,
    );

    await user.save();
    this.clearUserCache(userId);
    
    this.logger.log('Mot de passe réinitialisé');
  }

  async delete(id: string): Promise<void> {
    this.logger.log('Début suppression utilisateur');

    const adminEmail = process.env.EMAIL_USER;
    const user = await this.userModel.findById(id).select('email role').exec();
    
    // ✅ EMPÊCHER suppression de l'admin unique
    if (user?.email === adminEmail && user?.role === UserRole.ADMIN) {
      this.logger.warn('Tentative de suppression de l\'admin unique');
      throw new BadRequestException("Impossible de supprimer l'administrateur unique du système");
    }

    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      this.logger.warn('Utilisateur non trouvé pour suppression');
      throw new NotFoundException("Utilisateur non trouvé");
    }
    
    this.clearUserCache(id);
    this.logger.log('Utilisateur supprimé');
  }

  async toggleStatus(id: string): Promise<User> {
    this.logger.log('Changement statut utilisateur');

    const adminEmail = process.env.EMAIL_USER;
    const user = await this.findById(id);
    
    // ✅ EMPÊCHER désactivation de l'admin unique
    if (user.email === adminEmail && user.role === UserRole.ADMIN) {
      this.logger.warn('Tentative de désactivation de l\'admin unique');
      throw new BadRequestException("Impossible de désactiver l'administrateur unique du système");
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { isActive: !user.isActive }, { new: true })
      .select("-password")
      .exec();

    if (!updatedUser) {
      this.logger.error('Utilisateur non trouvé après changement statut');
      throw new NotFoundException("Utilisateur non trouvé");
    }

    this.clearUserCache(id);
    this.logger.log(`Statut utilisateur modifié - Actif: ${updatedUser.isActive}`);
    return updatedUser;
  }

  async checkDatabaseConnection(): Promise<boolean> {
    try {
      if (!this.userModel.db || !this.userModel.db.db) {
        this.logger.error("Connexion base de données non disponible");
        return false;
      }
      await this.userModel.db.db.command({ ping: 1 });
      return true;
    } catch (error) {
      this.logger.error("Échec vérification connexion base de données");
      return false;
    }
  }

  async getStats() {
    const cacheKey = this.getCacheKey("getStats", "all");
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const [totalUsers, activeUsers, adminUsers] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.userModel.countDocuments({ isActive: true }).exec(),
      this.userModel.countDocuments({ role: "admin" }).exec(),
    ]);

    const stats = {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      adminUsers,
      regularUsers: totalUsers - adminUsers,
    };

    this.setCache(cacheKey, stats);
    return stats;
  }

  async getMaintenanceStatus() {
    const cacheKey = this.getCacheKey("getMaintenanceStatus", "status");
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const isActive = await this.isMaintenanceMode();
    const status = {
      isActive,
      enabledAt: isActive ? new Date().toISOString() : null,
      message: isActive 
        ? "Mode maintenance activé - Accès réservé aux administrateurs" 
        : "Mode maintenance désactivé - Application accessible",
    };

    this.setCache(cacheKey, status);
    return status;
  }

  async clearAllCache(): Promise<void> {
    const cacheSize = this.cache.size;
    this.cache.clear();
    this.logger.log(`Cache utilisateur vidé - ${cacheSize} entrées supprimées`);
  }


   private maskEmail(email: string): string {
  if (!email || typeof email !== 'string') return '***@***';
  
  const trimmedEmail = email.trim();
  const [name, domain] = trimmedEmail.split('@');
  
  if (!name || !domain || name.length === 0 || domain.length === 0) {
    return '***@***';
  }
  
  // Masquer le nom (garder première lettre et dernière)
  const maskedName = name.length <= 2 
    ? name.charAt(0) + '*'
    : name.charAt(0) + '***' + (name.length > 1 ? name.charAt(name.length - 1) : '');
  
  // Masquer partiellement le domaine
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return `${maskedName}@***`;
  
  const maskedDomain = domainParts.length === 2 
    ? '***.' + domainParts[1]
    : '***.' + domainParts.slice(-2).join('.');
  
  return `${maskedName}@${maskedDomain}`;
  }
  
}