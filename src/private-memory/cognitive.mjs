// Human-inspired retrieval policy, not a psychological measurement or model training.
// The clock changes accessibility, never deletes a memory. Reads never reinforce it.
import { tokens } from './capture.mjs';
export const DAY = 86400000;
export const localDay = t => new Date(t + 8 * 3600000).toISOString().slice(0, 10);
const canonical = s => String(s).normalize('NFKC').replace(/[\s，。！？!?,.～~]/gu, '').trim();
export const sameMeaning = (a, b) => canonical(a) === canonical(b);
export const containsMeaning = (a, b) => Boolean(canonical(b)) && canonical(a).includes(canonical(b));
export function newTrace(record, now) {
  const receivedAt = Math.min(record.createdAt ?? record.sourceTime, now);
  return {
    pinned: false, archived: false, lastReinforcedAt: receivedAt,
    latestSourceTime: record.sourceTime,
    evidence: [{ sourceId: record.sourceId, time: record.sourceTime }],
    rehearsalDays: [localDay(receivedAt)],
  };
}
export function reinforce(record, frame, now) {
  const t = record.trace ??= newTrace(record, now);
  if (t.evidence.some(e => e.sourceId === frame.id)) return false;
  // Out-of-order evidence must not reset age or restore an old manual archive.
  if (frame.time < (t.latestSourceTime ?? record.sourceTime)) return false;
  t.latestSourceTime = frame.time;
  const observedAt = Math.min(frame.observedAt ?? frame.time, now);
  const day = localDay(observedAt);
  t.evidence = [...t.evidence, { sourceId: frame.id, time: frame.time }].slice(-32);
  if (!t.rehearsalDays.includes(day)) {
    t.rehearsalDays = [...t.rehearsalDays, day].slice(-12);
    t.lastReinforcedAt = observedAt;
    record.updatedAt = now;
  }
  return true;
}
export function memoryView(r, now, settings = {}) {
  const t = r.trace || newTrace(r, now);
  const protectedMemory = t.pinned || r.slot === 'name' ||
    r.slot?.startsWith('address:avoid:') || r.tags?.includes('边界') ||
    (r.kind === 'reminder' && r.dueAt >= now - 2 * DAY);
  const count = t.rehearsalDays.length;
  const salience = /记住|约定|答应|很重要|第一次|毕业|生日/.test(r.content) ? 1.7 : 1;
  const halfLife = ({ profile: 180, preference: 90, episode: 30, reminder: 14 }[r.kind] || 30) *
    (1 + Math.min(8, Math.max(0, count - 1)) * .75) * salience;
  const age = Math.max(0, now - t.lastReinforcedAt) / DAY;
  const strength = protectedMemory || settings.decayEnabled === false ? 1 : 2 ** (-age / halfLife);
  const stage = t.archived ? 'archived' : protectedMemory ? 'protected' :
    strength < .12 ? 'archived' : strength < .5 ? 'background' : count >= 3 ? 'familiar' : 'fresh';
  return { stage, strength: Math.round(strength * 1000) / 1000,
    evidenceCount: count, lastReinforcedAt: t.lastReinforcedAt, pinned: t.pinned,
    lastConfirmedAt: t.latestSourceTime ?? r.sourceTime,
    manuallyArchived: t.archived,
    temporal: r.kind === 'reminder' ? (r.dueAt <= now ? 'past' : 'upcoming') : 'historical' };
}
const NOISE = new Set(['我是', '我想', '你是', '你说', '我的', '你的', '我们', '这个', '那个', '今天', '昨天', '记得', '记住', '什么', '一下', '时候']);
export function relevance(r, q) {
  const words = tokens(q).filter(v => !NOISE.has(v));
  if (!words.length) return 0;
  const own = new Set(tokens([r.content, ...r.tags, r.slot].join(' ')));
  const hits = words.filter(w => own.has(w)).length;
  const exact = canonical(q).length >= 2 && canonical(r.content).includes(canonical(q)) ? 1 : 0;
  return Math.min(1, hits / Math.max(2, Math.min(words.length, 6)) + exact * .5);
}
export function selectMemories(user, now, { q = '', limit = 12, history = false, category } = {}) {
  const hasQuery = String(q).trim().length > 0;
  const ranked = user.records.filter(r => (history || r.status === 'active') && (!category || r.kind === category))
    .map(r => ({ r, memory: memoryView(r, now, user.settings), match: relevance(r, q) }))
    .filter(v => history || (!v.memory.manuallyArchived && (hasQuery ? v.match >= .16 : !['archived', 'background'].includes(v.memory.stage))))
    .filter(v => !hasQuery || v.match >= .16);
  // Relevance dominates freshness: recent unrelated material cannot crowd out an old cue.
  ranked.sort((a, b) => (hasQuery ? (b.match - a.match) * 10 : 0) ||
    Number(b.memory.pinned) - Number(a.memory.pinned) ||
    Number(b.memory.stage === 'protected') - Number(a.memory.stage === 'protected') ||
    b.memory.strength - a.memory.strength || b.r.updatedAt - a.r.updatedAt || a.r.id.localeCompare(b.r.id));
  const chosen = ranked.slice(0, Math.min(100, Math.max(1, Number(limit) || 12)));
  return chosen.map(v => ({ ...structuredClone(v.r), memory: v.memory,
    recall: { related: v.match > 0, uncertain: ['background', 'archived'].includes(v.memory.stage), reason: hasQuery ? 'topic-cue' : 'current-context' } }));
}
export function validateCognitive(u) {
  if (u.settings !== undefined && (!u.settings || typeof u.settings !== 'object' ||
    Array.isArray(u.settings) || typeof u.settings.decayEnabled !== 'boolean')) throw Error('记忆设置损坏');
  for (const r of u.records) {
    if (!r.trace) { if (r.trace !== undefined) throw Error('记忆轨迹损坏'); continue; }
    const t = r.trace;
    if (typeof t.pinned !== 'boolean' || typeof t.archived !== 'boolean' ||
      !Number.isFinite(t.lastReinforcedAt) || !Array.isArray(t.evidence) || !t.evidence.length || t.evidence.length > 32 ||
      (t.latestSourceTime !== undefined && !Number.isFinite(t.latestSourceTime)) ||
      t.evidence.some(e => !e || typeof e.sourceId !== 'string' || !e.sourceId || e.sourceId.length > 160 || !Number.isFinite(e.time)) ||
      !Array.isArray(t.rehearsalDays) || !t.rehearsalDays.length || t.rehearsalDays.length > 12 ||
      new Set(t.rehearsalDays).size !== t.rehearsalDays.length || t.rehearsalDays.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d)))
      throw Error('记忆轨迹损坏，未覆盖原文件');
  }
}
