import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { User } from "./user.schema";

@Schema({
  timestamps: true,
  collection: "password_reset_tokens",
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
})
export class ResetToken extends Document {
  @Prop({ 
    type: String, 
    required: true, 
    unique: true 
  })
  token: string;

  @Prop({
    type: Types.ObjectId,
    ref: "User",
    required: true,
  })
  user: Types.ObjectId | User; // ✅ Union type

  @Prop({
    type: Date,
    required: true,
  })
  expiresAt: Date;

  @Prop({
    type: Boolean,
    default: false,
  })
  used: boolean;

  @Prop({
    type: String,
    enum: ["pending", "used", "expired"],
    default: "pending",
  })
  status: string;
}

export const ResetTokenSchema = SchemaFactory.createForClass(ResetToken);

// Single index definition for expiration
ResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ✅ Middleware asynchrone sans next
ResetTokenSchema.pre("save", async function() {
  if (this.isModified("used") && this.used) {
    this.status = "used";
  }
});

export type ResetTokenDocument = ResetToken &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };