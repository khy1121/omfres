import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getStore } from "./store";

/** 초기 임시 PIN. 환경변수 ADMIN_PIN(6자리 숫자)으로 덮어쓸 수 있으며, 관리자 페이지에서 변경 가능. 비어 있거나 형식이 틀리면 무시 */
const DEFAULT_PIN = /^\d{6}$/.test(process.env.ADMIN_PIN ?? "") ? (process.env.ADMIN_PIN as string) : "000000";
const COOKIE = "admin_session";
const SESSION_HOURS = 12;

export const isValidPin = (pin: unknown): pin is string => typeof pin === "string" && /^\d{6}$/.test(pin);

export function hashPin(pin: string) {
  return createHash("sha256").update(`resv-pin:${pin}`).digest("hex");
}

async function currentPinHash() {
  return (await getStore().getAdminPinHash()) ?? hashPin(DEFAULT_PIN);
}

function safeEq(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function verifyPin(pin: string) {
  return safeEq(hashPin(pin), await currentPinHash());
}

/** 세션 토큰은 현재 PIN 해시로 서명 → PIN을 바꾸면 기존 세션이 모두 무효화됨 */
function sign(payload: string, pinHash: string) {
  const secret = process.env.ADMIN_SECRET || pinHash;
  return createHmac("sha256", `${secret}:${pinHash}`).update(payload).digest("hex");
}

export async function createSession() {
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  const payload = String(exp);
  const token = `${payload}.${sign(payload, await currentPinHash())}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (Number(payload) < Date.now()) return false;
  return safeEq(sig, sign(payload, await currentPinHash()));
}

export async function changePin(currentPin: string, newPin: string) {
  if (!(await verifyPin(currentPin))) return false;
  await getStore().setAdminPinHash(hashPin(newPin));
  await createSession(); // 새 PIN으로 세션 재발급
  return true;
}
