import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// 서버 전용 Firebase Admin. 브라우저는 Firestore에 직접 접근하지 않고 모든 데이터는 이 모듈을 거친다.
// FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST가 있으면 Admin SDK가 자동으로 에뮬레이터를 사용한다.

function app(): App {
  if (getApps().length) return getApp();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID 환경변수가 없습니다.");

  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST || !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (usingEmulator && (!clientEmail || !privateKey)) return initializeApp({ projectId });
  if (!clientEmail || !privateKey) throw new Error("FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY 환경변수가 없습니다.");

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

export const adminAuth = () => getAuth(app());

// settings()는 인스턴스당 한 번만 호출할 수 있다. 개발 서버는 모듈을 다시 불러와도
// Firebase 앱과 Firestore 인스턴스는 유지하므로, 설정한 인스턴스를 전역에 보관해 재사용한다.
const globalForDb = globalThis as unknown as { __firestore?: Firestore };

export function db(): Firestore {
  if (!globalForDb.__firestore) {
    const firestore = getFirestore(app());
    try {
      firestore.settings({ ignoreUndefinedProperties: true });
    } catch {
      // 이미 설정된 인스턴스(핫 리로드 직후)면 그대로 사용
    }
    globalForDb.__firestore = firestore;
  }
  return globalForDb.__firestore;
}
