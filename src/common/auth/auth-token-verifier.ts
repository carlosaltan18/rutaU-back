export interface AuthClaims {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
}

export abstract class AuthTokenVerifier {
  abstract verify(token: string): Promise<AuthClaims>;
}
