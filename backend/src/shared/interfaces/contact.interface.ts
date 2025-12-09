import { Document } from "mongoose";

export interface Contact {
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  isRead: boolean;
  adminResponse?: string;
  respondedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Type utilisé avec Mongoose pour les schémas
export type ContactDocument = Contact & Document;

// Export par défaut
export default Contact;
