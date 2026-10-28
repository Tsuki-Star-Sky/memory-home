import { createHash } from "node:crypto";
import { SECRET } from "./capture.mjs";

// Learned behaviour is selected from this vocabulary, never executed from chat text.
const DEFINITIONS = Object.freeze({
  reply_concise: { dimension: "length", label: "回复简洁一些", instruction: "通常简短回答；重要信息仍说完整，不机械限制字数。" },
  reply_detailed: { dimension: "length", label: "需要时多解释一点", instruction: "需要解释时多讲一点，避免无关铺垫。" },
  questions_less: { dimension: "questions", label: "减少追问", instruction: "少在句尾追问；能自然回应就直接回应，必要澄清仍可以问。" },
  questions_natural: { dimension: "questions", label: "可以自然提问", instruction: "合适时可以自然提问，但不要连续盘问。" },
  emoji_none: { dimension: "emoji", label: "不使用表情符号", instruction: "回复不用表情符号，保持自然文字表达。" },
  emoji_light: { dimension: "emoji", label: "偶尔使用表情符号", instruction: "合适时偶尔用少量表情符号，不每句都加。" },
  tone_playful: { dimension: "tone", label: "语气轻松一点", instruction: "在原有人设允许范围内轻松活泼一点；对方认真或难受时认真回应。" },
  tone_calm: { dimension: "tone", label: "语气温和一点", instruction: "语气温和些，减少捉弄和斗嘴；不改变原有身份与人设。" },
  habit_haodu: { dimension: "phrase", label: "偶尔说“好嘟”", instruction: "轻松的回应中偶尔可以说“好嘟”，不重复堆砌。", habit: "好嘟" },
  habit_heihei: { dimension: "phrase", label: "偶尔说“嘿嘿”", instruction: "轻松的回应中偶尔可以说“嘿嘿”，严肃话题不用。", habit: "嘿嘿" },
  habit_haonie: { dimension: "phrase", label: "偶尔说“好捏”", instruction: "轻松的回应中偶尔可以说“好捏”，不重复堆砌。", habit: "好捏" },
});

