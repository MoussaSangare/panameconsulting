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

  // ==================== CORE METHODS ====================
  async create(createDto: CreateRendezvousDto, userEmail: string, isAdmin: boolean = false): Promise<Rendezvous> {
  const maskedEmail = this.maskEmail(createDto.email);
  this.logger.log(`Création d'un nouveau rendez-vous pour: ${maskedEmail}`);
  this.logger.log(`Email utilisateur depuis token: ${this.maskEmail(userEmail)}, isAdmin: ${isAdmin}`);

  // OPTIMISATION: Exécuter les vérifications en parallèle
  const [user, confirmedCount, processedData] = await Promise.all([
    // 1. Vérifier que l'utilisateur a un compte
    this.usersService.findByEmail(createDto.email),
    
    // 2. Vérifier s'il y a déjà un rendez-vous confirmé
    this.rendezvousModel.countDocuments({
      email: createDto.email.toLowerCase().trim(),
      status: RENDEZVOUS_STATUS.CONFIRMED,
    }),
    
    // 3. Traiter et valider les données
    Promise.resolve(this.processAndValidateRendezvousData(createDto))
  ]);

  // VÉRIFICATION CRITIQUE : S'assurer que l'utilisateur a un compte
  if (!user) {
    this.logger.warn(`Tentative de prise de rendez-vous sans compte: ${maskedEmail}`);
    throw new ForbiddenException("Vous devez avoir un compte pour prendre un rendez-vous. Veuillez vous inscrire d'abord.");
  }

  // Pour les utilisateurs normaux, vérifier que l'email correspond STRICTEMENT
  if (!isAdmin) {
    const normalizedDtoEmail = createDto.email.toLowerCase().trim();
    const normalizedUserEmail = userEmail.toLowerCase().trim();
    
    this.logger.log(`Comparaison emails - DTO: ${this.maskEmail(normalizedDtoEmail)}, Token: ${this.maskEmail(normalizedUserEmail)}`);
    
    if (normalizedDtoEmail !== normalizedUserEmail) {
      this.logger.warn(`Tentative de création avec email différent: ${maskedEmail}`);
      throw new BadRequestException("L'email doit correspondre exactement à votre compte de connexion");
    }
  }

  this.logger.log(`Nombre de rendez-vous confirmés pour ${maskedEmail}: ${confirmedCount}`);

  if (confirmedCount >= 1) {
    this.logger.warn(`Tentative de création d'un deuxième rendez-vous pour: ${maskedEmail}`);
    throw new BadRequestException("Vous avez déjà un rendez-vous confirmé");
  }

  // Validation spécifique pour les champs "Autre"
  if (processedData.destination === 'Autre' && (!processedData.destinationAutre || processedData.destinationAutre.trim() === '')) {
    this.logger.warn('Destination "Autre" sans précision');
    throw new BadRequestException('La destination "Autre" nécessite une précision');
  }
  
  if (processedData.filiere === 'Autre' && (!processedData.filiereAutre || processedData.filiereAutre.trim() === '')) {
    this.logger.warn('Filière "Autre" sans précision');
    throw new BadRequestException('La filière "Autre" nécessite une précision');
  }

  // OPTIMISATION: Exécuter les vérifications de disponibilité en parallèle
  const [isAvailable, dayCount] = await Promise.all([
    // Vérifier la disponibilité du créneau
    this.isSlotAvailable(processedData.date, processedData.time),
    
    // Vérifier le nombre maximum de créneaux par jour
    this.rendezvousModel.countDocuments({
      date: processedData.date,
      status: { $ne: RENDEZVOUS_STATUS.CANCELLED },
    })
  ]);
  
  if (!isAvailable) {
    this.logger.warn('Créneau non disponible');
    throw new BadRequestException("Ce créneau horaire n'est pas disponible");
  }

  if (dayCount >= MAX_SLOTS_PER_DAY) {
    this.logger.warn('Date complète');
    throw new BadRequestException(
      "Tous les créneaux sont complets pour cette date",
    );
  }

  // Validation des contraintes de date
  this.validateDateConstraints(processedData.date);
  
  // Validation de l'heure
  this.validateTimeSlot(processedData.time);

  // Vérifier que la date n'est pas passée
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = new Date(processedData.date);
  selectedDate.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
    this.logger.warn('Tentative de réservation d\'une date passée');
    throw new BadRequestException(
      "Vous ne pouvez pas réserver une date passée",
    );
  }

  // Vérifier que le créneau n'est pas passé (si date d'aujourd'hui)
  if (processedData.date === today.toISOString().split('T')[0] && processedData.time) {
    const [hours, minutes] = processedData.time.split(':').map(Number);
    const now = new Date();
    const selectedDateTime = new Date();
    selectedDateTime.setHours(hours, minutes, 0, 0);
    
    if (selectedDateTime < now) {
      this.logger.warn('Tentative de réservation d\'un créneau passé');
      throw new BadRequestException("Vous ne pouvez pas réserver un créneau passé");
    }
  }

  // Préparer les données pour l'enregistrement
  const rendezvousData: any = {
    firstName: processedData.firstName.trim(),
    lastName: processedData.lastName.trim(),
    email: processedData.email.toLowerCase().trim(),
    telephone: processedData.telephone.trim(),
    niveauEtude: processedData.niveauEtude,
    date: processedData.date,
    time: processedData.time,
    status: RENDEZVOUS_STATUS.CONFIRMED, // Toujours confirmé automatiquement
    createdAt: new Date(),
    updatedAt: new Date(),
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

  // LOG des données finales avant création
  this.logger.log('Données finales du rendez-vous:', {
    email: this.maskEmail(rendezvousData.email),
    destination: rendezvousData.destination,
    filiere: rendezvousData.filiere,
    date: rendezvousData.date,
    time: rendezvousData.time,
    status: rendezvousData.status
  });

  // Créer le rendez-vous
  const created = new this.rendezvousModel(rendezvousData);
  const saved = await created.save();
  
  this.logger.log(`Rendez-vous créé avec ID: ${saved._id} pour ${maskedEmail}`);
  this.logger.log(`Détails: ${saved.firstName} ${saved.lastName}, ${saved.date} à ${saved.time}, statut: ${saved.status}`);

  // OPTIMISATION: Envoyer la notification sans attendre la réponse
  this.sendNotification(saved, "confirmation").catch(notifError => {
    this.logger.error('Erreur notification, mais rendez-vous créé:', notifError);
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

    const [data, total] = await Promise.all([
      this.rendezvousModel
        .find(filters)
        .skip(skip)
        .limit(limit)
        .sort({ date: 1, time: 1 })
        .exec(),
      this.rendezvousModel.countDocuments(filters),
    ]);

    this.logger.debug(`Nombre de rendez-vous trouvés: ${total}`);
    
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
    
    // VÉRIFICATION : S'assurer que l'email a un compte
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn(`Tentative d'accès aux rendez-vous sans compte: ${maskedEmail}`);
      throw new ForbiddenException("Aucun compte trouvé pour cet email. Veuillez d'abord créer un compte.");
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    const filters: any = { 
      email: normalizedEmail 
    };
    
    // Filtrer par statut SEULEMENT si spécifié
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

    this.logger.log(`Résultats pour ${maskedEmail}: ${data.length} rendez-vous trouvés sur ${total} total`);
    
    if (data.length > 0) {
      this.logger.log(`Statuts des rendez-vous trouvés:`, 
        data.map(rdv => ({ 
          id: rdv._id, 
          status: rdv.status, 
          date: rdv.date,
          maskedEmail: this.maskEmail(rdv.email)
        })));
    }

    return {
      data: data as Rendezvous[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userEmail?: string, isAdmin: boolean = false): Promise<Rendezvous | null> {
    this.logger.log(`Recherche du rendez-vous avec ID: ${id}`);
    
    const rdv = await this.rendezvousModel.findById(id).exec();
    
    if (!rdv) {
      this.logger.warn('Rendez-vous non trouvé');
      return null;
    }
    
    // VÉRIFICATION : S'assurer que l'utilisateur a un compte
    const user = await this.usersService.findByEmail(rdv.email);
    if (!user) {
      this.logger.warn(`Rendez-vous lié à un email sans compte: ${this.maskEmail(rdv.email)}`);
      throw new ForbiddenException("Le compte lié à ce rendez-vous n'existe plus");
    }
    
    // Vérifier si l'utilisateur est autorisé à voir ce rendez-vous
    if (!isAdmin && userEmail) {
      const normalizedRdvEmail = rdv.email.toLowerCase().trim();
      const normalizedUserEmail = userEmail.toLowerCase().trim();
      
      if (normalizedRdvEmail !== normalizedUserEmail) {
        const maskedEmail = this.maskEmail(rdv.email);
        this.logger.warn(`Accès non autorisé au rendez-vous (appartenant à: ${maskedEmail})`);
        return null;
      }
    }
    
    this.logger.log(`Rendez-vous trouvé, statut: ${rdv.status}, email: ${this.maskEmail(rdv.email)}`);
    return rdv;
  }

  async update(
    id: string,
    updateDto: UpdateRendezvousDto,
    userEmail: string,
    isAdmin: boolean = false,
  ): Promise<Rendezvous> {
    const maskedUserEmail = this.maskEmail(userEmail);
    this.logger.log(`Tentative de mise à jour du rendez-vous: ${id} par ${maskedUserEmail}`);

    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      this.logger.warn('Rendez-vous non trouvé pour mise à jour');
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Si le rendez-vous est terminé, interdire toute modification
    if (rdv.status === RENDEZVOUS_STATUS.COMPLETED) {
      this.logger.warn('Tentative de modification d\'un rendez-vous terminé');
      throw new BadRequestException("Impossible de modifier un rendez-vous terminé");
    }

    // Vérifier les permissions avec email
    if (!isAdmin) {
      const normalizedRdvEmail = rdv.email.toLowerCase().trim();
      const normalizedUserEmail = userEmail.toLowerCase().trim();
      
      if (normalizedRdvEmail !== normalizedUserEmail) {
        const maskedRdvEmail = this.maskEmail(rdv.email);
        this.logger.warn(`Tentative d'accès non autorisé au rendez-vous (appartenant à: ${maskedRdvEmail})`);
        throw new ForbiddenException(
          "Vous ne pouvez modifier que vos propres rendez-vous",
        );
      }
    }

    // VÉRIFICATION : Si changement d'email, vérifier que le nouvel email a un compte
    if (updateDto.email && updateDto.email !== rdv.email) {
      const newEmailUser = await this.usersService.findByEmail(updateDto.email);
      if (!newEmailUser) {
        this.logger.warn(`Tentative de changement vers un email sans compte: ${this.maskEmail(updateDto.email)}`);
        throw new ForbiddenException("Le nouvel email doit correspondre à un compte existant");
      }
    }

    // Si utilisateur normal tente de changer l'email
    if (!isAdmin && updateDto.email) {
      const normalizedUpdateEmail = updateDto.email.toLowerCase().trim();
      const normalizedUserEmail = userEmail.toLowerCase().trim();
      
      if (normalizedUpdateEmail !== normalizedUserEmail) {
        this.logger.warn('Tentative de changement d\'email par un utilisateur normal');
        throw new ForbiddenException("Vous ne pouvez pas changer l'email du rendez-vous");
      }
    }

    // Si admin veut changer l'email, vérifier qu'il n'y ait pas déjà un rendez-vous confirmé pour le nouvel email
    if (isAdmin && updateDto.email) {
      const normalizedNewEmail = updateDto.email.toLowerCase().trim();
      const normalizedCurrentEmail = rdv.email.toLowerCase().trim();
      
      // Si l'email change et que le nouveau email a déjà un rendez-vous confirmé
      if (normalizedNewEmail !== normalizedCurrentEmail) {
        const confirmedCount = await this.rendezvousModel.countDocuments({
          email: normalizedNewEmail,
          status: RENDEZVOUS_STATUS.CONFIRMED,
          _id: { $ne: id }
        });

        if (confirmedCount >= 1) {
          const maskedNewEmail = this.maskEmail(normalizedNewEmail);
          this.logger.warn(`Le nouvel email ${maskedNewEmail} a déjà un rendez-vous confirmé`);
          throw new BadRequestException("Cet email a déjà un rendez-vous confirmé");
        }
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
          this.logger.warn('Créneau non disponible pour mise à jour');
          throw new BadRequestException(
            "Ce créneau horaire n'est pas disponible",
          );
        }
      }
    }

    // Si admin veut changer le statut
    if (updateDto.status && isAdmin) {
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
    } else if (updateDto.status && !isAdmin) {
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
      this.logger.error('Rendez-vous non trouvé après mise à jour');
      throw new NotFoundException("Rendez-vous non trouvé après mise à jour");
    }

    this.logger.log(`Rendez-vous mis à jour: ${id} par ${maskedUserEmail}`);
    
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
    const maskedEmail = this.maskEmail(userEmail || 'admin');
    this.logger.log(`Tentative de changement de statut: ${status} pour le rendez-vous: ${id} par ${maskedEmail}`);

    const allowedStatuses = Object.values(RENDEZVOUS_STATUS);
    if (!allowedStatuses.includes(status as RendezvousStatus)) {
      this.logger.warn('Statut invalide');
      throw new BadRequestException("Statut invalide");
    }

    if (status === RENDEZVOUS_STATUS.COMPLETED && !avisAdmin) {
      this.logger.warn('Avis admin manquant pour terminer le rendez-vous');
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
      this.logger.warn('Rendez-vous non trouvé pour changement de statut');
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

  async removeWithPolicy(id: string, userEmail: string, isAdmin: boolean = false): Promise<Rendezvous> {
    const maskedEmail = this.maskEmail(userEmail);
    this.logger.log(`Tentative d'annulation du rendez-vous: ${id} par ${maskedEmail}`);

    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      this.logger.warn('Rendez-vous non trouvé pour annulation');
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Si le rendez-vous est terminé, interdire l'annulation
    if (rdv.status === RENDEZVOUS_STATUS.COMPLETED) {
      this.logger.warn('Tentative d\'annulation d\'un rendez-vous terminé');
      throw new BadRequestException("Impossible d'annuler un rendez-vous terminé");
    }

    // Vérifier les permissions avec email
    if (!isAdmin) {
      const normalizedRdvEmail = rdv.email.toLowerCase().trim();
      const normalizedUserEmail = userEmail.toLowerCase().trim();
      
      if (normalizedRdvEmail !== normalizedUserEmail) {
        const maskedRdvEmail = this.maskEmail(rdv.email);
        this.logger.warn(`Tentative d'annulation non autorisée du rendez-vous (appartenant à: ${maskedRdvEmail})`);
        throw new ForbiddenException(
          "Vous ne pouvez annuler que vos propres rendez-vous",
        );
      }
    }

    // Utilisateur normal ne peut annuler que les rendez-vous CONFIRMÉS
    if (!isAdmin && rdv.status !== RENDEZVOUS_STATUS.CONFIRMED) {
      this.logger.warn(`Tentative d'annulation d'un rendez-vous non confirmé (statut: ${rdv.status})`);
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
        this.logger.warn('Tentative d\'annulation tardive du rendez-vous');
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
        cancellationReason:
          isAdmin
            ? "Annulé par l'administrateur"
            : "Annulé par l'utilisateur",
      },
      { new: true },
    );

    if (!updated) {
      this.logger.error('Rendez-vous non trouvé après annulation');
      throw new NotFoundException("Rendez-vous non trouvé après annulation");
    }

    this.logger.log(`Rendez-vous annulé: ${id} par ${maskedEmail}`);

    // Notification d'annulation
    await this.sendNotification(updated, "status");

    return updated;
  }

  async confirmByUser(id: string, userEmail: string, isAdmin: boolean = false): Promise<Rendezvous> {
    const maskedEmail = this.maskEmail(userEmail);
    this.logger.log(`Tentative de confirmation du rendez-vous: ${id} par ${maskedEmail}`);

    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      this.logger.warn('Rendez-vous non trouvé pour confirmation');
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Seul l'admin peut confirmer/changer le statut
    if (!isAdmin) {
      this.logger.warn('Tentative de confirmation par non-admin');
      throw new ForbiddenException(
        "La confirmation des rendez-vous est réservée aux administrateurs",
      );
    }

    if (rdv.status !== RENDEZVOUS_STATUS.PENDING) {
      this.logger.warn(`Tentative de confirmation d'un rendez-vous non en attente (statut: ${rdv.status})`);
      throw new BadRequestException(
        "Seuls les rendez-vous en attente peuvent être confirmés par l'admin",
      );
    }

    // Vérifier que le rendez-vous n'est pas passé
    const now = new Date();
    const rdvDateTime = new Date(`${rdv.date}T${rdv.time}`);
    if (rdvDateTime < now) {
      this.logger.warn('Tentative de confirmation d\'un rendez-vous passé');
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
      this.logger.error('Rendez-vous non trouvé après confirmation');
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
      this.logger.log('Aucun créneau disponible (weekend/jour férié)');
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
    this.logger.log('Recherche des dates disponibles');
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
      this.logger.warn('Tentative de réservation un weekend');
      throw new BadRequestException(
        "Les réservations sont fermées le week-end",
      );
    }

    if (this.isHoliday(dateStr)) {
      this.logger.warn('Tentative de réservation un jour férié');
      throw new BadRequestException(
        "Les réservations sont fermées les jours fériés",
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dateStr);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      this.logger.warn('Tentative de réservation d\'une date passée');
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
      this.logger.warn('Créneau horaire invalide');
      throw new BadRequestException(
        "Les horaires disponibles sont entre 9h00 et 16h30",
      );
    }

    const totalMinutes = (hours - 9) * 60 + minutes;
    if (totalMinutes % 30 !== 0) {
      this.logger.warn('Créneau non conforme');
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
      const maskedEmail = this.maskEmail(rendezvous.email);
      this.logger.log(`Notification ${type} envoyée pour le rendez-vous: ${rendezvous._id} (${maskedEmail})`);
    } catch (error) {
      this.logger.error(`Erreur notification ${type}`);
    }
  }

  private async createProcedureIfEligible(
    rendezvous: Rendezvous,
  ): Promise<void> {
    const maskedEmail = this.maskEmail(rendezvous.email);
    this.logger.log(`Vérification éligibilité procédure pour le rendez-vous: ${rendezvous._id} (${maskedEmail})`);

    const existingProcedure = await this.procedureService.findByEmail(
      rendezvous.email,
    );

    if (!existingProcedure || existingProcedure.length === 0) {
      try {
        const createDto: CreateProcedureDto = {
          rendezVousId: rendezvous._id.toString(),
        };
        await this.procedureService.createFromRendezvous(createDto);
        this.logger.log(`Procédure créée pour le rendez-vous: ${rendezvous._id} (${maskedEmail})`);
        await this.sendNotification(rendezvous, "status");
      } catch (error) {
        this.logger.error('Erreur création procédure');
      }
    } else {
      this.logger.log('Procédure déjà existante');
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

  // ==================== MÉTHODES DE SYNCHRONISATION EMAIL ====================

  async syncUserEmail(oldEmail: string, newEmail: string): Promise<void> {
    try {
      const normalizedOldEmail = oldEmail.toLowerCase().trim();
      const normalizedNewEmail = newEmail.toLowerCase().trim();
      
      // Mettre à jour tous les rendez-vous liés à l'ancien email
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
}