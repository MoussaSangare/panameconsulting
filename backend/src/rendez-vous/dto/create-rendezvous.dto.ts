import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const TIME_SLOT_REGEX = /^(09|1[0-6]):(00|30)$/;
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

// Constantes pour la cohérence
const EDUCATION_LEVELS = [
  'Bac',
  'Bac+1',
  'Bac+2',
  'Licence',
  'Master I',
  'Master II',
  'Doctorat'
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

export class CreateRendezvousDto {
  @ApiProperty({ example: 'Jean', description: 'Prénom du client' })
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  @MaxLength(50, { message: 'Le prénom ne peut pas dépasser 50 caractères' })
  firstName: string;

  @ApiProperty({ example: 'Dupont', description: 'Nom de famille du client' })
  @IsNotEmpty({ message: 'Le nom est obligatoire' })
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @MaxLength(50, { message: 'Le nom ne peut pas dépasser 50 caractères' })
  lastName: string;

  @ApiProperty({
    example: 'jean.dupont@example.com',
    description: 'Email du client (doit correspondre à un compte existant)',
  })
  @IsNotEmpty({ message: "L'email est obligatoire" })
  @IsEmail({}, { message: "Format d'email invalide" })
  @MaxLength(100, { message: "L'email ne peut pas dépasser 100 caractères" })
  email: string;

  @ApiProperty({ example: '+22812345678', description: 'Téléphone du client' })
  @IsNotEmpty({ message: 'Le téléphone est obligatoire' })
  @IsString({ message: 'Le téléphone doit être une chaîne de caractères' })
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Format de téléphone invalide' })
  telephone: string;

  @ApiProperty({
    example: 'France',
    description: 'Destination souhaitée',
    enum: DESTINATIONS,
  })
  @IsNotEmpty({ message: 'La destination est obligatoire' })
  @IsString({ message: 'La destination doit être une chaîne de caractères' })
  @IsEnum(DESTINATIONS, { message: 'Destination invalide' })
  destination: string;

  @ApiProperty({
    required: false,
    example: 'Autre destination',
    description: 'Destination personnalisée si "Autre" est sélectionné',
  })
  @IsOptional()
  @IsString({ message: 'La destination personnalisée doit être une chaîne' })
  @ValidateIf((o) => o.destination === 'Autre')
  @IsNotEmpty({ 
    message: 'La destination personnalisée est obligatoire quand "Autre" est sélectionné' 
  })
  @MaxLength(100, {
    message: 'La destination personnalisée ne peut pas dépasser 100 caractères',
  })
  destinationAutre?: string;

  @ApiProperty({
    enum: EDUCATION_LEVELS,
    example: 'Licence',
    description: "Niveau d'étude du client",
  })
  @IsNotEmpty({ message: "Le niveau d'étude est obligatoire" })
  @IsString({ message: "Le niveau d'étude doit être une chaîne de caractères" })
  @IsEnum(EDUCATION_LEVELS, { message: 'Niveau d\'étude invalide' })
  niveauEtude: string;

  @ApiProperty({
    example: 'Informatique',
    description: 'Filière souhaitée',
    enum: FILIERES,
  })
  @IsNotEmpty({ message: 'La filière est obligatoire' })
  @IsString({ message: 'La filière doit être une chaîne de caractères' })
  @IsEnum(FILIERES, { message: 'Filière invalide' })
  filiere: string;

  @ApiProperty({
    required: false,
    example: 'Autre filière',
    description: 'Filière personnalisée si "Autre" est sélectionné',
  })
  @IsOptional()
  @IsString({ message: 'La filière personnalisée doit être une chaîne' })
  @ValidateIf((o) => o.filiere === 'Autre')
  @IsNotEmpty({ 
    message: 'La filière personnalisée est obligatoire quand "Autre" est sélectionné' 
  })
  @MaxLength(100, {
    message: 'La filière personnalisée ne peut pas dépasser 100 caractères',
  })
  filiereAutre?: string;

  @ApiProperty({
    example: '2024-12-25',
    description: 'Date du rendez-vous (YYYY-MM-DD)',
  })
  @IsNotEmpty({ message: 'La date est obligatoire' })
  @Matches(DATE_REGEX, {
    message: 'Format de date invalide (YYYY-MM-DD requis)',
  })
  date: string;

  @ApiProperty({
    example: '10:00',
    description: 'Heure du rendez-vous (HH:MM) entre 09:00 et 16:30 par pas de 30min',
  })
  @IsNotEmpty({ message: "L'heure est obligatoire" })
  @Matches(TIME_SLOT_REGEX, {
    message: 'Créneau horaire invalide (09:00-16:30, par pas de 30min)',
  })
  time: string;
}