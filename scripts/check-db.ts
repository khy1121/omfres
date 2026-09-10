/** DB의 전체 예약을 출력하고 표.md 와 대조합니다.  npx tsx scripts/check-db.ts */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { findProfessor } = await import("../src/lib/config");
  const { getStore } = await import("../src/lib/store");
  const PROFESSORS = await getStore().getProfessors();
  const getProfessor = (id: unknown) => findProfessor(PROFESSORS, id);
  const rows = (await getStore().listAll()).sort((a, b) =>
    `${a.professorId}${a.date}${a.time}`.localeCompare(`${b.professorId}${b.date}${b.time}`),
  );
  console.log(`DB 전체: ${rows.length}건`);
  for (const p of PROFESSORS) console.log(`  ${p.name}: ${rows.filter((r) => r.professorId === p.id).length}건`);

  // 표.md 파싱
  const md = readFileSync(resolve(process.cwd(), "표.md"), "utf-8");
  const COLS = ["jeon", "jung", "choi"];
  const expected = new Map<string, string>(); // key prof:date:time → name
  for (const l of (md.split("## 전체 배정표")[1] ?? "").split(/\r?\n/)) {
    if (!l.startsWith("|")) continue;
    const c = l.split("|").slice(1, -1).map((s) => s.trim());
    if (c.length !== 4 || c[0] === "이름" || /^-+$/.test(c[0])) continue;
    c.slice(1).forEach((cell, i) => {
      const m = cell.match(/^(\d{1,2})\/(\d{1,2})\([^)]*\)\s*(\d{1,2}):(\d{2})$/);
      if (m) expected.set(`${COLS[i]}:2026-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}:${m[3].padStart(2, "0")}:${m[4]}`, c[0]);
    });
  }

  const mismatch: string[] = [];
  const extra: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const k = `${r.professorId}:${r.date}:${r.time}`;
    seen.add(k);
    const exp = expected.get(k);
    if (!exp) extra.push(`${getProfessor(r.professorId)?.name} ${r.date} ${r.time} ${r.name}`);
    else if (exp !== r.name) mismatch.push(`${getProfessor(r.professorId)?.name} ${r.date} ${r.time}: DB=${r.name}, 표=${exp}`);
  }
  const missing = [...expected].filter(([k]) => !seen.has(k)).map(([k, n]) => `${k} ${n}`);

  console.log(`\n표와 일치: ${expected.size - missing.length - mismatch.length}건 / 표 ${expected.size}건`);
  if (mismatch.length) { console.log("\n이름 불일치:"); mismatch.forEach((s) => console.log("  - " + s)); }
  if (extra.length) { console.log("\n표에 없는 예약 (DB에만 있음):"); extra.forEach((s) => console.log("  - " + s)); }
  if (missing.length) { console.log("\n표에 있는데 DB에 없음:"); missing.forEach((s) => console.log("  - " + s)); }
  if (!mismatch.length && !extra.length && !missing.length) console.log("문제 없음: DB가 표와 정확히 일치합니다.");
}
main().catch((e) => { console.error(e); process.exit(1); });
