import { Module, Global } from "@nestjs/common";
import { MailService } from "./mail.service";
import {SmtpService } from "../config/smtp.service";

@Global()
@Module({
  
  providers: [MailService,SmtpService],
  exports: [MailService,SmtpService],
})
export class MailModule {}