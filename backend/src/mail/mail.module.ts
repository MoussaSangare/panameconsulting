import { Module, Global } from "@nestjs/common";
import { MailService } from "./mail.service";
import { ConfigModule } from "@nestjs/config";
import { Resend } from "resend";
import { ResendService } from "../config/resend.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [MailService,
    ResendService
  ],
  exports: [MailService,
    ResendService
  ],
})
export class MailModule {}