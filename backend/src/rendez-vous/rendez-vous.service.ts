import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Cron } from "@nestjs/schedule";
import { ProcedureService } from "../procedure/procedure.service";
import { NotificationService } from "../notification/notification.service";
import { UsersService } from "../users/users.service";
import { Rendezvous } from "../schemas/rendezvous.schema";
import { CreateRendezvousDto } from "./dto/create-rendezvous.dto";
import { UpdateRendezvousDto } from "./dto/update-rendezvous.dto";
import { CreateProcedureDto } from "../procedure/dto/create-procedure.dto";
const Holidays = require('date-holidays');

// Constantes pour la cohérence
const RENDEZVOUS_STATUS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  EXPIRED: 'Expiré'
} as const;

const ADMIN_OPINION = {
  FAVORABLE: 'Favorable',
  UNFAVORABLE: 'Défavorable'
} as const;

const MAX_SLOTS_PER_DAY = 24;
const WORKING_HOURS = { start: 9, end: 16.5 };
const CANCELLATION_THRESHOLD_HOURS = 2;
const AUTO_CANCEL_PENDING_HOURS = 5;
const EXPIRATION_BUFFER_MINUTES = 10; // 10 minutes après l'horaire

// Types pour la cohérence
type RendezvousStatus = typeof RENDEZVOUS_STATUS[keyof typeof RENDEZVOUS_STATUS];
type AdminOpinion = typeof ADMIN_OPINION[keyof typeof ADMIN_OPINION];

@Injectable()
export class RendezvousService {
  private readonly logger = new Logger(RendezvousService.name);
  private holidays: any;
  private cachedHolidays: Map<string, string[]> = new Map();

  constructor(
    @InjectModel(Rendezvous.name) private rendezvousModel: Model<Rendezvous>,
    private procedureService: ProcedureService,
    private notificationService: NotificationService,
    private usersService: UsersService,
  ) {
    this.initializeHolidays();
  }

  // ==================== UTILITY METHODS ====================

  private initializeHolidays(): void {
    try {
      this.holidays = new Holidays('ML');
      this.logger.log('Bibliothèque date-holidays initialisée pour le Mali');
    } catch (error) {
      this.logger.error('Erreur d\'initialisation de date-holidays');
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
      this.logger.error(`Erreur lors de la récupération des jours fériés pour ${year}`);
      
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
      this.logger.error('Erreur lors de la vérification du jour férié');
      return false;
    }
  }

  private maskEmail(email: string): string {
    if (!email) return '***';
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***';
    
    if (localPart.length <= 2) {
      return `${localPart.charAt(0)}***@${domain}`;
    }
    return `${localPart.charAt(0)}***${localPart.charAt(localPart.length - 1)}@${domain}`;
  }

  private getCurrentDateTime(): Date {
    return new Date();
  }

  private isToday(dateStr: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  }

  private isPastTimeSlot(dateStr: string, timeStr: string): boolean {
    const now = new Date();
    const slotDateTime = new Date(`${dateStr}T${timeStr}:00`);
    return slotDateTime < now;
  }

  private isExpiredRendezvous(rendezvous: Rendezvous): boolean {
    if (rendezvous.status === RENDEZVOUS_STATUS.EXPIRED) {
      return true;
    }

    // Vérifier si le rendez-vous a dépassé son horaire + 10 minutes
    const now = new Date();
    const rdvDateTime = new Date(`${rendezvous.date}T${rendezvous.time}:00`);
    const expirationTime = new Date(rdvDateTime.getTime() + EXPIRATION_BUFFER_MINUTES * 60000);

    return now > expirationTime && 
           (rendezvous.status === RENDEZVOUS_STATUS.PENDING || 
            rendezvous.status === RENDEZVOUS_STATUS.CONFIRMED);
  }

  private isPastRendezvous(rendezvous: Rendezvous): boolean {
    const rdvDateTime = new Date(`${rendezvous.date}T${rendezvous.time}:00`);
    const now = new Date();
    return rdvDateTime < now;
  }

