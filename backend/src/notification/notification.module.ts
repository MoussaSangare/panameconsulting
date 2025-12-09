import { Module } from "@nestjs/common";
import { NotificationService } from "./notification.service";

@Module({
  providers: [NotificationService],
  exports: [NotificationService], // Important pour l'utiliser ailleurs
})
export class NotificationModule {}
