import { Module, Global } from "@nestjs/common";
import { MailService } from "./mail.service";
import { ConfigModule } from "@nestjs/config";
import {SmtpService } from "../config/smtp.service";

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
  ],
  providers: [MailService,
SmtpService  ],
  exports: [MailService,
SmtpService
  ],
})
export class MailModule {}