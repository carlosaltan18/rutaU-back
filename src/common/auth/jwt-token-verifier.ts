import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenVerifier, type AuthClaims } from './auth-token-verifier.js';

@Injectable()
export class JwtTokenVerifier extends AuthTokenVerifier {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  verify(token: string): Promise<AuthClaims> {
    return this.jwtService.verifyAsync<AuthClaims>(token);
  }
}
