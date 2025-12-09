import { IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProcedureDto {
  @ApiProperty({
    description: 'ID du rendez-vous associé',
    example: '507f1f77bcf86cd799439011',
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
