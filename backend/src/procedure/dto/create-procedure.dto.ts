import { IsEmail, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProcedureDto {

  @IsNotEmpty({ message: "L'email est obligatoire" })
  @IsEmail({}, { message: "Format d'email invalide" })
  email: string; // Add this field

  @IsNotEmpty({ message: "Le prénom est obligatoire" })
  @IsString({ message: "Le prénom doit être une chaîne de caractères" })
  @MaxLength(50, { message: "Le prénom ne peut pas dépasser 50 caractères" })
  firstName: string;

  @IsNotEmpty({ message: "Le nom est obligatoire" })
  @IsString({ message: "Le nom doit être une chaîne de caractères" })
  @MaxLength(50, { message: "Le nom ne peut pas dépasser 50 caractères" })
  lastName: string;

  @IsNotEmpty({ message: "Le téléphone est obligatoire" })
  @IsString({ message: "Le téléphone doit être une chaîne de caractères" })
  telephone: string;
  
  @ApiProperty({
    description: 'Email associé au Rendez-vous dont la procédure est issue',
    example: 'exemple.ex5@gmail.com',
  })
  @IsMongoId({ message: 'ID de rendez-vous invalide' })
  @IsNotEmpty({ message: "L'ID du rendez-vous est obligatoire" })
  rendezVousId!: string;
}

export class CancelProcedureDto {
  @ApiProperty({
    example: 'Changement de plans',
    description: "Raison de l'annulation",
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La raison doit être une chaîne de caractères' })
  @MinLength(5, { message: 'La raison doit contenir au moins 5 caractères' })
  @MaxLength(500, { message: 'La raison ne doit pas dépasser 500 caractères' })
  reason?: string;
}
