import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateContactDto {
  @ApiProperty({
    example: "Jean",
    description: "Prénom",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Le prénom doit être une chaîne de caractères" })
  @MaxLength(50, { message: "Le prénom ne doit pas dépasser 50 caractères" })
  firstName?: string;

  @ApiProperty({
    example: "Dupont",
    description: "Nom",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Le nom doit être une chaîne de caractères" })
  @MaxLength(50, { message: "Le nom ne doit pas dépasser 50 caractères" })
  lastName?: string;

  @ApiProperty({
    example: "jean.dupont@example.com",
    description: "Email",
  })
  @IsNotEmpty({ message: "L'email est obligatoire" })
  @IsEmail({}, { message: "Format d'email invalide" })
  email: string;

  @ApiProperty({
    example: "Bonjour, je souhaite obtenir des informations...",
    description: "Message",
  })
  @IsNotEmpty({ message: "Le message est obligatoire" })
  @IsString({ message: "Le message doit être une chaîne de caractères" })
  @MinLength(10, { message: "Le message doit contenir au moins 10 caractères" })
  @MaxLength(2000, {
    message: "Le message ne doit pas dépasser 2000 caractères",
  })
  message: string;
}
