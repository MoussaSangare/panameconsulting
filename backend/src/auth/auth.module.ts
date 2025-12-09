import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { PassportModule } from "@nestjs/passport";
import { ScheduleModule } from "@nestjs/schedule";
import { MailModule } from "../mail/mail.module";
import { UsersModule } from "../users/users.module";
import { ResetToken, ResetTokenSchema } from "../schemas/reset-token.schema";
import {
  RefreshToken,
  RefreshTokenSchema,
} from "../schemas/refresh-token.schema";
import {
  RevokedToken,
  RevokedTokenSchema,
} from "../schemas/revoked-token.schema";
import { Session, SessionSchema } from "../schemas/session.schema";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CleanupService } from "./cleanup.service";
import { RefreshTokenService } from "./refresh-token.service";
import { RevokedTokenService } from "./revoked-token.service";
import { SessionService } from "./session.service";
import { LocalStrategy } from "./strategies/local.strategy";
import { User, UserSchema } from "../schemas/user.schema";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    MailModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: RevokedToken.name, schema: RevokedTokenSchema },
      { name: Session.name, schema: SessionSchema },
      { name: ResetToken.name, schema: ResetTokenSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: User.name, schema: UserSchema },
    ] as const), // <-- AJOUTEZ ICI 'as const'
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get("JWT_EXPIRES_IN", "15m"),
          issuer: configService.get("APP_NAME", "panameconsulting"),
          algorithm: "HS256",
        },
      }),
      inject: [ConfigService],
    }),
    ConfigModule.forRoot(),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    RefreshTokenService,
    RevokedTokenService,
    CleanupService,
    LocalStrategy,
    JwtStrategy
  ],
  exports: [
    AuthService,
    SessionService,
    RefreshTokenService,
    RevokedTokenService,
    JwtModule,
  ],
})
export class AuthModule {}