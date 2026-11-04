// 战报图：1080×1350（4:5，朋友圈、小红书都能直接发）。上半是天，太阳高度 = 本周总分；下半是三件事。
window.Poster = (function () {
  const W = 1080, H = 1350, HORIZON = 820;
  const NUM = '"DIN Condensed", "DIN Alternate", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif';
  const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  const STAMP = { done: ["完成", "#ff7a3d"], half: ["一半", "#ff7a3d"], miss: ["没成", "#8a8299"] };

  function loadImg(src) {
    return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  }

  // 超出宽度就截断加省略号
  function fit(ctx, text, maxW) {
    text = String(text || "");
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    return s + "…";
  }

  function ridge(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(0, H);
    pts.forEach(([x, y]) => ctx.lineTo(x * W / 1440, y));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  async function make({ data, week, row, rank, of, color }) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const k = row.total / 100;

    // 天：分数越高，夜色越淡
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 120);
    sky.addColorStop(0, "#13164a"); sky.addColorStop(.35, "#2c2466"); sky.addColorStop(.6, "#74407e");
    sky.addColorStop(.8, "#e2676b"); sky.addColorStop(1, "#ffb36b");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(4, 6, 26, ${(.85 - k * .85).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);

    // 太阳
    const sx = 800, sy = HORIZON - 40 - k * 430, sr = 120;
    const glow = ctx.createRadialGradient(sx, sy, sr * .6, sx, sy, sr * 3.4);
    glow.addColorStop(0, "rgba(255, 196, 110, .55)"); glow.addColorStop(1, "rgba(255, 130, 80, 0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, sr * 3.4, 0, Math.PI * 2); ctx.fill();
    const sun = ctx.createRadialGradient(sx - 10, sy - 14, 4, sx, sy, sr);
    sun.addColorStop(0, "#fffbe8"); sun.addColorStop(.45, "#ffe08a"); sun.addColorStop(.8, "#ffb547"); sun.addColorStop(1, "#ff8a4c");
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

    // 山
    ridge(ctx, [[0, 760], [140, 690], [260, 740], [420, 640], [560, 720], [700, 665], [860, 735], [1010, 650], [1160, 720], [1300, 675], [1440, 730]], "#4a2a5e");
    ridge(ctx, [[0, 830], [180, 765], [330, 815], [500, 750], [690, 820], [880, 760], [1060, 820], [1240, 770], [1440, 815]], "#2b1a45");
    ridge(ctx, [[0, 900], [240, 860], [480, 890], [760, 855], [1040, 892], [1280, 865], [1440, 885]], "#fff8f0");
    ctx.fillStyle = "#fff8f0"; ctx.fillRect(0, 900, W, H - 900);

    // 抬头
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = `600 34px ${SANS}`;
    ctx.fillText(`${data.title} · 第 ${week} 周`, 72, 110);

    // 头像和昵称
    const ax = 72, ay = 160, ar = 52;
    ctx.save();
    ctx.beginPath(); ctx.arc(ax + ar, ay + ar, ar, 0, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.clip();
    const im = row.player.avatar ? await loadImg(`img/a${Number(row.player.avatar)}.png`) : null;
    if (im) { ctx.fillStyle = "#fff"; ctx.fillRect(ax, ay, ar * 2, ar * 2); ctx.drawImage(im, ax, ay, ar * 2, ar * 2); }
    else { ctx.fillStyle = "#fff"; ctx.font = `900 50px ${SANS}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText([...row.name][0] || "?", ax + ar, ay + ar + 2); }
    ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(ax + ar, ay + ar, ar, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff"; ctx.font = `800 60px ${SANS}`;
    ctx.fillText(fit(ctx, row.name, 560), 72 + ar * 2 + 28, ay + ar + 20);

    // 总分
    ctx.font = `700 330px ${NUM}`;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(255, 140, 80, .45)"; ctx.shadowBlur = 40;
    ctx.fillText(String(row.total), 62, 600);
    const tw = ctx.measureText(String(row.total)).width;
    ctx.shadowBlur = 0;
    ctx.font = `700 70px ${NUM}`; ctx.fillStyle = "rgba(255,255,255,.7)";
    ctx.fillText("/100", 62 + tw + 12, 600);
    ctx.font = `600 34px ${SANS}`; ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillText(`本周第 ${rank} 名 · 共 ${of} 人`, 72, 660);

    // 两条分数条
    const bar = (y, label, v, max, color) => {
      ctx.fillStyle = "rgba(255,255,255,.18)"; roundRect(ctx, 72, y, 600, 22, 11); ctx.fill();
      ctx.fillStyle = color; if (v > 0) { roundRect(ctx, 72, y, Math.max(22, 600 * v / max), 22, 11); ctx.fill(); }
      ctx.fillStyle = "#fff"; ctx.font = `600 28px ${SANS}`; ctx.fillText(label, 700, y + 20);
    };
    bar(700, `少刷 ${row.screen}/40`, row.screen, 40, "#6aa6f0");
    bar(744, `做成 ${row.goals}/60`, row.goals, 60, "#ffb547");

    // 三件事
    ctx.fillStyle = "#1b1530"; ctx.font = `800 40px ${SANS}`;
    ctx.fillText("说好的三件事", 72, 965);
    const e = row.entry;
    if (typeof e.screen === "number" && typeof row.player.baseline === "number") {
      ctx.font = `500 28px ${SANS}`; ctx.fillStyle = "#5c5470"; ctx.textAlign = "right";
      ctx.fillText(`手机娱乐 日均 ${row.player.baseline} → ${e.screen} 分钟`, W - 72, 965);
      ctx.textAlign = "left";
    }
    (e.goals || []).slice(0, 3).forEach((g, i) => {
      const y = 1005 + i * 90;
      const [txt, color] = STAMP[g.status] || STAMP.miss;
      ctx.lineWidth = 3;
      roundRect(ctx, 72, y, 96, 50, 12);
      if (g.status === "done") { ctx.fillStyle = color; ctx.fill(); ctx.fillStyle = "#fff"; }
      else { ctx.strokeStyle = color; ctx.stroke(); ctx.fillStyle = color; }
      ctx.font = `800 26px ${SANS}`; ctx.textAlign = "center"; ctx.fillText(txt, 120, y + 35); ctx.textAlign = "left";
      ctx.fillStyle = "#1b1530"; ctx.font = `600 32px ${SANS}`;
      ctx.fillText(fit(ctx, g.text, W - 72 - 196), 196, y + 26);
      ctx.fillStyle = "#8a8299"; ctx.font = `400 24px ${SANS}`;
      ctx.fillText(fit(ctx, "证据：" + (g.evidence || "没交"), W - 72 - 196), 196, y + 58);
    });

    // 底栏
    ctx.fillStyle = "#8a8299"; ctx.font = `500 26px ${SANS}`;
    ctx.fillText(data.url || "", 72, H - 48);
    ctx.textAlign = "right"; ctx.fillText("每周一交一张卡 · 只跟自己比", W - 72, H - 48); ctx.textAlign = "left";

    return c.toDataURL("image/png");
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  return { make };
})();
