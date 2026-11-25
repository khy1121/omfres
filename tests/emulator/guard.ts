// 에뮬레이터 테스트 안전장치: 에뮬레이터가 아니거나 실제 프로젝트를 가리키면 즉시 중단한다.
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST가 없습니다. `npm run test:emulator`로 실행하세요.");

process.env.FIREBASE_PROJECT_ID = process.env.GCLOUD_PROJECT ?? "demo-reservation";
if (!process.env.FIREBASE_PROJECT_ID.startsWith("demo-")) {
  throw new Error(`에뮬레이터 테스트는 demo- 프로젝트에서만 실행합니다: ${process.env.FIREBASE_PROJECT_ID}`);
}
// 실제 서비스 계정이 섞여 들어오지 않도록 제거
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;
