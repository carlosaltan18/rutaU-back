import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CancellationReason } from '../../../common/domain/enums.js';

/** Recibe el motivo simple que se comparte al cancelar un viaje. */
export class CancelCoordinationDto {
  @ApiProperty({ enum: CancellationReason })
  @IsEnum(CancellationReason)
  reason: CancellationReason;
}
