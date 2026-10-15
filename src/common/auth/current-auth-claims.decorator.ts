import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthClaims } from './auth-token-verifier.js';

export const CurrentAuthClaims = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthClaims =>
    context.switchToHttp().getRequest<{ authClaims: AuthClaims }>().authClaims,
);
