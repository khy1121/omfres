# 상담 예약

교수가 수업 그룹을 만들어 학생을 링크로 초대하고, 수업·목적·학생마다 다른 상담 일정을 열면 학생이 직접 시간을 골라 예약하는 Next.js 앱입니다. 기획과 설계 배경은 [리팩토링-기획안.md](리팩토링-기획안.md)에 있습니다.

## 흐름

| 누구 | 하는 일 |
|---|---|
| 모두 | Google로 로그인 → 내 정보에서 교수/학생 선택 (교수는 `hansung.ac.kr`, `hansung.kr` 계정만) |
| 교수 | 수업 그룹 생성 → 초대 링크 공유 → 상담 일정 등록(요일 반복 또는 직접 지정, 공개 대상, 예약 규칙) → 예약 현황·이동·취소·CSV |
| 학생 | 초대 링크로 참여(이름·학번 필수) → 나에게 열린 일정에서 날짜·시간 선택 → 내 예약에서 변경·취소 |

## 페이지

- `/` 소개 (로그인 시 `/courses`로 이동)
- `/login` Google 로그인, `/me` 내 정보(계정 유형·이름·학번)
- `/courses` 내 수업, `/courses/new` 그룹 만들기, `/join/[token]` 초대 링크 참여
- `/courses/[id]` 그룹(교수: 일정·초대 링크·정보 / 학생: 열린 일정·내 상담)
- `/courses/[id]/members` 학생 명단 (교수)
- `/courses/[id]/schedules/new`, `/[sid]`, `/[sid]/edit` 일정 등록·상세·수정 (학생에게는 예약 화면)
- `/bookings` 내 예약(학생) / 다가오는 상담(교수)

## 규칙

- 같은 일정의 같은 시간은 한 명만 예약됩니다. 같은 교수의 다른 수업 일정과 겹치는 시간, 학생 본인의 다른 예약과 겹치는 시간도 막습니다. Firestore 트랜잭션 안에서 5분 단위 잠금 문서로 보장합니다.
- 시간 버튼은 선택만 하고 확정 버튼으로 저장합니다. 다른 학생이 먼저 잡으면 선택한 날짜를 유지한 채 안내하고 시간 목록을 다시 불러옵니다. 응답을 받지 못하면 재전송 대신 **예약 결과 확인**으로 서버 상태를 조회합니다.
- 일정마다 1인당 예약 횟수, 예약 마감(상담 N시간 전까지), 학생 변경·취소 마감을 정합니다. 교수는 마감과 관계없이 예약을 옮기거나 취소할 수 있습니다.
- 일정을 수정해도 이미 받은 예약의 시각·길이는 바뀌지 않습니다. 새 규칙에 없는 시간이나 공개 대상에서 빠진 학생의 예약은 저장 전에 보여주고, 자동 취소하지 않습니다.
- 학생이 그룹에서 제외되거나 나가면 그 그룹의 예정된 상담은 취소됩니다. 그룹이 있는 계정은 교수/학생 유형을 바꿀 수 없습니다.
- 시각은 모두 한국 시간 기준입니다. 상태 표시(예정·상담 시간 중·상담 시간 경과)는 실제 참석 여부를 뜻하지 않습니다.

## 구조

- 인증: Firebase Authentication(Google) → 서버가 ID 토큰을 검증해 httpOnly 세션 쿠키 발급
- 데이터: Cloud Firestore. 브라우저는 직접 접근하지 않고(`firestore.rules` 전면 차단) 모든 읽기·쓰기를 서버 Route Handler가 Admin SDK로 처리
- 권한: `src/lib/dal/*`에서 검사. `src/proxy.ts`는 세션 쿠키가 없을 때 로그인 화면으로 보내는 역할만 함
- 규칙·계산: `src/lib/schedule/rules.ts`(슬롯 생성·입력 검증·예약 가능 판정), `src/lib/data/bookings.ts`(예약 트랜잭션)

## 로컬 실행

```bash
npm install
npm run dev            # .env.local의 실제 Firebase 프로젝트 사용
npm run dev:emulator   # Firebase 에뮬레이터 사용 (http://localhost:3948, 가짜 Google 로그인, 데이터는 종료 시 사라짐)
```

`.env.example`을 참고해 `.env.local`을 만듭니다. 에뮬레이터 실행에는 Java가 필요합니다.

## 검증

```bash
npm test                # 단위·컴포넌트 테스트 (가상 DOM)
npm run test:emulator   # Firestore 에뮬레이터 통합 테스트 (동시 예약·초대 링크 등)
npm run dev:emulator    # 다른 터미널에서 실행한 뒤
npm run test:e2e        # 실제 HTTP 요청으로 전체 흐름 점검 (로그인~예약·권한·화면 렌더링)
npm run lint
npm run build
```

에뮬레이터·E2E는 `demo-` 프로젝트에서만 동작하며 실제 Firebase 프로젝트에 접근하지 않습니다.

## 배포 (Vercel)

1. Vercel 프로젝트 환경변수에 `.env.example`의 항목을 **Production과 Preview 모두** 등록합니다.
   - `FIREBASE_PRIVATE_KEY`(비밀값)는 PEM 원문, 따옴표로 감싼 한 줄(`\n` 포함), 서비스 계정 JSON 전체 중 어느 형태로 넣어도 됩니다.
   - `INSTRUCTOR_EMAIL_DOMAINS`가 비어 있으면 아무도 교수를 선택할 수 없습니다 (서버 로그에 경고가 남습니다).
2. Firebase 콘솔 → Authentication → 설정 → **승인된 도메인**에 배포 도메인을 추가합니다.
3. (선택) `npx firebase deploy --only firestore:rules`로 보안 규칙을 배포합니다. 프로덕션 모드로 만든 DB는 기본적으로 모두 막혀 있어 동작에는 영향이 없습니다.
4. 환경변수를 바꾼 뒤에는 재배포해야 적용됩니다.
