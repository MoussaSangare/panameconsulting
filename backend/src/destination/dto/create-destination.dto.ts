import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateDestinationDto {
  @ApiProperty({
    example: "France",
    description: "Nom du pays",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: "Le pays est obligatoire" })
  @MinLength(2, { message: "Le pays doit contenir au moins 2 caractères" })
  @MaxLength(100, { message: "Le pays ne doit pas dépasser 100 caractères" })
  country: string;

  @ApiProperty({
    example: "La France offre un système éducatif exceptionnel...",
    description: "Description détaillée de la destination",
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: "La description est obligatoire" })
  @MinLength(10, {
    message: "La description doit contenir au moins 10 caractères",
  })
  @MaxLength(2000, {
    message: "La description ne doit pas dépasser 2000 caractères",
  })
  text: string;

  @ApiPropertyOptional({
    type: "string",
    format: "binary",
    description: "Image de la destination (JPEG, PNG, WEBP) - Max 5MB",
  })
  @IsOptional()
  image?: any;
}
