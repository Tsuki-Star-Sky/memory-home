import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrivateMemory } from '../src/private-memory/store.mjs';
import { DAY, memoryView } from '../src/private-memory/cognitive.mjs';
const key = 'private:123', start = Date.parse('2026-10-28T12:00:00+08:00');
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-home-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let now = start, seq = 0;
  const file = path.join(dir, 'memory.json'), store = new PrivateMemory({ file, now: () => now });
  const say = (text, options = {}) => store.observe(key, { plain: text, userId: '123', messageId: String(++seq), time: now, ...options });
  const episode = (text, slot = '') => {
    say(text);
    return store.remember(key, { kind: 'episode', content: text, quote: text, sourceId: String(seq), slot });
  };
  return { store, file, say, episode, at: days => now = start + days * DAY };
}
test('old stores load without rewriting, migrate on first successful mutation, and preserve provenance', t => {
  const f = fixture(t); f.say('我喜欢柠檬');
  const old = JSON.parse(fs.readFileSync(f.file)); delete old.memoryModel;
  for (const u of Object.values(old.users)) { delete u.learning; for (const r of u.records) delete r.trace; }
  fs.writeFileSync(f.file, JSON.stringify(old)); const bytes = fs.readFileSync(f.file);
  const again = new PrivateMemory({ file: f.file });
  again.context(key, '柠檬'); again.export(key);
  assert.deepEqual(fs.readFileSync(f.file), bytes);
  again.configure(key, { decayEnabled: false });
  const saved = JSON.parse(fs.readFileSync(f.file)); assert.equal(saved.memoryModel, 2);
  assert.equal(saved.users[key].records[0].content, '我喜欢柠檬');
});
test('real spaced repetition consolidates; duplicates, same-day spam and retrieval never rehearse', t => {
  const f = fixture(t); f.say('我喜欢柠檬');
  for (let i = 0; i < 15; i++) f.say('我喜欢柠檬');
  assert.equal(f.store.export(key).records[0].memory.evidenceCount, 1);
  f.at(1); f.say('我喜欢柠檬'); f.at(2); f.say('我喜欢柠檬');
  assert.equal(f.store.export(key).records[0].memory.stage, 'familiar');
  assert.equal(f.store.export(key).records.length, 1);
  const before = fs.readFileSync(f.file);
  for (let i = 0; i < 15; i++) f.store.context(key, '柠檬');
  assert.deepEqual(fs.readFileSync(f.file), before);
  f.at(10); f.say('我喜欢柠檬', { messageId: '1' });
  assert.equal(f.store.export(key).records[0].memory.evidenceCount, 3);
});
test('old episodes fade out of unsolicited context but a topic cue retrieves dated uncertain memory', t => {
  const f = fixture(t); f.episode('我上周去了海边'); f.at(400);
  assert.doesNotMatch(f.store.context(key), /去了海边/);
  const r = f.store.query(key, { q: '旅游' })[0];
  assert.equal(r.memory.stage, 'archived'); assert.equal(r.recall.uncertain, true);
  assert.match(f.store.context(key, '旅游'), /去了海边/);
  assert.equal(f.store.export(key).records.length, 1);
  assert.match(f.store.context(key, '旅游'), /2026-10-28/);
});
test('explicit boundaries, chosen keepsakes and pending reminders survive decay; past plans are dated', t => {
  const f = fixture(t); f.say('以后别叫我小猪'); const e = f.episode('我们那次聊到了纸飞机');
  f.store.setMemoryState(key, e.id, 'pin', true);
  f.say('我明天上午有面试', { messageId: 'event' });
  const reminder = f.store.remember(key, { kind: 'reminder', quote: '我明天上午有面试', content: '我明天上午有面试', sourceId: 'event', dueAt: new Date(start + DAY).toISOString() });
  assert.equal(memoryView(reminder, start).stage, 'protected');
  f.at(3000); const out = f.store.context(key);
  assert.match(out, /小猪/); assert.match(out, /纸飞机/);
  const past = f.store.query(key, { q: '面试' })[0]; assert.equal(past.memory.temporal, 'past');
  assert.match(f.store.context(key, '面试'), /过去的明天/);
});
test('manual archive remains excluded until restored; superseded values cannot be revived or pinned', t => {
  const f = fixture(t); const e = f.episode('我去过海边');
  f.store.setMemoryState(key, e.id, 'archive'); assert.equal(f.store.query(key, { q: '海边' }).length, 0);
  f.store.setMemoryState(key, e.id, 'restore'); assert.equal(f.store.query(key, { q: '海边' }).length, 1);
  const old = f.say('请叫我阿圆'); f.at(1); f.say('请叫我小圆');
  for (const action of ['pin', 'restore']) assert.throws(() => f.store.setMemoryState(key, old.id, action, true));
  assert.doesNotMatch(f.store.context(key, '名字'), /阿圆/);
});
test('same slot in different categories cannot silently overwrite unrelated memories', t => {
  const f = fixture(t); f.say('请叫我小圆'); f.episode('我们聊天时说起小圆这个名字', 'name');
  assert.equal(f.store.export(key).records.filter(r => r.status === 'active').length, 2);
});
test('category filtering occurs before result limit; relevant old memory beats unrelated recent ones', t => {
  const f = fixture(t); f.episode('我去过海边'); f.at(2);
  for (let i = 0; i < 25; i++) f.say('我喜欢水果' + i);
  assert.equal(f.store.query(key, { category: 'episode', limit: 1 })[0].content, '我去过海边');
  assert.equal(f.store.query(key, { q: '海边', limit: 1 })[0].content, '我去过海边');
});
test('automatic capture and learning use one durable transaction, failed writes remain retryable', t => {
  const f = fixture(t); f.say('我喜欢柠檬'); const before = fs.readFileSync(f.file);
  const bad = f.file + '-directory'; fs.mkdirSync(bad); f.store.file = bad;
  assert.throws(() => f.say('请叫我小圆', { messageId: 'retry' }));
  assert.deepEqual(fs.readFileSync(f.file), before); f.store.file = f.file;
  assert.ok(f.say('请叫我小圆', { messageId: 'retry' }).id);
  const bytes = fs.readFileSync(f.file);
  assert.throws(() => f.store.remember(key, { kind: 'episode', content: '伪造', quote: '伪造', sourceId: 'missing' }));
  assert.deepEqual(fs.readFileSync(f.file), bytes);
});
test('new metadata corruption fails closed; clock shifts stay finite and cannot give super-strength', t => {
  const f = fixture(t); f.say('我喜欢柠檬', { time: start + 400 * DAY }); f.at(-10);
  assert.equal(f.store.export(key).records[0].memory.strength, 1);
  const bad = JSON.parse(fs.readFileSync(f.file)); bad.users[key].records[0].trace.evidence = 'broken';
  fs.writeFileSync(f.file, JSON.stringify(bad)); const before = fs.readFileSync(f.file);
  assert.throws(() => new PrivateMemory({ file: f.file })); assert.deepEqual(fs.readFileSync(f.file), before);
});
test('forget purges all rehearsal sources and never recreates records on replay after restart', t => {
  const f = fixture(t); const r = f.say('我喜欢柠檬', { messageId: 'original' });
  f.at(2); f.say('我喜欢柠檬', { messageId: 'later' }); f.store.forget(key, r.id);
  assert.doesNotMatch(fs.readFileSync(f.file, 'utf8'), /柠檬/);
  const again = new PrivateMemory({ file: f.file, now: () => start + 3 * DAY });
  again.observe(key, { plain: '我喜欢柠檬', messageId: 'later', time: start + 2 * DAY, userId: '123' });
  assert.equal(again.query(key).length, 0);
});
test('disabling decay restores accessibility without discarding history; manual archive still applies', t => {
  const f = fixture(t); const r = f.episode('我去过海边'); f.at(1000);
  f.store.configure(key, { decayEnabled: false }); assert.match(f.store.context(key), /海边/);
  f.store.setMemoryState(key, r.id, 'archive'); assert.doesNotMatch(f.store.context(key), /海边/);
  assert.throws(() => f.store.configure(key, { decayEnabled: 'false' }));
});
