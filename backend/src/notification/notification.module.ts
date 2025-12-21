import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { MailService } from '../mail/mail.service'; // Utilisez MailService directement

@Module({
  providers: [NotificationService, MailService],
  exports: [NotificationService],
})
export class NotificationModule {}