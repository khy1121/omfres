import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "../src/app/api/reservations/[id]/route";
import { getStore } from "../src/lib/store";

const ids: string[] = [];
afterEach(async () => { for (const id of ids.splice(0)) await getStore().remove(id); });

test("student API rejects moving and cancelling a started reservation without mutating it", async () => {
  assert.ok(!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL, "API tests must use the memory store");
  const r = { id: crypto.randomUUID(), professorId: "jeon", name: "테스트", date: "2000-09-01", time: "10:00", createdAt: new Date().toISOString() };
  ids.push(r.id);
  await getStore().create(r);
  const context = { params: Promise.resolve({ id: r.id }) };
  const moved = await PATCH(new NextRequest(`http://localhost/api/reservations/${r.id}`, {
    method: "PATCH", body: JSON.stringify({ name: r.name, date: "2099-09-24", time: "10:00" }),
  }), context);
  assert.equal(moved.status, 400);
  const removed = await DELETE(new NextRequest(`http://localhost/api/reservations/${r.id}?name=${encodeURIComponent(r.name)}`, { method: "DELETE" }), context);
  assert.equal(removed.status, 400);
  assert.deepEqual(await getStore().get(r.id), r);
});
