// 給 Claude 的系統提示與輸出格式。系統提示固定不變（放在快取前綴），檢索結果放在使用者訊息。

export const SYSTEM_PROMPT = `你是「台灣山徑路線規劃」網站的助理，使用繁體中文回答。
使用者會用一句話描述想走的登山路線或提出登山相關問題。你要把它轉成網站可以直接執行的規劃，並視需要回答問題。

網站的路線模型：
- 一條路線 = 起點 start + 依序走訪的通過點 vias；vias 的最後一個就是終點。
- 起點也可以出現在 vias 的最後，代表原路或繞一圈回到起點。
- 每個點都必須是「候選節點」清單裡的節點 ID（例如 n264），而且同一條路線所有點都必須在同一個區域（同一個 c 編號）。不同區域之間沒有路。
- 網站會自己找最短路徑，所以 vias 只需列出使用者在意的關鍵點（登山口、山頭、山屋、湖泊），不用列出沿途每個岔路。
- mode：使用者要「最快／時間最短」用 time，要「最短距離」用 dist，沒說就用 time。
- days 與 overnight：使用者有說天數（例如兩天一夜＝2）或要住山屋時，days 填天數，overnight 依序填每晚住宿的節點 ID（必須是路線上的點，通常也要放進 vias）。單日或沒提就 days=1、overnight=[]。

判斷 intent：
- plan：能確定起點與至少一個通過點。若使用者只說要爬某座山，請參考「參考資料」中的行程範本選常用登山口，並在 answer 說明你的假設。
- question：純知識問題（裝備、高山症、天候、申請…），start 填空字串、vias 為空。
- clarify：地名找不到、有多個可能、或跨區域無法連通。candidates 放可供使用者挑選的節點 ID（最多 6 個），answer 說明需要釐清什麼。

answer 用 2–5 句繁體中文，說明你規劃的路線與假設，或回答問題；引用參考資料時在句末標註 [1]、[2]… 並把編號放進 citations。只根據提供的資料回答，資料沒有的就直說不確定，不要編造時間、距離或申請規定。`;

export const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'start', 'vias', 'mode', 'days', 'overnight', 'candidates', 'answer', 'citations'],
  properties: {
    intent: { type: 'string', enum: ['plan', 'question', 'clarify'] },
    start: { type: 'string', description: '起點節點 ID，沒有就空字串' },
    vias: { type: 'array', items: { type: 'string' }, description: '依序走訪的節點 ID，最後一個為終點' },
    mode: { type: 'string', enum: ['time', 'dist'] },
    days: { type: 'integer' },
    overnight: { type: 'array', items: { type: 'string' }, description: '依序每晚住宿的節點 ID' },
    candidates: { type: 'array', items: { type: 'string' }, description: 'clarify 時讓使用者挑選的節點 ID' },
    answer: { type: 'string' },
    citations: { type: 'array', items: { type: 'integer' }, description: '引用的參考資料編號' },
  },
};

// 把檢索結果排成給模型讀的上下文。節點列成一行一個，文件依序編號供引用。
export function buildUserMessage(text, { nodes, docs }, comps) {
  const nodeLines = nodes.map(({ chunk }) => `- ${chunk.nodeId}｜${chunk.text}`).join('\n');
  const docLines = docs
    .map(({ chunk }, i) => {
      let extra = '';
      if (chunk.type === 'itinerary') extra = `\n  （範本節點：stops=${chunk.stops.join(',')}；overnight=${chunk.overnight.join(',') || '無'}）`;
      return `[${i + 1}] ${chunk.title}\n${chunk.text}${extra}`;
    })
    .join('\n\n');
  const compLine = comps.map((c, i) => `c${i} ${c.name}`).join('、');
  return `<候選節點>\n${nodeLines || '（沒有找到相符的地點）'}\n</候選節點>\n\n<參考資料>\n${docLines || '（無）'}\n</參考資料>\n\n<所有區域>\n${compLine}\n</所有區域>\n\n<使用者輸入>\n${text}\n</使用者輸入>`;
}
