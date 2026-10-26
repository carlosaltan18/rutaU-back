import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebaseAdminService } from '../firebase/firebase-admin.service.js';
import { AuthTokenVerifier, type AuthClaims } from './auth-token-verifier.js';

@Injectable()
export class FirebaseTokenVerifier extends AuthTokenVerifier {
  private readonly checkRevoked: boolean;

  constructor(
    private readonly firebase: FirebaseAdminService,
    config: ConfigService,
  ) {
    super();
    this.checkRevoked =
      config.get<string>('FIREBASE_CHECK_REVOKED_TOKENS', 'false') === 'true';
  }

  async verify(token: string): Promise<AuthClaims> {
    const decoded = await this.firebase.auth.verifyIdToken(
      token,
      this.checkRevoked,
    );
    const claims: AuthClaims = {
      sub: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified,
    };
    if (decoded.name) claims.name = decoded.name;
    if (decoded.picture) claims.picture = decoded.picture;
    return claims;
  }
}
