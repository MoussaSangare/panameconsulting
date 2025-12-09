import { IsString, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Match } from "../../shared/decorators/match.decorator";

export class UpdatePasswordDto {
  @ApiProperty({
    example: "CurrentPassword123",
    description: "Mot de passe actuel",
  })
  @IsString()
  @MinLength(8, {
    message: "Le mot de passe doit contenir au moins 8 caractères",
  })
  currentPassword: string;

  @ApiProperty({
    example: "NewPassword123",
    description: "Nouveau mot de passe",
  })
  @IsString()
  @MinLength(8, {
    message: "Le nouveau mot de passe doit contenir au moins 8 caractères",
  })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      "Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre",
  })
  newPassword: string;

  @ApiProperty({
    example: "NewPassword123",
    description: "Confirmation du nouveau mot de passe",
  })
  @IsString()
  @MinLength(8)
  @Match("newPassword", { message: "Les mots de passe ne correspondent pas" })
  confirmNewPassword: string;
}
