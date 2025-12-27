import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Procedure,
  ProcedureStatus,
  Step,
  StepName,
  StepStatus,
} from '../schemas/procedure.schema';
import { Rendezvous } from '../schemas/rendezvous.schema';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import { NotificationService } from '../notification/notification.service';
import { UserRole } from '../enums/user-role.enum';

// ✅ Interface pour l'utilisateur authentifié
interface AuthenticatedUser {
  email: string;
  role: UserRole;
  id?: string;
  [key: string]: unknown;
}

@Injectable()
export class ProcedureService {
  private readonly logger = new Logger(ProcedureService.name);

  constructor(
    @InjectModel(Procedure.name) private procedureModel: Model<Procedure>,
    @InjectModel(Rendezvous.name) private rendezvousModel: Model<Rendezvous>,
    private notificationService: NotificationService,
  ) {}

  // ==================== CORE METHODS ====================

  async createFromRendezvous(createDto: CreateProcedureDto): Promise<Procedure> {
    const maskedRendezvousId = this.maskId(createDto.rendezVousId);
    this.logger.log(`Création procédure depuis rendez-vous: ${maskedRendezvousId}`);

    const rendezvous = await this.rendezvousModel.findById(createDto.rendezVousId);
    if (!rendezvous) throw new BadRequestException('Rendez-vous non trouvé');

    // Validation stricte
    if (rendezvous.status !== 'Terminé') {
      throw new BadRequestException('Le rendez-vous doit être terminé');
    }
    if (rendezvous.avisAdmin !== 'Favorable') {
      throw new BadRequestException("L'avis administratif doit être favorable");
    }

    const existingProcedure = await this.procedureModel.findOne({
      rendezVousId: createDto.rendezVousId,
      isDeleted: false,
    });
    if (existingProcedure) throw new BadRequestException('Une procédure existe déjà');

    const procedureData = {
      rendezVousId: rendezvous._id,
      prenom: rendezvous.firstName,
      nom: rendezvous.lastName,
      email: rendezvous.email,
      telephone: rendezvous.telephone,
      destination: rendezvous.destination,
      destinationAutre: rendezvous.destinationAutre,
      niveauEtude: rendezvous.niveauEtude,
      filiere: rendezvous.filiere,
      filiereAutre: rendezvous.filiereAutre,
      statut: ProcedureStatus.IN_PROGRESS,
      steps: this.initializeSteps(),
      isDeleted: false,
    };

    const procedure = await this.procedureModel.create(procedureData);

    const maskedEmail = this.maskEmail(procedure.email);
    this.logger.log(`Procédure créée pour: ${maskedEmail}`);

    await this.notificationService.sendProcedureCreation(procedure, rendezvous);

    return procedure;
  }

  async getProcedureDetails(id: string, user: AuthenticatedUser): Promise<Procedure> {
    const maskedId = this.maskId(id);
    this.logger.debug(`Récupération détails procédure: ${maskedId}`);

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de procédure invalide');
    }

    const procedure = await this.procedureModel
      .findOne({
        _id: id,
        isDeleted: false,
      })
      .populate('rendezVousId', 'firstName lastName date time status avisAdmin');

    if (!procedure) throw new NotFoundException('Procédure non trouvée');

    // Vérification d'accès
    if (procedure.email !== user.email && user.role !== UserRole.ADMIN) {
      const maskedEmail = this.maskEmail(user.email);
      this.logger.warn(`Tentative accès non autorisé procédure ${maskedId} par: ${maskedEmail}`);
      throw new ForbiddenException('Accès non autorisé');
    }

