import { HttpStatus, Injectable } from '@nestjs/common';
import { TripRole } from '../../common/domain/enums.js';
import { DomainException } from '../../common/errors/domain.exception.js';

@Injectable()
export class TripCapacityPolicy {
  isValid(role: TripRole, seatCapacity: number | null): boolean {
    return role === TripRole.DRIVER
      ? Number.isInteger(seatCapacity) &&
          (seatCapacity ?? 0) >= 1 &&
          (seatCapacity ?? 0) <= 3
      : seatCapacity === null;
  }

  assertValid(role: TripRole, seatCapacity: number | null) {
    if (!this.isValid(role, seatCapacity)) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'La capacidad no corresponde al rol del trayecto.',
        HttpStatus.BAD_REQUEST,
        [
          {
            field: 'seatCapacity',
            message: 'DRIVER requiere 1..3; PASSENGER requiere null.',
          },
        ],
      );
    }
  }
}
