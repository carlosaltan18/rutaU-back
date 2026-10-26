import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Recibe el lugar acordado donde se reunirán las personas del viaje. */
export class UpdateMeetingPointDto {
  @ApiProperty({ example: 'Entrada principal de la Universidad' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  meetingPoint: string;
}
