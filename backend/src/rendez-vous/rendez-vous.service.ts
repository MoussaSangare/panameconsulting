import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Cron } from "@nestjs/schedule";
import { ProcedureService } from "../procedure/procedure.service";
import { NotificationService } from "../notification/notification.service";
import { Rendezvous } from "../schemas/rendezvous.schema";
import { CreateRendezvousDto } from "./dto/create-rendezvous.dto";
import { UpdateRendezvousDto } from "./dto/update-rendezvous.dto";
import { UserRole } from "../schemas/user.schema";
import { CreateProcedureDto } from "../procedure/dto/create-procedure.dto";
import { User } from "../schemas/user.schema";
const Holidays = require('date-holidays');

// Constantes pour la cohérence - avec des types spécifiques
const RENDEZVOUS_STATUS = {
  PENDING: 'En attente' as const,
  CONFIRMED: 'Confirmé' as const,
  COMPLETED: 'Terminé' as const,
  CANCELLED: 'Annulé' as const
};

const ADMIN_OPINION = {
  FAVORABLE: 'Favorable' as const,
  UNFAVORABLE: 'Défavorable' as const
};

const MAX_SLOTS_PER_DAY = 24;
const WORKING_HOURS = { start: 9, end: 16.5 };
const CANCELLATION_THRESHOLD_HOURS = 2;
const AUTO_CANCEL_PENDING_HOURS = 5;

// Type pour les statuts
type RendezvousStatus = typeof RENDEZVOUS_STATUS[keyof typeof RENDEZVOUS_STATUS];
type AdminOpinion = typeof ADMIN_OPINION[keyof typeof ADMIN_OPINION];

@Injectable()
export class RendezvousService {
  private readonly logger = new Logger(RendezvousService.name);
  private holidays: any;
  private cachedHolidays: Map<string, string[]> = new Map();

  constructor(
    @InjectModel(Rendezvous.name) private rendezvousModel: Model<Rendezvous>,
    @InjectModel(User.name) private userModel: Model<User>,
    private procedureService: ProcedureService,
    private notificationService: NotificationService,
  ) {
    this.initializeHolidays();
  }

  private initializeHolidays(): void {
    try {
      this.holidays = new Holidays('ML');
      this.logger.log('Initialisation de la bibliothèque date-holidays pour le Mali');
    } catch (error) {
      this.logger.error(`Erreur d'initialisation de date-holidays: ${error.message}`);
      this.holidays = null;
    }
  }

  private getHolidaysForYear(year: number): string[] {
    const cacheKey = year.toString();
    
    if (this.cachedHolidays.has(cacheKey)) {
      return this.cachedHolidays.get(cacheKey)!;
    }

    const holidayDates: string[] = [];

    try {
      if (this.holidays) {
        const holidaysList = this.holidays.getHolidays(year);
        
        if (holidaysList && Array.isArray(holidaysList)) {
          holidayDates.push(...holidaysList
            .filter(holiday => holiday.type === 'public')
            .map(holiday => {
              const date = new Date(holiday.date);
              return date.toISOString().split('T')[0];
            })
          );
        }
      }

      const fixedHolidays = [
        `${year}-01-01`,
        `${year}-05-01`,
        `${year}-09-22`,
        `${year}-12-25`,
      ];

      const allHolidays = [...new Set([...holidayDates, ...fixedHolidays])]
        .sort()
        .filter(date => {
          const parsedDate = new Date(date);
          return !isNaN(parsedDate.getTime());
        });

      this.cachedHolidays.set(cacheKey, allHolidays);
      
      this.logger.log(`${allHolidays.length} jours fériés chargés pour l'année ${year}`);
      return allHolidays;

    } catch (error) {
      this.logger.error(`Erreur lors de la récupération des jours fériés pour ${year}: ${error.message}`);
      
      const fallbackHolidays = [
        `${year}-01-01`,
        `${year}-05-01`,
        `${year}-09-22`,
        `${year}-12-25`,
      ];
      
      this.cachedHolidays.set(cacheKey, fallbackHolidays);
      return fallbackHolidays;
    }
  }

