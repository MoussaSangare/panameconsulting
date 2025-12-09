import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsOptional,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "Jean", description: "Prénom" })
  @IsString()
  @IsNotEmpty({ message: "Le prénom est requis" })
  firstName: string;

  @ApiProperty({ example: "Dupont", description: "Nom" })
  @IsString()
  @IsNotEmpty({ message: "Le nom est requis" })
  lastName: string;

  @ApiProperty({ example: "jean.dupont@example.com", description: "Email" })
  @IsEmail()
  @IsNotEmpty({ message: "L'email est requis" })
  email: string;

  @ApiProperty({ example: "Password123", description: "Mot de passe" })
  @IsString()
  @MinLength(8, {
    message: "Le mot de passe doit contenir au moins 8 caractères",
  })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      "Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre",
  })
  password: string;

  @ApiProperty({ example: "+33123456789", description: "Téléphone" })
  @IsString()
  @IsNotEmpty({ message: "Le téléphone est requis" })
  telephone: string;

  @ApiProperty({
    example: "user",
    description: "Rôle",
    required: false,
  })
  @IsOptional()
  @IsString()
  role?: string;
}
