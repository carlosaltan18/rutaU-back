import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RequestStatus, RequestType } from '../../../common/domain/enums.js';
import { PaginationDto } from '../../../common/pagination/pagination.dto.js';

export class CreateRideRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  senderTripId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  targetTripId: string;

  @ApiProperty({ enum: RequestType })
  @IsEnum(RequestType)
  type: RequestType;

  @ApiProperty({ format: 'date', example: '2026-10-19' })
  @IsDateString({ strict: true })
  travelDate: string;

  @ApiProperty({ example: 1000, description: 'Centavos de GTQ' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  offeredContributionMinor: number;

  @ApiProperty({ enum: ['GTQ'], example: 'GTQ' })
  @IsIn(['GTQ'])
  currency: 'GTQ';

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(160)
  message?: string;
}

export class RideRequestListQueryDto extends PaginationDto {
  @ApiProperty({ enum: ['sent', 'received'] })
  @IsIn(['sent', 'received'])
  box: 'sent' | 'received';

  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}
