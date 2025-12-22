import { Module, Global } from "@nestjs/common";
import { MailService } from "./mail.service";
import { ConfigModule } from "@nestjs/config";
import { EmailConfigService } from "../config/email-config.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MailService,EmailConfigService],
  exports: [MailService,EmailConfigService],
})
export class MailModule {}