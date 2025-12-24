import { Module} from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { ConfigModule } from "@nestjs/config";
import { ResendService } from "../config/resend.service";

@Module({
  imports: [ConfigModule],
  providers: [NotificationService,
    ResendService
  ],
  exports: [NotificationService,
    ResendService
  ],
})
export class NotificationModule {}