import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity.js';
import { AuthTokenVerifier } from '../../common/auth/auth-token-verifier.js';
import { JwtTokenVerifier } from '../../common/auth/jwt-token-verifier.js';
import { FirebaseTokenVerifier } from '../../common/auth/firebase-token-verifier.js';
import { Campus } from '../catalog/entities/campus.entity.js';
import { UniversityEmailDomain } from '../catalog/entities/university.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Student, Campus, UniversityEmailDomain]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(
          'JWT_SECRET',
          'unused-when-auth-provider-is-firebase',
        ),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') as never,
          issuer: 'rutau-local',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtTokenVerifier,
    FirebaseTokenVerifier,
    AuthService,
    {
      provide: AuthTokenVerifier,
      inject: [ConfigService, FirebaseTokenVerifier, JwtTokenVerifier],
      useFactory: (
        config: ConfigService,
        firebase: FirebaseTokenVerifier,
        jwt: JwtTokenVerifier,
      ) =>
        config.get<string>('AUTH_PROVIDER', 'FIREBASE') === 'JWT'
          ? jwt
          : firebase,
    },
  ],
  exports: [JwtModule, TypeOrmModule, AuthTokenVerifier],
})
export class AuthModule {}
