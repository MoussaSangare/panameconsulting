// contact.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type ContactDocument = Contact & Document;

@Schema({
  timestamps: true,
  collection: "contacts",
  versionKey: false,
})
export class Contact {
  @Prop({ trim: true, maxlength: 50 })
  firstName?: string;

  @Prop({ trim: true, maxlength: 50 })
  lastName?: string;

  @Prop({
    required: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  })
  email: string;

  @Prop({
    required: true,
    minlength: 10,
    maxlength: 2000,
  })
  message: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ maxlength: 2000 })
  adminResponse?: string;

  @Prop()
  respondedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: "User" })
  respondedBy?: Types.ObjectId;

  // Champs timestamps automatiques
  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
