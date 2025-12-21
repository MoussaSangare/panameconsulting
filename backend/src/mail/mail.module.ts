import { Module, Global } from "@nestjs/common";
import { MailService } from "./mail.service";
import { ConfigModule } from "@nestjs/config";
import { EmailTransportService } from "./email-transport.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MailService,
    EmailTransportService
  ],
  exports: [MailService, EmailTransportService],
})
export class MailModule {}