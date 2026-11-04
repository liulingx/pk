// 读 data.json，按 score.js 的规则算分并渲染。数据每周一晚上由 tools/settle.py 更新。
window.PK = (function () {
  const $ = id => document.getElementById(id);
  // 按北京时间显示日期，不跟访客的时区走
  const md = d => { const b = new Date(d.getTime() + 8 * 3600000); return `${b.getUTCMonth() + 1}月${b.getUTCDate()}日`; };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const STAMP = { done: "完成", half: "一半", miss: "没成" };

  // 头像底色：8 种都压得住白字
  const COLORS = ["#ff7a3d", "#3a7bd5", "#e2556b", "#7b5cd6", "#1f9a8a", "#d6457a", "#4a8f3a", "#c0700a"];
  function colorOf(p) {
    if (p.avatar) return COLORS[(Number(p.avatar) - 1) % COLORS.length];
    let h = 0; for (const c of String(p.id || p.name)) h = (h * 31 + c.charCodeAt(0)) % 997; return COLORS[h % COLORS.length];
  }
  // 有 img/aN.png 就用图，没有就显示昵称首字
  function avatarHTML(p) {
    const img = p.avatar ? `<img src="img/a${Number(p.avatar)}.png" alt="" loading="lazy" onerror="this.remove()">` : "";
    return `<span class="av" style="--c:${colorOf(p)}"><span>${esc([...(p.name || "?")][0])}</span>${img}</span>`;
  }

  function countUp(el, to, decimals) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !to) { el.textContent = to.toFixed(decimals); return; }
    const t0 = performance.now(), dur = 1600;
    (function tick(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * e).toFixed(decimals);
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  const ready = (async function () {
    let data;
    try {
      data = await (await fetch("data.json", { cache: "no-store" })).json();
    } catch (e) {
      $("status").textContent = "数据没载入，刷新试试";
      return null;
    }
    const players = data.players || [];
    const weeks = (data.weeks || []).slice().sort((a, b) => a.n - b.n);
    const SW = data.seasonWeeks || 4;

    $("title").textContent = data.title;
    $("tagline").textContent = data.tagline;
    $("join").textContent = data.join;

    // 状态条
    const now = Score.currentWeek(data.start);
    const startDate = Score.weekRange(data.start, 1).from;
    if (now === 0) {
      const days = Math.ceil((startDate.getTime() - Date.now()) / 86400000);
      $("status").textContent = `${md(startDate)}开赛 · 还有 ${days} 天`;
    } else {
      const r = Score.weekRange(data.start, now);
      $("status").textContent = `第 ${Score.seasonOf(now, SW)} 赛季 · 第 ${now} 周 · ${md(r.from)}–${md(r.to)}`;
    }

    const settled = weeks.filter(w => w.settled).sort((a, b) => b.n - a.n);
    const latest = settled[0];
    const latestRows = latest ? Score.rankWeek(players, latest) : [];

    // 天亮程度：上一周全员平均分；还没开赛就停在快天亮
    const rise = latestRows.length ? latestRows.reduce((s, r) => s + r.total, 0) / latestRows.length / 100 : 0.14;
    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.documentElement.style.setProperty("--rise", Math.max(0.08, Math.min(1, rise)).toFixed(3))));

    // 首屏数字：开赛以来的累计
    const stats = $("stats");
    let items;
    if (settled.length) {
      let saved = 0, done = 0;
      for (const w of settled) { const s = Score.weekStats(players, w); saved += s.savedMinutes; done += s.done; }
      const hours = saved / 60;
      items = [[hours, hours < 10 ? 1 : 0, "小时", "大家一起少刷了"], [done, 0, "件", "说到做到的事"], [players.length, 0, "人", "正在一起卷"]];
    } else {
      const days = Math.max(0, Math.ceil((startDate.getTime() - Date.now()) / 86400000));
      items = [[days, 0, "天", "后开赛"], [3, 0, "件", "每周立下的事"], [SW, 0, "周", "一个赛季"]];
    }
    stats.innerHTML = items.map(([, , unit, label]) => `<div><dd><span>0</span><small>${unit}</small></dd><dt>${label}</dt></div>`).join("");
    [...stats.querySelectorAll("dd span")].forEach((el, i) => countUp(el, items[i][0], items[i][1]));

    // 周榜
    if (!latest || !latestRows.length) {
      const first = Score.weekRange(data.start, 2).from;
      const before = now === 0 ? `${md(startDate)}交加入卡，立下第 1 周的 3 件事。` : "在那之前，先把这周的 3 件事做成。";
      $("board").innerHTML = `<div class="empty"><b>${md(first)}</b>第一张榜那天晚上出。<br>${before}</div>`;
    } else {
      const r = Score.weekRange(data.start, latest.n);
      $("board-title").textContent = `第 ${latest.n} 周榜`;
      $("board-sub").textContent = `${md(r.from)}–${md(r.to)} · ${latestRows.length} 人 · 点开看每个人的三件事`;
      $("board").innerHTML = latestRows.map((row, i) => laneHTML(row, i, latest.n)).join("");
      const go = () => $("board").querySelectorAll(".lane").forEach(l => {
        const t = Number(l.dataset.total);
        l.querySelector(".trail").style.width = t + "%";
        l.querySelector(".tip").style.left = t + "%";
      });
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { go(); io.disconnect(); } }, { threshold: 0.2 });
        io.observe($("board"));
      } else go();
    }

    // 赛季榜
    if (latest) {
      const season = Score.seasonOf(latest.n, SW);
      const rows = Score.seasonRank(players, weeks, season, SW);
      if (rows.length) {
        $("season-section").hidden = false;
        const done = settled.filter(w => Score.seasonOf(w.n, SW) === season).length;
        $("season-title").textContent = `第 ${season} 赛季榜 · 已赛 ${done}/${SW} 周`;
        $("season").innerHTML = rows.map((x, i) => `<li><span class="rk">${i + 1}</span>${avatarHTML(x.player)}<span class="nm">${esc(x.name)}<small>交了 ${x.weeks} 周</small></span><span class="avg">${x.avg}<small>平均</small></span></li>`).join("");
        let best = null;
        for (const r of latestRows) {
          const d = Score.dropRate(r.player.baseline, r.entry.screen);
          if (d !== null && d > 0 && (!best || d > best.d)) best = { r, d };
        }
        if (best) {
          $("improver").hidden = false;
          $("improver").innerHTML = `第 ${latest.n} 周最大进步：<b>${esc(best.r.name)}</b>，手机娱乐日均从 ${best.r.player.baseline} 分钟降到 ${best.r.entry.screen} 分钟，少了 <b>${Math.round(best.d * 100)}%</b>。`;
        }
      }
    }

    // 这周大家在做的事
    const pledgeWeek = weeks.filter(w => !w.settled && (w.entries || []).some(e => (e.goals || []).length)).sort((a, b) => b.n - a.n)[0];
    if (pledgeWeek) {
      const P = Object.fromEntries(players.map(p => [p.id, p]));
      const cards = pledgeWeek.entries.filter(e => P[e.id] && (e.goals || []).length).map(e => `<article class="pledge">
        <header>${avatarHTML(P[e.id])}<span>${esc(P[e.id].name)}</span></header>
        <ol>${e.goals.slice(0, 3).map(g => `<li>${esc(g.text)}<small>证据：${esc(g.evidence || "—")}</small></li>`).join("")}</ol>
      </article>`);
      if (cards.length) {
        $("pledge-section").hidden = false;
        $("pledge-title").textContent = `第 ${pledgeWeek.n} 周，大家在做的事`;
        $("pledges").innerHTML = cards.join("");
      }
    }

    // 战报图
    $("board").addEventListener("click", async ev => {
      const btn = ev.target.closest("[data-poster]");
      if (!btn) return;
      btn.disabled = true;
      const row = latestRows.find(r => r.id === btn.dataset.poster);
      const url = await Poster.make({ data, week: latest.n, row, rank: latestRows.indexOf(row) + 1, of: latestRows.length, color: colorOf(row.player) });
      btn.disabled = false;
      $("poster-img").src = url;
      $("poster-dl").href = url;
      $("poster-dl").download = `互卷周赛-第${latest.n}周-${row.name}.png`;
      $("poster-dialog").showModal();
    });
    document.querySelector("[data-close]").addEventListener("click", () => $("poster-dialog").close());

    return data;

    function laneHTML(row, i, n) {
      const e = row.entry, p = row.player;
      const share = row.total ? row.screen / row.total * 100 : 0;
      const goals = (e.goals || []).slice(0, 3).map(g => {
        const st = STAMP[g.status] ? g.status : "miss";
        return `<li><span class="stamp ${st}">${STAMP[st]}</span><span>${esc(g.text)}<small>证据：${esc(g.evidence || "没交")}</small></span></li>`;
      }).join("");
      const screenLine = typeof e.screen === "number" ? `日均 ${e.screen} 分钟 · 基线 ${p.baseline ?? "—"}` : "这周没交截图";
      return `<details class="lane${i === 0 ? " first" : ""}" data-total="${row.total}">
        <summary>
          <span class="rk">${i + 1}</span>${avatarHTML(p)}
          <span class="nm">${esc(row.name)}<small>少刷 ${row.screen} · 做成 ${row.goals}</small></span>
          <span class="sc">${row.total}</span>
          <span class="run" aria-hidden="true"><span class="trail"><i class="ts" style="flex-basis:${share}%"></i><i class="tg" style="flex-basis:${100 - share}%"></i></span><span class="tip"></span></span>
        </summary>
        <div class="lane-detail">
          <div>
            <p class="part"><b class="s">${row.screen}/40</b>少刷 · ${screenLine}</p>
            <p class="part"><b class="g">${row.goals}/60</b>做成</p>
            <ul class="goal-list">${goals || "<li>这周没交结果</li>"}</ul>
          </div>
          <div>
            <h4>手机娱乐日均（分钟）</h4>
            ${sparkHTML(p, n)}
            <button type="button" class="btn btn-sun small" data-poster="${esc(row.id)}">生成战报图</button>
          </div>
        </div>
      </details>`;
    }

    function sparkHTML(p, upto) {
      const pts = settled.filter(w => w.n <= upto).sort((a, b) => a.n - b.n)
        .map(w => ({ n: w.n, v: ((w.entries || []).find(e => e.id === p.id) || {}).screen }))
        .filter(x => typeof x.v === "number");
      if (!pts.length || typeof p.baseline !== "number") return "";
      const W = 300, H = 90, L = 8, R = 8, T = 16, B = 18;
      const max = Math.max(p.baseline, ...pts.map(x => x.v)) * 1.1 || 1;
      const y = v => T + (1 - v / max) * (H - T - B);
      const x = i => pts.length === 1 ? W / 2 : L + i * (W - L - R) / (pts.length - 1);
      const line = pts.map((q, i) => `${x(i).toFixed(1)},${y(q.v).toFixed(1)}`).join(" ");
      return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="基线 ${p.baseline} 分钟，最近 ${pts[pts.length - 1].v} 分钟">
        <line class="base" x1="0" x2="${W}" y1="${y(p.baseline)}" y2="${y(p.baseline)}"/>
        <text x="0" y="${y(p.baseline) - 4}">基线 ${p.baseline}</text>
        ${pts.length > 1 ? `<polyline class="ln" points="${line}"/>` : ""}
        ${pts.map((q, i) => `<circle class="pt" cx="${x(i)}" cy="${y(q.v)}" r="4"/>` +
          (i === 0 || i === pts.length - 1 ? `<text x="${x(i)}" y="${H - 3}" text-anchor="${pts.length === 1 ? "middle" : i === 0 ? "start" : "end"}">第${q.n}周 ${q.v}</text>` : "")).join("")}
      </svg>`;
    }
  })();

  return { ready, md, esc, avatarHTML, colorOf };
})();
