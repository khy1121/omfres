# 상담 예약 사이트

교수님 선택 → 캘린더에서 날짜 → 시작 시간 → 이름 입력 순으로 예약하는 Next.js 앱입니다.

## 페이지

- `/` 예약하기 (교수님 → 날짜 → 시간 → 이름)
- `/my` 내 예약 조회 · 일정 변경 · 취소 (이름으로 본인 확인)
- `/admin` 관리자: 전체 예약 / 학생별 조회 / 예약 삭제 / PIN 변경
  - 초기 PIN은 `000000` (환경변수 `ADMIN_PIN`으로 변경 가능). **배포 후 반드시 관리자 페이지에서 PIN을 바꾸세요.**
  - PIN을 변경하면 저장소에 해시로 보관되며 기존 로그인 세션은 모두 해제됩니다.

## 로컬 실행

```bash
npm install
npm run dev
```

환경변수가 없으면 메모리 저장소로 동작합니다 (서버 재시작 시 예약 초기화).

## 예약 흐름과 변경 기준

- 시간 버튼은 선택만 수행합니다. 학생 일정 변경과 관리자 추가·이동은 별도 확정 버튼으로 저장합니다.
- 저장 실패 시 선택값과 오류 안내를 유지합니다. 응답 유실·서버 오류로 결과가 불명확하면 재전송을 막고 **예약 상태 확인**으로 결과를 조회합니다. 조회에 없으면 지연 반영 가능성을 안내하고 **입력 유지하고 다시 시도**를 제공합니다. 이 버튼은 편집을 다시 허용하며, 실제 재전송에는 확정 버튼을 다시 눌러야 합니다.
- 신규 예약 단계는 브라우저 뒤로·앞으로 이동을 지원합니다. 입력 내용은 해당 화면의 메모리에만 유지되며 새로고침·페이지 이탈 시 초기화됩니다.
- 한국 시간 기준으로 상담 시작 전은 **예정**, 시작부터 종료 전은 **상담 시간 중**, 종료 이후는 **상담 시간 경과**로 표시합니다. 실제 참석 여부를 의미하지 않습니다.
- 일정 변경과 학생 취소는 **상담 시작 전까지** 가능합니다. 관리자 삭제는 지난 예약에도 허용합니다.
- 종료 시각은 현재 교수 설정의 상담 길이를 사용합니다. 삭제된 교수의 상담 길이를 알 수 없으면 **시작 시간 경과**로 표시합니다.

## 검증

```bash
npm test
npm run lint
npm run build
```

테스트는 가상 DOM과 메모리 저장소를 사용합니다. `.env.local`을 로드하지 않으며, 실제 Redis 환경변수가 있는 상태에서는 API 테스트를 실행하지 마세요.

## Vercel 배포

1. GitHub에 push 후 Vercel에서 Import.
2. Vercel 프로젝트 → **Storage** 탭 → **Upstash Redis** 생성/연결 (무료 플랜 가능).
   연결하면 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (또는 `KV_REST_API_*`)이 자동 주입됩니다.
3. Redeploy.

## 교수님(상담자) 관리

관리자 페이지(`/admin`) → **상담자 관리** 탭에서 상담자를 추가·수정·삭제하고 제약조건(상담 시간 단위, 요일별 시간대, 예약 불가 날짜, 지정 날짜만 허용)을 설정합니다. 목록은 Redis에 저장되며, 저장된 목록이 없으면 `src/lib/config.ts` 의 `DEFAULT_PROFESSORS` 가 초기값으로 쓰입니다.

초기값:

| 교수님 | 요일 · 시간 | 단위 | 비고 |
| --- | --- | --- | --- |
| 전유부 | 월·목·금 10:00~17:00 | 60분 | 9/21, 10/15 제외 |
| 정병덕 | 화 09:00~16:00 | 30분 | 9/22, 9/29, 10/6, 10/13 만 가능 |
| 최정섭 | 월·수·목·금 09:00~20:00 | 30분 | 목요일은 17:00까지 |

- `availability`: 요일별 시작/종료 시각 (종료 시각은 상담이 끝나야 하는 상한)
- `slotMinutes`: 상담 1회 길이. 시작 시각은 이 간격으로 생성됩니다.
- `excludeDates`: 예약 불가 날짜, `onlyDates`: 지정 시 이 날짜만 예약 가능
- 상담자를 삭제해도 기존 예약은 남으며, 목록에는 이름 대신 ID로 표시됩니다.

## API

- `GET /api/slots?professor=&date=YYYY-MM-DD` — 해당 교수님/날짜의 슬롯과 예약 가능 여부
- `GET|POST /api/admin/professors`, `PUT|DELETE /api/admin/professors/:id` — 상담자 관리 (관리자 로그인 필요)
- `GET /api/reservations?name=` — 내 예약 목록
- `POST /api/reservations` — `{ professorId, date, time, name }` 예약 생성 (중복 시 409)
- `PATCH /api/reservations/:id` — `{ name, date, time }` 일정 변경
- `DELETE /api/reservations/:id?name=` — 예약 취소
- `POST /api/admin/login` `{ pin }` / `POST /api/admin/logout`
- `GET /api/admin/reservations[?name=]` — 전체 또는 학생별 예약 (관리자)
- `DELETE /api/admin/reservations/:id` — 예약 삭제 (관리자)
- `POST /api/admin/pin` `{ currentPin, newPin }` — PIN 변경 (관리자)
