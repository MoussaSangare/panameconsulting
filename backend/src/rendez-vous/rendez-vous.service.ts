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
import { Rendezvous } from "../schemas/rendezvous.schema";
import { CreateRendezvousDto } from "./dto/create-rendezvous.dto";
import { UpdateRendezvousDto } from "./dto/update-rendezvous.dto";
import { UserRole } from "../schemas/user.schema";
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
  ) {
    this.initializeHolidays();
  }

  private initializeHolidays(): void {
    try {
      this.holidays = new Holidays('ML'); // Devrait fonctionner avec esModuleInterop
      this.logger.log('Initialisation de la bibliothèque date-holidays pour le Mali');
    } catch (error) {
      this.logger.error(`Erreur d'initialisation de date-holidays: ${error.message}`);
      // Fallback sur des jours fériés statiques en cas d'erreur
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
        `${year}-01-01`, // Nouvel An
        `${year}-05-01`, // Fête du Travail
        `${year}-09-22`, // Indépendance du Mali
        `${year}-12-25`, // Noël
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
    const maskedEmail = this.maskEmail(createDto.email);
    this.logger.log(`Création rendez-vous pour l'utilisateur: ${maskedEmail}`);
    this.logger.debug(`Données DTO reçues: ${JSON.stringify(createDto, null, 2)}`);

    // Vérifier s'il y a déjà un rendez-vous en cours
    const pendingCount = await this.rendezvousModel.countDocuments({
      email: this.normalizeEmail(createDto.email),
      status: { $in: [RENDEZVOUS_STATUS.PENDING, RENDEZVOUS_STATUS.CONFIRMED] },
    });

    this.logger.log(`Nombre de rendez-vous en cours pour ${maskedEmail}: ${pendingCount}`);

    if (pendingCount >= 1) {
      this.logger.warn(`Tentative de création d'un deuxième rendez-vous pour: ${maskedEmail}`);
      throw new BadRequestException("Vous avez déjà un rendez-vous en cours (en attente ou confirmé)");
    }

    // Traitement des champs "Autre" et validation (cohérent avec le schema)
    const processedData = this.processAndValidateRendezvousData(createDto);
    this.logger.debug(`Données traitées: ${JSON.stringify(processedData, null, 2)}`);

    // Validation spécifique pour les champs "Autre"
    if (processedData.destination === 'Autre' && (!processedData.destinationAutre || processedData.destinationAutre.trim() === '')) {
      this.logger.warn(`Destination "Autre" sans précision pour ${maskedEmail}`);
      throw new BadRequestException('La destination "Autre" nécessite une précision');
    }
    
    if (processedData.filiere === 'Autre' && (!processedData.filiereAutre || processedData.filiereAutre.trim() === '')) {
      this.logger.warn(`Filière "Autre" sans précision pour ${maskedEmail}`);
      throw new BadRequestException('La filière "Autre" nécessite une précision');
    }

    // Vérifier la disponibilité
    const isAvailable = await this.isSlotAvailable(
      processedData.date,
      processedData.time,
    );
    
    if (!isAvailable) {
      this.logger.warn(`Créneau non disponible: ${processedData.date} ${processedData.time} pour ${maskedEmail}`);
      throw new BadRequestException("Ce créneau horaire n'est pas disponible");
    }

    // Vérifier le nombre maximum de créneaux par jour
    const dayCount = await this.rendezvousModel.countDocuments({
      date: processedData.date,
      status: { $ne: RENDEZVOUS_STATUS.CANCELLED },
    });

    if (dayCount >= MAX_SLOTS_PER_DAY) {
      this.logger.warn(`Date complète: ${processedData.date} pour ${maskedEmail}`);
      throw new BadRequestException(
        "Tous les créneaux sont complets pour cette date",
      );
    }

    // Préparer les données pour l'enregistrement
    const rendezvousData: any = {
      firstName: processedData.firstName.trim(),
      lastName: processedData.lastName.trim(),
      email: this.normalizeEmail(processedData.email),
      telephone: processedData.telephone.trim(),
      niveauEtude: processedData.niveauEtude,
      date: processedData.date,
      time: processedData.time,
      status: RENDEZVOUS_STATUS.PENDING,
    };

    // Gestion des champs "Autre" pour la base de données
    if (processedData.destination === 'Autre' && processedData.destinationAutre) {
      rendezvousData.destination = 'Autre'; // Garder "Autre" comme valeur
      rendezvousData.destinationAutre = processedData.destinationAutre.trim();
    } else {
      rendezvousData.destination = processedData.destination;
    }

    if (processedData.filiere === 'Autre' && processedData.filiereAutre) {
      rendezvousData.filiere = 'Autre'; // Garder "Autre" comme valeur
      rendezvousData.filiereAutre = processedData.filiereAutre.trim();
    } else {
      rendezvousData.filiere = processedData.filiere;
    }

    this.logger.debug(`Données prêtes pour enregistrement: ${JSON.stringify(rendezvousData, null, 2)}`);

    // Créer le rendez-vous
    const created = new this.rendezvousModel(rendezvousData);
    const saved = await created.save();
    
    this.logger.log(`Rendez-vous créé avec ID: ${saved._id} pour ${maskedEmail}`);

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

    // LOG pour déboguer
    this.logger.debug(`Filtres admin findAll: ${JSON.stringify(filters)}`);
    this.logger.debug(`Page: ${page}, Limit: ${limit}, Skip: ${skip}`);

    const [data, total] = await Promise.all([
      this.rendezvousModel
        .find(filters)
        .skip(skip)
        .limit(limit)
        .sort({ date: 1, time: 1 })
        .exec(),
      this.rendezvousModel.countDocuments(filters),
    ]);

    this.logger.debug(`Nombre de rendez-vous trouvés par admin: ${total}`);
    this.logger.debug(`Premier rendez-vous trouvé: ${data.length > 0 ? data[0]._id : 'aucun'}`);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findByUser(
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
      this.logger.log(`Recherche des rendez-vous pour l'utilisateur: ${maskedEmail} - Page: ${page}, Limit: ${limit}, Statut: ${status || 'tous'}`);

      // ✅ CORRECTION : Décode d'abord l'email (car il vient encodé dans l'URL)
      const decodedEmail = decodeURIComponent(email);
      
      // ✅ Ensuite normalise l'email pour la recherche
      const normalizedEmail = this.normalizeEmail(decodedEmail);
      
      // VALIDATIONS STRICTES (cohérentes avec le controller)
      if (!normalizedEmail || normalizedEmail.trim() === '') {
        this.logger.warn(`Email vide ou invalide fourni: ${email}`);
        throw new BadRequestException("L'email est requis pour cette requête");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        this.logger.warn(`Format email invalide: ${maskedEmail}`);
        throw new BadRequestException("Format d'email invalide");
      }

      if (page < 1) {
        throw new BadRequestException('Le numéro de page doit être supérieur à 0');
      }

      if (limit < 1 || limit > 100) {
        throw new BadRequestException('La limite doit être entre 1 et 100');
      }

      if (status && !Object.values(RENDEZVOUS_STATUS).includes(status as RendezvousStatus)) {
        throw new BadRequestException(`Statut invalide. Valeurs autorisées: ${Object.values(RENDEZVOUS_STATUS).join(', ')}`);
      }

      // Calcul du skip pour la pagination
      const skip = (page - 1) * limit;

      // Construction des filtres (identique au frontend)
      const filters: any = { 
        email: normalizedEmail 
      };
      
      if (status) {
        filters.status = status;
      }

      this.logger.debug(`Filtres appliqués: ${JSON.stringify(filters)}`);
      this.logger.debug(`Pagination: skip=${skip}, limit=${limit}`);

      try {
        // Exécution parallèle pour performance
        const [data, total] = await Promise.all([
          this.rendezvousModel
            .find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ 
              date: -1,   // Les plus récents d'abord
              time: 1     // Puis par heure croissante
            })
            .lean()       // Retourne des objets JavaScript simples
            .exec(),
          this.rendezvousModel.countDocuments(filters).exec(),
        ]);

        // Calcul du nombre total de pages
        const totalPages = Math.ceil(total / limit);

        this.logger.log(`Rendez-vous trouvés pour ${maskedEmail}: ${data.length} sur ${total} (page ${page}/${totalPages})`);
        
        // LOG détaillé pour débogage
        if (data.length > 0) {
          this.logger.debug(`Premier rendez-vous: ID=${data[0]._id}, Date=${data[0].date}, Statut=${data[0].status}`);
        } else {
          this.logger.debug(`Aucun rendez-vous trouvé pour ${maskedEmail} avec les filtres appliqués`);
        }

        // Retourne la structure EXACTEMENT comme attendue par le frontend
        return {
          data: data as Rendezvous[], // Cast pour TypeScript
          total,
          page,
          limit,
          totalPages,
        };

      } catch (error: any) {
        this.logger.error(`Erreur lors de la recherche des rendez-vous pour ${maskedEmail}: ${error.message}`);
        this.logger.error(`Stack trace: ${error.stack}`);
        
        // Gestion spécifique des erreurs de base de données
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
          this.logger.error(`Erreur MongoDB: ${error.code} - ${error.message}`);
          throw new BadRequestException('Erreur de base de données lors de la recherche');
        }
        
        // Pour les autres erreurs
        if (error instanceof BadRequestException) {
          throw error; // Propagation des erreurs de validation
        }
        
        throw new BadRequestException('Erreur lors de la récupération des rendez-vous');
      }
    }

