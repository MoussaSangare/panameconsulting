import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail({}, { message: "Format d'email invalide" })
  @IsNotEmpty({ message: "L'email est obligatoire" })
  email: string;

  @ApiProperty({ example: "votreMotDePasse123" })
  @IsString()
  @IsNotEmpty({ message: "Le mot de passe est obligatoire" })
  password: string;
}
