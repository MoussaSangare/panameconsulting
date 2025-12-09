import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

@Schema({
  timestamps: true,
  collection: "revoked_tokens",
})
export class RevokedToken extends Document {
  @Prop({ required: true, unique: true })
  token: string;

  @Prop({
    required: true,
  })
  expiresAt: Date;

  @Prop({
    required: true,
  })
  userId: string;
}

export const RevokedTokenSchema = SchemaFactory.createForClass(RevokedToken);

// Single index definition
RevokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
