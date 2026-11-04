// 计分规则，网页和 tools/test-score.js 共用一份。
// 屏幕 40 分：比自己基线周的日均娱乐时长，每降 1% 得 1 分，降 40% 封顶；日均 30 分钟以内直接满分。
// 目标 60 分：每周 3 个有证据的目标，完成 20、完成一半以上 10、没完成或没交证据 0。
(function (root) {
  const SCREEN_MAX = 40;
  const SCREEN_FLOOR_MIN = 30;
  const GOAL_POINTS = { done: 20, half: 10, miss: 0 };
  const GOALS_PER_WEEK = 3;

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

  // 第 n 周的起止日期；第 0 周是基线周
  function weekRange(start, n) {
    const from = new Date(start + "T00:00:00+08:00");
    from.setUTCDate(from.getUTCDate() + 7 * n);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 6);
    return { from, to };
  }

  // 现在是第几周（北京时间）；开赛前返回 -1
  function currentWeek(start, now) {
    const t0 = new Date(start + "T00:00:00+08:00").getTime();
    const diff = (now || new Date()).getTime() - t0;
    return diff < 0 ? -1 : Math.floor(diff / (7 * 86400000));
  }

  // 加入那一周是自己的基线周，不进榜
  function rankWeek(players, week) {
    const base = Object.fromEntries(players.map(p => [p.id, p.baseline]));
    const name = Object.fromEntries(players.map(p => [p.id, p.name]));
    const joined = Object.fromEntries(players.map(p => [p.id, p.joinedWeek || 0]));
    return (week.entries || [])
      .filter(e => e.id in base && week.n > joined[e.id])
      .map(e => ({ id: e.id, name: name[e.id], entry: e, ...entryScore(base[e.id], e) }))
      .sort((a, b) => b.total - a.total || b.goals - a.goals);
  }

  const api = { SCREEN_MAX, SCREEN_FLOOR_MIN, GOAL_POINTS, GOALS_PER_WEEK,
    screenScore, goalsScore, entryScore, weekRange, currentWeek, rankWeek };
  if (typeof module !== "undefined") module.exports = api;
  else root.Score = api;
})(this);
