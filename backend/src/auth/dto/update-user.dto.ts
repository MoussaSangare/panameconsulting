import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateUserDto {
  @ApiProperty({
    example: "nouveau@email.com",
    description: "Nouvel email",
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: "Format d'email invalide" })
  email?: string;

  @ApiProperty({
    example: "+33123456789",
    description: "Nouveau numéro de téléphone",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Le téléphone doit être une chaîne de caractères" })
  @MinLength(5, { message: "Le téléphone doit contenir au moins 5 caractères" })
  telephone?: string;
}
