// 로컬 테스트용 실행: Firebase 에뮬레이터(Auth + Firestore) 위에서 Next 개발 서버를 띄운다.
// 실제 Firebase 프로젝트에는 접근하지 않는다 (demo- 프로젝트, 가짜 Google 로그인).
//   npm run dev:emulator            → http://localhost:3948
//   PORT=4000 npm run dev:emulator  → 다른 포트
import { spawn } from "node:child_process";

const project = "demo-reservation";
const port = process.env.PORT ?? "3948";

const env = {
  ...process.env,
  // .env.local보다 우선한다 (Next는 이미 설정된 환경변수를 덮어쓰지 않음)
  FIREBASE_PROJECT_ID: project,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: project,
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_APP_ID: "demo-app",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_CLIENT_EMAIL: "",
  FIREBASE_PRIVATE_KEY: "",
  INSTRUCTOR_EMAIL_DOMAINS: process.env.INSTRUCTOR_EMAIL_DOMAINS ?? "hansung.ac.kr,hansung.kr",
};

// shell 모드에서는 인자를 하나의 명령 문자열로 넘겨야 내부 명령의 따옴표가 유지된다
const child = spawn(`npx firebase emulators:exec --only auth,firestore --project ${project} "npx next dev -p ${port}"`, {
  stdio: "inherit",
  env,
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 0));
