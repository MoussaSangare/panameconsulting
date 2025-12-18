import { IsString, MinLength, Matches, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Match } from "../../shared/decorators/match.decorator";

export class ResetPasswordDto {
  @ApiProperty({ description: "Token de réinitialisation" })
  @IsString()
  @IsNotEmpty({ message: "Le token est requis" })
  token: string;

  @ApiProperty({
    example: "NewPassword123",
    description: "Nouveau mot de passe",
  })
  @IsString()
  @MinLength(8, {
    message: "Le mot de passe doit contenir au moins 8 caractères",
  })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      "Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre",
  })
  newPassword: string;

  @ApiProperty({
    example: "NewPassword123",
    description: "Confirmation du mot de passe",
  })
  @IsString()
  @MinLength(8)
  @Match("newPassword", { message: "Les mots de passe ne correspondent pas" })
  confirmPassword: string;
}
