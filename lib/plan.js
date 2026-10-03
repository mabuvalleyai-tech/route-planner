// 驗證並整理模型回傳的規劃，確保前端拿到的一定是路網裡存在、而且可以連通的點。
export function sanitizePlan(raw, nodes, allowedIds) {
  const exists = (id) => typeof id === 'string' && Object.hasOwn(nodes, id);
  const plan = {
    intent: ['plan', 'question', 'clarify'].includes(raw?.intent) ? raw.intent : 'clarify',
    start: exists(raw?.start) ? raw.start : '',
    vias: [],
    mode: raw?.mode === 'dist' ? 'dist' : 'time',
    days: Number.isInteger(raw?.days) && raw.days >= 1 && raw.days <= 14 ? raw.days : 1,
    overnight: [],
    candidates: [],
    answer: typeof raw?.answer === 'string' ? raw.answer.slice(0, 2000) : '',
    citations: Array.isArray(raw?.citations) ? raw.citations.filter(Number.isInteger) : [],
    comp: null,
  };
  const warn = (msg) => {
    plan.intent = 'clarify';
    plan.answer = plan.answer ? `${plan.answer}\n（${msg}）` : msg;
  };

  // 只接受這次檢索給過的候選節點，避免模型憑空寫出別的 ID
  const allowed = (id) => exists(id) && (!allowedIds || allowedIds.has(id));
  plan.candidates = (raw?.candidates || []).filter(allowed).slice(0, 6);

  if (plan.intent === 'plan') {
    if (!allowed(raw.start)) {
      warn('沒有找到明確的起點，請再描述一次或從下方候選選擇。');
      plan.start = '';
    }
    // 同一點不重複勾選（網站的勾選清單一點只能勾一次）；起點例外可放在最後代表回到起點
    const seen = new Set();
    for (const id of raw.vias || []) {
      if (!allowed(id) || seen.has(id)) continue;
      seen.add(id);
      plan.vias.push(id);
    }
    if (plan.start && plan.vias.length && plan.vias.every((id) => id === plan.start)) plan.vias = [];
    if (plan.intent === 'plan' && plan.vias.length === 0) warn('至少需要一個通過點或終點。');
    const comps = new Set([plan.start, ...plan.vias].filter(Boolean).map((id) => nodes[id].comp));
    if (comps.size > 1) {
      warn('這些地點分屬不同區域，路網之間沒有路相連，無法排成同一條路線。');
      plan.candidates = [...new Set([...plan.candidates, plan.start, ...plan.vias].filter(Boolean))].slice(0, 6);
      plan.vias = [];
    }
    if (plan.intent === 'plan') {
      plan.comp = nodes[plan.start].comp;
      plan.overnight = (raw.overnight || []).filter((id) => exists(id) && nodes[id].comp === plan.comp);
    }
  }
  if (plan.intent !== 'plan') {
    plan.vias = [];
    plan.overnight = [];
    if (plan.intent === 'question') plan.start = '';
  }
  return plan;
}
