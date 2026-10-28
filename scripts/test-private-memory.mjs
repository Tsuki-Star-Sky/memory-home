import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrivateMemory } from "../src/private-memory/store.mjs";
const key = "private:12345";
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qq-memory-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "memory.json");
  return { file, store: new PrivateMemory({ file }) };
}
const msg = (text, id = "1", userId = "12345") => ({
  text,
  plain: text,
  messageId: id,
  userId,
  time: Date.now(),
  isSelf: false,
});
test("private identity is canonical, durable and isolated from groups and other users", (t) => {
  const { store, file } = fixture(t);
  store.observe(key, msg("请叫我阿圆"));
  assert.match(new PrivateMemory({ file }).context("private:012345"), /阿圆/);
  assert.doesNotMatch(store.context("private:54321"), /阿圆/);
  assert.throws(() => store.context("group:12345"));
  assert.throws(() => store.observe(key, msg("我喜欢柠檬", "2", "99999")));
});
test("clear preferences auto-capture; jokes, transient states and credentials are not facts", (t) => {
  const { store } = fixture(t);
  store.observe(key, msg("我不喜欢香菜"));
  assert.match(store.context(key, "饮食偏好"), /香菜/);
  for (const [i, text] of [
    "哈哈我开玩笑的，我喜欢香菜",
    "今天我很难过",
    "我的密码是 secret-value",
    "朋友说我喜欢辣椒",
  ].entries())
    store.observe(key, msg(text, String(i + 2)));
  const rows = store.query(key);
  assert.equal(rows.length, 1);
  assert.doesNotMatch(JSON.stringify(store.export(key)), /secret-value|辣椒/);
});
test("semantic memory tools require the same users exact observed quote", (t) => {
  const { store } = fixture(t);
  store.observe(key, msg("我明天要去面试", "a"));
  assert.throws(() =>
    store.remember(key, {
      kind: "episode",
      content: "我拿到录用了",
      sourceId: "a",
      quote: "我明天要去面试",
    }),
  );
  assert.throws(() =>
    store.remember(key, {
      kind: "episode",
      content: "我明天要去面试",
      sourceId: "missing",
      quote: "我明天要去面试",
    }),
  );
  const row = store.remember(key, {
    kind: "episode",
    content: "我明天要去面试",
    sourceId: "a",
    quote: "我明天要去面试",
    tags: ["求职"],
  });
  assert.ok(row.id);
  assert.match(store.context(key, "找工作"), /面试/);
});
test("explicit corrections supersede old values; dislike and like on same subject resolve", (t) => {
  const { store } = fixture(t);
  store.observe(key, msg("请叫我阿圆", "a"));
  store.observe(key, msg("以后叫我小圆", "b"));
  const rows = store.query(key);
  assert.equal(rows.filter((r) => r.slot === "name").length, 1);
  assert.match(store.context(key), /小圆/);
  assert.doesNotMatch(store.context(key), /阿圆/);
  store.observe(key, msg("我喜欢香菜", "c"));
  store.observe(key, msg("我现在不喜欢香菜了", "d"));
  assert.equal(store.query(key, { q: "香菜" }).length, 1);
  assert.match(store.context(key, "香菜"), /不喜欢/);
});
test("forget purges source text, refuses replay and survives restart", (t) => {
  const { store, file } = fixture(t);
  store.observe(key, msg("我喜欢香菜", "a"));
  const row = store.query(key)[0];
  store.forget(key, row.id);
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /香菜/);
  assert.throws(() =>
    store.remember(key, {
      kind: "preference",
      content: "我喜欢香菜",
      quote: "我喜欢香菜",
      sourceId: "a",
    }),
  );
  const again = new PrivateMemory({ file });
  again.observe(key, msg("我喜欢香菜", "a"));
  assert.equal(again.query(key).length, 0);
  again.observe(key, msg("我喜欢香菜", "b"));
  assert.equal(again.query(key).length, 1);
});
test("forget command clears long-term memories, without storing the command as a preference", (t) => {
  const { store } = fixture(t);
  store.observe(key, msg("我喜欢香菜", "a"));
  store.observe(key, msg("这件事别记：香菜", "b"));
  assert.equal(store.query(key).length, 0);
  store.observe(key, msg("请叫我小圆", "c"));
  store.observe(key, msg("清空长期记忆", "d"));
  assert.equal(store.query(key).length, 0);
});
test("memory corruption is explicit and never overwritten with an empty store", (t) => {
  const { file } = fixture(t);
  fs.writeFileSync(file, "broken-json");
  assert.throws(() => new PrivateMemory({ file }));
  assert.equal(fs.readFileSync(file, "utf8"), "broken-json");
});
test("long-term episode survives time and temporary conversation reset", (t) => {
  const { file, store } = fixture(t);
  store.observe(key, msg("我上周去了海边", "a"));
  store.remember(key, {
    kind: "episode",
    content: "我上周去了海边",
    quote: "我上周去了海边",
    sourceId: "a",
    tags: ["旅行"],
  });
  const later = new PrivateMemory({
    file,
    now: () => Date.now() + 100 * 86400000,
  });
  assert.match(later.context(key, "上次旅游"), /海边/);
});
test("out of order evidence cannot roll a corrected field back", (t) => {
  const { store } = fixture(t);
  store.observe(key, { ...msg("请叫我旧名字", "a"), time: Date.now() - 10000 });
  store.observe(key, msg("请叫我新名字", "b"));
  assert.throws(() =>
    store.remember(key, {
      kind: "profile",
      slot: "name",
      content: "请叫我旧名字",
      quote: "请叫我旧名字",
      sourceId: "a",
    }),
  );
  assert.match(store.context(key), /新名字/);
});

test("failed atomic replacement never changes acknowledged in-memory state", (t) => {
  const { store, file } = fixture(t);
  store.observe(key, msg("请叫我小圆", "first"));
  const bytes = fs.readFileSync(file);
  const destination = path.join(path.dirname(file), "directory-instead-of-file");
  fs.mkdirSync(destination);
  store.file = destination;
  assert.throws(() => store.update(key, (u) => { u.records=[];return null; }));
  assert.match(store.context(key), /小圆/);
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.equal(fs.readdirSync(path.dirname(file)).some(p=>p.includes('.tmp-')), false);
});
test("forget and clear preserve opt-out; structurally corrupt record fails closed", (t) => {
  const { store, file } = fixture(t);
  store.observe(key, msg("我喜欢香菜"));
  store.update(key, (u) => {
    u.care.enabled = false;
    u.care.awaitingReply = true;
    u.care.lastAttemptDay = '2026-10-26';
    return null;
  });
  store.forget(key, store.query(key)[0].id);
  assert.equal(store.user(key).care.enabled, false);
  assert.equal(store.user(key).care.awaitingReply, true);
  assert.equal(store.user(key).care.lastAttemptDay, '2026-10-26');
  store.clear(key);
  assert.equal(store.user(key).care.enabled, false);
  fs.writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      users: { [key]: { records: [{}], frames: [], blocked: [], care: {} } },
    }),
  );
  assert.throws(() => new PrivateMemory({ file }));
});
