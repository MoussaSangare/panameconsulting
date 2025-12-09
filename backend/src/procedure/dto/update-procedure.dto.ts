import { PartialType } from '@nestjs/swagger';
import { CreateProcedureDto } from './create-procedure.dto';
import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDate,
  IsArray,
  ValidateNested,
  IsString,
  MaxLength,
  MinLength,
  IsEmail,
} from 'class-validator';
import { ProcedureStatus } from '../../schemas/procedure.schema';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { UpdateStepDto } from './update-step.dto';

export class UpdateProcedureDto extends PartialType(CreateProcedureDto) {
  @ApiProperty({
    example: 'Terminée',
    description: 'Statut de la procédure',
    enum: ProcedureStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(ProcedureStatus, { message: 'Statut invalide' })
  statut?: ProcedureStatus;

  @ApiProperty({
    example: 'Jean',
    description: 'Prénom',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  prenom?: string;

  @ApiProperty({
    example: 'Dupont',
    description: 'Nom',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  nom?: string;

  @ApiProperty({
    example: 'jean.dupont@example.com',
    description: 'Email',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: "Format d'email invalide" })
  email?: string;

  @ApiProperty({
    example: '+33123456789',
    description: 'Numéro de téléphone',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Le téléphone doit être une chaîne de caractères' })
  telephone?: string;

  @ApiProperty({
    example: 'France',
    description: 'Destination',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La destination doit être une chaîne de caractères' })
  destination?: string;

  @ApiProperty({
    example: 'Autre destination spécifique',
    description: "Destination personnalisée (si 'Autre' sélectionné)",
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La destination autre doit être une chaîne de caractères' })
  destinationAutre?: string;

  @ApiProperty({
    example: 'Informatique',
    description: 'Filière',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La filière doit être une chaîne de caractères' })
  filiere?: string;

  @ApiProperty({
    example: 'Autre filière spécifique',
    description: "Filière personnalisée (si 'Autre' sélectionné)",
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La filière autre doit être une chaîne de caractères' })
  filiereAutre?: string;

  @ApiProperty({
    example: 'Licence',
    description: "Niveau d'étude",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Le niveau d'étude doit être une chaîne de caractères" })
  niveauEtude?: string;

  @ApiProperty({
    description: 'Liste des étapes mises à jour',
    type: [UpdateStepDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateStepDto)
  steps?: UpdateStepDto[];

  @ApiProperty({
    example: false,
    description: 'Indique si la procédure est supprimée logiquement',
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isDeleted doit être un booléen' })
  isDeleted?: boolean;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Date de suppression',
    required: false,
  })
  @IsOptional()
  @IsDate({ message: 'deletedAt doit être une date valide' })
  @Type(() => Date)
  deletedAt?: Date;

  @ApiProperty({
    example: 'Doublon',
    description: 'Raison de la suppression',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'deletionReason doit être une chaîne de caractères' })
  deletionReason?: string;

  @ApiProperty({
    example: 'Documents manquants',
    description: 'Raison du rejet de la procédure',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'raisonRejet doit être une chaîne de caractères' })
  @MinLength(5, { message: 'La raison doit contenir au moins 5 caractères' })
  @MaxLength(500, { message: 'La raison ne doit pas dépasser 500 caractères' })
  raisonRejet?: string;

  @ApiProperty({
    example: '2024-01-20T15:45:00.000Z',
    description: 'Date de completion de la procédure',
    required: false,
  })
  @IsOptional()
  @IsDate({ message: 'dateCompletion doit être une date valide' })
  @Type(() => Date)
  dateCompletion?: Date;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Date de dernière modification',
    required: false,
  })
  @IsOptional()
  @IsDate({ message: 'dateDerniereModification doit être une date valide' })
  @Type(() => Date)
  dateDerniereModification?: Date;
}
