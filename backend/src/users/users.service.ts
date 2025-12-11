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
  if (trimmed === "") return undefined;

  // ✅ CORRECTION : Garder le + s'il est au début, garder tous les chiffres
  // Supprimer tous les espaces
  const cleaned = trimmed.replace(/\s/g, '');
  
  // Extraire le + s'il est au début, puis tous les chiffres
  const hasPlusPrefix = cleaned.startsWith('+');
  const digitsOnly = cleaned.replace(/\D/g, ''); // Garde uniquement les chiffres
  
  // Validation : au moins 8 chiffres (comme demandé)
  if (digitsOnly.length < 8) {
    return undefined;
  }

  // ✅ RETOURNER avec + si présent au départ
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

  // ✅ Méthodes de masquage unifiées et cohérentes
  private maskEmail(email: string): string {
    if (!email) return '***@***';
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***@***';
    
    const maskedLocal = localPart.length <= 2 
      ? localPart.charAt(0) + '*'
      : localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1);
    
    return `${maskedLocal}@${domain}`;
  }

  private maskUserId(userId: string): string {
    if (!userId) return 'user_***';
    return userId.length <= 8 ? userId : userId.substring(0, 4) + '***' + userId.substring(userId.length - 4);
  }

  private maskPhoneNumber(phone: string): string {
    if (!phone) return '***';
    if (phone.length <= 4) return phone;
    return `${phone.substring(0, 2)}***${phone.substring(phone.length - 2)}`;
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

  // 👤 Méthodes de recherche
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
    if (!Types.ObjectId.isValid(id)) {
      this.logger.warn(`Tentative de recherche avec ID invalide: ${this.maskUserId(id)}`);
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
      this.logger.warn(`Utilisateur non trouvé: ${this.maskUserId(id)}`);
      throw new NotFoundException("Utilisateur non trouvé");
    }
    return user;
  }

  // 🔧 Méthode pour mettre à jour logoutUntil
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

    // Vérifier le mode maintenance (sauf pour les admins)
    const isMaintenance = await this.isMaintenanceMode();
    if (isMaintenance && user.role !== UserRole.ADMIN) {
      const result = {
        canAccess: false,
        reason: "Mode maintenance activé",
        user: {
          id: user._id.toString(),
          email: this.maskEmail(user.email), // ✅ MASQUÉ
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

    // Vérifier si l'utilisateur est actif
    if (user.role !== UserRole.ADMIN && !user.isActive) {
      const result = {
        canAccess: false,
        reason: "Compte désactivé",
        user: {
          id: user._id.toString(),
          email: this.maskEmail(user.email), // ✅ MASQUÉ
          firstName: user.firstName,
          lastName: user.lastName,
          telephone: this.maskPhoneNumber(user.telephone), // ✅ MASQUÉ
          role: user.role,
          isActive: user.isActive,
          isAdmin: user.role === UserRole.ADMIN as any,        }
      };
      this.setCache(cacheKey, result);
      return result;
    }

    // Vérifier la durée de déconnexion forcée
    if (user.logoutUntil && new Date() < new Date(user.logoutUntil)) {
      const remainingHours = Math.ceil(
        (new Date(user.logoutUntil).getTime() - Date.now()) / (1000 * 60 * 60)
      );
      const result = {
        canAccess: false,
        reason: `Déconnecté temporairement (reste ${remainingHours}h)`,
        user: {
          id: user._id.toString(),
          email: this.maskEmail(user.email), // ✅ MASQUÉ
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

    // Accès accordé
    const result = {
      canAccess: true,
      user: {
        id: user._id.toString(),
        email: this.maskEmail(user.email), // ✅ MASQUÉ dans les logs
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
  const maskedEmail = this.maskEmail(createUserDto.email);
  this.logger.log(`Début création utilisateur: ${maskedEmail}`);

  try {
    // Vérifier l'email
    const existingUserWithEmail = await this.findByEmail(createUserDto.email);
    if (existingUserWithEmail) {
      this.logger.warn(`Email déjà utilisé: ${maskedEmail}`);
      throw new BadRequestException("Cet email est déjà utilisé");
    }

    // Vérification spéciale pour l'admin spécifique
    const adminEmail = process.env.EMAIL_USER;
    const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    const isAdminCreation = createUserDto.email === adminEmail;

    if (isAdminCreation) {
      // Vérifier si un admin existe déjà
      const existingAdmin = await this.findByRole(UserRole.ADMIN);
      if (existingAdmin) {
        this.logger.warn(`Tentative de création d'un deuxième admin spécifique: ${maskedEmail}`);
        throw new BadRequestException("Un administrateur existe déjà dans le système");
      }
      
      // Vérifier que le mot de passe correspond au mot de passe par défaut
      if (createUserDto.password !== defaultAdminPassword) {
        this.logger.warn(`Mot de passe incorrect pour l'admin spécifique: ${maskedEmail}`);
        throw new BadRequestException("Mot de passe administrateur invalide");
      }
    }

    // Normaliser et valider le téléphone
    const normalizedTelephone = this.normalizeTelephone(createUserDto.telephone);
    
    if (!normalizedTelephone) {
      this.logger.warn(`Téléphone invalide pour: ${maskedEmail}`);
      throw new BadRequestException("Le numéro de téléphone est invalide");
    }

    // Vérifier si le téléphone existe déjà
    const existingUserWithPhone = await this.userModel
      .findOne({ telephone: normalizedTelephone })
      .select('_id email')
      .exec();

    if (existingUserWithPhone) {
      const existingMaskedEmail = this.maskEmail(existingUserWithPhone.email || '');
      this.logger.warn(`Téléphone déjà utilisé: ${this.maskPhoneNumber(normalizedTelephone)} par ${existingMaskedEmail}`);
      throw new BadRequestException("Ce numéro de téléphone est déjà utilisé");
    }

    // Vérifier que le mot de passe est valide
    if (!createUserDto.password || createUserDto.password.trim().length < 8) {
      this.logger.warn(`Mot de passe invalide pour: ${maskedEmail}`);
      throw new BadRequestException("Le mot de passe doit contenir au moins 8 caractères");
    }

    // Hacher le mot de passe
    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(
        createUserDto.password,
        AuthConstants.BCRYPT_SALT_ROUNDS,
      );
    } catch (hashError) {
      this.logger.error(`Erreur de hashage du mot de passe pour ${maskedEmail}`);
      throw new BadRequestException("Erreur lors de la création du compte");
    }

    if (!hashedPassword || hashedPassword.trim() === '') {
      this.logger.error(`Mot de passe hashé vide pour: ${maskedEmail}`);
      throw new BadRequestException("Erreur lors de la création du compte");
    }

    // Déterminer le rôle
    let userRole = UserRole.USER;
    
    if (isAdminCreation) {
      // Pour l'admin spécifique, toujours admin
      userRole = UserRole.ADMIN;
      this.logger.log(`Admin spécifique créé: ${maskedEmail}`);
    } else {
      // Pour les autres utilisateurs, premier utilisateur = admin
      const existingAdmin = await this.findByRole(UserRole.ADMIN);
      if (!existingAdmin) {
        userRole = UserRole.ADMIN;
        this.logger.log(`Premier utilisateur créé en tant qu'admin: ${maskedEmail}`);
      }
    }

    // Créer l'objet utilisateur
    const userData = {
      firstName: createUserDto.firstName.trim(),
      lastName: createUserDto.lastName.trim(),
      email: createUserDto.email.toLowerCase().trim(),
      password: hashedPassword,
      telephone: normalizedTelephone,
      role: userRole,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Créer et sauvegarder l'utilisateur
    const user = new this.userModel(userData);
    const savedUser = await user.save();

    // Vérification post-création
    const freshUser = await this.userModel.findById(savedUser._id).select('+password').exec();
    
    if (!freshUser?.password || freshUser.password.trim() === '') {
      this.logger.error(`Mot de passe non enregistré pour ${maskedEmail}`);
      await this.userModel.findByIdAndDelete(savedUser._id);
      throw new BadRequestException("Erreur lors de la création du compte");
    }

    // Nettoyer le cache après création
    this.clearUserCache();

    this.logger.log(`Utilisateur créé avec succès: ${maskedEmail}, ID: ${this.maskUserId(savedUser._id.toString())}`);
    
    // Retourner l'utilisateur sans le mot de passe
    const userWithoutPassword = savedUser.toObject();
    delete userWithoutPassword.password;
    
    return userWithoutPassword as User;
  } catch (error: any) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      if (field === "email") {
        this.logger.warn(`Conflit email: ${maskedEmail}`);
        throw new BadRequestException("Cet email est déjà utilisé");
      }
      if (field === "telephone") {
        this.logger.warn(`Conflit téléphone pour: ${maskedEmail}`);
        throw new BadRequestException("Ce numéro de téléphone est déjà utilisé");
      }
    }

    if (error instanceof BadRequestException) {
      throw error;
    }

    this.logger.error(`Erreur création utilisateur ${maskedEmail}: ${error.message}`);
    
    throw new BadRequestException(
      error.message.includes("téléphone") 
        ? "Ce numéro de téléphone est déjà utilisé" 
        : "Erreur lors de la création du compte"
    );
  }
}

  // ✏️ Méthodes de mise à jour
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const maskedId = this.maskUserId(id);
    this.logger.log(`Début mise à jour utilisateur: ${maskedId}`);

    if (!id || !Types.ObjectId.isValid(id)) {
      this.logger.warn(`ID utilisateur invalide: ${id}`);
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
        this.logger.error(`Utilisateur non trouvé après mise à jour: ${maskedId}`);
        throw new NotFoundException("Utilisateur non trouvé après mise à jour");
      }

      this.clearUserCache(id);
      this.logger.log(`Utilisateur mis à jour avec succès: ${maskedId}`);
      return updatedUser;
    } catch (error: any) {
      this.handleUpdateError(error, maskedId);
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
      this.logger.warn(`Utilisateur non trouvé: ${this.maskUserId(userId)}`);
      throw new NotFoundException("Utilisateur non trouvé");
    }
  }

  private async checkForConflicts(
      userId: string,
      updateData: any,
    ): Promise<void> {
      // Empêcher la modification de l'email admin spécifique
      const adminEmail = process.env.EMAIL_USER;
      
      if (updateData.email === adminEmail) {
        const existingUser = await this.userModel.findById(userId);
        if (existingUser?.email !== adminEmail) {
          this.logger.warn(`Tentative d'utilisation de l'email admin réservé: ${this.maskEmail(updateData.email)}`);
          throw new BadRequestException("Cet email est réservé à l'administrateur principal");
        }
      }

      if (updateData.email) {
        const existingUserWithEmail = await this.userModel
          .findOne({
            email: updateData.email,
            _id: { $ne: new Types.ObjectId(userId) },
          })
          .select("_id")
          .exec();

        if (existingUserWithEmail) {
          this.logger.warn(`Conflit email: ${this.maskEmail(updateData.email)} déjà utilisé`);
          throw new BadRequestException("Cet email est déjà utilisé");
        }
      }

      if (updateData.telephone) {
        const existingUserWithPhone = await this.userModel
          .findOne({
            telephone: updateData.telephone,
            _id: { $ne: new Types.ObjectId(userId) },
          })
          .select("_id")
          .exec();

        if (existingUserWithPhone) {
          this.logger.warn(`Conflit téléphone: ${this.maskPhoneNumber(updateData.telephone)} déjà utilisé`);
          throw new BadRequestException("Ce numéro de téléphone est déjà utilisé");
        }
      }
    }

  private handleUpdateError(error: any, userId: string): never {
    if (error?.code === 11000) {
      const fields = Object.keys(error.keyPattern || {});
      if (fields.includes("email")) {
        this.logger.warn(`Erreur duplication email pour: ${userId}`);
        throw new BadRequestException("Cet email est déjà utilisé");
      }
      if (fields.includes("telephone")) {
        this.logger.warn(`Erreur duplication téléphone pour: ${userId}`);
        throw new BadRequestException("Ce numéro de téléphone est déjà utilisé");
      }
      throw new BadRequestException("Conflit de données");
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map(
        (err: any) => err.message,
      );
      this.logger.warn(`Erreur validation pour ${userId}: ${messages.join(', ')}`);
      throw new BadRequestException(messages.join(", "));
    }

    if (error.name === "CastError") {
      this.logger.warn(`ID utilisateur invalide: ${userId}`);
      throw new BadRequestException("ID utilisateur invalide");
    }

    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    this.logger.error(`Erreur inattendue pour ${userId}: ${error.message}`);
    throw new BadRequestException("Erreur lors de la mise à jour du profil");
  }

  async updatePassword(
    userId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    const maskedId = this.maskUserId(userId);
    this.logger.log(`Début changement mot de passe: ${maskedId}`);

    const user = await this.userModel.findById(userId).select('+password').exec();
    if (!user) {
      this.logger.warn(`Utilisateur non trouvé pour changement mot de passe: ${maskedId}`);
      throw new NotFoundException("Utilisateur non trouvé");
    }

    if (!user.password || user.password.trim() === '') {
      this.logger.error(`L'utilisateur ${maskedId} n'a pas de mot de passe hashé enregistré`);
      
      if (user.role === UserRole.ADMIN) {
        this.logger.log(`Admin ${maskedId} crée un nouveau mot de passe`);
        
        user.password = await bcrypt.hash(
          updatePasswordDto.newPassword,
          AuthConstants.BCRYPT_SALT_ROUNDS,
        );
        
        await user.save();
        this.clearUserCache(userId);
        this.logger.log(`Mot de passe créé avec succès pour admin: ${maskedId}`);
        return;
      }
      
      throw new UnauthorizedException("Configuration du compte invalide. Contactez l'administrateur.");
    }

    if (!updatePasswordDto.currentPassword || updatePasswordDto.currentPassword.trim() === '') {
      this.logger.warn(`Mot de passe actuel non fourni: ${maskedId}`);
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
      this.logger.error(`Erreur bcrypt.compare pour ${maskedId}`);
      
      if (error.message.includes('data and hash arguments required')) {
        throw new BadRequestException(
          "Erreur technique lors de la validation du mot de passe. Veuillez réessayer."
        );
      }
      
      throw error;
    }

    if (!isMatch) {
      this.logger.warn(`Mot de passe actuel incorrect: ${maskedId}`);
      throw new UnauthorizedException("Mot de passe actuel incorrect");
    }

    const isSamePassword = await bcrypt.compare(
      updatePasswordDto.newPassword,
      user.password
    );
    
    if (isSamePassword) {
      this.logger.warn(`Nouveau mot de passe identique à l'ancien: ${maskedId}`);
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel");
    }

    user.password = await bcrypt.hash(
      updatePasswordDto.newPassword,
      AuthConstants.BCRYPT_SALT_ROUNDS,
    );

    await user.save();
    this.clearUserCache(userId);
    
    this.logger.log(`Mot de passe changé avec succès: ${maskedId}`);
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const maskedId = this.maskUserId(userId);
    this.logger.log(`Réinitialisation mot de passe: ${maskedId}`);

    const user = await this.userModel.findById(userId);
    if (!user) {
      this.logger.warn(`Utilisateur non trouvé pour réinitialisation: ${maskedId}`);
      throw new NotFoundException("Utilisateur non trouvé");
    }

    user.password = await bcrypt.hash(
      newPassword,
      AuthConstants.BCRYPT_SALT_ROUNDS,
    );

    await user.save();
    this.clearUserCache(userId);
    
    this.logger.log(`Mot de passe réinitialisé: ${maskedId}`);
  }

  // 🗑️ Méthodes de suppression
  async delete(id: string): Promise<void> {
    const maskedId = this.maskUserId(id);
    this.logger.log(`Début suppression utilisateur: ${maskedId}`);

    // Vérifier si c'est l'admin principal
    const user = await this.userModel.findById(id).select('email role').exec();
    if (user?.email === process.env.EMAIL_USER && user?.role === UserRole.ADMIN) {
      this.logger.warn(`Tentative de suppression de l'admin principal: ${maskedId}`);
      throw new BadRequestException("Impossible de supprimer l'administrateur principal");
    }

    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      this.logger.warn(`Utilisateur non trouvé pour suppression: ${maskedId}`);
      throw new NotFoundException("Utilisateur non trouvé");
    }
    
    this.clearUserCache(id);
    this.logger.log(`Utilisateur supprimé: ${maskedId}`);
  }

  async toggleStatus(id: string): Promise<User> {
    const maskedId = this.maskUserId(id);
    this.logger.log(`Changement statut utilisateur: ${maskedId}`);

    const user = await this.findById(id);
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { isActive: !user.isActive }, { new: true })
      .select("-password")
      .exec();

    if (!updatedUser) {
      this.logger.error(`Utilisateur non trouvé après changement statut: ${maskedId}`);
      throw new NotFoundException("Utilisateur non trouvé");
    }

    this.clearUserCache(id);
    this.logger.log(`Statut utilisateur modifié: ${maskedId}, Actif: ${updatedUser.isActive}`);
    return updatedUser;
  }

  // 📊 Méthodes de statistiques et monitoring
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
}