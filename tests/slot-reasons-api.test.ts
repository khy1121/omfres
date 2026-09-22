import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/slots/route";
import { getStore } from "../src/lib/store";
import { todayKST, type Professor } from "../src/lib/config";

test("slots API distinguishes past and booked slots and allows future midnight", async () => {
  assert.ok(!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL, "API tests must use the memory store");
  const store = getStore();
  const original = await store.getProfessors();
  const prof: Professor = { id:"slot-reason-test", name:"테스트", slotMinutes:30, availability:[{days:[0,1,2,3,4,5,6],start:"00:00",end:"01:00"}] };
  const today = todayKST();
  const tomorrow = new Date(`${today}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  const date = tomorrow.toISOString().slice(0,10);
  const id = crypto.randomUUID();
  try {
    await store.setProfessors([prof]);
    await store.create({id,professorId:prof.id,name:"테스트",date,time:"00:30",createdAt:new Date().toISOString()});
    const response = await GET(new NextRequest(`http://localhost/api/slots?professor=${prof.id}&date=${date}`));
    assert.equal(response.status,200);
    assert.deepEqual((await response.json()).slots, [{time:"00:00",available:true,reason:null},{time:"00:30",available:false,reason:"booked"}]);
    const elapsed = await GET(new NextRequest(`http://localhost/api/slots?professor=${prof.id}&date=${today}`));
    assert.deepEqual((await elapsed.json()).slots[0], {time:"00:00",available:false,reason:"past"});
  } finally { await store.remove(id); await store.setProfessors(original); }
});
