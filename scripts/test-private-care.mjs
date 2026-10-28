import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrivateMemory } from "../src/private-memory/store.mjs";
import {
  claimCare,
  markCareSent,
  careDeliveryAllowed,
} from "../src/private-memory/care.mjs";
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qq-care-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let now = Date.parse("2026-10-26T10:00:00+08:00");
  const store = new PrivateMemory({
    file: path.join(dir, "memory.json"),
    now: () => now,
  });
  store.observe("private:123", {
    userId: "123",
    messageId: "a",
    plain: "我明天上午有面试",
    time: now,
  });
  return { store, setTime: (t) => (now = t), now: () => now };
}
test("event care obeys due time, quiet hours, cooldown and one unacknowledged contact", (t) => {
  const f = fixture(t),
    key = "private:123";
  f.store.remember(key, {
    kind: "reminder",
    content: "我明天上午有面试",
    quote: "我明天上午有面试",
    sourceId: "a",
    dueAt: "2026-10-27T15:00:00+08:00",
  });
  assert.equal(claimCare(f.store, key), null);
  f.setTime(Date.parse("2026-10-27T23:30:00+08:00"));
  assert.equal(claimCare(f.store, key), null);
  f.setTime(Date.parse("2026-10-28T10:00:00+08:00"));
  assert.equal(claimCare(f.store, key)?.kind, "event");
  markCareSent(f.store, key);
  f.setTime(f.now() + 86400000);
  assert.equal(claimCare(f.store, key), null);
});
test("pause, disallowed peers, busy gateway and disabled feature never claim", (t) => {
  const f = fixture(t);
  f.setTime(f.now() + 13 * 3600000);
  f.setTime(Date.parse("2026-10-27T10:00:00+08:00"));
  for (const option of [
    { paused: true },
    { allowed: false },
    { busy: true },
    { ready: false },
    { enabled: false },
  ])
    assert.equal(claimCare(f.store, "private:123", option), null);
  assert.equal(f.store.user("private:123").care.claim ?? null, null);
});
test("leases persist across restart; failed or declined opportunity is not repeatedly retried", (t) => {
  const f = fixture(t);
  f.setTime(Date.parse("2026-10-27T10:00:00+08:00"));
  assert.ok(claimCare(f.store, "private:123"));
  const again = new PrivateMemory({ file: f.store.file, now: f.now });
  assert.equal(claimCare(again, "private:123"), null);
  f.setTime(f.now() + 10 * 60000);
  assert.equal(claimCare(again, "private:123"), null);
});
test("new user message cancels unsent claim; ordinary reply is not a proactive contact", (t) => {
  const f = fixture(t);
  f.setTime(Date.parse("2026-10-27T10:00:00+08:00"));
  assert.ok(claimCare(f.store, "private:123"));
  f.store.observe("private:123", {
    userId: "123",
    messageId: "b",
    plain: "我回来啦",
    time: f.now(),
  });
  assert.equal(markCareSent(f.store, "private:123"), false);
  assert.equal(f.store.user("private:123").care.awaitingReply, false);
});
test("queued care rechecks lease, quiet hours, readiness and opt-out immediately before delivery", (t) => {
  const f = fixture(t),
    key = "private:123";
  f.setTime(Date.parse("2026-10-27T22:58:00+08:00"));
  claimCare(f.store, key);
  assert.equal(careDeliveryAllowed(f.store, key), true);
  for (const opts of [
    { paused: true },
    { ready: false },
    { enabled: false },
    { allowed: false },
  ])
    assert.equal(careDeliveryAllowed(f.store, key, opts), false);
  f.setTime(Date.parse("2026-10-27T23:00:00+08:00"));
  assert.equal(careDeliveryAllowed(f.store, key), false);
  f.setTime(Date.parse("2026-10-28T10:00:00+08:00"));
  assert.equal(careDeliveryAllowed(f.store, key), false);
});
