
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Model } from 'mongoose';
import { Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

// Interface pour les méthodes d'instance
export interface RendezvousMethods {
  getEffectiveDestination(): string;
  getEffectiveFiliere(): string;
  isPast(): boolean;
  canBeCancelled(byAdmin?: boolean): boolean;
  toSafeJSON(): any;
}

// Interface pour les méthodes statiques
export interface RendezvousModel extends Model<Rendezvous, {}, RendezvousMethods> {
  processOtherFieldsStatic(data: any): any;
  validateRendezvousDataStatic(data: any): void;
}

// Constantes pour la cohérence
const RENDEZVOUS_STATUS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé'
} as const;

const ADMIN_OPINION = {
  FAVORABLE: 'Favorable',
  UNFAVORABLE: 'Défavorable'
} as const;

const EDUCATION_LEVELS = [
  'Bac',
  'Bac+1',
  'Bac+2',
  'Licence',
  'Master I',
  'Master II',
  'Doctorat'
] as const;

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30'
] as const;

export type RendezvousDocument = Rendezvous & Document & RendezvousMethods;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      delete ret._id;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Rendezvous {
  @Transform(({ value }) => value.toString())
  _id: Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
    maxlength: 50,
  })
  firstName: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 50,
  })
  lastName: string;

  @Prop({
    required: true,
    lowercase: true,
    trim: true,
    maxlength: 100,
    match: [/^\S+@\S+\.\S+$/, 'Format email invalide'],
  })
  email: string;

  @Prop({
    required: true,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Format téléphone invalide'],
  })
  telephone: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  destination: string;

  @Prop({
    required: false,
    trim: true,
    maxlength: 100,
  })
  destinationAutre?: string;

  @Prop({
    required: true,
    trim: true,
    enum: EDUCATION_LEVELS,
  })
  niveauEtude: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
  })
  filiere: string;

  @Prop({
    required: false,
    trim: true,
    maxlength: 100,
  })
  filiereAutre?: string;

  @Prop({
    required: true,
    match: [/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, 'Format de date invalide (YYYY-MM-DD requis)'],
    index: true,
  })
  date: string;

  @Prop({
    required: true,
    match: [/^(09|1[0-6]):(00|30)$/, 'Créneau horaire invalide (09:00-16:30, par pas de 30min)'],
  })
  time: string;

  @Prop({
    default: RENDEZVOUS_STATUS.PENDING,
    enum: Object.values(RENDEZVOUS_STATUS),
    index: true,
  })
  status: string;

  @Prop({
    required: false,
    enum: Object.values(ADMIN_OPINION),
  })
  avisAdmin?: string;

  @Prop({
    required: false,
  })
  cancelledAt?: Date;

  @Prop({
    required: false,
    enum: ['admin', 'user'],
  })
  cancelledBy?: string;

  @Prop({
    required: false,
  })
  cancellationReason?: string;

  @Prop({
    default: Date.now,
  })
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  // Virtual pour la date/heure combinée avec gestion timezone
  @Prop({
    virtual: true,
    get: function() {
      const dateStr = this.date;
      const timeStr = this.time;
      
      if (!dateStr || !timeStr) return null;
      
      const dateTimeStr = `${dateStr}T${timeStr}:00.000Z`;
      const dateTime = new Date(dateTimeStr);
      
      return isNaN(dateTime.getTime()) ? null : dateTime;
    },
    set: function(value: Date) {
      if (value && !isNaN(value.getTime())) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
        const hours = String(value.getUTCHours()).padStart(2, '0');
        const minutes = String(value.getUTCMinutes()).padStart(2, '0');
        
        this.date = `${year}-${month}-${day}`;
        this.time = `${hours}:${minutes}`;
      }
    },
  })
  dateTime?: Date;
}

export const RendezvousSchema = SchemaFactory.createForClass(Rendezvous);

// ==================== MIDDLEWARE PRE-SAVE ====================

