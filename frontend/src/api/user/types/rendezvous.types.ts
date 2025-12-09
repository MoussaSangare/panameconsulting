// ==================== TYPES DE BASE (STRICTEMENT ADAPTÉS AU BACKEND) ====================

// Constantes EXACTEMENT comme dans le backend
export const RENDEZVOUS_STATUS = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
} as const;

export const ADMIN_OPINION = {
  FAVORABLE: 'Favorable',
  UNFAVORABLE: 'Défavorable',
} as const;

export const EDUCATION_LEVELS = [
  'Bac',
  'Bac+1',
  'Bac+2',
  'Licence',
  'Master I',
  'Master II',
  'Doctorat',
] as const;

export const TIME_SLOTS = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
] as const;

// Expressions régulières EXACTEMENT comme dans le backend
export const TIME_SLOT_REGEX = /^(09|1[0-6]):(00|30)$/;
export const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

// ==================== TYPES PRINCIPAUX (ADAPTÉS AU SCHEMA MONGOOSE) ====================

export type RendezvousStatus =
  (typeof RENDEZVOUS_STATUS)[keyof typeof RENDEZVOUS_STATUS];
export type AdminOpinion = (typeof ADMIN_OPINION)[keyof typeof ADMIN_OPINION];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export type TimeSlot = (typeof TIME_SLOTS)[number];

// Interface PRINCIPALE du rendez-vous - STRICTEMENT adaptée au backend
export interface Rendezvous {
  // Identifiant MongoDB
  _id: string;

  // Informations personnelles (EXACTEMENT comme dans le schema)
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;

  // Informations académiques (EXACTEMENT comme dans le backend)
  destination: string;
  destinationAutre?: string; // Seulement si destination === 'Autre'
  niveauEtude: EducationLevel;
  filiere: string;
  filiereAutre?: string; // Seulement si filiere === 'Autre'

  // Date et heure (formats stricts comme backend)
  date: string; // Format: YYYY-MM-DD
  time: TimeSlot; // Format: HH:MM (09:00-16:30, pas de 30min)

  // Statut et gestion (cohérent avec backend)
  status: RendezvousStatus;
  avisAdmin?: AdminOpinion; // Seulement si status === 'Terminé'
  notes?: string;

  // Métadonnées (auto-générées par Mongoose)
  createdAt: Date | string;
  updatedAt: Date | string;

  // Soft delete fields (comme backend)
  cancelledAt?: Date | string;
  cancelledBy?: 'admin' | 'user';
  cancellationReason?: string;

  // Version MongoDB (optionnelle)
  __v?: number;
}

// ==================== DTOs (STRICTEMENT comme backend) ====================

// DTO pour la création - EXACTEMENT comme CreateRendezvousDto du backend
export interface CreateRendezvousDto {
  firstName: string;
  lastName: string;
  email: string;
  telephone: string;
  destination: string;
  destinationAutre?: string; // Conditionnel
  niveauEtude: EducationLevel;
  filiere: string;
  filiereAutre?: string; // Conditionnel
  date: string; // YYYY-MM-DD
  time: TimeSlot; // HH:MM
}

// DTO pour la mise à jour - EXACTEMENT comme UpdateRendezvousDto du backend
export interface UpdateRendezvousDto extends Partial<CreateRendezvousDto> {
  status?: RendezvousStatus;
  avisAdmin?: AdminOpinion;
  notes?: string;
}

// ==================== RÉPONSES API (ADAPTÉES AUX ROUTES BACKEND) ====================

