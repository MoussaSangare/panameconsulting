import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Model } from 'mongoose';
import { Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

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

const DESTINATIONS = [
  'France',
  'Canada',
  'Belgique',
  'Suisse',
  'États-Unis',
  'Autre'
] as const;

const FILIERES = [
  'Informatique',
  'Médecine',
  'Droit',
  'Commerce',
  'Ingénierie',
  'Architecture',
  'Autre'
] as const;

// Interface pour les méthodes d'instance
export interface RendezvousMethods {
  getEffectiveDestination(): string;
  getEffectiveFiliere(): string;
  isPast(): boolean;
  isExpired(): boolean;
  canBeCancelled(byAdmin?: boolean): boolean;
  canBeModified(): boolean;
  canBeMarkedAsCompleted(): boolean;
  toSafeJSON(): any;
  isToday(): boolean;
}

// Interface pour les méthodes statiques
export interface RendezvousModel extends Model<Rendezvous, {}, RendezvousMethods> {
  findActiveByEmail(email: string): Promise<Rendezvous[]>;
  findExpired(): Promise<Rendezvous[]>;
  countDailyBookings(date: string): Promise<number>;
}

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
  _id: string;

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
    index: true,
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
    enum: DESTINATIONS,
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
    enum: FILIERES,
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
    enum: TIME_SLOTS,
    index: true,
  })
  time: string;

  @Prop({
    default: RENDEZVOUS_STATUS.CONFIRMED,
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
    enum: ['admin', 'user', 'system'],
  })
  cancelledBy?: string;

  @Prop({
    required: false,
  })
  cancellationReason?: string;

  @Prop({
    required: false,
  })
  expiredAt?: Date;

  @Prop({
    default: Date.now,
  })
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  })
  user?: mongoose.Schema.Types.ObjectId;

  // Virtual pour la date/heure combinée
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

  // Virtual pour la date d'expiration (heure + 10 minutes)
  @Prop({
    virtual: true,
    get: function() {
      if (!this.dateTime) return null;
      
      const expirationTime = new Date(this.dateTime.getTime() + 10 * 60000);
      return expirationTime;
    }
  })
  expirationTime?: Date;

  // Virtual pour vérifier si le rendez-vous est en retard
  @Prop({
    virtual: true,
    get: function() {
      if (!this.dateTime) return false;
      
      const now = new Date();
      const lateTime = new Date(this.dateTime.getTime() + 10 * 60000);
      return now > lateTime && 
             (this.status === RENDEZVOUS_STATUS.PENDING || 
              this.status === RENDEZVOUS_STATUS.CONFIRMED);
    }
  })
  isLate?: boolean;
}

export const RendezvousSchema = SchemaFactory.createForClass(Rendezvous);

// ==================== MIDDLEWARE PRE-SAVE ====================

