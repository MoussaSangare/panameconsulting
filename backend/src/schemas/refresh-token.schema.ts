import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

@Schema({ 
  timestamps: true,
  collection: "refresh_tokens",
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
})export class RefreshToken extends Document {
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  user: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  deactivatedAt?: Date;

  @Prop()
  revocationReason?: string; // Ajout pour l'audit
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// Define indexes separately to avoid duplicates
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ user: 1 });
RefreshTokenSchema.index({ isActive: 1 }); // Ajout pour performance
RefreshTokenSchema.index({ deactivatedAt: 1 }); // Ajout pour cleanup