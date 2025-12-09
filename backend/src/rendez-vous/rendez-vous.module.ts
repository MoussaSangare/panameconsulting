import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Rendezvous, RendezvousSchema } from '../schemas/rendezvous.schema';
import { NotificationModule } from '../notification/notification.module';
import { RendezvousController } from './rendez-vous.controller';
import { RendezvousService } from './rendez-vous.service';
import { ProcedureModule } from '../procedure/procedure.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Rendezvous.name, schema: RendezvousSchema }]),
    NotificationModule,
    forwardRef(() => ProcedureModule),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [RendezvousController],
  providers: [RendezvousService],
  exports: [RendezvousService, MongooseModule],
})
export class RendezvousModule {}
