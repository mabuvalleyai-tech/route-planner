// 「用一句話規劃」面板：把文字送到 /api/plan，拿回驗證過的規劃後交給 RoutePlanner.applyPlan 填表、計算與分天。
(function() {
    'use strict';

    var form = document.getElementById('nlForm');
    if (!form)
        return;
    var input = document.getElementById('nlInput');
    var submit = document.getElementById('nlSubmit');
    var result = document.getElementById('nlResult');
    var answerEl = document.getElementById('nlAnswer');
    var candsEl = document.getElementById('nlCands');
    var sourcesEl = document.getElementById('nlSources');
    var errEl = document.getElementById('nlErr');
    var SUBMIT_LABEL = submit.textContent;
    var lastText = '';

    // 主程式要等路網載入才會掛上 RoutePlanner
    var ready = new Promise(function(resolve) {
        if (window.RoutePlanner)
            return resolve(window.RoutePlanner);
        document.addEventListener('routeplanner:ready', function() {
            resolve(window.RoutePlanner);
        }, { once: true });
    });

    function setBusy(busy) {
        submit.disabled = busy;
        input.disabled = busy;
        submit.textContent = busy ? '規劃中…' : SUBMIT_LABEL;
    }

    // .err 預設 display:none，要加 show 才看得到（同原站 showError）
    function showErr(msg) {
        errEl.textContent = msg;
        errEl.classList.toggle('show', !!msg);
    }

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls)
            n.className = cls;
        if (text != null)
            n.textContent = text;
        return n;
    }

    function render(data) {
        result.hidden = false;
        answerEl.textContent = data.plan.answer || '';
        candsEl.innerHTML = '';
        (data.candidates || []).forEach(function(c) {
            var b = el('button', 'nl-chip', c.name + '（' + c.area + '）');
            b.type = 'button';
            // 選一個候選就把它補進原句重新規劃，讓模型帶著上下文再判斷一次
            b.addEventListener('click', function() {
                ask(lastText + '；我指的是「' + c.name + '」（' + c.id + '）');
            });
            candsEl.appendChild(b);
        });
        sourcesEl.innerHTML = '';
        (data.sources || []).forEach(function(s) {
            var li = el('li');
            li.appendChild(document.createTextNode('[' + s.n + '] '));
            if (s.url) {
                var a = el('a', null, s.title);
                a.href = s.url;
                a.target = '_blank';
                a.rel = 'noopener';
                li.appendChild(a);
            } else {
                li.appendChild(document.createTextNode(s.title));
            }
            sourcesEl.appendChild(li);
        });
    }

    function ask(text) {
        text = text.trim();
        if (!text)
            return;
        lastText = text;
        input.value = text;
        showErr('');
        setBusy(true);
        var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        var timer = ctrl && setTimeout(function() {
            ctrl.abort();
        }, 60000);
        ready.then(function(rp) {
            return fetch('api/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, comp: rp.activeComp() }),
                signal: ctrl ? ctrl.signal : undefined
            }).then(function(res) {
                return res.json().catch(function() {
                    return {};
                }).then(function(body) {
                    if (res.status === 404)
                        throw new Error('這個網址沒有部署自然語言服務（需要部署到 Vercel），仍可在下方手動規劃。');
                    if (!res.ok)
                        throw new Error(body.error || ('HTTP ' + res.status));
                    return body;
                });
            }).then(function(data) {
                render(data);
                if (data.plan.intent === 'plan')
                    return rp.applyPlan(data.plan);
            });
        }).catch(function(err) {
            if (err && err.name === 'AbortError')
                showErr('等候 AI 回應超過 60 秒，請稍後再試。');
            else
                showErr((err && err.message) || '規劃失敗，請稍後再試。');
            if (window.console)
                console.error('[nl] 規劃失敗', err);
        }).then(function() {
            if (timer)
                clearTimeout(timer);
            setBusy(false);
        });
    }

    form.addEventListener('submit', function(ev) {
        ev.preventDefault();
        ask(input.value);
    });
    input.addEventListener('keydown', function(ev) {
        // Enter 送出、Shift+Enter 換行；輸入法選字中的 Enter 不算
        if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
            ev.preventDefault();
            ask(input.value);
        }
    });
    document.getElementById('nlChips').addEventListener('click', function(ev) {
        var chip = ev.target.closest('.nl-chip');
        if (chip)
            ask(chip.textContent);
    });
})();
