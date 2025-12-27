import { Module} from "@nestjs/common";
import { NotificationService } from "./notification.service";
import {  SmtpService, } from "../config/smtp.service";

@Module({
  imports: [
    ],
    
 providers: [NotificationService,SmtpService],
  exports: [NotificationService,SmtpService],
})
export class NotificationModule {}