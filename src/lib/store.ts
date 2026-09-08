import { Redis } from "@upstash/redis";

export type Reservation = {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (상담 시작시간)
  studentId: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
};

export interface Store {
  /** 해당 날짜의 예약된 시간 목록 */
  bookedTimes(date: string): Promise<string[]>;
  /** 슬롯을 원자적으로 선점하여 예약 생성. 이미 있으면 false */
  create(r: Reservation): Promise<boolean>;
  get(id: string): Promise<Reservation | null>;
  /** 학번 기준 예약 목록 */
  listByStudent(studentId: string): Promise<Reservation[]>;
  /** 날짜/시간 변경. 새 슬롯이 이미 차 있으면 false */
  move(id: string, date: string, time: string): Promise<boolean>;
  remove(id: string): Promise<void>;
  /** 전체 예약 (관리자용) */
  listAll(): Promise<Reservation[]>;
  /** 관리자 PIN 해시 (없으면 null → 기본 PIN 사용) */
  getAdminPinHash(): Promise<string | null>;
  setAdminPinHash(hash: string): Promise<void>;
}

const slotKey = (date: string, time: string) => `slot:${date}:${time}`;
const dayKey = (date: string) => `day:${date}`;
const resvKey = (id: string) => `resv:${id}`;
const studentKey = (sid: string) => `student:${sid}`;
const ALL_KEY = "resv:all";
const PIN_KEY = "admin:pin";

// ── Upstash Redis (Vercel Storage에서 연결 시 자동 설정) ──
function makeRedisStore(): Store {
  const redis = Redis.fromEnv();
  return {
    async bookedTimes(date) {
      return (await redis.smembers(dayKey(date))) ?? [];
    },
    async create(r) {
      // SET NX → 동시 요청 시 한 명만 성공
      const ok = await redis.set(slotKey(r.date, r.time), r.id, { nx: true });
      if (ok !== "OK") return false;
      await Promise.all([
        redis.set(resvKey(r.id), r),
        redis.sadd(dayKey(r.date), r.time),
        redis.sadd(studentKey(r.studentId), r.id),
        redis.sadd(ALL_KEY, r.id),
      ]);
      return true;
    },
    async get(id) {
      return (await redis.get<Reservation>(resvKey(id))) ?? null;
    },
    async listByStudent(studentId) {
      const ids = (await redis.smembers(studentKey(studentId))) ?? [];
      if (ids.length === 0) return [];
      const rows = await redis.mget<(Reservation | null)[]>(...ids.map(resvKey));
      return rows.filter((r): r is Reservation => !!r);
    },
    async move(id, date, time) {
      const r = await this.get(id);
      if (!r) return false;
      const ok = await redis.set(slotKey(date, time), id, { nx: true });
      if (ok !== "OK") return false;
      const updated: Reservation = { ...r, date, time, updatedAt: new Date().toISOString() };
      await Promise.all([
        redis.del(slotKey(r.date, r.time)),
        redis.srem(dayKey(r.date), r.time),
        redis.sadd(dayKey(date), time),
        redis.set(resvKey(id), updated),
      ]);
      return true;
    },
    async remove(id) {
      const r = await this.get(id);
      if (!r) return;
      await Promise.all([
        redis.del(slotKey(r.date, r.time)),
        redis.srem(dayKey(r.date), r.time),
        redis.srem(studentKey(r.studentId), id),
        redis.srem(ALL_KEY, id),
        redis.del(resvKey(id)),
      ]);
    },
    async listAll() {
      const ids = (await redis.smembers(ALL_KEY)) ?? [];
      if (ids.length === 0) return [];
      const rows = await redis.mget<(Reservation | null)[]>(...ids.map(resvKey));
      return rows.filter((r): r is Reservation => !!r);
    },
    async getAdminPinHash() {
      return (await redis.get<string>(PIN_KEY)) ?? null;
    },
    async setAdminPinHash(hash) {
      await redis.set(PIN_KEY, hash);
    },
  };
}

// ── 로컬 개발용 메모리 저장소 (서버 재시작 시 초기화) ──
function makeMemoryStore(): Store {
  const g = globalThis as unknown as { __resv?: Map<string, Reservation>; __pin?: string | null };
  const map = (g.__resv ??= new Map());
  const taken = (date: string, time: string, exceptId?: string) =>
    [...map.values()].some((r) => r.date === date && r.time === time && r.id !== exceptId);
  return {
    async bookedTimes(date) {
      return [...map.values()].filter((r) => r.date === date).map((r) => r.time);
    },
    async create(r) {
      if (taken(r.date, r.time)) return false;
      map.set(r.id, r);
      return true;
    },
    async get(id) {
      return map.get(id) ?? null;
    },
    async listByStudent(studentId) {
      return [...map.values()].filter((r) => r.studentId === studentId);
    },
    async move(id, date, time) {
      const r = map.get(id);
      if (!r || taken(date, time, id)) return false;
      map.set(id, { ...r, date, time, updatedAt: new Date().toISOString() });
      return true;
    },
    async remove(id) {
      map.delete(id);
    },
    async listAll() {
      return [...map.values()];
    },
    async getAdminPinHash() {
      return g.__pin ?? null;
    },
    async setAdminPinHash(hash) {
      g.__pin = hash;
    },
  };
}

export function getStore(): Store {
  if (process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    process.env.UPSTASH_REDIS_REST_URL = process.env.KV_REST_API_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = process.env.KV_REST_API_TOKEN;
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return makeRedisStore();
  }
  if (process.env.NODE_ENV === "production") {
    console.warn("[store] Redis 환경변수가 없어 메모리 저장소를 사용합니다. 예약이 유지되지 않습니다.");
  }
  return makeMemoryStore();
}
