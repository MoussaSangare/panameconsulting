import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Services
import { ProcedureService } from './procedure.service';
import { NotificationService } from '../notification/notification.service';

// Controller
import { ProcedureController } from './procedure.controller';

// Schemas
import { Procedure, ProcedureSchema } from '../schemas/procedure.schema';
import { RendezvousModule } from '../rendez-vous/rendez-vous.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Procedure.name, schema: ProcedureSchema }]),
    forwardRef(() => RendezvousModule),
  ],
  controllers: [ProcedureController],
  providers: [ProcedureService, NotificationService],
  exports: [ProcedureService],
})
export class ProcedureModule {}
