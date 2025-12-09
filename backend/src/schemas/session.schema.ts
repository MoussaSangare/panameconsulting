// session.schema.ts - CORRIGÉ
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types, Model } from "mongoose";
import { AuthConstants } from "../auth/auth.constants";

// ✅ Définir l'interface statique
export interface SessionModel extends Model<Session> {
  cleanupExpired(): Promise<number>;
  findActiveByUserId(userId: string | Types.ObjectId): Promise<Session[]>;
}

@Schema({
  timestamps: true,
  collection: "sessions",
  toJSON: {
    virtuals: true
  }
})
export class Session extends Document {
  @Prop({ 
    type: Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true 
  })
  user: Types.ObjectId;

  @Prop({ 
    type: String,
    required: true, 
    unique: true,
    index: true 
  })
  token: string;

  @Prop({ 
    type: Date,
    required: true,
    index: true 
  })
  expiresAt: Date;

  @Prop({ 
    type: Boolean,
    default: true,
    index: true 
  })
  isActive: boolean;

  @Prop({ 
    type: Date,
    default: Date.now 
  })
  lastActivity: Date;

  @Prop({ 
    type: String 
  })
  ipAddress?: string;

  @Prop({ 
    type: String 
  })
  userAgent?: string;

  @Prop({ 
    type: Date 
  })
  deactivatedAt?: Date;

  @Prop({ 
    type: String,
    enum: Object.values(AuthConstants.REVOCATION_REASONS)
  })
  revocationReason?: string;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt?: Date;

  // Virtuals
  public get isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  public get isValid(): boolean {
    return this.isActive && !this.isExpired;
  }
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// ✅ Index pour performances
SessionSchema.index(
  { user: 1, isActive: 1, expiresAt: 1 },
  { 
    name: 'active_sessions_by_user',
    partialFilterExpression: { isActive: true }
  }
);

// ✅ Index TTL
SessionSchema.index(
  { expiresAt: 1 }, 
  { 
    expireAfterSeconds: 0,
    partialFilterExpression: { isActive: true },
    name: 'session_ttl'
  }
);

// ✅ Index pour recherche par token
SessionSchema.index(
  { token: 1 }, 
  { 
    unique: true,
    name: 'token_unique'
  }
);

// ✅ Index pour nettoyage
SessionSchema.index(
  { deactivatedAt: 1 },
  { 
    name: 'deactivated_sessions',
    partialFilterExpression: { isActive: false }
  }
);

// ✅ Index pour audits
SessionSchema.index(
  { createdAt: -1 },
  { name: 'created_desc' }
);

// ✅ Pré-save pour définir l'expiration par défaut
SessionSchema.pre('save', async function() {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + AuthConstants.SESSION_EXPIRATION_MS);
  }
  
  if (this.isModified()) {
    this.lastActivity = new Date();
  }
});

// ✅ Méthode d'instance pour désactiver la session
SessionSchema.methods.deactivate = function(reason?: string) {
  this.isActive = false;
  this.deactivatedAt = new Date();
  this.revocationReason = reason || AuthConstants.REVOCATION_REASONS.MANUAL_REVOKE;
  return this.save();
};

// ✅ Méthode statique pour nettoyer les sessions expirées
SessionSchema.statics.cleanupExpired = async function() {
  const result = await this.updateMany(
    { 
      expiresAt: { $lt: new Date() },
      isActive: true 
    },
    { 
      isActive: false,
      deactivatedAt: new Date(),
      revocationReason: AuthConstants.REVOCATION_REASONS.SESSION_EXPIRED
    }
  );
  
  return result.modifiedCount;
};

// ✅ Méthode statique pour trouver les sessions actives d'un utilisateur
SessionSchema.statics.findActiveByUserId = function(userId: string | Types.ObjectId) {
  return this.find({
    user: userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  })
  .sort({ createdAt: -1 })
  .exec();
};