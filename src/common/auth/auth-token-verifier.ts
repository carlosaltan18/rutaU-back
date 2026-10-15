export interface AuthClaims {
  sub: string;
  email?: string;
  emailVerified?: boolean;
}

export abstract class AuthTokenVerifier {
  abstract verify(token: string): Promise<AuthClaims>;
}