// Réponse pour GET /rendezvous/user - EXACTEMENT comme backend
export interface RendezvousResponse {
  data: Rendezvous[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Réponse pour GET /rendezvous (admin) - EXACTEMENT comme backend
export interface AdminRendezvousResponse {
  data: Rendezvous[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Réponse pour GET /rendezvous/available-slots - EXACTEMENT comme backend
export interface AvailableSlotsResponse {
  slots: TimeSlot[];
  date: string;
}

// Réponse pour GET /rendezvous/available-dates - EXACTEMENT comme backend
export interface AvailableDatesResponse {
  dates: string[];
  fromDate?: string;
  toDate?: string;
}

// Réponse standard pour POST/PUT/DELETE - Adaptée au backend
export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
  statusCode?: number;
}

// ==================== PARAMÈTRES DE REQUÊTE (ADAPTÉS AUX CONTROLLERS) ====================

// Paramètres pour GET /rendezvous/user - EXACTEMENT comme le backend attend
export interface UserRendezvousParams {
  email: string; // REQUIS
  page?: number; // default: 1
  limit?: number; // default: 10
  status?: RendezvousStatus; // optionnel
}

// Paramètres pour GET /rendezvous (admin) - EXACTEMENT comme le backend
export interface AdminRendezvousParams {
  page?: number; // default: 1
  limit?: number; // default: 10
  status?: RendezvousStatus;
  date?: string; // YYYY-MM-DD
  search?: string; // recherche textuelle
}

// Paramètres pour GET /rendezvous/available-slots
export interface AvailableSlotsParams {
  date: string; // REQUIS, format: YYYY-MM-DD
}

// ==================== TYPES POUR LE FRONTEND ====================

// Configuration d'affichage (frontend uniquement)
export interface StatusConfig {
  color: string;
  icon: string;
  label: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
}

// Rendez-vous formaté pour l'affichage (frontend uniquement)
export interface FormattedRendezvous {
  id: string;
  dateFormatted: string;
  timeFormatted: string;
  fullName: string;
  destination: string;
  filiere: string;
  niveauEtude: string;
  status: RendezvousStatus;
  statusConfig: StatusConfig;
  canCancel: boolean;
  timeRemaining?: string;
  isUpcoming: boolean;
  isPast: boolean;
}

// ==================== FONCTIONS UTILITAIRES (FRONTEND) ====================

// Vérifie si un statut est valide (identique logique backend)
export function isValidRendezvousStatus(
  status: string
): status is RendezvousStatus {
  return Object.values(RENDEZVOUS_STATUS).includes(status as RendezvousStatus);
}

// Vérifie si un avis admin est valide (identique logique backend)
export function isValidAdminOpinion(opinion: string): opinion is AdminOpinion {
  return Object.values(ADMIN_OPINION).includes(opinion as AdminOpinion);
}

// Vérifie si un niveau d'étude est valide (identique logique backend)
export function isValidEducationLevel(level: string): level is EducationLevel {
  return EDUCATION_LEVELS.includes(level as EducationLevel);
}

// Vérifie si un créneau horaire est valide (identique logique backend)
export function isValidTimeSlot(slot: string): slot is TimeSlot {
  return TIME_SLOT_REGEX.test(slot);
}

// Obtient la configuration d'affichage d'un statut (frontend)
export function getStatusConfig(status: RendezvousStatus): StatusConfig {
  const configs: Record<RendezvousStatus, StatusConfig> = {
    [RENDEZVOUS_STATUS.PENDING]: {
      color: 'text-yellow-800 bg-yellow-100 border-yellow-200',
      icon: 'Clock',
      label: 'En attente',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
    },
    [RENDEZVOUS_STATUS.CONFIRMED]: {
      color: 'text-green-800 bg-green-100 border-green-200',
      icon: 'CheckCircle',
      label: 'Confirmé',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-200',
      textColor: 'text-green-800',
    },
    [RENDEZVOUS_STATUS.COMPLETED]: {
      color: 'text-blue-800 bg-blue-100 border-blue-200',
      icon: 'CheckCircle',
      label: 'Terminé',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
    },
    [RENDEZVOUS_STATUS.CANCELLED]: {
      color: 'text-red-800 bg-red-100 border-red-200',
      icon: 'XCircle',
      label: 'Annulé',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
    },
  };

  return configs[status];
}

// Formate une date (frontend)
export function formatRendezvousDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Formate une heure (frontend)
export function formatRendezvousTime(timeStr: string): string {
  return timeStr.replace(':', 'h');
}

// Vérifie si un rendez-vous est à venir (logique backend)
export function isRendezvousUpcoming(rdv: Rendezvous): boolean {
  if (
    rdv.status === RENDEZVOUS_STATUS.CANCELLED ||
    rdv.status === RENDEZVOUS_STATUS.COMPLETED
  ) {
    return false;
  }

  try {
    const now = new Date();
    const rdvDateTime = new Date(`${rdv.date}T${rdv.time}:00`);
    return rdvDateTime > now;
  } catch {
    return false;
  }
}

// Vérifie si un rendez-vous peut être annulé (logique backend - 2h)
export function canCancelRendezvous(rdv: Rendezvous): boolean {
  if (
    rdv.status === RENDEZVOUS_STATUS.CANCELLED ||
    rdv.status === RENDEZVOUS_STATUS.COMPLETED
  ) {
    return false;
  }

  try {
    const now = new Date();
    const rdvDateTime = new Date(`${rdv.date}T${rdv.time}:00`);
    const timeDiff = rdvDateTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Identique au backend : 2 heures de délai
    return hoursDiff > 2;
  } catch {
    return false;
  }
}

// Obtient le message de temps restant (frontend)
export function getTimeRemainingMessage(rdv: Rendezvous): string | null {
  if (!isRendezvousUpcoming(rdv)) {
    return null;
  }

  try {
    const now = new Date();
    const rdvDateTime = new Date(`${rdv.date}T${rdv.time}:00`);
    const timeDiff = rdvDateTime.getTime() - now.getTime();

    if (timeDiff <= 0) return null;

    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Si moins de 2h, message spécial (cohérent avec backend)
    if (hoursDiff <= 2) {
      const minutesRemaining = Math.floor((timeDiff / (1000 * 60)) % 60);
      const hoursRemaining = Math.floor(timeDiff / (1000 * 60 * 60));

      if (hoursRemaining > 0) {
        return `Plus que ${hoursRemaining}h ${minutesRemaining}min`;
      } else {
        return `Plus que ${minutesRemaining}min`;
      }
    }

    // Format standard
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );

    if (days > 0) {
      return `Dans ${days} jour${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `Dans ${hours} heure${hours > 1 ? 's' : ''}`;
    }

    return null;
  } catch {
    return null;
  }
}

// Obtient la destination effective (gestion du "Autre")
export function getEffectiveDestination(rdv: Rendezvous): string {
  if (rdv.destination === 'Autre' && rdv.destinationAutre) {
    return rdv.destinationAutre;
  }
  return rdv.destination || 'Non spécifiée';
}

// Obtient la filière effective (gestion du "Autre")
export function getEffectiveFiliere(rdv: Rendezvous): string {
  if (rdv.filiere === 'Autre' && rdv.filiereAutre) {
    return rdv.filiereAutre;
  }
  return rdv.filiere || 'Non spécifiée';
}

// Crée un rendez-vous formaté pour l'affichage
export function createFormattedRendezvous(
  rdv: Rendezvous
): FormattedRendezvous {
  return {
    id: rdv._id,
    dateFormatted: formatRendezvousDate(rdv.date),
    timeFormatted: formatRendezvousTime(rdv.time),
    fullName: `${rdv.firstName} ${rdv.lastName}`,
    destination: getEffectiveDestination(rdv),
    filiere: getEffectiveFiliere(rdv),
    niveauEtude: rdv.niveauEtude,
    status: rdv.status,
    statusConfig: getStatusConfig(rdv.status),
    canCancel: canCancelRendezvous(rdv),
    timeRemaining: getTimeRemainingMessage(rdv) || undefined,
    isUpcoming: isRendezvousUpcoming(rdv),
    isPast:
      rdv.status === RENDEZVOUS_STATUS.COMPLETED ||
      rdv.status === RENDEZVOUS_STATUS.CANCELLED,
  };
}

// Valide les données de création (similaire au backend)
export function validateCreateRendezvousData(
  data: CreateRendezvousDto
): string[] {
  const errors: string[] = [];

  // Validation email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    errors.push("Format d'email invalide");
  }

  // Validation téléphone
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(data.telephone)) {
    errors.push('Format de téléphone invalide');
  }

  // Validation date
  if (!DATE_REGEX.test(data.date)) {
    errors.push('Format de date invalide (YYYY-MM-DD requis)');
  }

  // Validation heure
  if (!TIME_SLOT_REGEX.test(data.time)) {
    errors.push('Créneau horaire invalide (09:00-16:30, par pas de 30min)');
  }

  // Validation destination "Autre"
  if (
    data.destination === 'Autre' &&
    (!data.destinationAutre || data.destinationAutre.trim() === '')
  ) {
    errors.push('La destination "Autre" nécessite une précision');
  }

  // Validation filière "Autre"
  if (
    data.filiere === 'Autre' &&
    (!data.filiereAutre || data.filiereAutre.trim() === '')
  ) {
    errors.push('La filière "Autre" nécessite une précision');
  }

  // Validation niveau d'étude
  if (!isValidEducationLevel(data.niveauEtude)) {
    errors.push("Niveau d'étude invalide");
  }

  return errors;
}

// Traite les champs "Autre" pour la mise à jour (identique au backend)
export function processOtherFieldsForUpdate(
  data: UpdateRendezvousDto
): UpdateRendezvousDto {
  const processed = { ...data };

  // Traitement destination
  if (processed.destination === 'Autre' && processed.destinationAutre) {
    processed.destination = 'Autre'; // Garder "Autre" comme valeur
    processed.destinationAutre = processed.destinationAutre.trim();
  } else if (processed.destination !== 'Autre') {
    delete processed.destinationAutre;
  }

  // Traitement filière
  if (processed.filiere === 'Autre' && processed.filiereAutre) {
    processed.filiere = 'Autre'; // Garder "Autre" comme valeur
    processed.filiereAutre = processed.filiereAutre.trim();
  } else if (processed.filiere !== 'Autre') {
    delete processed.filiereAutre;
  }

  // Normalisation email
  if (processed.email) {
    processed.email = processed.email.toLowerCase().trim();
  }

  return processed;
}

// ==================== EXPORTS UTILES ====================

// Export des constantes pour un usage facile
export const RDV_STATUS = RENDEZVOUS_STATUS;
export const ADMIN_AVIS = ADMIN_OPINION;
export const NIVEAUX_ETUDE = EDUCATION_LEVELS;
export const CRENEAUX_HORAIRES = TIME_SLOTS;
