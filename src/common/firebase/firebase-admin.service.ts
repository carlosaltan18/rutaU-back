import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getDatabase, type Database } from 'firebase-admin/database';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

interface FirebaseServiceAccountJson {
  project_id: string;
  client_email: string;
  private_key: string;
}

@Injectable()
export class FirebaseAdminService {
  readonly app: App;
  readonly auth: Auth;
  readonly firestore: Firestore;
  readonly realtimeDatabase: Database;
  readonly messaging: Messaging;

  constructor(config: ConfigService) {
    const projectId = config.getOrThrow<string>('FIREBASE_PROJECT_ID');
    const databaseURL = config.getOrThrow<string>('FIREBASE_DATABASE_URL');
    const databaseId = config.get<string>('FIRESTORE_DATABASE_ID', '(default)');
    const appName = `rutau-${projectId}`;
    const existingApp = getApps().find(
      (candidate) => candidate.name === appName,
    );
    const credentialsJson = config.get<string>('FIREBASE_CREDENTIALS_JSON');

    this.app =
      existingApp ??
      initializeApp(
        {
          credential: credentialsJson
            ? cert(this.parseServiceAccount(credentialsJson))
            : applicationDefault(),
          projectId,
          databaseURL,
        },
        appName,
      );
    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app, databaseId);
    this.realtimeDatabase = getDatabase(this.app);
    this.messaging = getMessaging(this.app);
  }

  private parseServiceAccount(value: string): ServiceAccount {
    let parsed: FirebaseServiceAccountJson;
    try {
      parsed = JSON.parse(value) as FirebaseServiceAccountJson;
    } catch {
      throw new Error('FIREBASE_CREDENTIALS_JSON must contain valid JSON');
    }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        'FIREBASE_CREDENTIALS_JSON is missing project_id, client_email or private_key',
      );
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    };
  }
}
