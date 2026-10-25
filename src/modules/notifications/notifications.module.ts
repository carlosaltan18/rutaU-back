import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken, Notification } from './entities/notification.entity.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { PushNotificationDispatcher } from './push-notification.dispatcher.js';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, DeviceToken])],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushNotificationDispatcher],
  exports: [NotificationsService],
})
export class NotificationsModule {}
