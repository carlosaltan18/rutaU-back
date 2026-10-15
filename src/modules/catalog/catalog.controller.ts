import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator.js';
import { CatalogService } from './catalog.service.js';
import { CatalogQueryDto, ZoneQueryDto } from './dto/catalog-query.dto.js';

@ApiTags('Catalogs')
@Public()
@Controller()
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get('universities')
  @ApiOperation({ summary: 'Lista universidades activas' })
  listUniversities(@Query() query: CatalogQueryDto) {
    return this.service.listUniversities(query);
  }

  @Get('universities/:id/campuses')
  @ApiOperation({ summary: 'Lista campus activos de una universidad' })
  listCampuses(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: CatalogQueryDto,
  ) {
    return this.service.listCampuses(id, query);
  }

  @Get('zones')
  @ApiOperation({ summary: 'Busca zonas activas' })
  listZones(@Query() query: ZoneQueryDto) {
    return this.service.listZones(query);
  }
}
