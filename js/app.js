// 读 data.json，按 score.js 的规则算分并渲染。数据每周日手动更新。
(async function () {
  const $ = id => document.getElementById(id);
  // 按北京时间显示日期，不跟访客的时区走
  const md = d => { const b = new Date(d.getTime() + 8 * 3600000); return `${b.getUTCMonth() + 1}月${b.getUTCDate()}日`; };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const STATUS = { done: ["完成", "done"], half: ["一半", "half"], miss: ["没成", "miss"] };

  let data;
  try {
    data = await (await fetch("data.json", { cache: "no-store" })).json();
  } catch (e) {
    $("status").textContent = "数据没载入，刷新试试";
    return;
  }

  $("title").textContent = data.title;
  $("tagline").textContent = data.tagline;
  $("join").textContent = data.join;

  const now = Score.currentWeek(data.start);
  if (now < 0) {
    $("status").textContent = `${md(Score.weekRange(data.start, 0).from)}开赛 · 第 0 周是基线周`;
  } else {
    const r = Score.weekRange(data.start, now);
    const label = now === 0 ? "第 0 周 · 基线周" : `第 ${now} 周`;
    $("status").textContent = `${label} · ${md(r.from)}至${md(r.to)} · ${data.deadline}`;
  }

  const ranked = (data.weeks || [])
    .map(w => ({ week: w, rows: Score.rankWeek(data.players || [], w) }))
    .filter(x => x.rows.length)
    .sort((a, b) => b.week.n - a.week.n);

  if (!ranked.length) {
    const first = Score.weekRange(data.start, 1);
    $("board").innerHTML = `<p class="empty">第 1 周从${md(first.from)}开始计分，第一张榜${md(first.to)}晚上出。<br>在那之前的一周用来记录每个人的基线。</p>`;
  } else {
    const latest = ranked[0];
    const r = Score.weekRange(data.start, latest.week.n);
    $("board-title").textContent = `第 ${latest.week.n} 周榜 · ${md(r.from)}至${md(r.to)}`;
    $("board").innerHTML = latest.rows.map((row, i) => renderRow(row, i)).join("");
  }

  if (ranked.length > 1) {
    $("history-section").hidden = false;
    $("history").innerHTML = ranked.slice(1).map(({ week, rows }) =>
      `<li><span>第 ${week.n} 周</span><span>${rows.map(r => `${esc(r.name)} ${r.total}`).join(" · ")}</span></li>`
    ).join("");
  }

  function renderRow(row, i) {
    const p = data.players.find(p => p.id === row.id) || {};
    const e = row.entry;
    const goals = (e.goals || []).map(g => {
      const [txt, cls] = STATUS[g.status] || STATUS.miss;
      return `<li><span class="tag ${cls}">${txt}</span><span>${esc(g.text)}<small>证据：${esc(g.evidence || "没交")}</small></span></li>`;
    }).join("");
    const screenLine = typeof e.screen === "number"
      ? `日均娱乐 ${e.screen} 分钟，基线 ${p.baseline ?? "—"} 分钟`
      : "这周没交屏幕截图";
    return `<details class="row">
      <summary>
        <span class="rank">${i + 1}</span>
        <span class="who">${esc(row.name)}</span>
        <span class="bar" aria-hidden="true"><i class="s" style="width:${row.screen}%"></i><i class="g" style="width:${row.goals}%"></i></span>
        <span class="total">${row.total}</span>
      </summary>
      <div class="detail">
        <p><b>少刷 ${row.screen}/40</b> · ${screenLine}</p>
        <p><b>做成 ${row.goals}/60</b></p>
        <ul class="goal-list">${goals || "<li>这周没交目标</li>"}</ul>
      </div>
    </details>`;
  }
})();
