import { PartialType } from '@nestjs/mapped-types';
import { CreateRendezvousDto } from './create-rendezvous.dto';
import { IsOptional, IsEnum, ValidateIf, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

export class UpdateRendezvousDto extends PartialType(CreateRendezvousDto) {
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

  // Validation conditionnelle pour les champs "Autre" (cohérent avec create DTO)
  @ValidateIf((o) => o.destination === 'Autre')
  @IsNotEmpty({ message: 'La destination personnalisée est obligatoire quand "Autre" est sélectionné' })
  destinationAutre?: string;

  @ValidateIf((o) => o.filiere === 'Autre')
  @IsNotEmpty({ message: 'La filière personnalisée est obligatoire quand "Autre" est sélectionné' })
  filiereAutre?: string;
}