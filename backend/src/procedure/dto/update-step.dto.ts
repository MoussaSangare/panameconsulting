import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsDateString,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StepStatus, StepName } from '../../schemas/procedure.schema';

export class UpdateStepDto {
  @ApiPropertyOptional({
    example: 'DEMANDE ADMISSION',
    description: "Nom de l'étape",
    enum: StepName,
  })
  @IsOptional()
  @IsEnum(StepName, { message: "Nom d'étape invalide" })
  nom?: StepName;

  @ApiPropertyOptional({
    example: 'Terminé',
    description: "Statut de l'étape",
    enum: StepStatus,
  })
  @IsOptional()
  @IsEnum(StepStatus, { message: "Statut d'étape invalide" })
  statut?: StepStatus;

  @ApiPropertyOptional({
    example: 'Documents incomplets',
    description: 'Raison du refus (si applicable)',
  })
  @ValidateIf((dto) => dto.statut === StepStatus.REJECTED)
  @IsNotEmpty({ message: "La raison du refus est obligatoire lorsque le statut est 'Rejeté'" })
  @IsString({ message: 'La raison doit être une chaîne de caractères' })
  @MinLength(5, { message: 'La raison doit contenir au moins 5 caractères' })
  @MaxLength(500, { message: 'La raison ne doit pas dépasser 500 caractères' })
  raisonRefus?: string;

  @ApiPropertyOptional({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Date de création',
  })
  @IsOptional()
  @IsDateString({}, { message: 'dateCreation doit être une date ISO valide' })
  dateCreation?: string;

  @ApiPropertyOptional({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Date de mise à jour',
  })
  @IsOptional()
  @IsDateString({}, { message: 'dateMaj doit être une date ISO valide' })
  dateMaj?: string;

  @ApiPropertyOptional({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Date de complétion',
  })
  @IsOptional()
  @IsDateString({}, { message: 'dateCompletion doit être une date ISO valide' })
  dateCompletion?: string;
}
