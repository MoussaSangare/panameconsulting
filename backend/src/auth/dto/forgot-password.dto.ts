import { IsEmail, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ForgotPasswordDto {
  @ApiProperty({
    example: "user@example.com",
    description: "Email de réinitialisation",
  })
  @IsEmail()
  @IsNotEmpty({ message: "L'email est requis" })
  email: string;
}
