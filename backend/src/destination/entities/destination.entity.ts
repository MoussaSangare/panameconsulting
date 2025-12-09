import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";
import { ApiProperty } from "@nestjs/swagger";

@Schema({
  timestamps: true,
  collection: "destinations",
  versionKey: false,
})
export class Destination extends Document {
  @ApiProperty({ example: "France", description: "Nom du pays" })
  @Prop({
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    unique: true,
  })
  country: string;

  @ApiProperty({
    example: "/france.webp",
    description: "Chemin de l'image",
  })
  @Prop({
    type: String,
    required: true,
  })
  imagePath: string;

  @ApiProperty({
    example: "Procédure complète pour visa étudiant",
    description: "Description de la destination",
  })
  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 2000,
  })
  text: string;

  // Timestamps automatiques
  createdAt: Date;
  updatedAt: Date;
}

export const DestinationSchema = SchemaFactory.createForClass(Destination);
DestinationSchema.index({ createdAt: -1 });
