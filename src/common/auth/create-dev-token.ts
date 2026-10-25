import 'dotenv/config';
import { JwtService } from '@nestjs/jwt';

const authSubject = process.argv[2];
if (!authSubject) {
  console.error('Uso: pnpm auth:token <authSubject>');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Este generador no puede ejecutarse en producción.');
  process.exit(1);
}
if (process.env.AUTH_PROVIDER !== 'JWT') {
  console.error(
    'Este generador solo está disponible cuando AUTH_PROVIDER=JWT. Con Firebase, Android debe obtener el ID token mediante Firebase Auth.',
  );
  process.exit(1);
}
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET is required');

const jwt = new JwtService({
  secret,
  signOptions: { expiresIn: '8h', issuer: 'rutau-local' },
});
process.stdout.write(await jwt.signAsync({ sub: authSubject }));
