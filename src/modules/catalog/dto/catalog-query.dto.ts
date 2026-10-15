import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/pagination/pagination.dto.js';

export class CatalogQueryDto extends PaginationDto {}

export class ZoneQueryDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'Guatemala' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  municipality?: string;

  @ApiPropertyOptional({ example: 'Zona 10' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  query?: string;
}
