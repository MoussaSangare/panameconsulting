// src/shared/interfaces/destination.interface.ts
import { Document } from "mongoose";

export interface Destination extends Document {
  country: string;
  imagePath: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}