// ==================== MÉTHODES UTILITAIRES PRIVÉES ====================

  async findOne(id: string): Promise<Rendezvous | null> {
    this.logger.log(`Recherche du rendez-vous avec ID: ${id}`);
    const rdv = await this.rendezvousModel.findById(id).exec();
    if (rdv) {
      const maskedEmail = this.maskEmail(rdv.email);
      this.logger.log(`Rendez-vous trouvé: ${id} pour ${maskedEmail}`);
      this.logger.debug(`Email du rendez-vous: ${rdv.email}`);
    } else {
      this.logger.warn(`Rendez-vous non trouvé: ${id}`);
    }
    return rdv;
  }

  async update(
    id: string,
    updateDto: UpdateRendezvousDto,
    user: any,
  ): Promise<Rendezvous> {
    const maskedEmail = this.maskEmail(user.email);
    this.logger.log(`Tentative de mise à jour du rendez-vous: ${id} par ${maskedEmail}`);

    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      this.logger.warn(`Rendez-vous non trouvé pour mise à jour: ${id}`);
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Vérifier les permissions avec email normalisé
    if (user.role !== UserRole.ADMIN && 
        this.normalizeEmail(rdv.email) !== this.normalizeEmail(user.email)) {
      this.logger.warn(`Tentative d'accès non autorisé au rendez-vous: ${id} par ${maskedEmail}`);
      this.logger.debug(`Email rdv: ${rdv.email}, Email user: ${user.email}`);
      this.logger.debug(`Email rdv normalisé: ${this.normalizeEmail(rdv.email)}, Email user normalisé: ${this.normalizeEmail(user.email)}`);
      throw new ForbiddenException(
        "Vous ne pouvez modifier que vos propres rendez-vous",
      );
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
          const maskedEmail = this.maskEmail(rdv.email);
          this.logger.warn(`Créneau non disponible pour mise à jour: ${date} ${time} pour ${maskedEmail}`);
          throw new BadRequestException(
            "Ce créneau horaire n'est pas disponible",
          );
        }
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

    const updatedMaskedEmail = this.maskEmail(updated.email);
    this.logger.log(`Rendez-vous mis à jour: ${id} pour ${updatedMaskedEmail}`);
    return updated;
  }

  async updateStatus(
    id: string,
    status: string,
    avisAdmin?: string,
    user?: any,
  ): Promise<Rendezvous> {
    const maskedEmail = user ? this.maskEmail(user.email) : 'utilisateur inconnu';
    this.logger.log(`Tentative de changement de statut: ${status} pour le rendez-vous: ${id} par ${maskedEmail}`);

    if (!user || user.role !== UserRole.ADMIN) {
      this.logger.warn(`Tentative non autorisée de changement de statut par ${maskedEmail}`);
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

    const updatedMaskedEmail = this.maskEmail(updated.email);
    this.logger.log(`Statut mis à jour: ${status} pour le rendez-vous: ${id} (${updatedMaskedEmail})`);

    // Notification
    await this.sendNotification(updated, "status");

    // Création automatique de procédure si conditions remplies
    if (avisAdmin === ADMIN_OPINION.FAVORABLE && status === RENDEZVOUS_STATUS.COMPLETED) {
      await this.createProcedureIfEligible(updated);
    }

    return updated;
  }

  async removeWithPolicy(id: string, user: any): Promise<Rendezvous> {
    const maskedEmail = this.maskEmail(user.email);
    this.logger.log(`Tentative d'annulation du rendez-vous: ${id} par ${maskedEmail}`);

    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      this.logger.warn(`Rendez-vous non trouvé pour annulation: ${id}`);
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    const isAdmin = user.role === UserRole.ADMIN;

    // Vérifier les permissions avec email normalisé
    if (!isAdmin && this.normalizeEmail(rdv.email) !== this.normalizeEmail(user.email)) {
      this.logger.warn(`Tentative d'annulation non autorisée du rendez-vous: ${id} par ${maskedEmail}`);
      this.logger.debug(`Email rdv: ${rdv.email}, Email user: ${user.email}`);
      throw new ForbiddenException(
        "Vous ne pouvez supprimer que vos propres rendez-vous",
      );
    }

    // Restriction horaire pour les utilisateurs (cohérent avec le schema)
    if (!isAdmin) {
      const rdvDateTime = new Date(`${rdv.date}T${rdv.time}:00`);
      const now = new Date();
      const diffMs = rdvDateTime.getTime() - now.getTime();
      const twoHoursMs = CANCELLATION_THRESHOLD_HOURS * 60 * 60 * 1000;

      if (diffMs <= twoHoursMs) {
        this.logger.warn(`Tentative d'annulation tardive du rendez-vous: ${id} par ${maskedEmail}`);
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

    const updatedMaskedEmail = this.maskEmail(updated.email);
    this.logger.log(`Rendez-vous annulé (soft delete): ${id} pour ${updatedMaskedEmail}`);

    // Notification d'annulation
    await this.sendNotification(updated, "status");

    return updated;
  }

  async confirmByUser(id: string, user: any): Promise<Rendezvous> {
    const maskedEmail = this.maskEmail(user.email);
    this.logger.log(`Tentative de confirmation du rendez-vous: ${id} par ${maskedEmail}`);

    const rdv = await this.rendezvousModel.findById(id);
    if (!rdv) {
      this.logger.warn(`Rendez-vous non trouvé pour confirmation: ${id}`);
      throw new NotFoundException("Rendez-vous non trouvé");
    }

    // Vérifier les permissions avec email normalisé
    if (this.normalizeEmail(rdv.email) !== this.normalizeEmail(user.email)) {
      this.logger.warn(`Tentative de confirmation non autorisée du rendez-vous: ${id} par ${maskedEmail}`);
      this.logger.debug(`Email rdv: ${rdv.email}, Email user: ${user.email}`);
      throw new ForbiddenException(
        "Vous ne pouvez confirmer que vos propres rendez-vous",
      );
    }

    if (rdv.status !== RENDEZVOUS_STATUS.PENDING) {
      this.logger.warn(`Tentative de confirmation d'un rendez-vous non en attente: ${id} (statut: ${rdv.status})`);
      throw new BadRequestException(
        "Seuls les rendez-vous en attente peuvent être confirmés",
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

    const updatedMaskedEmail = this.maskEmail(updated.email);
    this.logger.log(`Rendez-vous confirmé: ${id} pour ${updatedMaskedEmail}`);
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

  private normalizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      this.logger.warn(`Email invalide fourni pour normalisation: ${typeof email} - ${email}`);
      return '';
    }
    return email.toLowerCase().trim();
  }

  private processAndValidateRendezvousData(
    createDto: CreateRendezvousDto | UpdateRendezvousDto,
  ): any {
    const processed = { ...createDto };

    // Normaliser l'email
    if (processed.email) {
      processed.email = this.normalizeEmail(processed.email);
    }

    // Validation des champs requis (cohérent avec le schema)
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
      const maskedEmail = this.maskEmail(rendezvous.email);
      this.logger.log(`Notification ${type} envoyée pour le rendez-vous: ${rendezvous._id} (${maskedEmail})`);
    } catch (error) {
      this.logger.error(`Erreur notification ${type} pour ${rendezvous._id}: ${error.message}`);
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
        this.logger.error(`Erreur création procédure pour ${rendezvous._id}: ${error.message}`);
      }
    } else {
      this.logger.log(`Procédure déjà existante pour ${maskedEmail}`);
    }
  }

  // ==================== SECURITY METHODS ====================

  private maskEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      this.logger.warn(`Email invalide fourni: ${typeof email} - ${email}`);
      return 'email_non_disponible';
    }
    
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) {
      this.logger.warn(`Format email invalide: ${email}`);
      return 'format_email_invalide';
    }
    
    // Masquage cohérent
    const maskedLocal = localPart.length <= 2 
      ? localPart.charAt(0) + '*'
      : localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1);
    
    return `${maskedLocal}@${domain}`;
  }

  private maskSearchTerm(search: string): string {
    if (!search) return 'aucune';
    if (search.includes('@')) {
      return this.maskEmail(search);
    }
    return `recherche_${search.length}_caracteres`;
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
      this.logger.log(`${result.modifiedCount} rendez-vous automatiquement annulés (délai de 5h dépassé)`);
    }
  }
}