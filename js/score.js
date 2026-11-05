// 计分规则，网页、tools/test-score.js 和 tools/settle.py 的口径以这里为准（settle.py 只录数据、不算分）。
// 屏幕 40 分：比自己基线的日均娱乐时长，每降 1% 得 1 分，降 40% 封顶；日均 30 分钟以内直接满分。
// 目标 60 分：每周 3 个有证据的目标，完成 20、完成一半以上 10、没完成或没交证据 0。
// 第 1 周从 start 那天（周一）开始；4 周一个赛季。
(function (root) {
  const SCREEN_MAX = 40;
  const SCREEN_FLOOR_MIN = 30;
  const GOAL_POINTS = { done: 20, half: 10, miss: 0 };
  const GOALS_PER_WEEK = 3;
  const DAY = 86400000;

  function screenScore(baseline, week) {
    if (typeof week !== "number" || week < 0) return 0;
    if (week <= SCREEN_FLOOR_MIN) return SCREEN_MAX;
    if (typeof baseline !== "number" || baseline <= 0) return 0;
    const drop = (baseline - week) / baseline;
    return Math.max(0, Math.min(SCREEN_MAX, Math.round(drop * 100)));
  }

  function goalsScore(goals) {
    if (!Array.isArray(goals)) return 0;
    return goals.slice(0, GOALS_PER_WEEK)
      .reduce((sum, g) => sum + (GOAL_POINTS[g && g.status] || 0), 0);
  }

  function entryScore(baseline, entry) {
    const screen = screenScore(baseline, entry.screen);
    const goals = goalsScore(entry.goals);
    return { screen, goals, total: screen + goals };
  }

  // 第 n 周（n ≥ 1）的起止日期，按北京时间零点
  function weekRange(start, n) {
    const from = new Date(new Date(start + "T00:00:00+08:00").getTime() + 7 * (n - 1) * DAY);
    return { from, to: new Date(from.getTime() + 6 * DAY) };
  }

  // 现在是第几周；开赛前返回 0
  function currentWeek(start, now) {
    const diff = (now || new Date()).getTime() - new Date(start + "T00:00:00+08:00").getTime();
    return diff < 0 ? 0 : Math.floor(diff / (7 * DAY)) + 1;
  }

  function seasonOf(n, len) { return Math.ceil(n / (len || 4)); }

  function byId(players) { return Object.fromEntries(players.map(p => [p.id, p])); }

  // 结算时把当时的基线存进 entry（base），以后改基线不会追溯改历史分
  function baseOf(entry, player) { return typeof entry.base === "number" ? entry.base : player.baseline; }
  function submitted(entry) {
    return typeof entry.screen === "number" || (entry.goals || []).some(g => g && g.status);
  }

  // 只排已结算的周；加入前的周不算
  function rankWeek(players, week) {
    if (!week || !week.settled) return [];
    const P = byId(players);
    return (week.entries || [])
      .filter(e => P[e.id] && week.n >= (P[e.id].fromWeek || 1))
      .map(e => ({ id: e.id, name: P[e.id].name, player: P[e.id], entry: e, base: baseOf(e, P[e.id]), ...entryScore(baseOf(e, P[e.id]), e) }))
      .sort((a, b) => b.total - a.total || b.goals - a.goals);
  }

  // 赛季榜：加入后每个已结算的周都算进平均，没交的周记 0；
  // 赛季里已结算满 2 周后，至少真正交过 2 周才上榜
  function seasonRank(players, weeks, season, len) {
    const settled = weeks.filter(w => w.settled && seasonOf(w.n, len) === season);
    const need = Math.min(2, settled.length);
    if (!need) return [];
    return players.map(p => {
      const mine = settled.filter(w => w.n >= (p.fromWeek || 1));
      const totals = [];
      let sent = 0;
      for (const w of mine) {
        const row = rankWeek(players, w).find(r => r.id === p.id);
        totals.push(row ? row.total : 0);
        if (row && submitted(row.entry)) sent++;
      }
      const avg = totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length * 10) / 10 : 0;
      return { id: p.id, name: p.name, player: p, weeks: sent, avg };
    })
      .filter(x => x.weeks >= need)
      .sort((a, b) => b.avg - a.avg || b.weeks - a.weeks);
  }

  // 一周的合计：大家一共少刷了多少分钟、做成了几件事
  function weekStats(players, week) {
    const rows = rankWeek(players, week);
    let saved = 0, done = 0, half = 0;
    for (const r of rows) {
      const b = r.base, s = r.entry.screen;
      if (typeof b === "number" && typeof s === "number") saved += Math.max(0, b - s) * 7;
      for (const g of (r.entry.goals || []).slice(0, GOALS_PER_WEEK)) {
        if (g && g.status === "done") done++;
        else if (g && g.status === "half") half++;
      }
    }
    return { people: rows.length, savedMinutes: saved, done, half };
  }

  // 降幅（0–1），没有数据返回 null
  function dropRate(baseline, screen) {
    if (typeof baseline !== "number" || baseline <= 0 || typeof screen !== "number") return null;
    return (baseline - screen) / baseline;
  }

  // 首屏和战报图用哪张场景图：0–100 分对应夜、破晓、日出、晨光
  function sceneLevel(score) { return score < 25 ? 1 : score < 50 ? 2 : score < 75 ? 3 : 4; }

  const api = { SCREEN_MAX, SCREEN_FLOOR_MIN, GOAL_POINTS, GOALS_PER_WEEK,
    screenScore, goalsScore, entryScore, weekRange, currentWeek, seasonOf,
    rankWeek, seasonRank, weekStats, dropRate, submitted, sceneLevel };
  if (typeof module !== "undefined") module.exports = api;
  else root.Score = api;
})(this);