  private isHoliday(dateStr: string): boolean {
    try {
      const year = new Date(dateStr).getFullYear();
      const holidays = this.getHolidaysForYear(year);
      return holidays.includes(dateStr);
    } catch (error) {
      this.logger.error(`Erreur lors de la vérification du jour férié ${dateStr}: ${error.message}`);
      return false;
    }
  }

  // ==================== CORE METHODS ====================

  async create(createDto: CreateRendezvousDto): Promise<Rendezvous> {
    this.logger.log(`Création rendez-vous pour l'utilisateur ID: ${createDto.userId}`);
    this.logger.debug(`Données DTO reçues: ${JSON.stringify(createDto, null, 2)}`);

    // Valider que l'userId est un ObjectId valide
    if (!Types.ObjectId.isValid(createDto.userId)) {
      throw new BadRequestException("ID utilisateur invalide");
    }

    // Vérifier que l'utilisateur existe
    const user = await this.userModel.findById(createDto.userId).exec();
    if (!user) {
      this.logger.warn(`Utilisateur non trouvé pour l'ID: ${createDto.userId}`);
      throw new BadRequestException("Utilisateur non trouvé");
    }

    // Vérifier que l'email fourni correspond à l'utilisateur
    const normalizedDtoEmail = createDto.email.toLowerCase().trim();
    const normalizedUserEmail = user.email.toLowerCase().trim();
    
    if (normalizedDtoEmail !== normalizedUserEmail) {
      this.logger.warn(`Email mismatch: DTO=${normalizedDtoEmail}, User=${normalizedUserEmail}`);
      throw new BadRequestException("L'email ne correspond pas à l'utilisateur");
    }

    // Vérifier s'il y a déjà un rendez-vous confirmé
    const confirmedCount = await this.rendezvousModel.countDocuments({
      userId: createDto.userId,
      status: RENDEZVOUS_STATUS.CONFIRMED,
    });

    this.logger.log(`Nombre de rendez-vous confirmés pour l'utilisateur ${createDto.userId}: ${confirmedCount}`);

    if (confirmedCount >= 1) {
      this.logger.warn(`Tentative de création d'un deuxième rendez-vous pour l'utilisateur: ${createDto.userId}`);
      throw new BadRequestException("Vous avez déjà un rendez-vous confirmé");
    }

    // Traitement des champs "Autre" et validation
    const processedData = this.processAndValidateRendezvousData(createDto);
    this.logger.debug(`Données traitées: ${JSON.stringify(processedData, null, 2)}`);

    // Validation spécifique pour les champs "Autre"
    if (processedData.destination === 'Autre' && (!processedData.destinationAutre || processedData.destinationAutre.trim() === '')) {
      this.logger.warn(`Destination "Autre" sans précision pour ${createDto.userId}`);
      throw new BadRequestException('La destination "Autre" nécessite une précision');
    }
    
    if (processedData.filiere === 'Autre' && (!processedData.filiereAutre || processedData.filiereAutre.trim() === '')) {
      this.logger.warn(`Filière "Autre" sans précision pour ${createDto.userId}`);
      throw new BadRequestException('La filière "Autre" nécessite une précision');
    }

    // Vérifier la disponibilité
    const isAvailable = await this.isSlotAvailable(
      processedData.date,
      processedData.time,
    );
    
    if (!isAvailable) {
      this.logger.warn(`Créneau non disponible: ${processedData.date} ${processedData.time} pour ${createDto.userId}`);
      throw new BadRequestException("Ce créneau horaire n'est pas disponible");
    }

    // Vérifier le nombre maximum de créneaux par jour
    const dayCount = await this.rendezvousModel.countDocuments({
      date: processedData.date,
      status: { $ne: RENDEZVOUS_STATUS.CANCELLED },
    });

    if (dayCount >= MAX_SLOTS_PER_DAY) {
      this.logger.warn(`Date complète: ${processedData.date} pour ${createDto.userId}`);
      throw new BadRequestException(
        "Tous les créneaux sont complets pour cette date",
      );
    }

    // Préparer les données pour l'enregistrement
    const rendezvousData: any = {
      userId: new Types.ObjectId(createDto.userId),
      firstName: processedData.firstName.trim(),
      lastName: processedData.lastName.trim(),
      email: processedData.email.toLowerCase().trim(),
      telephone: processedData.telephone.trim(),
      niveauEtude: processedData.niveauEtude,
      date: processedData.date,
      time: processedData.time,
      // Par défaut CONFIRMED
      status: RENDEZVOUS_STATUS.CONFIRMED,
    };

    // Gestion des champs "Autre" pour la base de données
    if (processedData.destination === 'Autre' && processedData.destinationAutre) {
      rendezvousData.destination = 'Autre';
      rendezvousData.destinationAutre = processedData.destinationAutre.trim();
    } else {
      rendezvousData.destination = processedData.destination;
    }

    if (processedData.filiere === 'Autre' && processedData.filiereAutre) {
      rendezvousData.filiere = 'Autre';
      rendezvousData.filiereAutre = processedData.filiereAutre.trim();
    } else {
      rendezvousData.filiere = processedData.filiere;
    }

    this.logger.debug(`Données prêtes pour enregistrement: ${JSON.stringify(rendezvousData, null, 2)}`);

    // Créer le rendez-vous
    const created = new this.rendezvousModel(rendezvousData);
    const saved = await created.save();
    
    this.logger.log(`Rendez-vous créé avec ID: ${saved._id} pour l'utilisateur ${createDto.userId} (Statut: Confirmé)`);

    // Notification
    await this.sendNotification(saved, "confirmation");

    return saved;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
    date?: string,
    search?: string,
  ): Promise<{ 
    data: Rendezvous[]; 
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const filters: any = {};
    if (status) filters.status = status;
    if (date) filters.date = date;
    if (search) {
      const normalizedSearch = search.trim();
      filters.$or = [
        { email: { $regex: normalizedSearch, $options: "i" } },
        { destination: { $regex: normalizedSearch, $options: "i" } },
        { firstName: { $regex: normalizedSearch, $options: "i" } },
        { lastName: { $regex: normalizedSearch, $options: "i" } },
      ];
    }

    this.logger.debug(`Filtres admin findAll: ${JSON.stringify(filters)}`);
    this.logger.debug(`Page: ${page}, Limit: ${limit}, Skip: ${skip}`);

    const [data, total] = await Promise.all([
      this.rendezvousModel
        .find(filters)
        .skip(skip)
        .limit(limit)
        .sort({ date: 1, time: 1 })
        .populate('userId', 'firstName lastName email telephone')
        .exec(),
      this.rendezvousModel.countDocuments(filters),
    ]);

    this.logger.debug(`Nombre de rendez-vous trouvés par admin: ${total}`);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<{ 
    data: Rendezvous[]; 
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    
    this.logger.log(`SERVICE - Recherche rendez-vous pour userId: "${userId}"`);
    this.logger.log(`SERVICE - Paramètres: page=${page}, limit=${limit}, status=${status || 'tous'}`);
    
    // Valider que l'userId est un ObjectId valide
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID utilisateur invalide');
    }

    const objectIdUserId = new Types.ObjectId(userId);
    
    const filters: any = { 
      userId: objectIdUserId 
    };
    
    // Filtrer par statut SEULEMENT si spécifié
    if (status) {
      filters.status = status;
    } else {
      this.logger.log(`SERVICE - Pas de filtre de statut, retour de TOUS les rendez-vous`);
    }

    this.logger.log(`SERVICE - Filtres MongoDB: ${JSON.stringify(filters)}`);

    const [data, total] = await Promise.all([
      this.rendezvousModel
        .find(filters)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ date: -1, time: 1 })
        .lean()
        .exec(),
      this.rendezvousModel.countDocuments(filters).exec(),
    ]);

    this.logger.log(`SERVICE - Résultats: ${data.length} rendez-vous trouvés sur ${total} total`);
    
    if (data.length > 0) {
      this.logger.log(`SERVICE - Statuts des rendez-vous trouvés:`, 
        data.map(rdv => ({ id: rdv._id, status: rdv.status, date: rdv.date })));
    }

    return {
      data: data as Rendezvous[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId?: string): Promise<Rendezvous | null> {
    this.logger.log(`Recherche du rendez-vous avec ID: ${id}`);
    
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID rendez-vous invalide');
    }

    const rdv = await this.rendezvousModel.findById(id).exec();
    
    if (!rdv) {
      this.logger.warn(`Rendez-vous non trouvé: ${id}`);
      return null;
    }
    
    // Vérifier si l'utilisateur est autorisé à voir ce rendez-vous
    if (userId) {
      const rdvUserId = rdv.userId?.toString();
      
      if (rdvUserId !== userId) {
        this.logger.warn(`Accès non autorisé au rendez-vous: ${id}`);
        return null;
      }
    }
    
    this.logger.log(`Rendez-vous trouvé: ${id}, statut: ${rdv.status}`);
    return rdv;
  }

  async update(
    id: string,
    updateDto: UpdateRendezvousDto,
    user: any,
  ): Promise<Rendezvous> {
    this.logger.log(`Tentative de mise à jour du rendez-vous: ${id} par ${user.email}`);

    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      this.logger.warn(`Rendez-vous non trouvé pour mise à jour: ${id}`);
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Vérifier les permissions avec userId - utiliser id directement
    if (user.role !== UserRole.ADMIN) {
      const rdvUserId = rdv.userId?.toString();
      
      // Utiliser user.id directement
      if (rdvUserId !== user.id) {
        this.logger.warn(`Tentative d'accès non autorisé au rendez-vous: ${id}`);
        throw new ForbiddenException(
          "Vous ne pouvez modifier que vos propres rendez-vous",
        );
      }
    }

    // Si admin modifie le userId, vérifier que le nouvel utilisateur existe
    if (updateDto.userId && user.role === UserRole.ADMIN) {
      if (!Types.ObjectId.isValid(updateDto.userId)) {
        throw new BadRequestException("ID utilisateur invalide");
      }
      const newUser = await this.userModel.findById(updateDto.userId).exec();
      if (!newUser) {
        throw new BadRequestException("Nouvel utilisateur non trouvé");
      }
      // Mettre à jour l'email pour correspondre au nouvel utilisateur
      updateDto.email = newUser.email;
    }

    // Si utilisateur normal, forcer le userId à rester le sien
    if (user.role !== UserRole.ADMIN && updateDto.userId) {
      throw new ForbiddenException("Vous ne pouvez pas changer l'utilisateur du rendez-vous");
    }

    // Si l'email est modifié, vérifier qu'il correspond à l'utilisateur
    if (updateDto.email) {
      const userIdToCheck = updateDto.userId || rdv.userId.toString();
      const userToCheck = await this.userModel.findById(userIdToCheck).exec();
      if (userToCheck && updateDto.email.toLowerCase().trim() !== userToCheck.email.toLowerCase().trim()) {
        throw new BadRequestException("L'email doit correspondre à l'utilisateur");
      }
    }

    // Validation des données si nécessaire
    if (updateDto.date || updateDto.time) {
      const date = updateDto.date || rdv.date;
      const time = updateDto.time || rdv.time;
      this.validateDateConstraints(date);
      this.validateTimeSlot(time);

      if (updateDto.date || updateDto.time) {
        const isAvailable = await this.isSlotAvailable(date, time, id);
        if (!isAvailable) {
          this.logger.warn(`Créneau non disponible pour mise à jour: ${date} ${time}`);
          throw new BadRequestException(
            "Ce créneau horaire n'est pas disponible",
          );
        }
      }
    }

    // Si admin veut changer le statut
    if (updateDto.status && user.role === UserRole.ADMIN) {
      // Admin peut mettre en attente, confirmer, annuler ou terminer
      if (!Object.values(RENDEZVOUS_STATUS).includes(updateDto.status as RendezvousStatus)) {
        throw new BadRequestException("Statut invalide");
      }
      
      // Pour "Terminé", vérifier avisAdmin obligatoire
      if (updateDto.status === RENDEZVOUS_STATUS.COMPLETED && !updateDto.avisAdmin) {
        throw new BadRequestException("L'avis admin est obligatoire pour terminer un rendez-vous");
      }
      
      // Pour "Terminé", avisAdmin doit être Favorable ou Défavorable
      if (updateDto.status === RENDEZVOUS_STATUS.COMPLETED && updateDto.avisAdmin) {
        if (!Object.values(ADMIN_OPINION).includes(updateDto.avisAdmin as AdminOpinion)) {
          throw new BadRequestException("Avis admin invalide. Doit être 'Favorable' ou 'Défavorable'");
        }
        
        // Si Terminé + Favorable, créer une procédure automatiquement
        if (updateDto.avisAdmin === ADMIN_OPINION.FAVORABLE) {
          setTimeout(async () => {
            await this.createProcedureIfEligible(rdv);
          }, 0);
        }
      }
    } else if (updateDto.status && user.role !== UserRole.ADMIN) {
      // Utilisateur normal ne peut que annuler un rendez-vous confirmé
      if (updateDto.status !== RENDEZVOUS_STATUS.CANCELLED) {
        throw new ForbiddenException("Seuls les administrateurs peuvent changer le statut");
      }
      
      if (rdv.status !== RENDEZVOUS_STATUS.CONFIRMED) {
        throw new BadRequestException("Vous ne pouvez annuler que les rendez-vous confirmés");
      }
    }

    const updated = await this.rendezvousModel.findByIdAndUpdate(
      id,
      updateDto,
      { new: true, runValidators: true },
    );

    if (!updated) {
      this.logger.error(`Rendez-vous non trouvé après mise à jour: ${id}`);
      throw new NotFoundException("Rendez-vous non trouvé après mise à jour");
    }

    this.logger.log(`Rendez-vous mis à jour: ${id}`);
    
    // Notification
    if (updateDto.status) {
      await this.sendNotification(updated, "status");
    }
    
    return updated;
  }

  async updateStatus(
    id: string,
    status: string,
    avisAdmin?: string,
    user?: any,
  ): Promise<Rendezvous> {
    this.logger.log(`Tentative de changement de statut: ${status} pour le rendez-vous: ${id} par ${user?.email}`);

    if (!user || user.role !== UserRole.ADMIN) {
      this.logger.warn(`Tentative non autorisée de changement de statut par ${user?.email}`);
      throw new ForbiddenException("Accès réservé aux administrateurs");
    }

    const allowedStatuses = Object.values(RENDEZVOUS_STATUS);
    if (!allowedStatuses.includes(status as RendezvousStatus)) {
      this.logger.warn(`Statut invalide: ${status} pour le rendez-vous: ${id}`);
      throw new BadRequestException("Statut invalide");
    }

    if (status === RENDEZVOUS_STATUS.COMPLETED && !avisAdmin) {
      this.logger.warn(`Avis admin manquant pour terminer le rendez-vous: ${id}`);
      throw new BadRequestException(
        "L'avis admin est obligatoire pour terminer un rendez-vous",
      );
    }

    // Pour "Terminé", vérifier que avisAdmin est Favorable ou Défavorable
    if (status === RENDEZVOUS_STATUS.COMPLETED && avisAdmin) {
      if (!Object.values(ADMIN_OPINION).includes(avisAdmin as AdminOpinion)) {
        throw new BadRequestException("Avis admin invalide. Doit être 'Favorable' ou 'Défavorable'");
      }
    }

    const update: any = { status };
    if (avisAdmin !== undefined) {
      update.avisAdmin = avisAdmin;
    }

    const updated = await this.rendezvousModel.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!updated) {
      this.logger.warn(`Rendez-vous non trouvé pour changement de statut: ${id}`);
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    this.logger.log(`Statut mis à jour: ${status} pour le rendez-vous: ${id}`);

    // Notification
    await this.sendNotification(updated, "status");

    // Création automatique de procédure si Terminé + Favorable
    if (status === RENDEZVOUS_STATUS.COMPLETED && avisAdmin === ADMIN_OPINION.FAVORABLE) {
      await this.createProcedureIfEligible(updated);
    }

    return updated;
  }

  async removeWithPolicy(id: string, user: any): Promise<Rendezvous> {
    this.logger.log(`Tentative d'annulation du rendez-vous: ${id} par ${user.email}`);

    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      this.logger.warn(`Rendez-vous non trouvé pour annulation: ${id}`);
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    const isAdmin = user.role === UserRole.ADMIN;

    // Vérifier les permissions avec userId - utiliser id directement
    if (!isAdmin) {
      const rdvUserId = rdv.userId?.toString();
      
      // Utiliser user.id directement
      if (rdvUserId !== user.id) {
        this.logger.warn(`Tentative d'annulation non autorisée du rendez-vous: ${id}`);
        throw new ForbiddenException(
          "Vous ne pouvez supprimer que vos propres rendez-vous",
        );
      }
    }

    // Utilisateur normal ne peut annuler que les rendez-vous CONFIRMÉS
    if (!isAdmin && rdv.status !== RENDEZVOUS_STATUS.CONFIRMED) {
      this.logger.warn(`Tentative d'annulation d'un rendez-vous non confirmé: ${id} (statut: ${rdv.status})`);
      throw new BadRequestException(
        "Vous ne pouvez annuler que les rendez-vous confirmés",
      );
    }

    // Restriction horaire pour les utilisateurs
    if (!isAdmin) {
      const rdvDateTime = new Date(`${rdv.date}T${rdv.time}:00`);
      const now = new Date();
      const diffMs = rdvDateTime.getTime() - now.getTime();
      const twoHoursMs = CANCELLATION_THRESHOLD_HOURS * 60 * 60 * 1000;

      if (diffMs <= twoHoursMs) {
        this.logger.warn(`Tentative d'annulation tardive du rendez-vous: ${id}`);
        throw new BadRequestException(
          "Vous ne pouvez plus annuler votre rendez-vous à moins de 2 heures de l'heure prévue",
        );
      }
    }

    // SOFT DELETE - Changement de statut en Annulé
    const updated = await this.rendezvousModel.findByIdAndUpdate(
      id,
      {
        status: RENDEZVOUS_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: user.role === UserRole.ADMIN ? "admin" : "user",
        cancellationReason:
          user.role === UserRole.ADMIN
            ? "Annulé par l'administrateur"
            : "Annulé par l'utilisateur",
      },
      { new: true },
    );

    if (!updated) {
      this.logger.error(`Rendez-vous non trouvé après annulation: ${id}`);
      throw new NotFoundException("Rendez-vous non trouvé après annulation");
    }

    this.logger.log(`Rendez-vous annulé: ${id}`);

    // Notification d'annulation
    await this.sendNotification(updated, "status");

    return updated;
  }

  async confirmByUser(id: string, user: any): Promise<Rendezvous> {
    this.logger.log(`Tentative de confirmation du rendez-vous: ${id} par ${user.email}`);

    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      this.logger.warn(`Rendez-vous non trouvé pour confirmation: ${id}`);
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Seul l'admin peut confirmer/changer le statut
    if (user.role !== UserRole.ADMIN) {
      this.logger.warn(`Tentative de confirmation par non-admin: ${id}`);
      throw new ForbiddenException(
        "La confirmation des rendez-vous est réservée aux administrateurs",
      );
    }

    if (rdv.status !== RENDEZVOUS_STATUS.PENDING) {
      this.logger.warn(`Tentative de confirmation d'un rendez-vous non en attente: ${id} (statut: ${rdv.status})`);
      throw new BadRequestException(
        "Seuls les rendez-vous en attente peuvent être confirmés par l'admin",
      );
    }

    // Vérifier que le rendez-vous n'est pas passé
    const now = new Date();
    const rdvDateTime = new Date(`${rdv.date}T${rdv.time}`);
    if (rdvDateTime < now) {
      this.logger.warn(`Tentative de confirmation d'un rendez-vous passé: ${id}`);
      throw new BadRequestException(
        "Impossible de confirmer un rendez-vous passé",
      );
    }

    const updated = await this.rendezvousModel.findByIdAndUpdate(
      id,
      { status: RENDEZVOUS_STATUS.CONFIRMED },
      { new: true },
    );

    if (!updated) {
      this.logger.error(`Rendez-vous non trouvé après confirmation: ${id}`);
      throw new NotFoundException("Rendez-vous non trouvé après confirmation");
    }

    this.logger.log(`Rendez-vous confirmé par admin: ${id}`);
    await this.sendNotification(updated, "status");

    return updated;
  }

  // ==================== AVAILABILITY METHODS ====================

  async getAvailableSlots(date: string): Promise<string[]> {
    this.logger.log(`Recherche des créneaux disponibles pour: ${date}`);

    if (this.isWeekend(date) || this.isHoliday(date)) {
      this.logger.log(`Aucun créneau disponible (weekend/jour férié): ${date}`);
      return [];
    }

    const occupiedSlots = await this.getOccupiedSlots(date);
    const allSlots = this.generateTimeSlots();

    // Filtrer les créneaux passés si c'est aujourd'hui
    const today = new Date().toISOString().split("T")[0];
    if (date === today) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const availableSlots = allSlots.filter((slot) => {
        const [hours, minutes] = slot.split(":").map(Number);
        const slotTime = hours * 60 + minutes;
        return slotTime > currentTime && !occupiedSlots.includes(slot);
      });

      this.logger.log(`Créneaux disponibles pour ${date}: ${availableSlots.length}`);
      return availableSlots;
    }

    const availableSlots = allSlots.filter((slot) => !occupiedSlots.includes(slot));
    this.logger.log(`Créneaux disponibles pour ${date}: ${availableSlots.length}`);
    return availableSlots;
  }

  async getAvailableDates(): Promise<string[]> {
    this.logger.log(`Recherche des dates disponibles`);
    const availableDates: string[] = [];
    const today = new Date();

    for (let i = 0; i < 60; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];

      if (this.isWeekend(dateStr) || this.isHoliday(dateStr)) {
        continue;
      }

      const dayCount = await this.rendezvousModel.countDocuments({
        date: dateStr,
        status: { $ne: RENDEZVOUS_STATUS.CANCELLED },
      });

      if (dayCount < MAX_SLOTS_PER_DAY) {
        availableDates.push(dateStr);
      }
    }

    this.logger.log(`Dates disponibles trouvées: ${availableDates.length}`);
    return availableDates;
  }

  // ==================== PRIVATE METHODS ====================

  private processAndValidateRendezvousData(
    createDto: CreateRendezvousDto | UpdateRendezvousDto,
  ): any {
    const processed = { ...createDto };

    // Normaliser l'email
    if (processed.email) {
      processed.email = processed.email.toLowerCase().trim();
    }

    // Validation des champs requis
    if (processed.destination) processed.destination = processed.destination.trim();
    if (processed.destinationAutre) processed.destinationAutre = processed.destinationAutre.trim();
    if (processed.filiere) processed.filiere = processed.filiere.trim();
    if (processed.filiereAutre) processed.filiereAutre = processed.filiereAutre.trim();
    
    // Validation date et heure
    if (processed.date) this.validateDateConstraints(processed.date);
    if (processed.time) this.validateTimeSlot(processed.time);

    return processed;
  }

  private validateDateConstraints(dateStr: string): void {
    if (this.isWeekend(dateStr)) {
      this.logger.warn(`Tentative de réservation un weekend: ${dateStr}`);
      throw new BadRequestException(
        "Les réservations sont fermées le week-end",
      );
    }

    if (this.isHoliday(dateStr)) {
      this.logger.warn(`Tentative de réservation un jour férié: ${dateStr}`);
      throw new BadRequestException(
        "Les réservations sont fermées les jours fériés",
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dateStr);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      this.logger.warn(`Tentative de réservation d'une date passée: ${dateStr}`);
      throw new BadRequestException(
        "Vous ne pouvez pas réserver une date passée",
      );
    }
  }

  private validateTimeSlot(time: string): void {
    const [hours, minutes] = time.split(":").map(Number);
    const timeInHours = hours + minutes / 60;

    if (
      timeInHours < WORKING_HOURS.start ||
      timeInHours > WORKING_HOURS.end
    ) {
      this.logger.warn(`Créneau horaire invalide: ${time}`);
      throw new BadRequestException(
        "Les horaires disponibles sont entre 9h00 et 16h30",
      );
    }

    const totalMinutes = (hours - 9) * 60 + minutes;
    if (totalMinutes % 30 !== 0) {
      this.logger.warn(`Créneau non conforme: ${time}`);
      throw new BadRequestException(
        "Les créneaux doivent être espacés de 30 minutes (9h00, 9h30, 10h00, etc.)",
      );
    }
  }

  private async isSlotAvailable(
    date: string,
    time: string,
    excludeId?: string,
  ): Promise<boolean> {
    const query: any = {
      date,
      time,
      status: { $ne: RENDEZVOUS_STATUS.CANCELLED },
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await this.rendezvousModel.findOne(query);
    return !existing;
  }

  private async getOccupiedSlots(date: string): Promise<string[]> {
    const results = await this.rendezvousModel
      .find({
        date,
        status: { $ne: RENDEZVOUS_STATUS.CANCELLED },
      })
      .select("time -_id")
      .lean();

    return results.map((r) => r.time);
  }

  private generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let hour = 9; hour <= 16; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      if (hour < 16) {
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
    }
    return slots;
  }

  private isWeekend(dateStr: string): boolean {
    const date = new Date(dateStr);
    return date.getDay() === 0 || date.getDay() === 6;
  }

  private async sendNotification(
    rendezvous: Rendezvous,
    type: "confirmation" | "status" | "reminder",
  ): Promise<void> {
    try {
      switch (type) {
        case "confirmation":
          await this.notificationService.sendConfirmation(rendezvous);
          break;
        case "status":
          await this.notificationService.sendStatusUpdate(rendezvous);
          break;
        case "reminder":
          await this.notificationService.sendReminder(rendezvous);
          break;
      }
      this.logger.log(`Notification ${type} envoyée pour le rendez-vous: ${rendezvous._id}`);
    } catch (error) {
      this.logger.error(`Erreur notification ${type} pour ${rendezvous._id}: ${error.message}`);
    }
  }

  private async createProcedureIfEligible(
    rendezvous: Rendezvous,
  ): Promise<void> {
    this.logger.log(`Vérification éligibilité procédure pour le rendez-vous: ${rendezvous._id}`);

    const existingProcedure = await this.procedureService.findByEmail(
      rendezvous.email,
    );

    if (!existingProcedure || existingProcedure.length === 0) {
      try {
        const createDto: CreateProcedureDto = {
          rendezVousId: rendezvous._id.toString(),
        };
        await this.procedureService.createFromRendezvous(createDto);
        this.logger.log(`Procédure créée pour le rendez-vous: ${rendezvous._id}`);
        await this.sendNotification(rendezvous, "status");
      } catch (error) {
        this.logger.error(`Erreur création procédure pour ${rendezvous._id}: ${error.message}`);
      }
    } else {
      this.logger.log(`Procédure déjà existante pour ${rendezvous.email}`);
    }
  }

  // ==================== CRON JOBS ====================

  @Cron("0 9 * * *")
  async sendDailyReminders(): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const rendezvous = await this.rendezvousModel.find({
      date: today,
      status: RENDEZVOUS_STATUS.CONFIRMED,
    });

    this.logger.log(`Envoi rappels pour ${rendezvous.length} rendez-vous`);

    for (const rdv of rendezvous) {
      await this.sendNotification(rdv, "reminder");
    }
  }

  @Cron("0 * * * *")
  async updatePastRendezVous(): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const result = await this.rendezvousModel.updateMany(
      {
        date: { $lt: today },
        status: { $in: [RENDEZVOUS_STATUS.PENDING, RENDEZVOUS_STATUS.CONFIRMED] },
      },
      { $set: { status: RENDEZVOUS_STATUS.COMPLETED } },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(`${result.modifiedCount} rendez-vous passés mis à jour automatiquement`);
    }
  }

  @Cron("0 * * * *")
  async autoCancelPendingRendezvous(): Promise<void> {
    // Annuler les "En attente" après 5h
    const fiveHoursAgo = new Date();
    fiveHoursAgo.setHours(fiveHoursAgo.getHours() - AUTO_CANCEL_PENDING_HOURS);

    const result = await this.rendezvousModel.updateMany(
      {
        status: RENDEZVOUS_STATUS.PENDING,
        createdAt: { $lt: fiveHoursAgo },
      },
      { $set: { status: RENDEZVOUS_STATUS.CANCELLED } },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(`${result.modifiedCount} rendez-vous en attente automatiquement annulés (délai de 5h dépassé)`);
    }
  }
}