RendezvousSchema.pre('save', async function() {
  const rendezvous = this as any;
  
  try {
    // Normalisation des champs
    if (rendezvous.firstName) rendezvous.firstName = rendezvous.firstName.trim();
    if (rendezvous.lastName) rendezvous.lastName = rendezvous.lastName.trim();
    if (rendezvous.email) rendezvous.email = rendezvous.email.toLowerCase().trim();
    if (rendezvous.telephone) rendezvous.telephone = rendezvous.telephone.trim();
    if (rendezvous.destination) rendezvous.destination = rendezvous.destination.trim();
    if (rendezvous.destinationAutre) rendezvous.destinationAutre = rendezvous.destinationAutre.trim();
    if (rendezvous.filiere) rendezvous.filiere = rendezvous.filiere.trim();
    if (rendezvous.filiereAutre) rendezvous.filiereAutre = rendezvous.filiereAutre.trim();
    
    // Validation des champs "Autre"
    if (rendezvous.destination === 'Autre' && (!rendezvous.destinationAutre || rendezvous.destinationAutre.trim() === '')) {
      throw new BadRequestException('La destination "Autre" nécessite une précision');
    }
    
    if (rendezvous.filiere === 'Autre' && (!rendezvous.filiereAutre || rendezvous.filiereAutre.trim() === '')) {
      throw new BadRequestException('La filière "Autre" nécessite une précision');
    }

    // Validation de la date
    if (rendezvous.date) {
      const date = new Date(rendezvous.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (isNaN(date.getTime()) || date < today) {
        throw new BadRequestException('Date invalide ou passée');
      }
    }

    // Validation de l'heure
    if (rendezvous.time) {
      const [hours, minutes] = rendezvous.time.split(':').map(Number);
      const timeInHours = hours + minutes / 60;
      
      if (timeInHours < 9 || timeInHours > 16.5) {
        throw new BadRequestException('Les horaires disponibles sont entre 9h00 et 16h30');
      }
      
      const totalMinutes = (hours - 9) * 60 + minutes;
      if (totalMinutes % 30 !== 0) {
        throw new BadRequestException('Les créneaux doivent être espacés de 30 minutes');
      }
    }

    // Vérifier si le rendez-vous est expiré
    if (rendezvous.dateTime && (rendezvous.status === RENDEZVOUS_STATUS.PENDING || rendezvous.status === RENDEZVOUS_STATUS.CONFIRMED)) {
      const now = new Date();
      const expirationTime = new Date(rendezvous.dateTime.getTime() + 10 * 60000);
      
      if (now > expirationTime) {
        rendezvous.status = RENDEZVOUS_STATUS.EXPIRED;
        rendezvous.expiredAt = new Date();
      }
    }

    // Marquer la date de mise à jour
    rendezvous.updatedAt = new Date();

  } catch (error) {
    throw error;
  }
});

// ==================== MÉTHODES D'INSTANCE ====================

RendezvousSchema.methods.getEffectiveDestination = function(): string {
  const rendezvous = this as any;
  return rendezvous.destination === 'Autre' && rendezvous.destinationAutre 
    ? rendezvous.destinationAutre 
    : rendezvous.destination;
};

RendezvousSchema.methods.getEffectiveFiliere = function(): string {
  const rendezvous = this as any;
  return rendezvous.filiere === 'Autre' && rendezvous.filiereAutre 
    ? rendezvous.filiereAutre 
    : rendezvous.filiere;
};

RendezvousSchema.methods.isPast = function(): boolean {
  const rendezvous = this as any;
  
  if (!rendezvous.dateTime || isNaN(rendezvous.dateTime.getTime())) {
    return false;
  }
  
  const now = new Date();
  return rendezvous.dateTime < now;
};

RendezvousSchema.methods.isExpired = function(): boolean {
  const rendezvous = this as any;
  
  if (rendezvous.status === RENDEZVOUS_STATUS.EXPIRED) {
    return true;
  }
  
  if (!rendezvous.dateTime || isNaN(rendezvous.dateTime.getTime())) {
    return false;
  }
  
  const now = new Date();
  const expirationTime = new Date(rendezvous.dateTime.getTime() + 10 * 60000);
  
  return now > expirationTime && 
         (rendezvous.status === RENDEZVOUS_STATUS.PENDING || 
          rendezvous.status === RENDEZVOUS_STATUS.CONFIRMED);
};

RendezvousSchema.methods.canBeCancelled = function(byAdmin: boolean = false): boolean {
  const rendezvous = this as any;
  
  if (rendezvous.status === RENDEZVOUS_STATUS.CANCELLED || 
      rendezvous.status === RENDEZVOUS_STATUS.COMPLETED ||
      rendezvous.status === RENDEZVOUS_STATUS.EXPIRED) {
    return false;
  }

  if (byAdmin) {
    return true;
  }

  if (!rendezvous.dateTime || isNaN(rendezvous.dateTime.getTime())) {
    return false;
  }

  // Utilisateurs normaux : annulation possible jusqu'à 2h avant
  const now = new Date();
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const timeUntilRdv = rendezvous.dateTime.getTime() - now.getTime();

  return timeUntilRdv > twoHoursMs && rendezvous.status === RENDEZVOUS_STATUS.CONFIRMED;
};

RendezvousSchema.methods.canBeModified = function(): boolean {
  const rendezvous = this as any;
  
  return rendezvous.status !== RENDEZVOUS_STATUS.COMPLETED &&
         rendezvous.status !== RENDEZVOUS_STATUS.EXPIRED &&
         rendezvous.status !== RENDEZVOUS_STATUS.CANCELLED &&
         !rendezvous.isExpired();
};

RendezvousSchema.methods.canBeMarkedAsCompleted = function(): boolean {
  const rendezvous = this as any;
  
  // Vérifier que le rendez-vous n'est pas déjà terminé, annulé ou expiré
  if (rendezvous.status === RENDEZVOUS_STATUS.COMPLETED ||
      rendezvous.status === RENDEZVOUS_STATUS.CANCELLED ||
      rendezvous.status === RENDEZVOUS_STATUS.EXPIRED) {
    return false;
  }
  
  // Vérifier que le rendez-vous a eu lieu (date dans le passé ou aujourd'hui)
  if (!rendezvous.dateTime || isNaN(rendezvous.dateTime.getTime())) {
    return false;
  }
  
  const now = new Date();
  return rendezvous.dateTime <= now && rendezvous.status === RENDEZVOUS_STATUS.CONFIRMED;
};

RendezvousSchema.methods.isToday = function(): boolean {
  const rendezvous = this as any;
  
  if (!rendezvous.date) return false;
  
  const today = new Date().toISOString().split('T')[0];
  return rendezvous.date === today;
};

RendezvousSchema.methods.toSafeJSON = function() {
  const rendezvous = this as any;
  const obj = rendezvous.toObject();
  
  // Masquer l'email
  if (obj.email) {
    const [localPart, domain] = obj.email.split('@');
    if (localPart && domain) {
      const maskedLocal = localPart.length <= 2 
        ? localPart.charAt(0) + '*'
        : localPart.charAt(0) + '***' + localPart.charAt(localPart.length - 1);
      obj.email = `${maskedLocal}@${domain}`;
    }
  }
  
  // Ajouter les champs virtuels
  obj.effectiveDestination = rendezvous.getEffectiveDestination();
  obj.effectiveFiliere = rendezvous.getEffectiveFiliere();
  obj.isPast = rendezvous.isPast();
  obj.isExpired = rendezvous.isExpired();
  obj.canBeCancelledByUser = rendezvous.canBeCancelled(false);
  obj.canBeModified = rendezvous.canBeModified();
  obj.canBeMarkedAsCompleted = rendezvous.canBeMarkedAsCompleted();
  obj.isToday = rendezvous.isToday();
  
  // Ajouter les informations de retard
  if (rendezvous.dateTime) {
    const now = new Date();
    const expirationTime = new Date(rendezvous.dateTime.getTime() + 10 * 60000);
    obj.minutesUntilExpiration = Math.max(0, Math.round((expirationTime.getTime() - now.getTime()) / 60000));
    obj.isLate = now > expirationTime;
  }
  
  return obj;
};

// ==================== MÉTHODES STATIQUES ====================

RendezvousSchema.statics.findActiveByEmail = async function(email: string): Promise<Rendezvous[]> {
  const normalizedEmail = email.toLowerCase().trim();
  
  return this.find({ 
    email: normalizedEmail,
    status: { $nin: [RENDEZVOUS_STATUS.CANCELLED, RENDEZVOUS_STATUS.EXPIRED] }
  }).sort({ date: -1, time: 1 }).exec();
};

RendezvousSchema.statics.findExpired = async function(): Promise<Rendezvous[]> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  return this.find({
    status: { $in: [RENDEZVOUS_STATUS.PENDING, RENDEZVOUS_STATUS.CONFIRMED] },
    date: { $lte: today }
  }).exec();
};