  private isFutureRendezvous(rendezvous: Rendezvous): boolean {
    const rdvDateTime = new Date(`${rendezvous.date}T${rendezvous.time}:00`);
    const now = new Date();
    return rdvDateTime > now;
  }

  // ==================== CORE METHODS ====================

  async create(createDto: CreateRendezvousDto, userEmail: string, isAdmin: boolean = false): Promise<Rendezvous> {
    const maskedEmail = this.maskEmail(createDto.email);
    this.logger.log(`Création d'un nouveau rendez-vous pour: ${maskedEmail}`);

    // VÉRIFICATION: Email doit exister dans Users
    const user = await this.usersService.findByEmail(createDto.email);
    if (!user) {
      this.logger.warn(`Tentative de prise de rendez-vous sans compte: ${maskedEmail}`);
      throw new ForbiddenException("Vous devez avoir un compte pour prendre un rendez-vous.");
    }

    // Vérification des permissions email pour les non-admins
    if (!isAdmin) {
      const normalizedDtoEmail = createDto.email.toLowerCase().trim();
      const normalizedUserEmail = userEmail.toLowerCase().trim();
      
      if (normalizedDtoEmail !== normalizedUserEmail) {
        this.logger.warn(`Tentative de création avec email différent: ${maskedEmail}`);
        throw new BadRequestException("L'email doit correspondre exactement à votre compte de connexion");
      }
    }

    // VÉRIFICATION: Max 1 rendez-vous confirmé par utilisateur
    const confirmedCount = await this.rendezvousModel.countDocuments({
      email: createDto.email.toLowerCase().trim(),
      status: RENDEZVOUS_STATUS.CONFIRMED,
    });

    this.logger.log(`Nombre de rendez-vous confirmés pour ${maskedEmail}: ${confirmedCount}`);

    if (confirmedCount >= 1) {
      this.logger.warn(`Tentative de création d'un deuxième rendez-vous pour: ${maskedEmail}`);
      throw new BadRequestException("Vous avez déjà un rendez-vous confirmé");
    }

    // Traitement et validation des données
    const processedData = this.processAndValidateRendezvousData(createDto);

    // Vérification champs "Autre"
    if (processedData.destination === 'Autre' && (!processedData.destinationAutre || processedData.destinationAutre.trim() === '')) {
      throw new BadRequestException('La destination "Autre" nécessite une précision');
    }
    
    if (processedData.filiere === 'Autre' && (!processedData.filiereAutre || processedData.filiereAutre.trim() === '')) {
      throw new BadRequestException('La filière "Autre" nécessite une précision');
    }

    // Vérification disponibilité du créneau
    const isAvailable = await this.isSlotAvailable(processedData.date, processedData.time);
    if (!isAvailable) {
      this.logger.warn('Créneau non disponible');
      throw new BadRequestException("Ce créneau horaire n'est pas disponible");
    }

    // Vérification limite quotidienne (24 max)
    const dayCount = await this.rendezvousModel.countDocuments({
      date: processedData.date,
      status: { $nin: [RENDEZVOUS_STATUS.CANCELLED, RENDEZVOUS_STATUS.EXPIRED] },
    });

    if (dayCount >= MAX_SLOTS_PER_DAY) {
      this.logger.warn('Date complète');
      throw new BadRequestException("Tous les créneaux sont complets pour cette date");
    }

    // Validation des contraintes de date
    this.validateDateConstraints(processedData.date);
    
    // Validation de l'heure
    this.validateTimeSlot(processedData.time);

    // Vérifier que la date/heure n'est pas passée
    if (this.isToday(processedData.date)) {
      if (this.isPastTimeSlot(processedData.date, processedData.time)) {
        throw new BadRequestException("Vous ne pouvez pas réserver un créneau passé");
      }
    }

    // Vérifier date passée
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(processedData.date);
    selectedDate.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      throw new BadRequestException("Vous ne pouvez pas réserver une date passée");
    }

