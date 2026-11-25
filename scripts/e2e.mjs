// 전체 흐름 E2E 점검 — `npm run dev:emulator`로 띄운 서버(기본 3948)에 실제 HTTP 요청을 보낸다.
// 가짜 Google 계정은 Auth 에뮬레이터로 만든다. 실제 Firebase 프로젝트에는 접근하지 않는다.
//   node scripts/e2e.mjs [baseUrl]
import assert from "node:assert/strict";

const BASE = process.argv[2] ?? "http://localhost:3948";
const AUTH = "http://127.0.0.1:9099";
const RUN = Date.now().toString(36); // 실행마다 다른 계정·그룹

let passed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (e) {
    console.log(`  ✘ ${name}`);
    console.error(e);
    process.exit(1);
  }
};

// ── 로그인 ──
async function login(email, name) {
  const idTokenJson = JSON.stringify({ sub: `${email}-${RUN}`, email, email_verified: true, name });
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postBody: `id_token=${encodeURIComponent(idTokenJson)}&providerId=google.com`,
      requestUri: "http://localhost",
      returnIdpCredential: true,
      returnSecureToken: true,
    }),
  });
  const data = await r.json();
  assert.ok(data.idToken, `emulator sign-in failed: ${JSON.stringify(data)}`);
  const s = await fetch(`${BASE}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ idToken: data.idToken, displayName: name }),
  });
  assert.equal(s.status, 200, `session: ${await s.text()}`);
  const cookie = s.headers.get("set-cookie").split(";")[0];
  return { email, name, cookie };
}

async function api(user, method, path, body, { origin = BASE } = {}) {
  const headers = { Cookie: user?.cookie ?? "" };
  if (origin) headers.Origin = origin;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}

async function page(user, path) {
  const r = await fetch(BASE + path, { headers: { Cookie: user?.cookie ?? "" }, redirect: "manual" });
  const html = await r.text();
  // "use client" 모듈의 값을 서버에서 잘못 쓰면 클래스·텍스트 자리에 이 오류 문구가 렌더링된다
  assert.ok(!html.includes("from the server but"), `${path}: client-only value used on the server`);
  return { status: r.status, html, location: r.headers.get("location") };
}

// ── 날짜: 다음 주 월요일부터 (KST) ──
const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const today = kstToday();
const dow = new Date(today + "T00:00:00Z").getUTCDay();
const MON = addDays(today, ((8 - dow) % 7) + 7);
const TUE = addDays(MON, 1);

function scheduleBody(patch = {}) {
  return {
    title: "중간 면담",
    description: "과제 진행 상황을 이야기합니다.",
    mode: "offline",
    location: "연구관 709호",
    meetingUrl: "",
    slotMinutes: 30,
    maxBookingsPerStudent: 1,
    bookingCloseHours: 0,
    cancelCloseHours: 0,
    audience: "all",
    audienceIds: [],
    ruleType: "recurring",
    recurring: { from: MON, to: addDays(MON, 13), windows: [{ days: [1], start: "10:00", end: "12:00" }, { days: [2], start: "14:00", end: "15:00" }], excludeDates: [] },
    manualSlots: [],
    ...patch,
  };
}

console.log(`E2E against ${BASE} (run ${RUN}, first Monday ${MON})`);

const prof = await login(`prof.${RUN}@hansung.ac.kr`, "김교수");
const prof2 = await login(`prof2.${RUN}@hansung.kr`, "이교수");
const faker = await login(`fake.${RUN}@gmail.com`, "사칭");
const S = [];
for (let i = 0; i < 6; i++) S.push(await login(`s${i}.${RUN}@gmail.com`, `학생${i}`));

let courseId, course2Id, token, open, selected, draft, other;

console.log("\n[프로필]");
await step("교수 도메인 계정은 교수를 선택할 수 있다", async () => {
  const r = await api(prof, "PUT", "/api/me", { accountType: "instructor", name: "김교수" });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.isInstructor, true);
  assert.equal((await api(prof2, "PUT", "/api/me", { accountType: "instructor", name: "이교수" })).status, 200);
});
await step("개인 Gmail은 교수를 선택할 수 없다", async () => {
  const r = await api(faker, "PUT", "/api/me", { accountType: "instructor", name: "사칭" });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /학교 계정/);
});
await step("학생은 학번 없이 저장할 수 없다", async () => {
  assert.equal((await api(S[0], "PUT", "/api/me", { accountType: "student", name: "학생0", studentNo: "" })).status, 400);
  for (let i = 0; i < S.length; i++) {
    const r = await api(S[i], "PUT", "/api/me", { accountType: "student", name: `학생${i}`, studentNo: `20710${i}${i}` });
    assert.equal(r.status, 200, r.text);
  }
});
await step("다른 사이트에서 온 요청과 Origin 없는 요청은 거부된다", async () => {
  assert.equal((await api(S[0], "PUT", "/api/me", { accountType: "student", name: "x", studentNo: "1234567" }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await api(S[0], "PUT", "/api/me", { accountType: "student", name: "x", studentNo: "1234567" }, { origin: null })).status, 403);
});

console.log("\n[그룹·초대]");
await step("학생은 그룹을 만들 수 없고, 교수는 만들 수 있다", async () => {
  assert.equal((await api(S[0], "POST", "/api/courses", { title: "x", term: "y" })).status, 403);
  const r = await api(prof, "POST", "/api/courses", { title: `자료구조 ${RUN}`, term: "2026년 2학기", description: "01분반" });
  assert.equal(r.status, 201, r.text);
  courseId = r.json.id;
  course2Id = (await api(prof, "POST", "/api/courses", { title: `운영체제 ${RUN}`, term: "2026년 2학기" })).json.id;
});
await step("초대 링크 재발급 후 이전 링크는 거부된다", async () => {
  const first = (await api(prof, "POST", `/api/courses/${courseId}/invite`, { expiresInDays: 7 })).json.token;
  token = (await api(prof, "POST", `/api/courses/${courseId}/invite`, {})).json.token;
  assert.notEqual(first, token);
  const r = await api(S[0], "POST", "/api/join", { token: first });
  assert.equal(r.status, 410);
  assert.equal(r.json.code, "revoked");
});
await step("학생 5명이 동시에 참여한다 (교수 계정은 참여 불가)", async () => {
  const rs = await Promise.all(S.slice(0, 5).map((s) => api(s, "POST", "/api/join", { token })));
  assert.deepEqual(rs.map((r) => r.status), [200, 200, 200, 200, 200]);
  assert.equal((await api(prof2, "POST", "/api/join", { token })).status, 400);
  const tok2 = (await api(prof, "POST", `/api/courses/${course2Id}/invite`, {})).json.token;
  for (const s of S.slice(0, 3)) assert.equal((await api(s, "POST", "/api/join", { token: tok2 })).status, 200);
});
await step("참여 화면에 개설 교수 이름과 이메일이 보인다", async () => {
  const p = await page(S[5], `/join/${token}`);
  assert.equal(p.status, 200);
  assert.ok(p.html.includes("김교수") && p.html.includes(prof.email), "owner shown");
  assert.ok(p.html.includes("이 수업에 참여하기"));
});
await step("그룹 밖 사용자는 그룹 화면·API에 접근할 수 없다", async () => {
  assert.equal((await page(S[5], `/courses/${courseId}`)).status, 404);
  assert.equal((await api(S[5], "GET", `/api/courses/${courseId}/schedules/x/slots?date=${MON}`)).status, 404);
  assert.equal((await page(S[0], `/courses/${courseId}/members`)).status, 404, "students cannot see the roster");
});

console.log("\n[일정 등록]");
await step("교수가 공개·대상 지정·초안 일정을 만든다", async () => {
  const bad = await api(prof, "POST", `/api/courses/${courseId}/schedules`, { schedule: scheduleBody({ slotMinutes: 17 }), status: "open" });
  assert.equal(bad.status, 400);
  open = (await api(prof, "POST", `/api/courses/${courseId}/schedules`, { schedule: scheduleBody(), status: "open" })).json.id;
  const me = await api(S[1], "GET", "/api/me");
  const s1uid = me.json.uid;
  selected = (await api(prof, "POST", `/api/courses/${courseId}/schedules`, {
    schedule: scheduleBody({ title: "개별 면담", ruleType: "manual", recurring: null, manualSlots: [`${TUE} 16:00`, `${TUE} 16:30`], audience: "selected", audienceIds: [s1uid] }),
    status: "open",
  })).json.id;
  draft = (await api(prof, "POST", `/api/courses/${courseId}/schedules`, { schedule: scheduleBody({ title: "초안 일정" }), status: "draft" })).json.id;
  assert.ok(open && selected && draft);
});
await step("다른 그룹 학생을 대상에 넣을 수 없다", async () => {
  const r = await api(prof, "POST", `/api/courses/${courseId}/schedules`, { schedule: scheduleBody({ audience: "selected", audienceIds: ["someone-else"] }), status: "open" });
  assert.equal(r.status, 400);
});
await step("학생마다 보이는 일정이 다르다", async () => {
  const p0 = (await page(S[0], `/courses/${courseId}`)).html;
  const p1 = (await page(S[1], `/courses/${courseId}`)).html;
  assert.ok(p0.includes("중간 면담") && !p0.includes("개별 면담") && !p0.includes("초안 일정"), "s0 sees only the public one");
  assert.ok(p1.includes("중간 면담") && p1.includes("개별 면담") && !p1.includes("초안 일정"), "s1 also sees the selected one");
  assert.equal((await page(S[0], `/courses/${courseId}/schedules/${selected}`)).status, 404);
  assert.equal((await page(S[0], `/courses/${courseId}/schedules/${draft}`)).status, 404);
  const pp = (await page(prof, `/courses/${courseId}`)).html;
  assert.ok(pp.includes("초안 일정") && pp.includes("비공개"));
});

console.log("\n[예약·동시성]");
let winner, b0;
await step("학생 5명이 같은 시간을 동시에 예약하면 1명만 성공한다", async () => {
  const rs = await Promise.all(S.slice(0, 5).map((s) => api(s, "POST", "/api/bookings", { scheduleId: open, date: MON, time: "10:00" })));
  const ok = rs.filter((r) => r.status === 201);
  assert.equal(ok.length, 1, rs.map((r) => r.status).join(","));
  assert.ok(rs.filter((r) => r.status !== 201).every((r) => r.status === 409 && r.json.code === "SLOT_TAKEN"));
  winner = S[rs.findIndex((r) => r.status === 201)];
  b0 = ok[0].json.booking;
});
await step("슬롯 조회에 내 예약·마감이 반영된다", async () => {
  const mine = (await api(winner, "GET", `/api/courses/${courseId}/schedules/${open}/slots?date=${MON}`)).json;
  assert.equal(mine.slots.find((s) => s.time === "10:00").reason, "mine");
  const loser = S.find((s) => s !== winner);
  const theirs = (await api(loser, "GET", `/api/courses/${courseId}/schedules/${open}/slots?date=${MON}`)).json;
  assert.equal(theirs.slots.find((s) => s.time === "10:00").reason, "taken");
  assert.equal(theirs.slots.find((s) => s.time === "10:30").available, true);
});
await step("1인당 횟수를 넘기면 거부된다", async () => {
  const r = await api(winner, "POST", "/api/bookings", { scheduleId: open, date: MON, time: "11:00" });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, "LIMIT_REACHED");
});
await step("같은 교수의 다른 수업과 겹치는 시간은 예약할 수 없다", async () => {
  other = (await api(prof, "POST", `/api/courses/${course2Id}/schedules`, {
    schedule: scheduleBody({ title: "프로젝트 면담", recurring: { from: MON, to: addDays(MON, 6), windows: [{ days: [1], start: "09:45", end: "11:15" }], excludeDates: [] } }),
    status: "open",
  })).json.id;
  const student = S.slice(0, 3).find((s) => s !== winner);
  const r = await api(student, "POST", "/api/bookings", { scheduleId: other, date: MON, time: "09:45" }); // 09:45~10:15 vs 10:00~10:30
  assert.equal(r.status, 409);
  assert.equal(r.json.code, "INSTRUCTOR_BUSY");
  const slots = (await api(student, "GET", `/api/courses/${course2Id}/schedules/${other}/slots?date=${MON}`)).json.slots;
  assert.equal(slots.find((s) => s.time === "09:45").reason, "taken");
  assert.equal(slots.find((s) => s.time === "10:15").reason, "taken", "10:15~10:45 also overlaps 10:00~10:30");
  assert.equal(slots.find((s) => s.time === "10:45").available, true);
  assert.equal((await api(student, "POST", "/api/bookings", { scheduleId: other, date: MON, time: "10:45" })).status, 201);
});
await step("대상이 아닌 학생은 지정 일정을 예약할 수 없다", async () => {
  assert.equal((await api(S[2], "POST", "/api/bookings", { scheduleId: selected, date: TUE, time: "16:00" })).status, 404);
  assert.equal((await api(S[1], "POST", "/api/bookings", { scheduleId: selected, date: TUE, time: "16:00" })).status, 201);
});
await step("학생이 시간을 바꾸면 이전 시간이 비워진다", async () => {
  const r = await api(winner, "PATCH", `/api/bookings/${b0.id}`, { date: MON, time: "11:30" });
  assert.equal(r.status, 200, r.text);
  const loser = S.slice(0, 5).find((s) => s !== winner && s !== S[1]);
  const again = await api(loser, "POST", "/api/bookings", { scheduleId: open, date: MON, time: "10:00" });
  assert.equal(again.status, 201, again.text);
});
await step("다른 학생은 남의 예약을 바꾸거나 취소할 수 없다", async () => {
  const stranger = S.find((s) => s !== winner);
  assert.equal((await api(stranger, "DELETE", `/api/bookings/${b0.id}`)).status, 404);
  assert.equal((await api(stranger, "PATCH", `/api/bookings/${b0.id}`, { date: MON, time: "10:30" })).status, 404);
  assert.equal((await api(prof2, "DELETE", `/api/bookings/${b0.id}`)).status, 404, "another instructor");
});

console.log("\n[교수 관리]");
await step("일정 수정 전 영향받는 예약을 미리 보여준다", async () => {
  const changed = scheduleBody({ recurring: { from: MON, to: addDays(MON, 13), windows: [{ days: [1], start: "10:00", end: "11:00" }], excludeDates: [] } });
  const r = await api(prof, "PATCH", `/api/courses/${courseId}/schedules/${open}`, { schedule: changed, dryRun: true });
  assert.equal(r.status, 200, r.text);
  assert.ok(r.json.impact.some((b) => b.id === b0.id && b.reason === "no_slot"), "11:30 booking affected");
  assert.ok(!r.json.impact.some((b) => b.time === "10:00"), "10:00 still valid");
});
await step("장소를 바꾸면 예정 예약에도 반영된다", async () => {
  const r = await api(prof, "PATCH", `/api/courses/${courseId}/schedules/${open}`, { schedule: scheduleBody({ location: "연구관 710호" }) });
  assert.equal(r.status, 200, r.text);
  const mine = (await api(winner, "GET", `/api/bookings?scheduleId=${open}`)).json.bookings.find((b) => b.id === b0.id);
  assert.equal(mine.location, "연구관 710호");
});
await step("교수는 학생 예약을 옮기고 취소할 수 있다", async () => {
  const m = await api(prof, "PATCH", `/api/bookings/${b0.id}`, { date: addDays(MON, 7), time: "10:00" });
  assert.equal(m.status, 200, m.text);
  const c = await api(prof, "DELETE", `/api/bookings/${b0.id}`);
  assert.equal(c.status, 200);
  assert.equal(c.json.booking.cancelledBy, "instructor");
});
await step("예정 예약이 있는 일정은 삭제할 수 없고, 마감하면 예약이 막힌다", async () => {
  assert.equal((await api(prof, "DELETE", `/api/courses/${courseId}/schedules/${open}`)).status, 409);
  assert.equal((await api(prof, "PATCH", `/api/courses/${courseId}/schedules/${open}`, { status: "closed" })).status, 200);
  const r = await api(S[4], "POST", "/api/bookings", { scheduleId: open, date: MON, time: "10:30" });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, "NOT_OPEN");
  assert.equal((await page(S[4], `/courses/${courseId}/schedules/${open}`)).status, 404, "closed schedule is hidden from students");
  assert.equal((await api(prof, "PATCH", `/api/courses/${courseId}/schedules/${open}`, { status: "open" })).status, 200);
  assert.equal((await api(prof, "DELETE", `/api/courses/${courseId}/schedules/${draft}`)).status, 200, "empty draft can be deleted");
});
await step("학생을 제외하면 그 그룹의 예정 예약이 취소된다", async () => {
  const me = (await api(S[1], "GET", "/api/me")).json;
  const r = await api(prof, "DELETE", `/api/courses/${courseId}/members/${me.uid}`);
  assert.equal(r.status, 200, r.text);
  assert.ok(r.json.cancelled >= 1);
  const left = (await api(S[1], "GET", "/api/bookings")).json.bookings.filter((b) => b.courseId === courseId && b.status === "booked");
  assert.equal(left.length, 0);
});
await step("그룹에 속한 계정은 유형을 바꿀 수 없다", async () => {
  assert.equal((await api(prof, "PUT", "/api/me", { accountType: "student", name: "김교수", studentNo: "1234567" })).status, 409);
});

console.log("\n[화면 렌더링]");
await step("교수 화면들이 정상 렌더링된다", async () => {
  for (const [path, text] of [
    ["/courses", `자료구조 ${RUN}`],
    [`/courses/${courseId}`, "새 일정"],
    [`/courses/${courseId}/members`, "학생 명단"],
    [`/courses/${courseId}/schedules/new`, "새 상담 일정"],
    [`/courses/${courseId}/schedules/${open}`, "예약 현황"],
    [`/courses/${courseId}/schedules/${open}/edit`, "상담 일정 수정"],
    ["/bookings", "다가오는 상담"],
    ["/me", "교수 계정입니다"],
  ]) {
    const p = await page(prof, path);
    assert.equal(p.status, 200, `${path} → ${p.status}`);
    assert.ok(p.html.includes(text), `${path} should include ${text}`);
  }
});
await step("학생 화면들이 정상 렌더링된다", async () => {
  for (const [path, text] of [
    ["/courses", `자료구조 ${RUN}`],
    [`/courses/${courseId}`, "중간 면담"],
    // 동시 예약에서 누가 이겼는지에 따라 예약 선택 화면 또는 횟수 소진 안내가 나온다
    [`/courses/${courseId}/schedules/${open}`, /날짜와 시간 선택|예약 가능 횟수/],
    ["/bookings", "내 예약"],
    ["/me", "학생 계정입니다"],
  ]) {
    const p = await page(S[0], path);
    assert.equal(p.status, 200, `${path} → ${p.status}`);
    assert.ok(typeof text === "string" ? p.html.includes(text) : text.test(p.html), `${path} should include ${text}`);
  }
});
await step("비로그인 사용자는 로그인 화면으로 이동한다", async () => {
  for (const path of ["/courses", "/bookings", `/join/${token}`]) {
    const p = await page(null, path);
    assert.equal(p.status, 307);
    assert.ok(p.location.includes("/login?next="), p.location);
  }
  assert.equal((await page(null, "/")).status, 200);
  assert.equal((await page(prof, "/")).status, 307, "logged-in home redirects");
});
await step("로그아웃하면 세션이 끊긴다", async () => {
  const r = await api(S[5], "DELETE", "/api/session");
  assert.equal(r.status, 200);
  assert.equal((await api(S[5], "GET", "/api/me")).status, 401, "revoked cookie no longer works");
});

console.log(`\n${passed} checks passed`);
