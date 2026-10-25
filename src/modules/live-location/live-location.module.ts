import { Module } from '@nestjs/common';
import { LiveLocationService } from './live-location.service.js';

@Module({
  providers: [LiveLocationService],
  exports: [LiveLocationService],
})
export class LiveLocationModule {}