    // Préparation des données
    const rendezvousData: any = {
      firstName: processedData.firstName.trim(),
      lastName: processedData.lastName.trim(),
      email: processedData.email.toLowerCase().trim(),
      telephone: processedData.telephone.trim(),
      niveauEtude: processedData.niveauEtude,
      date: processedData.date,
      time: processedData.time,
      status: RENDEZVOUS_STATUS.CONFIRMED, // Statut confirmé automatiquement
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Gestion des champs "Autre"
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

    // Création du rendez-vous
    const created = new this.rendezvousModel(rendezvousData);
    const saved = await created.save();
    
    this.logger.log(`Rendez-vous créé avec ID: ${saved._id} pour ${maskedEmail}`);

    // Notification (asynchrone)
    this.sendNotification(saved, "confirmation").catch(notifError => {
      this.logger.error('Erreur notification:', notifError);
    });

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

    // Exclure les rendez-vous expirés et annulés côté backend
    filters.status = { $nin: [RENDEZVOUS_STATUS.EXPIRED, RENDEZVOUS_STATUS.CANCELLED] };

    const [data, total] = await Promise.all([
      this.rendezvousModel
        .find(filters)
        .skip(skip)
        .limit(limit)
        .sort({ date: 1, time: 1 })
        .exec(),
      this.rendezvousModel.countDocuments(filters),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findByEmail(
    email: string,
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
    
    const maskedEmail = this.maskEmail(email);
    this.logger.log(`Recherche rendez-vous pour: ${maskedEmail}`);
    
    // Vérifier que l'email a un compte
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new ForbiddenException("Aucun compte trouvé pour cet email.");
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    const filters: any = { 
      email: normalizedEmail,
      status: { $nin: [RENDEZVOUS_STATUS.EXPIRED, RENDEZVOUS_STATUS.CANCELLED] } // Exclure expirés/annulés
    };
    
    if (status) {
      filters.status = status;
    }

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

    this.logger.log(`Résultats pour ${maskedEmail}: ${data.length} rendez-vous trouvés`);

    return {
      data: data as Rendezvous[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userEmail?: string, isAdmin: boolean = false): Promise<Rendezvous | null> {
    const rdv = await this.rendezvousModel.findById(id).exec();
    
    if (!rdv) {
      return null;
    }
    
    // Vérifier compte utilisateur
    const user = await this.usersService.findByEmail(rdv.email);
    if (!user) {
      throw new ForbiddenException("Le compte lié à ce rendez-vous n'existe plus");
    }
    
    // Vérifier permissions
    if (!isAdmin && userEmail) {
      const normalizedRdvEmail = rdv.email.toLowerCase().trim();
      const normalizedUserEmail = userEmail.toLowerCase().trim();
      
      if (normalizedRdvEmail !== normalizedUserEmail) {
        return null;
      }
    }
    
    return rdv;
  }

  async update(
    id: string,
    updateDto: UpdateRendezvousDto,
    userEmail: string,
    isAdmin: boolean = false,
  ): Promise<Rendezvous> {
    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Vérifier si le rendez-vous est expiré
    if (this.isExpiredRendezvous(rdv) || rdv.status === RENDEZVOUS_STATUS.EXPIRED) {
      throw new BadRequestException("Impossible de modifier un rendez-vous expiré");
    }

    // Vérifier si le rendez-vous est terminé
    if (rdv.status === RENDEZVOUS_STATUS.COMPLETED) {
      throw new BadRequestException("Impossible de modifier un rendez-vous terminé");
    }

    // Vérifier permissions
    if (!isAdmin) {
      const normalizedRdvEmail = rdv.email.toLowerCase().trim();
      const normalizedUserEmail = userEmail.toLowerCase().trim();
      
      if (normalizedRdvEmail !== normalizedUserEmail) {
        throw new ForbiddenException("Vous ne pouvez modifier que vos propres rendez-vous");
      }
    }

    // Vérification changement d'email
    if (updateDto.email && updateDto.email !== rdv.email) {
      const newEmailUser = await this.usersService.findByEmail(updateDto.email);
      if (!newEmailUser) {
        throw new ForbiddenException("Le nouvel email doit correspondre à un compte existant");
      }
    }

    // Pour utilisateur normal, empêcher le changement d'email
    if (!isAdmin && updateDto.email) {
      const normalizedUpdateEmail = updateDto.email.toLowerCase().trim();
      const normalizedUserEmail = userEmail.toLowerCase().trim();
      
      if (normalizedUpdateEmail !== normalizedUserEmail) {
        throw new ForbiddenException("Vous ne pouvez pas changer l'email du rendez-vous");
      }
    }

    // Vérifier les transitions de statut autorisées
    if (updateDto.status) {
      // Validation spécifique pour le statut "Terminé"
      if (updateDto.status === RENDEZVOUS_STATUS.COMPLETED) {
        // Vérifier que le rendez-vous n'est pas dans le futur
        if (this.isFutureRendezvous(rdv)) {
          throw new BadRequestException(
            "Impossible de marquer comme terminé un rendez-vous futur. " +
            "Seuls les rendez-vous dont la date/heure est passée peuvent être terminés."
          );
        }
      }
      
      await this.validateStatusTransition(rdv.status, updateDto.status, isAdmin);
    }

    // Validation des données si date/time changent
    if (updateDto.date || updateDto.time) {
      const date = updateDto.date || rdv.date;
      const time = updateDto.time || rdv.time;
      this.validateDateConstraints(date);
      this.validateTimeSlot(time);

      if (updateDto.date || updateDto.time) {
        const isAvailable = await this.isSlotAvailable(date, time, id);
        if (!isAvailable) {
          throw new BadRequestException("Ce créneau horaire n'est pas disponible");
        }
      }
    }

    // Traiter les champs "Autre"
    if (updateDto.destination === 'Autre' && updateDto.destinationAutre) {
      updateDto.destinationAutre = updateDto.destinationAutre.trim();
    }
    
    if (updateDto.filiere === 'Autre' && updateDto.filiereAutre) {
      updateDto.filiereAutre = updateDto.filiereAutre.trim();
    }

    const updated = await this.rendezvousModel.findByIdAndUpdate(
      id,
      updateDto,
      { new: true, runValidators: true },
    );

    if (!updated) {
      throw new NotFoundException("Rendez-vous non trouvé après mise à jour");
    }

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
    userEmail?: string,
  ): Promise<Rendezvous> {
    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Vérifier si le rendez-vous est expiré
    if (this.isExpiredRendezvous(rdv) || rdv.status === RENDEZVOUS_STATUS.EXPIRED) {
      throw new BadRequestException("Impossible de modifier le statut d'un rendez-vous expiré");
    }

    if (!Object.values(RENDEZVOUS_STATUS).includes(status as RendezvousStatus)) {
      throw new BadRequestException("Statut invalide");
    }

    // Vérification spécifique pour le statut "Terminé"
    if (status === RENDEZVOUS_STATUS.COMPLETED) {
      // VÉRIFICATION IMPORTANTE : Un rendez-vous ne peut être marqué comme "Terminé" 
      // que s'il a déjà eu lieu (date dans le passé ou aujourd'hui)
      if (this.isFutureRendezvous(rdv)) {
        throw new BadRequestException(
          "Impossible de marquer comme terminé un rendez-vous futur. " +
          "Seuls les rendez-vous dont la date/heure est passée peuvent être terminés."
        );
      }
      
      // Vérifier que le rendez-vous n'est pas trop ancien (optionnel)
      const rdvDateTime = new Date(`${rdv.date}T${rdv.time}:00`);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      if (rdvDateTime < oneWeekAgo) {
        throw new BadRequestException(
          "Impossible de marquer comme terminé un rendez-vous trop ancien (plus d'une semaine)"
        );
      }
    }

    // Vérifier les transitions de statut
    await this.validateStatusTransition(rdv.status, status, true); // Admin uniquement

    if (status === RENDEZVOUS_STATUS.COMPLETED && !avisAdmin) {
      throw new BadRequestException("L'avis admin est obligatoire pour terminer un rendez-vous");
    }

    // Pour "Terminé", vérifier que avisAdmin est valide
    if (status === RENDEZVOUS_STATUS.COMPLETED && avisAdmin) {
      if (!Object.values(ADMIN_OPINION).includes(avisAdmin as AdminOpinion)) {
        throw new BadRequestException("Avis admin invalide");
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
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Notification
    await this.sendNotification(updated, "status");

    // Création automatique de procédure si Terminé + Favorable
    if (status === RENDEZVOUS_STATUS.COMPLETED && avisAdmin === ADMIN_OPINION.FAVORABLE) {
      await this.createProcedureIfEligible(updated);
    }

    return updated;
  }

  async removeWithPolicy(id: string, userEmail: string, isAdmin: boolean = false): Promise<Rendezvous> {
    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Vérifier si le rendez-vous est expiré
    if (this.isExpiredRendezvous(rdv) || rdv.status === RENDEZVOUS_STATUS.EXPIRED) {
      throw new BadRequestException("Impossible d'annuler un rendez-vous expiré");
    }

    // Vérifier si le rendez-vous est terminé
    if (rdv.status === RENDEZVOUS_STATUS.COMPLETED) {
      throw new BadRequestException("Impossible d'annuler un rendez-vous terminé");
    }

    // Vérifier permissions
    if (!isAdmin) {
      const normalizedRdvEmail = rdv.email.toLowerCase().trim();
      const normalizedUserEmail = userEmail.toLowerCase().trim();
      
      if (normalizedRdvEmail !== normalizedUserEmail) {
        throw new ForbiddenException("Vous ne pouvez annuler que vos propres rendez-vous");
      }
    }

    // Utilisateur normal ne peut annuler que les rendez-vous CONFIRMÉS
    if (!isAdmin && rdv.status !== RENDEZVOUS_STATUS.CONFIRMED) {
      throw new BadRequestException("Vous ne pouvez annuler que les rendez-vous confirmés");
    }

    // Restriction horaire pour les utilisateurs (2h avant)
    if (!isAdmin) {
      const rdvDateTime = new Date(`${rdv.date}T${rdv.time}:00`);
      const now = new Date();
      const diffMs = rdvDateTime.getTime() - now.getTime();
      const twoHoursMs = CANCELLATION_THRESHOLD_HOURS * 60 * 60 * 1000;

      if (diffMs <= twoHoursMs) {
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
        cancelledBy: isAdmin ? "admin" : "user",
        cancellationReason: isAdmin ? "Annulé par l'administrateur" : "Annulé par l'utilisateur",
      },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException("Rendez-vous non trouvé après annulation");
    }

    // Notification d'annulation
    await this.sendNotification(updated, "status");

    return updated;
  }

  async confirmByUser(id: string, userEmail: string, isAdmin: boolean = false): Promise<Rendezvous> {
    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Seul l'admin peut confirmer
    if (!isAdmin) {
      throw new ForbiddenException("La confirmation des rendez-vous est réservée aux administrateurs");
    }

    // Transition autorisée: PENDING → CONFIRMED (admin uniquement)
    if (rdv.status !== RENDEZVOUS_STATUS.PENDING) {
      throw new BadRequestException("Seuls les rendez-vous en attente peuvent être confirmés");
    }

    // Vérifier que le rendez-vous n'est pas expiré
    if (this.isExpiredRendezvous(rdv)) {
      throw new BadRequestException("Impossible de confirmer un rendez-vous expiré");
    }

    const updated = await this.rendezvousModel.findByIdAndUpdate(
      id,
      { status: RENDEZVOUS_STATUS.CONFIRMED },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException("Rendez-vous non trouvé après confirmation");
    }

    await this.sendNotification(updated, "status");

    return updated;
  }

  // ==================== AVAILABILITY METHODS ====================

  async getAvailableSlots(date: string): Promise<string[]> {
    if (this.isWeekend(date) || this.isHoliday(date)) {
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

      return availableSlots;
    }

    const availableSlots = allSlots.filter((slot) => !occupiedSlots.includes(slot));
    return availableSlots;
  }

  async getAvailableDates(): Promise<string[]> {
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
        status: { $nin: [RENDEZVOUS_STATUS.CANCELLED, RENDEZVOUS_STATUS.EXPIRED] },
      });

      if (dayCount < MAX_SLOTS_PER_DAY) {
        availableDates.push(dateStr);
      }
    }

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

    // Validation des champs
    if (processed.destination) processed.destination = processed.destination.trim();
    if (processed.destinationAutre) processed.destinationAutre = processed.destinationAutre.trim();
    if (processed.filiere) processed.filiere = processed.filiere.trim();
    if (processed.filiereAutre) processed.filiereAutre = processed.filiereAutre.trim();
    
    return processed;
  }

  private validateDateConstraints(dateStr: string): void {
    if (this.isWeekend(dateStr)) {
      throw new BadRequestException("Les réservations sont fermées le week-end");
    }

    if (this.isHoliday(dateStr)) {
      throw new BadRequestException("Les réservations sont fermées les jours fériés");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dateStr);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      throw new BadRequestException("Vous ne pouvez pas réserver une date passée");
    }
  }

  private validateTimeSlot(time: string): void {
    const [hours, minutes] = time.split(":").map(Number);
    const timeInHours = hours + minutes / 60;

    if (
      timeInHours < WORKING_HOURS.start ||
      timeInHours > WORKING_HOURS.end
    ) {
      throw new BadRequestException(
        "Les horaires disponibles sont entre 9h00 et 16h30",
      );
    }

    const totalMinutes = (hours - 9) * 60 + minutes;
    if (totalMinutes % 30 !== 0) {
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
      status: { $nin: [RENDEZVOUS_STATUS.CANCELLED, RENDEZVOUS_STATUS.EXPIRED] },
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
        status: { $nin: [RENDEZVOUS_STATUS.CANCELLED, RENDEZVOUS_STATUS.EXPIRED] },
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

  private async validateStatusTransition(
    currentStatus: string,
    newStatus: string,
    isAdmin: boolean
  ): Promise<void> {
    const transitions: Record<string, string[]> = {
      [RENDEZVOUS_STATUS.PENDING]: [RENDEZVOUS_STATUS.CONFIRMED, RENDEZVOUS_STATUS.CANCELLED, RENDEZVOUS_STATUS.EXPIRED],
      [RENDEZVOUS_STATUS.CONFIRMED]: [RENDEZVOUS_STATUS.COMPLETED, RENDEZVOUS_STATUS.CANCELLED, RENDEZVOUS_STATUS.EXPIRED],
      [RENDEZVOUS_STATUS.COMPLETED]: [],
      [RENDEZVOUS_STATUS.CANCELLED]: [],
      [RENDEZVOUS_STATUS.EXPIRED]: [],
    };

    const allowedTransitions = transitions[currentStatus] || [];
    
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(`Transition de statut invalide: ${currentStatus} → ${newStatus}`);
    }

    // Vérifier les permissions spécifiques
    if (newStatus === RENDEZVOUS_STATUS.CONFIRMED && !isAdmin) {
      throw new ForbiddenException("Seuls les administrateurs peuvent confirmer des rendez-vous");
    }

    if (newStatus === RENDEZVOUS_STATUS.COMPLETED && !isAdmin) {
      throw new ForbiddenException("Seuls les administrateurs peuvent marquer un rendez-vous comme terminé");
    }

    // Règles supplémentaires pour "Terminé"
    if (newStatus === RENDEZVOUS_STATUS.COMPLETED) {
      // Un admin ne peut marquer comme terminé qu'un rendez-vous CONFIRMÉ
      if (currentStatus !== RENDEZVOUS_STATUS.CONFIRMED) {
        throw new BadRequestException(
          `Seuls les rendez-vous confirmés peuvent être marqués comme terminés. ` +
          `Statut actuel: ${currentStatus}`
        );
      }
    }
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
    } catch (error) {
      this.logger.error(`Erreur notification ${type}`);
    }
  }

  private async createProcedureIfEligible(
    rendezvous: Rendezvous,
  ): Promise<void> {
    const existingProcedure = await this.procedureService.findByEmail(
      rendezvous.email,
    );

    if (!existingProcedure || existingProcedure.length === 0) {
      try {
        const createDto: CreateProcedureDto = {
          rendezVousId: rendezvous._id.toString(),
        };
        await this.procedureService.createFromRendezvous(createDto);
        await this.sendNotification(rendezvous, "status");
      } catch (error) {
        this.logger.error('Erreur création procédure');
      }
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

    for (const rdv of rendezvous) {
      await this.sendNotification(rdv, "reminder");
    }
  }

  @Cron("*/10 * * * *") // Toutes les 10 minutes
  async updateExpiredRendezvous(): Promise<void> {
    const now = new Date();
    
    // Chercher les rendez-vous qui devraient être expirés
    const rendezvousToExpire = await this.rendezvousModel.find({
      status: { $in: [RENDEZVOUS_STATUS.PENDING, RENDEZVOUS_STATUS.CONFIRMED] },
    });

    let expiredCount = 0;
    
    for (const rdv of rendezvousToExpire) {
      const rdvDateTime = new Date(`${rdv.date}T${rdv.time}:00`);
      const expirationTime = new Date(rdvDateTime.getTime() + EXPIRATION_BUFFER_MINUTES * 60000);
      
      // Un rendez-vous est expiré si:
      // 1. Date du rendez-vous = aujourd'hui
      // 2. Heure + 10 minutes ≤ maintenant
      // 3. Statut = "En attente" ou "Confirmé"
      const isToday = this.isToday(rdv.date);
      
      if (isToday && now > expirationTime) {
        await this.rendezvousModel.updateOne(
          { _id: rdv._id },
          { $set: { status: RENDEZVOUS_STATUS.EXPIRED } }
        );
        expiredCount++;
        
        // Notification d'expiration
        try {
          await this.sendNotification(rdv, "status");
        } catch (error) {
          this.logger.error('Erreur notification expiration');
        }
      }
    }

    if (expiredCount > 0) {
      this.logger.log(`${expiredCount} rendez-vous automatiquement expirés`);
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

  // ==================== MÉTHODES DE SYNCHRONISATION EMAIL ====================

  async syncUserEmail(oldEmail: string, newEmail: string): Promise<void> {
    try {
      const normalizedOldEmail = oldEmail.toLowerCase().trim();
      const normalizedNewEmail = newEmail.toLowerCase().trim();
      
      const result = await this.rendezvousModel.updateMany(
        { email: normalizedOldEmail },
        { 
          email: normalizedNewEmail,
          updatedAt: new Date()
        }
      );
      
      this.logger.log(`Synchronisation email: ${this.maskEmail(oldEmail)} -> ${this.maskEmail(newEmail)} - ${result.modifiedCount} rendez-vous mis à jour`);
    } catch (error) {
      this.logger.error(`Erreur synchronisation email: ${error.message}`);
    }
  }

  // ==================== MÉTHODES DE VÉRIFICATION EN TEMPS RÉEL ====================

  async checkRealTimeAvailability(date: string, time: string, excludeId?: string): Promise<boolean> {
    // Vérification immédiate sans cache
    return this.isSlotAvailable(date, time, excludeId);
  }

  async getCurrentUserConfirmedRendezvous(email: string): Promise<Rendezvous | null> {
    const normalizedEmail = email.toLowerCase().trim();
    
    return this.rendezvousModel.findOne({
      email: normalizedEmail,
      status: RENDEZVOUS_STATUS.CONFIRMED
    }).exec();
  }

  // ==================== MÉTHODES D'EXPIRATION MANUELLE ====================

  async manuallyExpireOldRendezvous(): Promise<number> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    const result = await this.rendezvousModel.updateMany(
      {
        status: { $in: [RENDEZVOUS_STATUS.PENDING, RENDEZVOUS_STATUS.CONFIRMED] },
        date: { $lt: today }
      },
      {
        $set: { status: RENDEZVOUS_STATUS.EXPIRED }
      }
    );

    this.logger.log(`${result.modifiedCount} anciens rendez-vous marqués comme expirés`);
    return result.modifiedCount;
  }
}