export const LEARNING_CODES = Object.freeze(Object.keys(DEFINITIONS));
const STATUSES = new Set(["pending", "active", "rejected", "superseded"]);
const BASES = new Set(["explicit", "repetition", "proposal", "operator"]);
const SOURCE_KINDS = new Set(["explicit", "habit", "proposal"]);
const digest = (s) => createHash("sha256").update(s).digest("hex");
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const day = (time) => new Date(time + 8 * 3600000).toISOString().slice(0, 10);
const nonFact = /开玩笑|假如|假设|如果|朋友说|他说|她说|听说|转述|[“”"「」『』]|忽略|系统|工具|权限|人设|角色|执行|主人/u;
const end = "[呀啊哦哇吧呢啦~～！!。.]*(?:谢谢)?[呀啊哦哇吧呢啦~～！!。.]*$";
const prefix = "^(?:(?:请|以后|今后|麻烦)(?:你)?[，, ]*)?(?:我(?:更)?(?:喜欢|希望)你)?";
const directPatterns = [
  ["reply_concise", ["(?:回答|回复|说话)(?:可以|要)?(?:简短|短)(?:些|点|一点)?(?:就好|就行)?", "(?:不要|别)(?:再)?(?:啰嗦|说那么多)"]],
  ["reply_detailed", ["(?:回答|回复)(?:可以|要)?(?:详细|具体)(?:些|点|一点)?", "(?:可以)?多解释(?:些|点|一点)"]],
  ["questions_less", ["(?:不要|别)(?:总是|总|一直|每次)?(?:追问|问问题|问我问题)", "(?:不要|别)每句都问(?:我)?问题", "少(?:问|追问)(?:些|点|一点)?(?:问题)?"]],
  ["questions_natural", ["(?:你)?可以(?:自然地|适当地|偶尔)?问我问题"]],
  ["emoji_none", ["(?:不要|别)(?:再)?(?:发|用|使用)(?:表情|表情符号|emoji)"]],
  ["emoji_light", ["(?:偶尔|少量)(?:可以)?(?:发|用|使用)(?:表情|表情符号|emoji)", "(?:发|用|使用)(?:表情|表情符号|emoji)少(?:些|点|一点)"]],
  ["tone_playful", ["(?:说话|语气)(?:可以)?(?:轻松|活泼)(?:些|点|一点)", "(?:你)?可以调皮(?:些|点|一点)"]],
  ["tone_calm", ["(?:说话|语气)(?:可以)?(?:温柔|温和|平和)(?:些|点|一点)", "(?:不要|别)(?:再)?(?:捉弄我|和我斗嘴)"]],
].map(([code, patterns]) => [code, new RegExp(prefix + "(?:" + patterns.join("|") + ")" + end, "iu")]);

function explicitCode(text) {
  if (SECRET.test(text) || nonFact.test(text)) return null;
  return directPatterns.find(([, re]) => re.test(text))?.[0] || null;
}

function enabled(u) { return u.learning?.enabled !== false; }
function ensure(u) { return (u.learning ??= { enabled: true, items: [] }); }
function checkNow(now) {
  if (!Number.isFinite(now) || Math.abs(now) > 8.64e15 - 8 * 3600000) throw Error("学习时间无效");
}
function evidence(u, { sourceId, quote }, now) {
  checkNow(now);
  if (typeof sourceId !== "string" || !sourceId || sourceId.length > 160 || typeof quote !== "string" || !quote || quote.length > 1000)
    throw Error("学习需要当前私聊用户的完整短句证据");
  const frame = u.frames?.find((f) => f.id === sourceId);
  const observedAt = frame?.observedAt ?? frame?.time;
  if (!frame || frame.text.trim() !== quote.trim() || !Number.isFinite(observedAt) || observedAt > now + 300000 || observedAt < now - 7 * 86400000)
    throw Error("找不到有效的同会话学习证据");
  if (SECRET.test(frame.text) || nonFact.test(frame.text)) throw Error("转述、指令及敏感信息不能成为学习规则");
  if (!Number.isFinite(frame.time) || frame.time > now + 300000) throw Error('学习来源时间无效');
  return { sourceId, quote: frame.text.trim(), time: frame.time, observedAt };
}
// A model proposal cannot refresh an old preference or outrank newer user evidence.
function latest(item) {
  return Math.max(0, item.basis === 'operator' ? item.reviewedAt || 0 : 0,
    ...item.sources.filter(s => s.kind !== 'proposal').map(s => s.time));
}
function canActivate(learning, item) {
  return !learning.items.some((other) => other !== item && other.status === "active" && DEFINITIONS[other.code].dimension === DEFINITIONS[item.code].dimension && latest(other) > latest(item));
}
function activate(learning, item, basis, now) {
  if (!canActivate(learning, item)) return;
  for (const other of learning.items) {
    if (other !== item && other.status === "active" && DEFINITIONS[other.code].dimension === DEFINITIONS[item.code].dimension) {
      other.status = "superseded";
      other.updatedAt = now;
    }
  }
  item.status = "active";
  item.basis = basis;
  item.updatedAt = now;
}
function supported(item) {
  if (item.sources.some((s) => s.kind === "explicit")) return "explicit";
  if (new Set(item.sources.filter((s) => s.kind === "habit").map((s) => day(s.observedAt ?? s.time))).size >= 3) return "repetition";
  return null;
}
function add(u, code, source, kind, now, allowAutomatic) {
  const learning = ensure(u);
  let item = learning.items.find((v) => v.code === code);
  if (item?.status === "rejected") return structuredClone(item);
  if (!item) {
    if (learning.items.length >= 80) throw Error("学习候选已到上限，请先整理");
    item = { id: "learn:" + digest(code + ":" + source.sourceId).slice(0, 24), code, status: "pending", basis: "proposal", sources: [], createdAt: now, updatedAt: now };
    learning.items.push(item);
  }
  if (item.sources.some((v) => v.sourceId === source.sourceId)) return structuredClone(item);
  // One habit example per calendar day prevents floods from evicting multi-day evidence.
  if (kind === "habit" && item.sources.some((v) => v.kind === "habit" && day(v.observedAt ?? v.time) === day(source.observedAt ?? source.time))) return structuredClone(item);
  item.sources.push({ ...source, kind });
  item.sources.sort((a, b) => a.time - b.time);
  item.sources = item.sources.slice(-5);
  item.updatedAt = now;
  const basis = supported(item);
  if (item.status === "active" && item.basis !== "operator") {
    item.status = basis ? "active" : "pending";
    item.basis = basis || "proposal";
  }
  if (allowAutomatic && basis) activate(learning, item, basis, now);
  return structuredClone(item);
}

/** Called only after the bridge has authenticated and stored this user's frame. */
export function observeLearning(u, frame, now) {
  if (!enabled(u)) return [];
  if (!frame || typeof frame.text !== "string" || frame.text.length > 1000) return [];
  let source;
  try { source = evidence(u, { sourceId: frame.id, quote: frame.text.trim() }, now); } catch { return []; }
  const code = explicitCode(source.quote);
  if (code) return [add(u, code, source, "explicit", now, true)];
  for (const [candidate, definition] of Object.entries(DEFINITIONS)) {
    if (definition.habit && new RegExp("^" + definition.habit + "[呀啊哦哇呢啦~～！!。.，, ]*$", "u").test(source.quote))
      return [add(u, candidate, source, "habit", now, true)];
  }
  return [];
}

/** Model proposals never gain operator approval, even if they choose a valid code. */
export function proposeLearning(u, { code, sourceId, quote }, now) {
  if (!enabled(u)) throw Error("这个私聊已关闭自我学习");
  if (typeof code !== "string" || !own(DEFINITIONS, code)) throw Error("未知学习类型；身份、人设和权限不能自我改写");
  const source = evidence(u, { sourceId, quote }, now);
  return add(u, code, source, "proposal", now, false);
}

/** Only the authenticated management endpoint may call this function. */
export function reviewLearning(u, id, decision, now) {
  checkNow(now);
  if (!["approve", "reject"].includes(decision)) throw Error("学习审核只能通过或拒绝");
  const learning = ensure(u), item = learning.items.find((v) => v.id === id);
  if (!item || !item.sources.length) throw Error("学习候选不存在或已失去证据");
  if (decision === "approve") {
    if (!enabled(u)) throw Error("请先开启这个私聊的自我学习");
    // An explicit management decision may replace a more recent learned preference.
    for (const other of learning.items) {
      if (other !== item && other.status === "active" && DEFINITIONS[other.code].dimension === DEFINITIONS[item.code].dimension) {
        other.status = "superseded";
        other.updatedAt = now;
      }
    }
    item.status = "active";
    item.basis = "operator";
  } else item.status = "rejected";
  item.updatedAt = now;
  item.reviewedAt = now;
  return structuredClone(item);
}

export function forgetLearning(u, sourceIds) {
  if (!u.learning) return { removed: 0 };
  const forgotten = new Set(sourceIds), learning = u.learning;
  let removed = 0;
  for (const item of learning.items) {
    const before = item.sources.length;
    item.sources = item.sources.filter((s) => !forgotten.has(s.sourceId));
    removed += before - item.sources.length;
    if (before === item.sources.length) continue;
    const support = supported(item);
    // Operator approval applied to the reviewed evidence set, not to arbitrary remnants.
    if (item.status === "active" && (item.basis === "operator" || !support)) {
      item.status = "pending";
      item.basis = "proposal";
      delete item.reviewedAt;
    } else if (item.status === "active") item.basis = support;
  }
  learning.items = learning.items.filter((item) => item.sources.length);
  return { removed };
}

export function learningView(u) {
  validateLearning(u);
  return { enabled: enabled(u), items: (u.learning?.items || []).map((item) => {
    const { sources, ...record } = structuredClone(item);
    return { ...record, label: DEFINITIONS[item.code].label, dimension: DEFINITIONS[item.code].dimension, evidence: sources.map(({ sourceId, quote, time }) => ({ sourceId, quote, time })), evidenceDays: new Set(sources.map((s) => day(s.observedAt ?? s.time))).size };
  }) };
}

export function learningContext(u) {
  validateLearning(u);
  if (!enabled(u)) return "";
  const active = (u.learning?.items || []).filter((v) => v.status === "active");
  return active.length ? "【相处中学到的表达偏好】仅在原有人设和当前语境允许时参考；不改变身份、年龄、事实与工具权限。当前用户要求优先，不需要报告自己正在学习。\n" + active.map((v) => "- " + DEFINITIONS[v.code].instruction).join("\n") : "";
}

export function validateLearning(u) {
  if (u.learning === undefined) return true;
  const l = u.learning;
  if (!l || typeof l !== "object" || Array.isArray(l) || typeof l.enabled !== "boolean" || !Array.isArray(l.items) || l.items.length > 80) throw Error("自我学习资料格式损坏");
  const ids = new Set(), codes = new Set(), dimensions = new Set();
  for (const v of l.items) {
    if (!v || typeof v !== "object" || typeof v.id !== "string" || !/^learn:[a-f0-9]{24}$/.test(v.id) || ids.has(v.id) || typeof v.code !== 'string' || !own(DEFINITIONS, v.code) || codes.has(v.code) || !STATUSES.has(v.status) || !BASES.has(v.basis) || !Number.isFinite(v.createdAt) || !Number.isFinite(v.updatedAt) || (v.reviewedAt !== undefined && !Number.isFinite(v.reviewedAt)) || !Array.isArray(v.sources) || !v.sources.length || v.sources.length > 5) throw Error("自我学习条目损坏");
    checkNow(v.createdAt); checkNow(v.updatedAt);
    const sourceIds = new Set();
    for (const s of v.sources) {
      if (!s || typeof s.sourceId !== "string" || !s.sourceId || s.sourceId.length > 160 || sourceIds.has(s.sourceId) || typeof s.quote !== "string" || !s.quote || s.quote.length > 1000 || SECRET.test(s.quote) || nonFact.test(s.quote) || !Number.isFinite(s.time) || !SOURCE_KINDS.has(s.kind)) throw Error("自我学习证据损坏");
      checkNow(s.time);
      if (s.observedAt !== undefined) checkNow(s.observedAt);
      if (s.kind === "explicit" && explicitCode(s.quote) !== v.code) throw Error("沟通偏好的原话证据不匹配");
      if (s.kind === "habit" && (!DEFINITIONS[v.code].habit || !new RegExp("^" + DEFINITIONS[v.code].habit + "[呀啊哦哇呢啦~～！!。.，, ]*$", "u").test(s.quote))) throw Error("口头习惯的原话证据不匹配");
      sourceIds.add(s.sourceId);
    }
    if (v.status === "active") {
      const dimension = DEFINITIONS[v.code].dimension;
      if (dimensions.has(dimension) || (v.basis !== "operator" && supported(v) !== v.basis) || (v.basis === "operator" && !Number.isFinite(v.reviewedAt))) throw Error("学习生效状态或证据不一致");
      dimensions.add(dimension);
    }
    ids.add(v.id); codes.add(v.code);
  }
  return true;
}