    this.logger.debug(`Détails procédure récupérés: ${maskedId}`);
    return procedure;
  }

  async updateProcedure(id: string, updateDto: UpdateProcedureDto): Promise<Procedure> {
    const maskedId = this.maskId(id);
    this.logger.log(`Mise à jour procédure: ${maskedId}`);

    const procedure = await this.procedureModel.findByIdAndUpdate(
      id,
      { ...updateDto, dateDerniereModification: new Date() },
      { new: true, runValidators: true },
    );

    if (!procedure) throw new NotFoundException('Procédure non trouvée');

    this.logger.log(`Procédure mise à jour: ${maskedId}`);
    return procedure;
  }

  private validateStepOrder(procedure: Procedure, stepName: StepName, newStatus: StepStatus): void {
    const steps = procedure.steps;

    const currentStep = steps.find((s) => s.nom === stepName);
    if (!currentStep) {
      throw new BadRequestException('Étape non trouvée dans la procédure');
    }

    if (
      [StepStatus.COMPLETED, StepStatus.CANCELLED, StepStatus.REJECTED].includes(
        currentStep.statut,
      ) &&
      currentStep.statut !== newStatus
    ) {
      throw new BadRequestException(
        `Impossible de modifier une étape ${currentStep.statut.toLowerCase()}`,
      );
    }

    const admissionStep = steps.find((s) => s.nom === StepName.DEMANDE_ADMISSION);

    if (
      admissionStep &&
      [StepStatus.REJECTED, StepStatus.CANCELLED].includes(admissionStep.statut)
    ) {
      if (newStatus !== admissionStep.statut) {
        throw new BadRequestException(
          `Impossible de modifier une étape car l'admission est ${admissionStep.statut.toLowerCase()}`,
        );
      }
    }

    if (stepName === StepName.PREPARATIF_VOYAGE) {
      const visaStep = steps.find((s) => s.nom === StepName.DEMANDE_VISA);

      if (visaStep && [StepStatus.REJECTED, StepStatus.CANCELLED].includes(visaStep.statut)) {
        if (newStatus !== visaStep.statut) {
          throw new BadRequestException(
            `Impossible de modifier les préparatifs de voyage car la demande de visa est ${visaStep.statut.toLowerCase()}`,
          );
        }
      }
    }

    if (
      !admissionStep ||
      ![StepStatus.REJECTED, StepStatus.CANCELLED].includes(admissionStep.statut)
    ) {
      if (stepName === StepName.DEMANDE_VISA) {
        const admissionStep = steps.find((s) => s.nom === StepName.DEMANDE_ADMISSION);

        if (!admissionStep) {
          throw new BadRequestException("Étape d'admission non trouvée");
        }

        if (
          [StepStatus.IN_PROGRESS, StepStatus.COMPLETED].includes(newStatus) &&
          admissionStep.statut !== StepStatus.COMPLETED
        ) {
          throw new BadRequestException(
            "La demande d'admission doit être terminée avant de pouvoir modifier la demande de visa",
          );
        }
      }

      if (stepName === StepName.PREPARATIF_VOYAGE) {
        const visaStep = steps.find((s) => s.nom === StepName.DEMANDE_VISA);

        if (!visaStep) {
          throw new BadRequestException('Étape de demande de visa non trouvée');
        }

        if (
          [StepStatus.IN_PROGRESS, StepStatus.COMPLETED].includes(newStatus) &&
          visaStep.statut !== StepStatus.COMPLETED
        ) {
          throw new BadRequestException(
            'La demande de visa doit être terminée avant de pouvoir modifier les préparatifs de voyage',
          );
        }
      }
    }

    if (
      [StepStatus.REJECTED, StepStatus.CANCELLED].includes(currentStep.statut) &&
      [StepStatus.IN_PROGRESS, StepStatus.PENDING, StepStatus.COMPLETED].includes(newStatus)
    ) {
      throw new BadRequestException(
        `Impossible de reprendre une étape ${currentStep.statut.toLowerCase()}`,
      );
    }

    if (currentStep.statut === StepStatus.COMPLETED && newStatus !== StepStatus.COMPLETED) {
      throw new BadRequestException("Impossible de modifier le statut d'une étape déjà terminée");
    }
  }

  private applyCascadeRejection(procedure: Procedure): void {
    const steps = procedure.steps;

    const admissionStep = steps.find((s) => s.nom === StepName.DEMANDE_ADMISSION);
    if (
      admissionStep &&
      [StepStatus.REJECTED, StepStatus.CANCELLED].includes(admissionStep.statut)
    ) {
      const otherSteps = steps.filter((s) => s.nom !== StepName.DEMANDE_ADMISSION);
      otherSteps.forEach((step) => {
        if (![StepStatus.REJECTED, StepStatus.CANCELLED].includes(step.statut)) {
          step.statut = admissionStep.statut;
          if (admissionStep.raisonRefus && !step.raisonRefus) {
            step.raisonRefus = admissionStep.raisonRefus;
          }
          step.dateMaj = new Date();
          step.dateCompletion = new Date();
        }
      });
    }

    const visaStep = steps.find((s) => s.nom === StepName.DEMANDE_VISA);
    const voyageStep = steps.find((s) => s.nom === StepName.PREPARATIF_VOYAGE);

    if (
      visaStep &&
      voyageStep &&
      [StepStatus.REJECTED, StepStatus.CANCELLED].includes(visaStep.statut) &&
      ![StepStatus.REJECTED, StepStatus.CANCELLED].includes(voyageStep.statut)
    ) {
      voyageStep.statut = visaStep.statut;
      if (visaStep.raisonRefus && !voyageStep.raisonRefus) {
        voyageStep.raisonRefus = visaStep.raisonRefus;
      }
      voyageStep.dateMaj = new Date();
      voyageStep.dateCompletion = new Date();
    }
  }

  async updateStep(id: string, stepName: string, updateDto: UpdateStepDto): Promise<Procedure> {
    const maskedId = this.maskId(id);

    try {
      this.logger.log(`Mise à jour étape - Procédure: ${maskedId}, Étape: ${stepName}`);

      let decodedStepName: string;
      try {
        decodedStepName = decodeURIComponent(stepName);
      } catch {
        throw new BadRequestException(`Nom d'étape mal formé: ${stepName}`);
      }

      const validStepNames = Object.values(StepName);
      if (!validStepNames.includes(decodedStepName as StepName)) {
        this.logger.error(`Nom d'étape invalide: "${decodedStepName}"`);
        throw new BadRequestException(`Nom d'étape invalide: "${decodedStepName}"`);
      }

      const procedure = await this.procedureModel.findById(id).exec();
      if (!procedure) {
        this.logger.error(`Procédure non trouvée: ${maskedId}`);
        throw new NotFoundException('Procédure non trouvée');
      }

      const stepIndex = procedure.steps.findIndex((step: Step) => step.nom === decodedStepName);
      if (stepIndex === -1) {
        this.logger.error(`Étape non trouvée: "${decodedStepName}" dans ${maskedId}`);
        throw new NotFoundException(`Étape "${decodedStepName}" non trouvée dans cette procédure`);
      }

      if (
        updateDto.statut === StepStatus.REJECTED &&
        (!updateDto.raisonRefus || updateDto.raisonRefus.trim() === '')
      ) {
        throw new BadRequestException(
          'La raison du refus est obligatoire lorsque le statut est "Rejeté"',
        );
      }

      const admissionStep = procedure.steps.find((s) => s.nom === StepName.DEMANDE_ADMISSION);

      if (
        admissionStep &&
        [StepStatus.REJECTED, StepStatus.CANCELLED].includes(admissionStep.statut)
      ) {
        if (updateDto.statut && updateDto.statut !== admissionStep.statut) {
          throw new BadRequestException(
            `Impossible de modifier l'étape "${decodedStepName}" car la demande d'admission est ${admissionStep.statut.toLowerCase()}`,
          );
        }
      }

      if (decodedStepName === StepName.PREPARATIF_VOYAGE) {
        const visaStep = procedure.steps.find((s) => s.nom === StepName.DEMANDE_VISA);

        if (visaStep && [StepStatus.REJECTED, StepStatus.CANCELLED].includes(visaStep.statut)) {
          if (updateDto.statut && updateDto.statut !== visaStep.statut) {
            throw new BadRequestException(
              `Impossible de modifier les préparatifs de voyage car la demande de visa est ${visaStep.statut.toLowerCase()}`,
            );
          }
        }
      }

      if (updateDto.statut) {
        this.validateStepOrder(procedure, decodedStepName as StepName, updateDto.statut);
      }

      const now = new Date();

      const existingStep = procedure.steps[stepIndex];

      // ✅ CORRECTION: Gestion du type StepStatus avec valeur par défaut
      const currentStepStatus = existingStep.statut;
      const newStepStatus = updateDto.statut !== undefined ? updateDto.statut : currentStepStatus;

      const updatedStep: Step = {
        nom: existingStep.nom,
        statut: newStepStatus,
        raisonRefus:
          updateDto.raisonRefus !== undefined ? updateDto.raisonRefus : existingStep.raisonRefus,
        dateCreation: existingStep.dateCreation,
        dateMaj: now,
      };

      procedure.steps[stepIndex] = updatedStep;

      if (
        decodedStepName === StepName.DEMANDE_ADMISSION &&
        updateDto.statut &&
        [StepStatus.REJECTED, StepStatus.CANCELLED].includes(updateDto.statut)
      ) {
        procedure.steps.forEach((step, _index) => {
          // ✅ CORRECTION: _index non utilisé
          if (step.nom !== StepName.DEMANDE_ADMISSION) {
            step.statut = updateDto.statut!; // ✅ Utilisation de ! car nous savons que c'est défini ici
            if (updateDto.raisonRefus && !step.raisonRefus) {
              step.raisonRefus = updateDto.raisonRefus;
            }
            step.dateMaj = now;
            step.dateCompletion = now;
          }
        });
      }

      if (
        decodedStepName === StepName.DEMANDE_VISA &&
        updateDto.statut &&
        [StepStatus.REJECTED, StepStatus.CANCELLED].includes(updateDto.statut)
      ) {
        const voyageStepIndex = procedure.steps.findIndex(
          (s) => s.nom === StepName.PREPARATIF_VOYAGE,
        );

        if (voyageStepIndex !== -1) {
          const voyageStep = procedure.steps[voyageStepIndex];
          if (![StepStatus.REJECTED, StepStatus.CANCELLED].includes(voyageStep.statut)) {
            voyageStep.statut = updateDto.statut!;
            if (updateDto.raisonRefus && !voyageStep.raisonRefus) {
              voyageStep.raisonRefus = updateDto.raisonRefus;
            }
            voyageStep.dateMaj = now;
            voyageStep.dateCompletion = now;
          }
        }
      }

      this.updateProcedureGlobalStatus(procedure);

      const savedProcedure = await procedure.save();

      if (
        updateDto.statut === StepStatus.COMPLETED &&
        stepIndex < procedure.steps.length - 1 &&
        ![StepStatus.REJECTED, StepStatus.CANCELLED].includes(updateDto.statut)
      ) {
        const nextStep = procedure.steps[stepIndex + 1];
        if (nextStep.statut === StepStatus.PENDING) {
          this.logger.log(`Activation étape suivante: ${nextStep.nom} pour ${maskedId}`);
          nextStep.statut = StepStatus.IN_PROGRESS;
          nextStep.dateMaj = now;
          await procedure.save();
        }
      }

      try {
        await this.notificationService.sendProcedureUpdate(savedProcedure);
      } catch (notificationError: unknown) {
        this.logger.warn(
          `Erreur notification procédure ${maskedId}: ${this.getErrorMessage(notificationError)}`,
        );
      }

      this.logger.log(`Étape mise à jour avec succès: ${stepName} pour ${maskedId}`);
      return savedProcedure;
    } catch (error: unknown) {
      this.logger.error(
        `Erreur mise à jour étape "${stepName}" pour ${maskedId}: ${this.getErrorMessage(error)}`,
      );

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Erreur lors de la mise à jour de l'étape: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async findByEmail(email: string): Promise<Procedure[]> {
    if (!email) {
      throw new BadRequestException('Email est requis');
    }

    const maskedEmail = this.maskEmail(email);
    this.logger.debug(`Recherche procédures par email: ${maskedEmail}`);

    return this.procedureModel
      .find({
        email: email.toLowerCase(),
        isDeleted: false,
      })
      .populate('rendezVousId', 'firstName lastName date time status avisAdmin');
  }

  private updateProcedureGlobalStatus(procedure: Procedure): void {
    if (!procedure.steps || procedure.steps.length === 0) {
      procedure.statut = ProcedureStatus.IN_PROGRESS;
      return;
    }

    const allCompleted = procedure.steps.every(
      (step: Step) => step.statut === StepStatus.COMPLETED,
    );
    const anyRejected = procedure.steps.some((step: Step) => step.statut === StepStatus.REJECTED);
    const anyCancelled = procedure.steps.some((step: Step) => step.statut === StepStatus.CANCELLED);

    const admissionStep = procedure.steps.find(
      (step: Step) => step.nom === StepName.DEMANDE_ADMISSION,
    );

    if (
      admissionStep &&
      (admissionStep.statut === StepStatus.REJECTED ||
        admissionStep.statut === StepStatus.CANCELLED)
    ) {
      procedure.steps.forEach((step: Step) => {
        if (step.nom !== StepName.DEMANDE_ADMISSION) {
          step.statut = admissionStep.statut;
          if (admissionStep.raisonRefus && !step.raisonRefus) {
            step.raisonRefus = admissionStep.raisonRefus;
          }
          step.dateMaj = new Date();
        }
      });

      if (admissionStep.statut === StepStatus.REJECTED) {
        procedure.statut = ProcedureStatus.REJECTED;
        procedure.raisonRejet = admissionStep.raisonRefus || undefined;
      } else if (admissionStep.statut === StepStatus.CANCELLED) {
        procedure.statut = ProcedureStatus.CANCELLED;
      }
      return;
    }

    if (anyRejected) {
      procedure.statut = ProcedureStatus.REJECTED;
      const rejectedStep = procedure.steps.find(
        (step: Step) => step.statut === StepStatus.REJECTED,
      );
      procedure.raisonRejet = rejectedStep?.raisonRefus || undefined;
    } else if (anyCancelled) {
      procedure.statut = ProcedureStatus.CANCELLED;
    } else if (allCompleted) {
      procedure.statut = ProcedureStatus.COMPLETED;
      procedure.dateCompletion = new Date();
    } else {
      procedure.statut = ProcedureStatus.IN_PROGRESS;
    }
  }

  // ==================== USER METHODS ====================
  async getUserProcedures(email: string, page: number = 1, limit: number = 10) {
    const maskedEmail = this.maskEmail(email);
    this.logger.debug(`Liste procédures utilisateur: ${maskedEmail}, Page: ${page}`);

    const skip = (page - 1) * limit;
    // ✅ RETIRER le filtre isDeleted: false pour voir les procédures annulées
    const query = { email: email.toLowerCase() };

    const [data, total] = await Promise.all([
      this.procedureModel
        .find(query)
        .select(
          'prenom nom email telephone destination destinationAutre filiere filiereAutre niveauEtude statut steps createdAt rendezVousId',
        )
        .populate('rendezVousId', 'firstName lastName date time status')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.procedureModel.countDocuments(query),
    ]);

    this.logger.debug(`Procédures trouvées: ${data.length} pour ${maskedEmail}`);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async cancelProcedure(id: string, userEmail: string, reason?: string): Promise<Procedure> {
    const maskedId = this.maskId(id);
    const maskedEmail = this.maskEmail(userEmail);

    this.logger.log(`Annulation procédure: ${maskedId} par: ${maskedEmail}`);

    const procedure = await this.procedureModel.findById(id);
    if (!procedure) throw new NotFoundException('Procédure non trouvée');

    if (procedure.email !== userEmail.toLowerCase()) {
      this.logger.warn(`Tentative annulation non autorisée: ${maskedId} par: ${maskedEmail}`);
      throw new ForbiddenException('Vous ne pouvez annuler que vos propres procédures');
    }

    if ([ProcedureStatus.COMPLETED, ProcedureStatus.CANCELLED, ProcedureStatus.REJECTED].includes(procedure.statut)) {
      throw new BadRequestException('Procédure déjà finalisée');
    }

    // ✅ CORRECTION: Ne pas mettre isDeleted: true, seulement changer le statut
    procedure.statut = ProcedureStatus.CANCELLED;
    procedure.raisonRejet = reason || "Annulée par l'utilisateur";
    
    // ✅ Mettre à jour toutes les étapes
    procedure.steps.forEach((step) => {
      if ([StepStatus.IN_PROGRESS, StepStatus.PENDING].includes(step.statut)) {
        step.statut = StepStatus.CANCELLED;
        step.raisonRefus = reason || "Annulée par l'utilisateur";
        step.dateMaj = new Date();
        step.dateCompletion = new Date();
      } else if (step.statut === StepStatus.COMPLETED) {
        // Garder les étapes terminées comme telles
        step.statut = StepStatus.COMPLETED;
      }
    });

    // ✅ Appeler save() avec validation
    const savedProcedure = await procedure.save({ validateBeforeSave: true });

    await this.notificationService.sendCancellationNotification(savedProcedure);

    this.logger.log(`Procédure annulée: ${maskedId} par: ${maskedEmail}`);
    return savedProcedure;
  }

  // ==================== ADMIN METHODS ====================

  async getActiveProcedures(page: number = 1, limit: number = 10, email?: string) {
    this.logger.debug(`Liste procédures actives - Page: ${page}, Limit: ${limit}`);

    const skip = (page - 1) * limit;
    // ✅ RETIRER le filtre isDeleted: false pour voir toutes les procédures
    const query: Record<string, unknown> = {};

    if (email) {
      query.email = email.toLowerCase();
      this.logger.debug(`Filtre email appliqué: ${this.maskEmail(email)}`);
    }

    const [data, total] = await Promise.all([
      this.procedureModel
        .find(query)
        .select(
          'prenom nom email telephone destination destinationAutre filiere filiereAutre niveauEtude statut steps createdAt',
        )
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      this.procedureModel.countDocuments(query),
    ]);

    this.logger.debug(`Procédures actives trouvées: ${data.length}`);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async softDelete(id: string, reason?: string): Promise<Procedure> {
    const maskedId = this.maskId(id);
    this.logger.log(`Suppression procédure: ${maskedId}`);

    const procedure = await this.procedureModel.findById(id);
    if (!procedure) throw new NotFoundException('Procédure non trouvée');

    // ✅ CORRECTION: Ne pas mettre isDeleted: true, seulement changer le statut
    procedure.statut = ProcedureStatus.CANCELLED;
    procedure.raisonRejet = reason || "Annulée par l'administrateur";

    procedure.steps.forEach((step) => {
      if ([StepStatus.IN_PROGRESS, StepStatus.PENDING].includes(step.statut)) {
        step.statut = StepStatus.CANCELLED;
        step.raisonRefus = reason || "Annulée par l'administrateur";
        step.dateMaj = new Date();
        step.dateCompletion = new Date();
      }
    });

    const savedProcedure = await procedure.save({ validateBeforeSave: true });

    this.logger.log(`Procédure annulée (admin): ${maskedId}`);
    return savedProcedure;
  }

  async getProceduresOverview() {
    this.logger.debug('Calcul statistiques procédures');

    const [byStatus, byDestination, total] = await Promise.all([
      this.procedureModel.aggregate([
        // ✅ RETIRER le filtre isDeleted: false pour inclure toutes les procédures
        { $group: { _id: '$statut', count: { $sum: 1 } } },
      ]),
      this.procedureModel.aggregate([
        // ✅ RETIRER le filtre isDeleted: false pour inclure toutes les procédures
        { $group: { _id: '$destination', count: { $sum: 1 } } },
      ]),
      this.procedureModel.countDocuments(),
    ]);

    this.logger.debug(`Statistiques calculées - Total: ${total}`);
    return { byStatus, byDestination, total };
  }

  // ==================== UTILITY METHODS ====================

  private initializeSteps(): Step[] {
    return [
      {
        nom: StepName.DEMANDE_ADMISSION,
        statut: StepStatus.IN_PROGRESS,
        dateCreation: new Date(),
        dateMaj: new Date(),
      },
      {
        nom: StepName.DEMANDE_VISA,
        statut: StepStatus.PENDING,
        dateCreation: new Date(),
        dateMaj: new Date(),
      },
      {
        nom: StepName.PREPARATIF_VOYAGE,
        statut: StepStatus.PENDING,
        dateCreation: new Date(),
        dateMaj: new Date(),
      },
    ];
  }

  async rejectProcedure(id: string, reason: string): Promise<Procedure> {
    const maskedId = this.maskId(id);
    this.logger.log(`Rejet procédure: ${maskedId}`);

    const procedure = await this.procedureModel.findById(id);
    if (!procedure) throw new NotFoundException('Procédure non trouvée');

    procedure.statut = ProcedureStatus.REJECTED;
    procedure.raisonRejet = reason;

    procedure.steps.forEach((step) => {
      step.statut = StepStatus.REJECTED;
      step.raisonRefus = reason;
      step.dateMaj = new Date();

      if (!step.dateCompletion) {
        step.dateCompletion = new Date();
      }
    });

    const saved = await procedure.save();
    await this.notificationService.sendProcedureUpdate(saved);

    this.logger.log(`Procédure rejetée: ${maskedId}`);
    return saved;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    return 'Erreur inconnue';
  }

  private maskEmail(email: string): string {
    if (!email) return '***';
    const [name, domain] = email.split('@');
    if (!name || !domain) return '***';

    const maskedName =
      name.length > 2
        ? name.substring(0, 2) + '*'.repeat(Math.max(name.length - 2, 1))
        : '*'.repeat(name.length);

    return `${maskedName}@${domain}`;
  }

  private maskId(id: string): string {
    if (!id || id.length < 8) return '***';
    return id.substring(0, 4) + '***' + id.substring(id.length - 4);
  }
}