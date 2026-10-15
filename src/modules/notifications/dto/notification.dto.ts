import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../../common/pagination/pagination.dto.js';

export class NotificationQueryDto extends PaginationDto {}

export class RegisterDeviceDto {
  @ApiProperty({ minLength: 16, maxLength: 512 })
  @IsString()
  @MinLength(16)
  @MaxLength(512)
  token: string;

  @ApiProperty({ enum: ['ANDROID'], default: 'ANDROID' })
  @IsIn(['ANDROID'])
  platform = 'ANDROID' as const;
}
