import { HttpStatus, Injectable } from '@nestjs/common';
import { RequestStatus } from '../../common/domain/enums.js';
import { DomainException } from '../../common/errors/domain.exception.js';

export type RequestActorRelation = 'SENDER' | 'RECEIVER' | 'SYSTEM';

@Injectable()
export class RequestStatePolicy {
  canTransition(
    from: RequestStatus,
    to: RequestStatus,
    actor: RequestActorRelation,
  ): boolean {
    if (from === RequestStatus.PENDING) {
      if (
        (to === RequestStatus.ACCEPTED || to === RequestStatus.REJECTED) &&
        actor === 'RECEIVER'
      ) {
        return true;
      }
      if (to === RequestStatus.CANCELLED && actor === 'SENDER') return true;
      if (to === RequestStatus.EXPIRED && actor === 'SYSTEM') return true;
    }
    return (
      from === RequestStatus.ACCEPTED &&
      to === RequestStatus.CANCELLED &&
      (actor === 'SENDER' || actor === 'RECEIVER')
    );
  }

  assertTransition(
    from: RequestStatus,
    to: RequestStatus,
    actor: RequestActorRelation,
  ) {
    if (!this.canTransition(from, to, actor)) {
      throw new DomainException(
        'REQUEST_NOT_PENDING',
        'La transición de estado no está permitida.',
        HttpStatus.CONFLICT,
      );
    }
  }
}
