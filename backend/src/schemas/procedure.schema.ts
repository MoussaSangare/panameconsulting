import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';

export enum StepStatus {
  PENDING = 'En attente',
  IN_PROGRESS = 'En cours',
  COMPLETED = 'Terminé',
  REJECTED = 'Rejeté',
  CANCELLED = 'Annulé',
}

export enum StepName {
  DEMANDE_ADMISSION = 'DEMANDE ADMISSION',
  DEMANDE_VISA = 'DEMANDE VISA',
  PREPARATIF_VOYAGE = 'PREPARATIF VOYAGE',
}

export enum ProcedureStatus {
  IN_PROGRESS = 'En cours',
  COMPLETED = 'Terminée',
  REJECTED = 'Refusée',
  CANCELLED = 'Annulée',
}

@Schema({ _id: false })
export class Step {
  @Prop({ type: String, enum: StepName, required: true })
  nom!: StepName;

  @Prop({
    type: String,
    enum: StepStatus,
    default: StepStatus.PENDING,
    required: true,
  })
  statut!: StepStatus;

  @Prop({ type: String, required: false })
  raisonRefus?: string;

  @Prop({ type: Date, default: Date.now })
  dateMaj!: Date;

  @Prop({ type: Date, default: Date.now })
  dateCreation!: Date;

  @Prop({ type: Date, required: false })
  dateCompletion?: Date;
}

export const StepSchema = SchemaFactory.createForClass(Step);

// Interface pour les méthodes d'instance
export interface ProcedureMethods {
  updateGlobalStatus(): void;
  addStep(stepName: StepName): void;
  updateStep(stepName: StepName, updates: Partial<Step>): void;
}

// Interface pour les méthodes statiques
export interface ProcedureModel extends Model<Procedure, object, ProcedureMethods> {
  findByRendezvousId(rendezVousId: Types.ObjectId): Promise<Procedure>;
  findByUserEmail(email: string): Promise<Procedure[]>;
}

@Schema({
  timestamps: true,
  collection: 'procedures',
})
export class Procedure extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: 'Rendezvous',
    required: true,
    unique: true,
  })
  rendezVousId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  prenom!: string;

  @Prop({ type: String, required: true })
  nom!: string;

  @Prop({ type: String, required: true })
  email!: string;

  @Prop({ type: String, required: true })
  telephone!: string;

  @Prop({ type: String, required: true })
  destination!: string;

  @Prop({ type: String, required: false })
  destinationAutre?: string;

  @Prop({ type: String, required: true })
  filiere!: string;

  @Prop({ type: String, required: false })
  filiereAutre?: string;

  @Prop({ type: String, required: true })
  niveauEtude!: string;

  @Prop({
    type: String,
    enum: ProcedureStatus,
    default: ProcedureStatus.IN_PROGRESS,
  })
  statut!: ProcedureStatus;

  @Prop({ type: [StepSchema], default: [] })
  steps!: Step[];

  @Prop({ type: Boolean, default: false })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;

  @Prop({ type: String })
  deletionReason?: string;

  @Prop({ type: String })
  raisonRejet?: string;

  @Prop({ type: Date })
  dateCompletion?: Date;

  @Prop({ type: Date, default: Date.now })
  dateDerniereModification?: Date;

  updateGlobalStatus?: () => void;
  addStep?: (stepName: StepName) => void;
  updateStep?: (stepName: StepName, updates: Partial<Step>) => void;
}

export type ProcedureDocument = Procedure & Document & ProcedureMethods;

export const ProcedureSchema = SchemaFactory.createForClass(Procedure);

// ==================== MÉTHODES D'INSTANCE ====================

