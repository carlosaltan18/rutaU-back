import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Equals,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { TripRole, TripStatus } from '../../../common/domain/enums.js';
import { PaginationDto } from '../../../common/pagination/pagination.dto.js';

export class CreateTripDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  originZoneId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  destinationCampusId: string;

  @ApiProperty({ minimum: 1, maximum: 7, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '06:30' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  departureTime: string;

  @ApiProperty({ enum: TripRole })
  @IsEnum(TripRole)
  role: TripRole;

  @ApiProperty({ nullable: true, minimum: 1, maximum: 3, example: null })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  seatCapacity: number | null;

  @ApiPropertyOptional({ example: 0, description: 'Debe ser 0 al crear' })
  @IsOptional()
  @Type(() => Number)
  @Equals(0)
  version?: 0;
}

class UpdatableTripDto extends OmitType(CreateTripDto, ['version'] as const) {}

export class UpdateTripDto extends PartialType(UpdatableTripDto) {
  @ApiProperty({ minimum: 1, description: 'Versión observada por el cliente' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

export class TripListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TripStatus })
  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;
}

export class MatchQueryDto extends PaginationDto {
  @ApiProperty({ format: 'date', example: '2026-10-19' })
  @IsDateString({ strict: true })
  travelDate: string;
}