RendezvousSchema.statics.countDailyBookings = async function(date: string): Promise<number> {
  return this.countDocuments({
    date,
    status: { $nin: [RENDEZVOUS_STATUS.CANCELLED, RENDEZVOUS_STATUS.EXPIRED] }
  }).exec();
};

// ==================== INDEXES ====================

// Index unique pour éviter les doublons de créneaux (sauf annulés/expirés)
RendezvousSchema.index({ date: 1, time: 1 }, { 
  unique: true,
  partialFilterExpression: { 
    status: { 
      $nin: [RENDEZVOUS_STATUS.CANCELLED, RENDEZVOUS_STATUS.EXPIRED] 
    } 
  }
});

// Index composé pour les recherches fréquentes
RendezvousSchema.index({ email: 1, status: 1 });
RendezvousSchema.index({ status: 1, date: 1 });
RendezvousSchema.index({ email: 1, date: -1 });
RendezvousSchema.index({ date: 1, status: 1, time: 1 });

// Index pour les jobs cron
RendezvousSchema.index({ 
  status: 1, 
  createdAt: 1 
}, { 
  partialFilterExpression: { status: RENDEZVOUS_STATUS.PENDING } 
});

RendezvousSchema.index({ 
  status: 1, 
  date: 1,
  time: 1 
}, { 
  partialFilterExpression: { 
    status: { $in: [RENDEZVOUS_STATUS.PENDING, RENDEZVOUS_STATUS.CONFIRMED] } 
  } 
});

// Index pour la synchronisation email
RendezvousSchema.index({ email: 1, updatedAt: -1 });

// Index pour les vérifications en temps réel
RendezvousSchema.index({ 
  date: 1, 
  time: 1, 
  status: 1 
}, { 
  background: true 
});