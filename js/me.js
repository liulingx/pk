// “我的”：选一次自己是谁（存在本机浏览器，或用 ?me=编号 的专属链接），
// 之后打开就看到：离交卡还有多久、这周的 3 件事（可以随手勾进度）、上周的分数和战报图。
// 这里勾的进度和证据存进交卡草稿，下周一的周一卡会自动带出来。
(async function () {
  const data = await PK.ready;
  if (!data) return;
  const $ = id => document.getElementById(id);
  const box = $("me");
  const ME = "pk-me", DRAFT = "pk-draft-v1";
  const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 隐私模式下不存 */ } };
  const ST = { done: "完成", half: "一半", miss: "没成" };

  const players = data.players || [];
  const P = Object.fromEntries(players.map(p => [p.id, p]));
  const isPlayer = id => typeof id === "string" && Object.prototype.hasOwnProperty.call(P, id);
  const weeks = (data.weeks || []).slice().sort((a, b) => a.n - b.n);
  const now = Score.currentWeek(data.start);
  const thisWeek = Math.max(1, now);

  // 专属链接 ?me=编号 优先，存下来以后不用再选
  const qs = new URLSearchParams(location.search).get("me");
  if (isPlayer(qs)) save(ME, qs);
  let me = load(ME);
  if (!isPlayer(me)) me = null;

  // 下一个交卡截止：周一 12:00（北京时间）
  function deadline() {
    const t = Date.now(), b = new Date(t + 8 * 3600000);
    const day = b.getUTCDay(), mins = b.getUTCHours() * 60 + b.getUTCMinutes();
    let add = (8 - day) % 7;
    if (add === 0 && mins >= 720) add = 7;
    const d = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + add, 12) - 8 * 3600000);
    return { at: d, left: d.getTime() - t, today: add === 0 };
  }
  function leftText(ms) {
    const h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
    return d >= 1 ? `${d} 天 ${h % 24} 小时` : h >= 1 ? `${h} 小时 ${Math.floor(ms / 60000) % 60} 分` : `${Math.max(1, Math.floor(ms / 60000))} 分钟`;
  }

  // 这周立下的 3 件事：本机草稿里有就用（带着勾过的进度），没有就用 data.json 里结算进来的
  function pledge() {
    const draft = load(DRAFT) || {};
    const pl = draft.pledge;
    if (pl && pl.week === thisWeek && (!pl.who || pl.who === me) && (pl.goals || []).some(g => g.text)) return pl;
    const w = weeks.find(x => x.n === thisWeek);
    const e = w && (w.entries || []).find(x => x.id === me);
    if (!e || !(e.goals || []).length) return null;
    return { week: thisWeek, goals: e.goals.slice(0, 3).map(g => ({ text: g.text, evidence: g.evidence || "" })) };
  }
  function savePledge(pl) {
    const draft = load(DRAFT) || {};
    draft.pledge = { ...pl, who: me };
    save(DRAFT, draft);
  }

  function latestRow() {
    const settled = weeks.filter(w => w.settled).sort((a, b) => b.n - a.n);
    for (const w of settled) {
      const rows = Score.rankWeek(players, w);
      const i = rows.findIndex(r => r.id === me);
      if (i >= 0) return { week: w.n, row: rows[i], rank: i + 1, of: rows.length };
    }
    return null;
  }

  function dueHTML() {
    const dl = deadline();
    return `${dl.today ? "今天 12:00 前交卡" : "离下次交卡"} · 还有 <b>${leftText(dl.left)}</b><small>${PK.md(dl.at)}（周一）12:00 截止</small>`;
  }
  // 只刷新倒计时那一行，不重画整块（免得打断正在选的下拉框）
  function tick() {
    const el = $("me-due");
    if (!el) return;
    el.innerHTML = dueHTML();
    el.classList.toggle("hot", deadline().today);
  }

  function render() {
    const due = `<p class="me-due${deadline().today ? " hot" : ""}" id="me-due">${dueHTML()}</p>`;
    const wx = /MicroMessenger/i.test(navigator.userAgent)
      ? `<p class="me-tip">你是在微信里打开的。草稿只存在微信里，换到别的浏览器就看不到，用下面的专属链接打开就能认出你。</p>` : "";

    if (!players.length) {
      box.innerHTML = `${due}<p class="me-empty">还没有人加入。开赛后，这里是你自己的一页：倒计时、这周的 3 件事、你的分数和战报图。<br>第一次来，先到下面<a href="#card-section">交加入卡</a>。</p>${wx}`;
      return;
    }

    const pick = `<label class="me-pick">我是<select id="me-sel"><option value="">选一下</option>${players.map(p => `<option value="${PK.esc(p.id)}"${p.id === me ? " selected" : ""}>${PK.esc(p.name)}</option>`).join("")}<option value="__new">我还没加入</option></select></label>`;
    if (!me) {
      box.innerHTML = `${pick}${due}<p class="me-empty">选一次就行，以后打开直接看到你自己的进度。还没加入的，到下面<a href="#card-section">交加入卡</a>。</p>${wx}`;
      return bind();
    }

    const p = P[me];
    const pl = pledge();
    let goals = "";
    if (pl) {
      const pts = pl.goals.reduce((s, g) => s + (Score.GOAL_POINTS[g.status] || 0), 0);
      goals = `<div class="me-goals">
        <h3>第 ${thisWeek} 周的 3 件事<small>随手勾进度，下周一交卡会自动带上</small></h3>
        ${pl.goals.map((g, i) => `<div class="me-goal" data-i="${i}">
          <p>${PK.esc(g.text || "（没写）")}<small>证据：${PK.esc(g.evidence || "—")}</small></p>
          <div class="st">${Object.keys(ST).map(v => `<button type="button" data-v="${v}" class="${g.status === v ? "on" : ""}">${ST[v]}</button>`).join("")}</div>
        </div>`).join("")}
        <p class="me-proj">按现在勾的，“做成”这周能拿 <b>${pts}</b>/60</p>
      </div>`;
    } else {
      goals = `<p class="me-empty">这周的 3 件事还没立。周一交卡时写下，这里就能勾进度。</p>`;
    }

    const last = latestRow();
    const score = last ? `<div class="me-score">
        <div><span class="big">${last.row.total}</span><small>第 ${last.week} 周总分</small></div>
        <div><span class="big">${last.rank}<em>/${last.of}</em></span><small>名次</small></div>
        <div><span class="big s">${last.row.screen}</span><small>少刷 /40</small></div>
        <div><span class="big g">${last.row.goals}</span><small>做成 /60</small></div>
      </div>
      <button type="button" class="btn btn-sun small" id="me-poster">生成我的战报图</button>` : "";

    const link = `${location.origin}${location.pathname}?me=${encodeURIComponent(me)}`;
    box.innerHTML = `${pick}
      <div class="me-head">${PK.avatarHTML(p)}<div><b>${PK.esc(p.name)}</b><small>第 ${p.fromWeek || 1} 周加入 · 基线日均 ${p.baseline ?? "—"} 分钟</small></div></div>
      ${due}${score}${goals}
      <div class="me-link"><span>你的专属链接（换手机、换浏览器用）</span><code>${PK.esc(link)}</code><button type="button" class="btn btn-ghost-d small" id="me-copy">复制</button></div>
      ${wx}`;
    bind();

    box.querySelectorAll(".me-goal .st button").forEach(b => b.addEventListener("click", () => {
      const i = Number(b.closest(".me-goal").dataset.i);
      const cur = pledge();
      if (!cur) return render();
      cur.goals[i].status = cur.goals[i].status === b.dataset.v ? "" : b.dataset.v;
      savePledge(cur);
      render();
    }));
    const pb = $("me-poster");
    if (pb) pb.addEventListener("click", async () => {
      pb.disabled = true;
      const url = await Poster.make({ data, week: last.week, row: last.row, rank: last.rank, of: last.of, color: PK.colorOf(p) });
      pb.disabled = false;
      $("poster-img").src = url;
      $("poster-dl").href = url;
      $("poster-dl").download = `互卷周赛-第${last.week}周-${p.name}.png`;
      $("poster-dialog").showModal();
    });
    $("me-copy").addEventListener("click", async ev => {
      const btn = ev.currentTarget;
      let ok = false;
      try { await navigator.clipboard.writeText(link); ok = true; } catch (e) { ok = false; }
      btn.textContent = ok ? "已复制" : "长按上面的链接复制";
    });
  }

  function bind() {
    const sel = $("me-sel");
    if (!sel) return;
    sel.addEventListener("change", () => {
      if (sel.value === "__new") { location.hash = "card-section"; sel.value = me || ""; return; }
      me = sel.value || null;
      save(ME, me);
      document.dispatchEvent(new CustomEvent("pk-me", { detail: me ? P[me] : null }));
      render();
    });
  }

  render();
  setInterval(tick, 60000);
  // 交卡区复制了新的一周目标，这里跟着刷新
  document.addEventListener("pk-pledge", render);
})();

// 底部导航：滚到哪一块就点亮哪一个
(function () {
  const links = [...document.querySelectorAll(".tabbar a")];
  if (!("IntersectionObserver" in window) || !links.length) return;
  const map = new Map(links.map(a => [document.querySelector(a.getAttribute("href")), a]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(a => a.classList.toggle("on", a === map.get(e.target)));
  }), { rootMargin: "-45% 0px -50% 0px" });
  map.forEach((a, sec) => sec && io.observe(sec));
})();
