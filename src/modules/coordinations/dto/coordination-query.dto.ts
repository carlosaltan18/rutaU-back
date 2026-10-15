import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CoordinationStatus } from '../../../common/domain/enums.js';
import { PaginationDto } from '../../../common/pagination/pagination.dto.js';

export class CoordinationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CoordinationStatus })
  @IsOptional()
  @IsEnum(CoordinationStatus)
  status?: CoordinationStatus;
}
