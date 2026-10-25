import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { FirebaseAdminService } from '../firebase/firebase-admin.service.js';
import { FirebaseTokenVerifier } from './firebase-token-verifier.js';

describe('FirebaseTokenVerifier', () => {
  it('maps a verified Firebase ID token to backend claims', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      uid: 'firebase-user-1',
      email: 'student@example.test',
      email_verified: true,
    });
    const firebase = {
      auth: { verifyIdToken },
    } as unknown as FirebaseAdminService;
    const config = {
      get: (_key: string, fallback: string) => fallback,
    } as ConfigService;
    const verifier = new FirebaseTokenVerifier(firebase, config);

    await expect(verifier.verify('firebase-id-token')).resolves.toEqual({
      sub: 'firebase-user-1',
      email: 'student@example.test',
      emailVerified: true,
    });
    expect(verifyIdToken).toHaveBeenCalledWith('firebase-id-token', false);
  });

  it('enables revocation checking through configuration', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({ uid: 'firebase-user-2' });
    const firebase = {
      auth: { verifyIdToken },
    } as unknown as FirebaseAdminService;
    const config = {
      get: () => 'true',
    } as unknown as ConfigService;
    const verifier = new FirebaseTokenVerifier(firebase, config);

    await verifier.verify('firebase-id-token');

    expect(verifyIdToken).toHaveBeenCalledWith('firebase-id-token', true);
  });
});