RendezvousSchema.pre('save', async function() {
  const rendezvous = this as unknown as RendezvousDocument;
  
  try {
    if (rendezvous.firstName) rendezvous.firstName = rendezvous.firstName.trim();
    if (rendezvous.lastName) rendezvous.lastName = rendezvous.lastName.trim();
    if (rendezvous.email) rendezvous.email = rendezvous.email.toLowerCase().trim();
    if (rendezvous.telephone) rendezvous.telephone = rendezvous.telephone.trim();
    if (rendezvous.destination) rendezvous.destination = rendezvous.destination.trim();
    if (rendezvous.destinationAutre) rendezvous.destinationAutre = rendezvous.destinationAutre.trim();
    if (rendezvous.filiere) rendezvous.filiere = rendezvous.filiere.trim();
    if (rendezvous.filiereAutre) rendezvous.filiereAutre = rendezvous.filiereAutre.trim();
    
    if (rendezvous.destination === 'Autre' && rendezvous.destinationAutre) {
      rendezvous.destination = rendezvous.destinationAutre.trim();
      rendezvous.destinationAutre = undefined;
    } else if (rendezvous.destination !== 'Autre') {
      rendezvous.destinationAutre = undefined;
    }

    if (rendezvous.filiere === 'Autre' && rendezvous.filiereAutre) {
      rendezvous.filiere = rendezvous.filiereAutre.trim();
      rendezvous.filiereAutre = undefined;
    } else if (rendezvous.filiere !== 'Autre') {
      rendezvous.filiereAutre = undefined;
    }

    if (rendezvous.destination === 'Autre' && (!rendezvous.destinationAutre || rendezvous.destinationAutre.trim() === '')) {
      throw new BadRequestException('La destination "Autre" nécessite une précision');
    }
    
    if (rendezvous.filiere === 'Autre' && (!rendezvous.filiereAutre || rendezvous.filiereAutre.trim() === '')) {
      throw new BadRequestException('La filière "Autre" nécessite une précision');
    }

    if (rendezvous.date) {
      const date = new Date(rendezvous.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (isNaN(date.getTime()) || date < today) {
        throw new BadRequestException('Date invalide ou passée');
      }
    }

    if (!rendezvous.destination?.trim()) {
      throw new BadRequestException('La destination est obligatoire');
    }

    if (!rendezvous.filiere?.trim()) {
      throw new BadRequestException('La filière est obligatoire');
    }
  } catch (error) {
    throw error;
  }
});

// ==================== MÉTHODES D'INSTANCE ====================

RendezvousSchema.methods.getEffectiveDestination = function(): string {
  const rendezvous = this as RendezvousDocument;
  return rendezvous.destination === 'Autre' && rendezvous.destinationAutre 
    ? rendezvous.destinationAutre 
    : rendezvous.destination;
};

RendezvousSchema.methods.getEffectiveFiliere = function(): string {
  const rendezvous = this as RendezvousDocument;
  return rendezvous.filiere === 'Autre' && rendezvous.filiereAutre 
    ? rendezvous.filiereAutre 
    : rendezvous.filiere;
};

RendezvousSchema.methods.isPast = function(): boolean {
  const rendezvous = this as RendezvousDocument;
  
  if (!rendezvous.dateTime || isNaN(rendezvous.dateTime.getTime())) {
    return false;
  }
  
  const now = new Date();
  return rendezvous.dateTime < now;
};

RendezvousSchema.methods.canBeCancelled = function(byAdmin: boolean = false): boolean {
  const rendezvous = this as RendezvousDocument;
  
  if (rendezvous.status === RENDEZVOUS_STATUS.CANCELLED || rendezvous.status === RENDEZVOUS_STATUS.COMPLETED) {
    return false;
  }

  if (byAdmin) {
    return true;
  }

  if (!rendezvous.dateTime || isNaN(rendezvous.dateTime.getTime())) {
    return false;
  }

  const now = new Date();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const timeUntilRdv = rendezvous.dateTime.getTime() - now.getTime();

  return timeUntilRdv > twoHoursMs;
};

RendezvousSchema.methods.toSafeJSON = function() {
  const rendezvous = this as RendezvousDocument;
  const obj = rendezvous.toObject();
  
  if (obj.email) {
    const [localPart, domain] = obj.email.split('@');
    if (localPart && domain) {
      const maskedLocal = localPart.length <= 2 
        ? localPart.charAt(0) + '*'
        : localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1);
      obj.email = `${maskedLocal}@${domain}`;
    }
  }
  
  obj.effectiveDestination = rendezvous.getEffectiveDestination();
  obj.effectiveFiliere = rendezvous.getEffectiveFiliere();
  obj.isPast = rendezvous.isPast();
  obj.canBeCancelledByUser = rendezvous.canBeCancelled(false);
  
  return obj;
};

// ==================== MÉTHODES STATIQUES ====================

RendezvousSchema.statics.processOtherFieldsStatic = function(data: any): any {
  const processed = { ...data };
  
  if (processed.destination === 'Autre' && processed.destinationAutre) {
    processed.destination = processed.destinationAutre.trim();
    processed.destinationAutre = undefined;
  } else if (processed.destination !== 'Autre') {
    processed.destinationAutre = undefined;
  }

  if (processed.filiere === 'Autre' && processed.filiereAutre) {
    processed.filiere = processed.filiereAutre.trim();
    processed.filiereAutre = undefined;
  } else if (processed.filiere !== 'Autre') {
    processed.filiereAutre = undefined;
  }

  return processed;
};

RendezvousSchema.statics.validateRendezvousDataStatic = function(data: any): void {
  if (data.destination === 'Autre' && (!data.destinationAutre || data.destinationAutre.trim() === '')) {
    throw new BadRequestException('La destination "Autre" nécessite une précision');
  }
  
  if (data.filiere === 'Autre' && (!data.filiereAutre || data.filiereAutre.trim() === '')) {
    throw new BadRequestException('La filière "Autre" nécessite une précision');
  }

  if (data.date) {
    const date = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isNaN(date.getTime()) || date < today) {
      throw new BadRequestException('Date invalide ou passée');
    }
  }
};

// Index composé pour les recherches fréquentes
RendezvousSchema.index({ date: 1, time: 1 });
RendezvousSchema.index({ email: 1, status: 1 });
RendezvousSchema.index({ status: 1, date: 1 });