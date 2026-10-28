import { randomUUID } from "node:crypto";
import { privateKey } from "./store.mjs";
export function careDeliveryAllowed(
  store,
  key,
  {
    enabled = true,
    allowed = true,
    paused = false,
    ready = true,
    attemptId = null,
  } = {},
) {
  const u = store.user(key),
    now = store.now(),
    claim = u.care?.claim;
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  return !!(
    enabled &&
    allowed &&
    !paused &&
    ready &&
    u.care?.enabled !== false &&
    (!u.care?.awaitingReply ||
      (attemptId &&
        u.care.contact?.id === claim?.id &&
        (u.care.contact.status === "sent" ||
          u.care.contact.attemptId === attemptId))) &&
    claim &&
    claim.expiresAt > now &&
    hour >= 8 &&
    hour < 23
  );
}
export function claimCare(
  store,
  key,
  {
    enabled = true,
    allowed = true,
    paused = false,
    busy = false,
    ready = true,
  } = {},
) {
  key = privateKey(key);
  if (!enabled || !allowed || paused || busy || !ready) return null;
  const now = store.now(),
    u = store.user(key),
    care = u.care || {};
  if (
    care.enabled === false ||
    !u.lastIncomingAt ||
    now - u.lastIncomingAt < 3600000 ||
    care.awaitingReply
  )
    return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  const day = `${parts.year}-${parts.month}-${parts.day}`,
    hour = Number(parts.hour);
  if (
    hour >= 23 ||
    hour < 8 ||
    care.lastAttemptDay === day ||
    (care.lastSentAt && now - care.lastSentAt < 12 * 3600000) ||
    (care.claim && care.claim.expiresAt > now)
  )
    return null;
  const event = u.records.find(
    (r) =>
      r.status === "active" &&
      !r.trace?.archived &&
      r.kind === "reminder" &&
      r.dueAt <= now &&
      now - r.dueAt < 48 * 3600000 &&
      !(care.sentIds || []).includes(r.id),
  );
  if (
    !event &&
    (now - u.lastIncomingAt < 12 * 3600000 ||
      now - u.lastIncomingAt > 7 * 86400000)
  )
    return null;
  const claim = {
    id: randomUUID(),
    kind: event ? "event" : "checkin",
    memoryId: event?.id || null,
    summary: event?.content || "",
    sourceTime: event?.sourceTime || null,
    createdAt: now,
    expiresAt: now + 5 * 60000,
  };
  store.update(key, (user) => {
    user.care = { ...user.care, lastAttemptDay: day, claim };
    return null;
  });
  return claim;
}
// Each actual outbound batch reserves its uncertain result durably before touching QQ.
// A crash or failed receipt leaves a pending contact, blocking new batches until a real reply.
export function createCareSendGuard(
  store,
  key,
  { claimId = null, options = () => ({}) } = {},
) {
  key = privateKey(key);
  const attemptId = randomUUID();
  let reserved = false;
  return () => {
    const u = store.user(key),
      claim = u.care?.claim,
      contact = u.care?.contact;
    if (!claimId) {
      if (u.care?.awaitingReply || claim)
        throw Error("正在等待对方回复，不继续主动联系");
      return;
    }
    if (
      claim?.id !== claimId ||
      !careDeliveryAllowed(store, key, { ...options(), attemptId })
    )
      throw Error("主动联系时段、权限或租约已变化");
    if (contact?.status === "pending" && contact.attemptId !== attemptId)
      throw Error("上次发送结果待确认，停止追发");
    if (reserved) return;
    store.update(key, (user) => {
      user.care = {
        ...user.care,
        awaitingReply: true,
        contact: {
          id: claimId,
          attemptId,
          status: "pending",
          startedAt: store.now(),
          expiresAt: claim.expiresAt,
        },
      };
      return null;
    });
    reserved = true;
  };
}
export function markCareSent(store, key) {
  const u = store.user(key),
    claim = u.care?.claim,
    contact = u.care?.contact;
  if (!contact && (!claim || claim.expiresAt < store.now())) return false;
  store.update(key, (user) => {
    user.care = {
      ...user.care,
      awaitingReply: true,
      lastSentAt: store.now(),
      contact: {
        ...(contact || { id: claim.id, startedAt: store.now() }),
        status: "sent",
      },
      sentIds: [
        ...new Set([
          ...(user.care.sentIds || []),
          ...(claim?.memoryId ? [claim.memoryId] : []),
        ]),
      ].slice(-500),
    };
    return null;
  });
  return true;
}
export function careContext(store, key) {
  const claim = store.user(key).care?.claim;
  if (!claim || claim.expiresAt < store.now()) return "";
  return (
    "【私聊主动关心机会】" +
    JSON.stringify(claim) +
    "\n沿用原完整人设。相关时自然问候一句，不强迫对方回复，不催促、不卖惨；没有合适内容可以不发。事件时间是过去的原话线索，不要猜结果；不编造现实活动。发送仍必须经过原有QQ工具、准入与审核。"
  );
}
