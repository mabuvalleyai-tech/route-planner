// 一次性遷移：把 index.html 內嵌的 <script id="trail-data"> 路網 JSON 拆到 data/trail-network.json，
// 並把主程式 IIFE 改成 startPlanner(DATA)，由 fetch 載入資料後再啟動。
// 用法：node scripts/extract-trail-data.mjs [index.html]
// 原站更新後要重新同步時，先把新版 index.html 覆蓋進來再跑一次。
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] || 'index.html';
let html = readFileSync(file, 'utf8');

const open = '<script id="trail-data" type="application/json">';
const a = html.indexOf(open);
if (a < 0) {
  console.log('找不到內嵌的 trail-data，可能已經遷移過，略過。');
  process.exit(0);
}
const b = html.indexOf('</script>', a);
const data = JSON.parse(html.slice(a + open.length, b));
writeFileSync('data/trail-network.json', JSON.stringify(data));
html = html.slice(0, a) + html.slice(b + '</script>'.length).replace(/^\s*\n/, '\n');

const iifeOpen = /<script>\s*\(function\(\) \{\s*"use strict";\s*var DATA = JSON\.parse\(document\.getElementById\('trail-data'\)\.textContent\);/;
if (!iifeOpen.test(html)) throw new Error('找不到主程式開頭，原站結構可能變了');
html = html.replace(iifeOpen, '<script>\n    function startPlanner(DATA) {\n        "use strict";\n');

const iifeClose = /\}\s*\)\(\);\s*<\/script>\s*<\/body>/;
if (!iifeClose.test(html)) throw new Error('找不到主程式結尾，原站結構可能變了');
html = html.replace(iifeClose, `}
    fetch('data/trail-network.json').then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }).then(startPlanner).catch(function(err) {
        var box = document.getElementById('errBox');
        if (box) box.textContent = '路網資料載入失敗：' + err.message;
        throw err;
    });
</script>
</body>`);

writeFileSync(file, html);
console.log(`nodes=${Object.keys(data.nodes).length} edges=${data.edges.length} comps=${data.comps.length}`);