ProcedureSchema.methods.updateGlobalStatus = function (): void {
  const procedure = this as ProcedureDocument;

  if (!procedure.steps || procedure.steps.length === 0) {
    procedure.statut = ProcedureStatus.IN_PROGRESS;
    return;
  }

  const allCompleted = procedure.steps.every((step: Step) => step.statut === StepStatus.COMPLETED);
  const anyRejected = procedure.steps.some((step: Step) => step.statut === StepStatus.REJECTED);
  const anyCancelled = procedure.steps.some((step: Step) => step.statut === StepStatus.CANCELLED);

  // RÈGLE STRICTE : Si la demande d'admission est rejetée ou annulée, TOUTES les autres étapes le sont aussi
  const admissionStep = procedure.steps.find(
    (step: Step) => step.nom === StepName.DEMANDE_ADMISSION,
  );

  if (
    admissionStep &&
    (admissionStep.statut === StepStatus.REJECTED || admissionStep.statut === StepStatus.CANCELLED)
  ) {
    // Marquer toutes les autres étapes avec le même statut et la même raison
    procedure.steps.forEach((step: Step) => {
      if (step.nom !== StepName.DEMANDE_ADMISSION) {
        step.statut = admissionStep.statut;
        if (admissionStep.raisonRefus && !step.raisonRefus) {
          step.raisonRefus = admissionStep.raisonRefus;
        }
        step.dateMaj = new Date();
      }
    });

    // Mettre à jour le statut global
    if (admissionStep.statut === StepStatus.REJECTED) {
      procedure.statut = ProcedureStatus.REJECTED;
      procedure.raisonRejet = admissionStep.raisonRefus;
    } else if (admissionStep.statut === StepStatus.CANCELLED) {
      procedure.statut = ProcedureStatus.CANCELLED;
    }
    return;
  }

  if (anyRejected) {
    procedure.statut = ProcedureStatus.REJECTED;
    const rejectedStep = procedure.steps.find((step: Step) => step.statut === StepStatus.REJECTED);
    procedure.raisonRejet = rejectedStep?.raisonRefus;
  } else if (anyCancelled) {
    procedure.statut = ProcedureStatus.CANCELLED;
  } else if (allCompleted) {
    procedure.statut = ProcedureStatus.COMPLETED;
    procedure.dateCompletion = new Date();
  } else {
    procedure.statut = ProcedureStatus.IN_PROGRESS;
  }
};

ProcedureSchema.methods.addStep = function (stepName: StepName): void {
  const procedure = this as ProcedureDocument;
  const existingStep = procedure.steps.find((step: Step) => step.nom === stepName);

  if (!existingStep) {
    procedure.steps.push({
      nom: stepName,
      statut: StepStatus.PENDING,
      dateCreation: new Date(),
      dateMaj: new Date(),
    });
    procedure.updateGlobalStatus();
  }
};

ProcedureSchema.methods.updateStep = function (stepName: StepName, updates: Partial<Step>): void {
  const procedure = this as ProcedureDocument;
  const stepIndex = procedure.steps.findIndex((step: Step) => step.nom === stepName);

  if (stepIndex !== -1) {
    procedure.steps[stepIndex] = {
      ...procedure.steps[stepIndex],
      ...updates,
      dateMaj: new Date(),
    };

    if (updates.statut === StepStatus.COMPLETED || updates.statut === StepStatus.REJECTED) {
      procedure.steps[stepIndex].dateCompletion = new Date();
    }

    procedure.updateGlobalStatus();
  }
};

// ==================== MÉTHODES STATIQUES ====================

ProcedureSchema.statics.findByRendezvousId = function (
  rendezVousId: Types.ObjectId,
): Promise<ProcedureDocument | null> {
  return this.findOne({ rendezVousId, isDeleted: false }) as Promise<ProcedureDocument | null>;
};

ProcedureSchema.statics.findByUserEmail = function (email: string): Promise<ProcedureDocument[]> {
  return this.find({ email, isDeleted: false }).sort({ createdAt: -1 }) as Promise<
    ProcedureDocument[]
  >;
};

// ==================== MIDDLEWARES ====================

// Alternative solution using async/await style (if you prefer):
ProcedureSchema.pre('save', async function () {
  const procedure = this as ProcedureDocument;
  procedure.dateDerniereModification = new Date();

  // TRAITEMENT STRICTE DES CHAMPS "AUTRE"
  if (procedure.destination === 'Autre') {
    if (!procedure.destinationAutre || procedure.destinationAutre.trim() === '') {
      throw new Error('Veuillez préciser votre destination');
    }
    procedure.destination = procedure.destinationAutre.trim();
  }

  if (procedure.filiere === 'Autre') {
    if (!procedure.filiereAutre || procedure.filiereAutre.trim() === '') {
      throw new Error('Veuillez préciser votre filière');
    }
    procedure.filiere = procedure.filiereAutre.trim();
  }

  // Nettoyer les champs *_Autre
  if (procedure.destinationAutre && procedure.destinationAutre === procedure.destination) {
    procedure.destinationAutre = undefined;
  }

  if (procedure.filiereAutre && procedure.filiereAutre === procedure.filiere) {
    procedure.filiereAutre = undefined;
  }

  // GARANTIR LES 3 ÉTAPES OBLIGATOIRES
  const requiredSteps = [
    StepName.DEMANDE_ADMISSION,
    StepName.DEMANDE_VISA,
    StepName.PREPARATIF_VOYAGE,
  ];

  requiredSteps.forEach((stepName) => {
    const existingStep = procedure.steps.find((step: Step) => step.nom === stepName);
    if (!existingStep) {
      procedure.steps.push({
        nom: stepName,
        statut:
          stepName === StepName.DEMANDE_ADMISSION ? StepStatus.IN_PROGRESS : StepStatus.PENDING,
        dateCreation: new Date(),
        dateMaj: new Date(),
      });
    }
  });

  if (procedure.isModified('steps')) {
    procedure.updateGlobalStatus();
  }
});