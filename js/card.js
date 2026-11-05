// 交卡：填表 → 生成一段固定格式的文字，复制到群里；tools/settle.py 按同一格式读回来。
// 草稿和上周立下的目标只存在访客自己的浏览器里。
(async function () {
  const data = await PK.ready;
  if (!data) return;
  const form = document.getElementById("card");
  const out = document.getElementById("card-out");
  const KEY = "pk-draft-v1";
  const ST = { done: "✅完成", half: "🟡一半", miss: "❌没成" };

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 隐私模式下不存 */ } },
  };
  // 去掉会打乱卡片格式的字符：分隔符、各种换行、卡头的方括号
  const clean = s => String(s || "").replace(/[｜|\r\n\u2028\u2029\u0085\v\f]+/g, " ").replace(/【/g, "[").replace(/】/g, "]").trim();
  const num = v => Math.max(0, Math.floor(Number(v) || 0));

  const thisWeek = Math.max(1, Score.currentWeek(data.start));
  const lastWeek = thisWeek - 1;
  let draft = store.get();

  // 先认人：专属链接 ?me= 优先，其次是“我的”里选过的。认出来就带出昵称和头像，已经加入、又过了第一周的，默认交周一卡
  const players = new Map((data.players || []).map(p => [p.id, p]));
  let me = players.get(new URLSearchParams(location.search).get("me")) || null;
  if (!me) { try { me = players.get(JSON.parse(localStorage.getItem("pk-me"))) || null; } catch (e) { me = null; } }

  let mode = draft.mode || (draft.pledge ? "week" : "join");
  const last = [0, 1, 2].map(i => ({ text: "", evidence: "", status: "", ...((draft.last || [])[i]) }));
  const next = [0, 1, 2].map(i => ({ text: "", evidence: "", ...((draft.next || [])[i]) }));
  // 上周立下的目标：本机草稿里有（而且是这个人的）就用，带着“我的”里勾过的进度；换了设备就从 data.json 里找
  const mine = pl => pl && pl.week === lastWeek && (!me || !pl.who || pl.who === me.id);
  let pledged = mine(draft.pledge) ? draft.pledge : null;
  if (!pledged && me) {
    const w = (data.weeks || []).find(x => x.n === lastWeek);
    const e = w && (w.entries || []).find(x => x.id === me.id);
    if (e && (e.goals || []).length) pledged = { week: lastWeek, goals: e.goals.slice(0, 3).map(g => ({ text: g.text, evidence: g.evidence || "" })) };
  }
  // 新的一周第一次打开：上周立下的目标带到“结果”里，“这周 3 件事”清空
  if (pledged && draft.lastFor !== lastWeek) {
    last.forEach((g, i) => Object.assign(g, { text: "", evidence: "", status: "" }, pledged.goals[i] || {}));
    next.forEach(g => Object.assign(g, { text: "", evidence: "" }));
    for (const k of ["wh", "wm"]) delete draft[k];
    draft.lastFor = lastWeek;
    mode = "week";
    store.set(draft);
  }
  if (me && lastWeek >= (me.fromWeek || 1)) mode = "week";
  // 开赛第一周还没有“上周”，只能交加入卡
  if (lastWeek < 1) mode = "join";

  // 头像下拉
  const sel = form.elements.avatar;
  sel.innerHTML = `<option value="">不选</option>` + (data.avatars || []).map((n, i) => `<option value="${i + 1}">${i + 1} ${PK.esc(n)}</option>`).join("");
  for (const k of ["name", "avatar", "list", "bh", "bm", "wh", "wm"]) if (draft[k] != null) form.elements[k].value = draft[k];
  function useMe(p) {
    me = p;
    if (!p) return;
    form.elements.name.value = p.name;
    form.elements.avatar.value = p.avatar ? String(p.avatar) : "";
  }
  if (me && !form.elements.name.value) useMe(me);
  document.addEventListener("pk-me", ev => { useMe(ev.detail); if (me && lastWeek >= (me.fromWeek || 1)) setMode("week"); else render(); });
  const weekBtn = form.querySelector('.seg [data-mode="week"]');
  if (lastWeek < 1) { weekBtn.disabled = true; weekBtn.title = "第 1 周结束后才交周一卡"; }

  document.getElementById("last-legend").textContent = `第 ${lastWeek} 周的结果`;
  document.getElementById("next-legend").textContent = `第 ${thisWeek} 周的 3 件事`;

  document.getElementById("last-goals").innerHTML = last.map((g, i) => `
    <div class="goal" data-i="${i}">
      <input data-k="text" maxlength="40" placeholder="第 ${i + 1} 件事（上周立下的）" value="${PK.esc(g.text)}">
      <input data-k="evidence" maxlength="40" placeholder="证据：截图、链接、谁签收的" value="${PK.esc(g.evidence)}">
      <div class="st">${Object.keys(ST).map(v => `<button type="button" data-v="${v}" class="${g.status === v ? "on" : ""}">${ST[v].slice(-2)}</button>`).join("")}</div>
    </div>`).join("");
  document.getElementById("next-goals").innerHTML = next.map((g, i) => `
    <div class="goal" data-i="${i}">
      <input data-k="text" maxlength="40" placeholder="${["例：高数第三章闭卷自测 ≥80", "例：跑步 3 次，每次 3 公里", "例：把报告初稿交给组长"][i]}" value="${PK.esc(g.text)}">
      <input data-k="evidence" maxlength="40" placeholder="${["证据：试卷照片", "证据：跑步轨迹截图", "证据：组长回复截图"][i]}" value="${PK.esc(g.evidence)}">
    </div>`).join("");

  // 时长后面显示折算的日均
  for (const [h, m] of [["bh", "bm"], ["wh", "wm"]]) {
    const span = document.createElement("span");
    span.className = "avg"; span.dataset.for = h;
    form.elements[m].nextElementSibling.after(span);
  }

  // 按 App 逐个填：手机周报里是一个个 App 的时长，在这里分别填，自动加成合计
  for (const [h, m] of [["bh", "bm"], ["wh", "wm"]]) {
    const hm = form.elements[m].closest(".hm");
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "link-btn"; btn.textContent = "按 App 逐个填，自动加起来";
    const box = document.createElement("div");
    box.className = "apps"; box.hidden = true;
    hm.after(btn, box);
    btn.addEventListener("click", () => {
      const src = h === "bh" ? form.elements.list.value : (me && me.list) || draft.list || "";
      const apps = String(src).split(/[、，,;；\s]+/).map(x => x.trim()).filter(Boolean).slice(0, 12);
      if (!apps.length) { btn.textContent = h === "bh" ? "先在上面写下娱乐清单" : "清单是空的，直接填合计"; return; }
      box.hidden = !box.hidden;
      if (box.hidden) return;
      box.innerHTML = apps.map(a => `<div class="app"><span>${PK.esc(a)}</span><input type="number" min="0" max="168" inputmode="numeric" placeholder="0" data-u="h" aria-label="${PK.esc(a)} 小时"><span>时</span><input type="number" min="0" max="59" inputmode="numeric" placeholder="0" data-u="m" aria-label="${PK.esc(a)} 分钟"><span>分</span></div>`).join("");
    });
    box.addEventListener("input", ev => {
      ev.stopPropagation();
      let t = 0, any = false;
      box.querySelectorAll("input").forEach(i => { if (i.value !== "") any = true; t += num(i.value) * (i.dataset.u === "h" ? 60 : 1); });
      form.elements[h].value = any ? Math.floor(t / 60) : "";
      form.elements[m].value = any ? t % 60 : "";
      render();
    });
  }

  function setMode(m) {
    mode = m;
    form.dataset.mode = m;
    form.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
    render();
  }

  // 两格都空返回 null，生成“（未填）”，不会被当成 0 分钟拿满分
  function minutes(h, m) {
    if (form.elements[h].value === "" && form.elements[m].value === "") return null;
    return num(form.elements[h].value) * 60 + num(form.elements[m].value);
  }
  function hm(total) { return `${Math.floor(total / 60)}小时${total % 60}分钟`; }

  function render() {
    const name = clean(form.elements.name.value) || "（昵称）";
    const av = form.elements.avatar.value;
    const L = [`【互卷周赛·${mode === "join" ? "加入卡" : "周一卡"}】`, `昵称：${name}`];
    if (av) L.push(`头像：${av}`);
    const warn = [];
    if (mode === "join") {
      if (me) warn.push(lastWeek < 1 ? `你（${me.name}）已经加入了，第 1 周结束后的周一再交“周一卡”` : `你（${me.name}）已经加入了，基线不能再改，每周一交“周一卡”就行`);
      const t = minutes("bh", "bm");
      L.push(`娱乐清单：${clean(form.elements.list.value) || "（未填）"}`);
      L.push(t === null ? "基线：（未填）" : `基线：合计 ${hm(t)}，日均 ${Math.round(t / 7)} 分钟`);
      if (t === null) warn.push("填上加入前那一整周的清单合计时长");
      if (!clean(form.elements.list.value)) warn.push("先写下你的娱乐清单");
    } else {
      const t = minutes("wh", "wm");
      L.push(t === null ? `第${lastWeek}周娱乐：（未填）` : `第${lastWeek}周娱乐：合计 ${hm(t)}，日均 ${Math.round(t / 7)} 分钟`);
      if (t === null) warn.push("填上上周的清单合计时长");
      L.push(`第${lastWeek}周结果：`);
      last.forEach((g, i) => L.push(`${i + 1}. ${ST[g.status] || "❓未选"}｜${clean(g.text) || "（未填）"}｜证据：${clean(g.evidence) || "无"}`));
      if (last.some(g => !g.status)) warn.push("上周每件事都要选完成 / 一半 / 没成");
      if (last.some(g => (g.status === "done" || g.status === "half") && !clean(g.evidence))) warn.push("完成和一半都要写证据，没证据算没成");
      if (lastWeek < 1) warn.push("开赛第一周交加入卡就行");
      if (me && lastWeek < (me.fromWeek || 1)) warn.push("你是第 " + me.fromWeek + " 周加入的，下周一才交周一卡");
    }
    L.push(`第${thisWeek}周目标：`);
    next.forEach((g, i) => L.push(`${i + 1}. ${clean(g.text) || "（未填）"}｜证据：${clean(g.evidence) || "（未填）"}`));
    L.push("（截图另发）");
    if (next.some(g => !clean(g.text) || !clean(g.evidence))) warn.push("这周 3 件事都要写清拿什么证明");
    out.textContent = L.join("\n");

    form.querySelectorAll(".avg").forEach(s => {
      const t = s.dataset.for === "bh" ? minutes("bh", "bm") : minutes("wh", "wm");
      s.textContent = t === null ? "" : `≈ 日均 ${Math.round(t / 7)} 分钟`;
    });
    let w = form.querySelector(".warn");
    if (!w) { w = document.createElement("p"); w.className = "warn"; out.after(w); }
    w.textContent = warn.length ? "还差：" + warn.join("；") : "";

    draft = { ...store.get(), mode, last, next };
    for (const k of ["name", "avatar", "list", "bh", "bm", "wh", "wm"]) draft[k] = form.elements[k].value;
    store.set(draft);
  }

  form.addEventListener("input", ev => {
    const box = ev.target.closest(".goal");
    if (box && ev.target.dataset.k) {
      const arr = box.parentElement.id === "last-goals" ? last : next;
      arr[box.dataset.i][ev.target.dataset.k] = ev.target.value;
    }
    render();
  });
  form.addEventListener("click", ev => {
    const seg = ev.target.closest(".seg button");
    if (seg) return setMode(seg.dataset.mode);
    const st = ev.target.closest(".st button");
    if (st) {
      const box = st.closest(".goal");
      last[box.dataset.i].status = st.dataset.v;
      box.querySelectorAll(".st button").forEach(b => b.classList.toggle("on", b === st));
      render();
    }
  });

  document.getElementById("copy").addEventListener("click", async ev => {
    const btn = ev.currentTarget; // await 之后 currentTarget 会变成 null，先存下来
    const text = out.textContent;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const r = document.createRange(); r.selectNodeContents(out);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
    }
    // 记下这周立的目标，下周一自动带出来；这周在“我的”里勾过的进度按序号留着
    const cur = store.get();
    const prev = cur.pledge && cur.pledge.week === thisWeek && (!me || !cur.pledge.who || cur.pledge.who === me.id) ? cur.pledge.goals || [] : [];
    draft = { ...cur, pledge: { week: thisWeek, who: me ? me.id : undefined,
      goals: next.map((g, i) => ({ text: clean(g.text), evidence: clean(g.evidence), ...(prev[i] && prev[i].status ? { status: prev[i].status } : {}) })) } };
    store.set(draft);
    document.dispatchEvent(new CustomEvent("pk-pledge"));
    btn.textContent = ok ? "已复制，去群里粘贴" : "已选中，手动复制一下";
    setTimeout(() => { btn.textContent = "复制这张卡"; }, 2500);
    const steps = document.getElementById("card-next");
    steps.hidden = false;
    steps.innerHTML = `<b>还差两步</b><ol><li>打开群，粘贴刚才复制的卡</li><li>再发截图：${mode === "join" ? "加入前那一整周" : `第 ${lastWeek} 周`}的屏幕使用时间周报（要看得到日期和排前 5 的 App）${mode === "week" ? "，加上每件事的证据" : ""}</li></ol>`;
  });

  setMode(mode);
})();
