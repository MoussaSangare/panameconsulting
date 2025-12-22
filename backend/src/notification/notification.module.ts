import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { ConfigModule } from "@nestjs/config";
import { EmailConfigService } from "../config/email-config.service";

@Module({
  imports: [ConfigModule],
  providers: [NotificationService,EmailConfigService],
  exports: [NotificationService,EmailConfigService],
})
export class NotificationModule {}