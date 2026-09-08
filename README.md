# 상담 예약 사이트

캘린더에서 날짜 → 30분 단위 시작 시간 → 학번/이름 입력 순으로 예약하는 Next.js 앱입니다.

## 페이지

- `/` 예약하기 (날짜 → 시간 → 학번/이름)
- `/my` 내 예약 조회 · 일정 변경 · 취소 (학번 + 이름으로 본인 확인)
- `/admin` 관리자: 전체 예약 / 학생별 조회 / 예약 삭제 / PIN 변경
  - 초기 PIN은 `000000` (환경변수 `ADMIN_PIN`으로 변경 가능). **배포 후 반드시 관리자 페이지에서 PIN을 바꾸세요.**
  - PIN을 변경하면 저장소에 해시로 보관되며 기존 로그인 세션은 모두 해제됩니다.

## 로컬 실행

```bash
npm install
npm run dev
```

환경변수가 없으면 메모리 저장소로 동작합니다 (서버 재시작 시 예약 초기화).

## Vercel 배포

1. GitHub에 push 후 Vercel에서 Import.
2. Vercel 프로젝트 → **Storage** 탭 → **Upstash Redis** 생성/연결 (무료 플랜 가능).
   연결하면 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (또는 `KV_REST_API_*`)이 자동 주입됩니다.
3. Redeploy.

## 설정 변경

`src/lib/config.ts` 에서 운영 시간, 슬롯 간격(기본 30분), 예약 가능 요일, 점심시간 제외 구간 등을 수정합니다.

## API

- `GET /api/slots?date=YYYY-MM-DD` — 해당 날짜의 슬롯과 예약 가능 여부
- `GET /api/reservations?studentId=&name=` — 내 예약 목록
- `POST /api/reservations` — `{ date, time, studentId, name }` 예약 생성 (중복 시 409)
- `PATCH /api/reservations/:id` — `{ studentId, name, date, time }` 일정 변경
- `DELETE /api/reservations/:id?studentId=&name=` — 예약 취소
- `POST /api/admin/login` `{ pin }` / `POST /api/admin/logout`
- `GET /api/admin/reservations[?studentId=]` — 전체 또는 학생별 예약 (관리자)
- `DELETE /api/admin/reservations/:id` — 예약 삭제 (관리자)
- `POST /api/admin/pin` `{ currentPin, newPin }` — PIN 변경 (관리자)
