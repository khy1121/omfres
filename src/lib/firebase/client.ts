"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";

// 브라우저용 Firebase — 로그인(ID 토큰 발급)에만 사용한다.
// 로그인 상태는 서버의 httpOnly 세션 쿠키가 기준이므로 브라우저에는 로그인 정보를 남기지 않는다(메모리 보관).

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let auth: Promise<Auth> | null = null;

export function clientAuth(): Promise<Auth> {
  if (!auth) {
    const app = getApps().length ? getApp() : initializeApp(config);
    const a = getAuth(app);
    auth = setPersistence(a, inMemoryPersistence).then(() => a);
  }
  return auth;
}
