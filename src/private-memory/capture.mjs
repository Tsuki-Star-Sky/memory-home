export const SECRET =
  /(?:密码|口令|验证码|API\s*KEY|access[_ -]?token|api[_ -]?token|sk-[A-Za-z0-9]|身份证|银行卡|私钥|助记词)/i;
export function capturePreference(text) {
  if (
    SECRET.test(text) ||
    /开玩笑|哈哈|假如|假设|朋友说|他说|她说|听说|如果/.test(text)
  )
    return null;
  const name = /^(?:请|以后|你可以)?叫我([^，。！？\n]{1,20})[。！]?$/u.exec(
    text,
  );
  if (name)
    return {
      kind: "profile",
      slot: "name",
      content: text,
      tags: ["称呼", "名字"],
    };
  const p =
    /^我(?:现在|以后)?(不喜欢|讨厌|喜欢|爱吃)([^，。！？\n]{1,60})[。！]?$/u.exec(
      text,
    );
  if (p)
    return {
      kind: "preference",
      slot: "preference:" + p[2].replace(/了$/u, ""),
      content: text,
      tags: ["偏好", "习惯", "饮食"],
    };
  const address =
    /^(?:请|以后)?(?:不要|别)(?:再)?叫我([^，。！？\n]{1,20})[。！]?$/u.exec(
      text,
    );
  if (address)
    return {
      kind: "preference",
      slot: "address:avoid:" + address[1],
      content: text,
      tags: ["称呼", "边界"],
    };
  // Conservative full-sentence rules only. Complex stories still require a cited model tool.
  const routine = /^我(?:每天|平时|通常|习惯)([^，。！？\n]{2,60})[。！]?$/u.exec(text);
  if (routine && !/今天|明天|可能|也许|偶尔|如果/.test(text))
    return { kind: 'preference', slot: 'routine:' + routine[1].replace(/了$/u, ''), content: text, tags: ['习惯', '日常'] };
  const milestone = /^我(?:今天|昨天|刚刚)(?:毕业了|通过了[^，。！？\n]{1,24}(?:考试|面试)|拿到了[^，。！？\n]{1,24}(?:证书|录取通知书)|去了[^，。！？\n]{1,24})[。！]?$/u.exec(text);
  if (milestone)
    return { kind: 'episode', slot: '', content: text, tags: ['经历'] };
  return null;
}
export function tokens(input) {
  let s = String(input || "")
    .normalize("NFKC")
    .toLowerCase();
  const synonyms = [
    [/找工作|求职|招聘|面试/g, " 求职 面试 "],
    [/旅游|旅行|出游|海边/g, " 旅行 海边 "],
    [/饮食|吃饭|口味|饭菜/g, " 饮食 偏好 "],
    [/讨厌|不爱|不喜欢/g, " 不喜欢 "],
    [/称呼|名字|叫什么/g, " 称呼 名字 "],
  ];
  for (const [re, to] of synonyms) s = s.replace(re, to);
  const out = s.match(/[a-z0-9]+/g) || [];
  for (const run of s.match(/[\p{Script=Han}]+/gu) || []) {
    if (run.length === 1) out.push(run);
    for (let i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
  }
  return [...new Set(out)];
}
