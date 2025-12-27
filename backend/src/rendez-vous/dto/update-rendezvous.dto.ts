import { PartialType } from '@nestjs/mapped-types';
import { CreateRendezvousDto } from './create-rendezvous.dto';
import { IsOptional, IsEnum, ValidateIf, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

export class UpdateRendezvousDto extends PartialType(CreateRendezvousDto) {
  @ApiProperty({
    example: 'jean.dupont@example.com',
    description: 'Email du client (doit correspondre à un compte existant)',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: "Format d'email invalide" })
  email?: string;

  @ApiProperty({
    enum: Object.values(RENDEZVOUS_STATUS),
    example: 'Confirmé',
    description: 'Nouveau statut du rendez-vous',
    required: false,
  })
  @IsOptional()
  @IsEnum(Object.values(RENDEZVOUS_STATUS), {
    message: 'Statut invalide',
  })
  status?: string;

  @ApiProperty({
    enum: Object.values(ADMIN_OPINION),
    example: 'Favorable',
    description: 'Avis administratif',
    required: false,
  })
  @IsOptional()
  @IsEnum(Object.values(ADMIN_OPINION), {
    message: 'Avis administratif invalide',
  })
  avisAdmin?: string;

  @ApiProperty({
    enum: DESTINATIONS,
    example: 'France',
    description: 'Destination mise à jour',
    required: false,
  })
  @IsOptional()
  @IsEnum(DESTINATIONS, { message: 'Destination invalide' })
  destination?: string;

  @ApiProperty({
    enum: FILIERES,
    example: 'Informatique',
    description: 'Filière mise à jour',
    required: false,
  })
  @IsOptional()
  @IsEnum(FILIERES, { message: 'Filière invalide' })
  filiere?: string;

  // Validation conditionnelle pour les champs "Autre"
  @ValidateIf((o) => o.destination === 'Autre')
  @IsNotEmpty({ message: 'La destination personnalisée est obligatoire quand "Autre" est sélectionné' })
  destinationAutre?: string;

  @ValidateIf((o) => o.filiere === 'Autre')
  @IsNotEmpty({ message: 'La filière personnalisée est obligatoire quand "Autre" est sélectionné' })
  filiereAutre?: string;
}