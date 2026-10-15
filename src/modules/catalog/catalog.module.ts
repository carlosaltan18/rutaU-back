import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campus } from './entities/campus.entity.js';
import {
  University,
  UniversityEmailDomain,
} from './entities/university.entity.js';
import { Zone } from './entities/zone.entity.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([University, UniversityEmailDomain, Campus, Zone]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
