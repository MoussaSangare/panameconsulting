import { Module} from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { ConfigModule } from "@nestjs/config";
import {  SmtpService, } from "../config/smtp.service";

@Module({
  imports: [
      ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
      }),
    ],
 providers: [NotificationService,
 SmtpService,  ],
  exports: [NotificationService,
 SmtpService,  ],
})
export class NotificationModule {}