import { RequestStatus } from '../../common/domain/enums.js';
import {
  RequestStatePolicy,
  type RequestActorRelation,
} from './request-state.policy.js';

describe('RequestStatePolicy', () => {
  const policy = new RequestStatePolicy();

  it.each([
    [RequestStatus.PENDING, RequestStatus.ACCEPTED, 'RECEIVER'],
    [RequestStatus.PENDING, RequestStatus.REJECTED, 'RECEIVER'],
    [RequestStatus.PENDING, RequestStatus.CANCELLED, 'SENDER'],
    [RequestStatus.PENDING, RequestStatus.EXPIRED, 'SYSTEM'],
    [RequestStatus.ACCEPTED, RequestStatus.CANCELLED, 'SENDER'],
    [RequestStatus.ACCEPTED, RequestStatus.CANCELLED, 'RECEIVER'],
  ] as Array<[RequestStatus, RequestStatus, RequestActorRelation]>)(
    'permite %s -> %s para %s',
    (from, to, actor) =>
      expect(policy.canTransition(from, to, actor)).toBe(true),
  );

  it.each([
    RequestStatus.REJECTED,
    RequestStatus.CANCELLED,
    RequestStatus.EXPIRED,
  ])('mantiene terminal el estado %s', (from) => {
    for (const to of Object.values(RequestStatus)) {
      expect(policy.canTransition(from, to, 'SENDER')).toBe(false);
    }
  });

  it('no permite al emisor aceptar ni al receptor cancelar una pendiente', () => {
    expect(
      policy.canTransition(
        RequestStatus.PENDING,
        RequestStatus.ACCEPTED,
        'SENDER',
      ),
    ).toBe(false);
    expect(
      policy.canTransition(
        RequestStatus.PENDING,
        RequestStatus.CANCELLED,
        'RECEIVER',
      ),
    ).toBe(false);
  });

  it('no permite al sistema cancelar una solicitud aceptada', () => {
    expect(
      policy.canTransition(
        RequestStatus.ACCEPTED,
        RequestStatus.CANCELLED,
        'SYSTEM',
      ),
    ).toBe(false);
  });
});
