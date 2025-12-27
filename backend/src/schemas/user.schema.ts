
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Model } from "mongoose";
import { UserRole } from "../enums/user-role.enum";

export interface UserModel extends Model<User> {
  findByEmailSafe(email: string): Promise<User | null>;
  existsById(userId: string): Promise<boolean>;
}

@Schema({ 
  timestamps: true,
  collection: "users",
  toJSON: { 
    virtuals: true
  },
  toObject: { 
    virtuals: true
  }
})
export class User extends Document {
  @Prop({ 
    type: String,
    required: true, 
    trim: true,
    minlength: 2,
    maxlength: 50
  })
  firstName: string;

  @Prop({ 
    type: String,
    required: true, 
    trim: true,
    minlength: 2,
    maxlength: 50
  })
  lastName: string;

  @Prop({ 
    type: String,
    required: true, 
    unique: true, 
    index: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxlength: 100
  })
  email: string;

  @Prop({ 
    type: String,
    required: true,
    select: false
  })
  password: string;

  @Prop({ 
    type: String,
    required: true,
    index: true,
    match: /^\+?[1-9]\d{1,14}$/,
    maxlength: 20
  })
  telephone: string;

  @Prop({
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER,
    index: true
  })
  role: UserRole;

  @Prop({ 
    type: Boolean,
    default: true,
    index: true 
  })
  isActive: boolean;

  @Prop({ 
    type: Date,
    index: true,
    expires: 86400 
  })
  logoutUntil?: Date;

  @Prop({ type: Date })
  lastLogout?: Date;

  @Prop({ type: String })
  logoutReason?: string;

  @Prop({ type: String })
  logoutTransactionId?: string;

  @Prop({ type: Number, default: 0 })
  logoutCount: number;

  @Prop({ type: Date })
  lastLogin?: Date;

  @Prop({ type: Number, default: 0 })
  loginCount: number;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
  id: any;

  // Virtuals
  public get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  public get isTemporarilyLoggedOut(): boolean {
    return this.logoutUntil && new Date() < this.logoutUntil;
  }

  public get canLogin(): boolean {
    if (this.role === UserRole.ADMIN) return true;
    if (!this.isActive) return false;
    if (this.isTemporarilyLoggedOut) return false;
    return true;
  }
}

export const UserSchema = SchemaFactory.createForClass(User);

// Index
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ logoutUntil: 1, isActive: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ updatedAt: -1 });
UserSchema.index({ email: 1, role: 1 });
UserSchema.index({ isActive: 1, role: 1, logoutUntil: 1 });

// Middleware
UserSchema.pre("save", function() {
  this.updatedAt = new Date();
});

UserSchema.pre("save", async function() {
  if (this.isModified('email')) {
    const UserModel = this.constructor as Model<User>;
    const existingUser = await UserModel.findOne({ 
      email: this.email 
    }).exec();
    
    if (existingUser && existingUser._id.toString() !== this._id.toString()) {
      throw new Error('Email already exists');
    }
  }
});

// Méthodes statiques
UserSchema.statics.findByEmailSafe = async function(email: string) {
  return this.findOne({ email: email.toLowerCase().trim() })
    .select('-password')
    .exec();
};

UserSchema.statics.existsById = async function(userId: string) {
  const count = await this.countDocuments({ _id: userId }).exec();
  return count > 0;
};

export { UserRole };
