import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

enum AuthProvider {
  Firebase = 'FIREBASE',
  Jwt = 'JWT',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsEnum(AuthProvider)
  AUTH_PROVIDER: AuthProvider = AuthProvider.Firebase;

  @ValidateIf(
    (environment: EnvironmentVariables) =>
      environment.AUTH_PROVIDER === AuthProvider.Jwt,
  )
  @IsString()
  @IsNotEmpty()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  CORS_ALLOWED_ORIGINS?: string;

  @ValidateIf(
    (environment: EnvironmentVariables) =>
      environment.AUTH_PROVIDER === AuthProvider.Firebase,
  )
  @IsString()
  @IsNotEmpty()
  FIREBASE_PROJECT_ID?: string;

  @ValidateIf(
    (environment: EnvironmentVariables) =>
      environment.AUTH_PROVIDER === AuthProvider.Firebase,
  )
  @IsUrl({ require_tld: false })
  FIREBASE_DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  FIRESTORE_DATABASE_ID?: string;

  @IsOptional()
  @IsString()
  FIREBASE_CREDENTIALS_JSON?: string;

  @IsOptional()
  @IsString()
  GOOGLE_APPLICATION_CREDENTIALS?: string;

  @IsOptional()
  @IsString()
  FIREBASE_CHECK_REVOKED_TOKENS?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  FCM_ENABLED?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  @Type(() => Number)
  LIVE_LOCATION_MAX_HOURS?: number;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment: ${errors.toString()}`);
  }
  if (
    validated.NODE_ENV === Environment.Production &&
    validated.AUTH_PROVIDER === AuthProvider.Jwt &&
    validated.JWT_SECRET?.includes('development-only')
  ) {
    throw new Error('JWT_SECRET must be replaced in production');
  }
  if (
    validated.AUTH_PROVIDER === AuthProvider.Firebase &&
    !validated.FIREBASE_CREDENTIALS_JSON &&
    !validated.GOOGLE_APPLICATION_CREDENTIALS
  ) {
    throw new Error(
      'Firebase auth requires FIREBASE_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS',
    );
  }
  return validated;
}
