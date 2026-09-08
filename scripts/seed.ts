/**
 * 표.md 의 "전체 배정표"를 읽어 예약 DB에 넣습니다.
 *
 *   npx tsx scripts/seed.ts            # 실제 반영 (.env.local 의 Upstash 자격증명 사용)
 *   npx tsx scripts/seed.ts --dry-run  # 파싱·검증 결과만 출력
 *   npx tsx scripts/seed.ts --force    # 요일/시간 규칙에 어긋나는 기존 배정도 그대로 반영 (슬롯 중복은 여전히 차단)
 *
 * 이미 같은 슬롯이 차 있으면 건너뛰므로 여러 번 실행해도 안전합니다.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// .env.local 로드 (외부 의존성 없이)
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const YEAR = 2026;
const COLUMNS = ["jeon", "jung", "choi"] as const; // 표 열 순서: 전유부, 정병덕, 최정섭

async function main() {
  // env 로드 뒤에 import 해야 getStore가 Redis를 인식
  const { PROFESSORS, getProfessor, generateTimeSlots, isDateSelectable } = await import("../src/lib/config");
  const { getStore } = await import("../src/lib/store");

  const md = readFileSync(resolve(process.cwd(), "표.md"), "utf-8");
  const section = md.split("## 전체 배정표")[1] ?? "";
  const rows = section
    .split(/\r?\n/)
    .filter((l) => l.startsWith("|"))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()))
    .filter((cells) => cells.length === 4 && cells[0] !== "이름" && !/^-+$/.test(cells[0]));

  type Entry = { name: string; professorId: string; date: string; time: string };
  const entries: Entry[] = [];
  const problems: string[] = [];

  for (const [name, ...cells] of rows) {
    cells.forEach((cell, i) => {
      if (!cell || cell === "—" || cell === "-") return;
      const m = cell.match(/^(\d{1,2})\/(\d{1,2})\([^)]*\)\s*(\d{1,2}):(\d{2})$/);
      if (!m) {
        problems.push(`${name} / ${COLUMNS[i]}: 형식을 읽을 수 없음 "${cell}"`);
        return;
      }
      const date = `${YEAR}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      const time = `${m[3].padStart(2, "0")}:${m[4]}`;
      entries.push({ name, professorId: COLUMNS[i], date, time });
    });
  }

  // 규칙 검증 (교수님별 요일/시간/제외일). --force 시 경고만 출력
  const ruleWarnings: string[] = [];
  for (const e of entries) {
    const prof = getProfessor(e.professorId)!;
    if (!isDateSelectable(prof, e.date)) ruleWarnings.push(`${e.name} / ${prof.name} ${e.date}: 예약 불가 날짜`);
    else if (!generateTimeSlots(prof, e.date).includes(e.time)) ruleWarnings.push(`${e.name} / ${prof.name} ${e.date} ${e.time}: 슬롯에 없는 시간`);
  }
  if (ruleWarnings.length) {
    if (force) {
      console.log("규칙 위반이지만 --force 로 반영합니다:");
      ruleWarnings.forEach((w) => console.log("  ! " + w));
    } else {
      problems.push(...ruleWarnings.map((w) => w + " (--force 로 강제 반영 가능)"));
    }
  }
  // 같은 교수님 슬롯 중복 검사
  const seen = new Map<string, string>();
  for (const e of entries) {
    const k = `${e.professorId}:${e.date}:${e.time}`;
    if (seen.has(k)) problems.push(`슬롯 중복: ${getProfessor(e.professorId)!.name} ${e.date} ${e.time} — ${seen.get(k)}, ${e.name}`);
    else seen.set(k, e.name);
  }

  console.log(`파싱: ${rows.length}명, 예약 ${entries.length}건`);
  for (const p of PROFESSORS) console.log(`  ${p.name}: ${entries.filter((e) => e.professorId === p.id).length}건`);
  if (problems.length) {
    console.log("\n문제:");
    problems.forEach((p) => console.log("  - " + p));
    console.log("\n문제가 있어 중단합니다. 표.md 또는 src/lib/config.ts 를 확인하세요.");
    process.exit(1);
  }

  if (dryRun) {
    console.log("\n[dry-run] 반영 예정 목록:");
    for (const e of entries) console.log(`  ${getProfessor(e.professorId)!.name}  ${e.date} ${e.time}  ${e.name}`);
    return;
  }

  const hasRedis =
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!hasRedis) {
    console.error("\nRedis 자격증명이 없습니다. .env.local 에 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 을 넣거나 --dry-run 으로 실행하세요.");
    process.exit(1);
  }

  const store = getStore();
  let created = 0, skipped = 0;
  for (const e of entries) {
    const ok = await store.create({
      id: crypto.randomUUID(),
      professorId: e.professorId,
      date: e.date,
      time: e.time,
      name: e.name,
      createdAt: new Date().toISOString(),
    });
    if (ok) created++;
    else {
      skipped++;
      console.log(`  건너뜀(이미 예약됨): ${getProfessor(e.professorId)!.name} ${e.date} ${e.time} ${e.name}`);
    }
  }
  console.log(`\n완료: 생성 ${created}건, 건너뜀 ${skipped}건`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
