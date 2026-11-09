// 누가 어질렀지? 과학 탐정단 — 3학년 과학 복습 추리 놀이 서버 (영어판 whomess를 과학판으로 바꿈)
// 가입·로그인 없음. 판 기록을 저장하지 않음. IP·별명을 로그에 남기지 않음.
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");

const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, "public/assets/map.json"), "utf8"));
const LOOKS = JSON.parse(fs.readFileSync(path.join(__dirname, "public/assets/looks.json"), "utf8"));
const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000 });

app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));
app.get("/qr.svg", async (req, res) => {
  const d = String(req.query.d || "").slice(0, 200);
  try {
    const svg = await QRCode.toString(d, { type: "svg", margin: 1, color: { dark: "#3a2e28", light: "#fffaf0" } });
    res.type("image/svg+xml").send(svg);
  } catch (e) { res.status(400).end(); }
});
app.get("/healthz", (req, res) => res.send("ok"));

// ---------- 규칙 숫자 ----------
const R = {
  TASK_POINT_PER_HELPER: 14,
  MESS_PENALTY: 0.02,
  MESS_LOSE: 5,
  PRANK_START: 40, PRANK_COOL: 40,  // 3학년: 첫 장난과 쉬는 시간을 10초씩 늘림
  REVEAL_MIN: 35, REVEAL_MAX: 45,
  BELL_START: 45,
  MEETING_COOL: 20,
  DISCUSS: 80, VOTE: 30, RESULT: 7,  // 3학년: 말하고 고를 시간을 넉넉히
  ROLE_CARD: 12,
  FLUSH: 10,
  ACT_RANGE: 1.6, REPORT_RANGE: 2.2, VIEW: 5.5,
  SPEED: 4.2,
  BLACKOUT: 20, TRACK: 1,
  LOST_START: 40, LOST_GAP: 35, LOST_JIT: 25, LOST_TTL: 70, LOST_MAX: 2,
  URGENT_TTL: 60, URGENT_BONUS: 0.03, URGENT_MAX: 3,
  LUNCH_TTL: 20, LUNCH_PER: 0.005, INSPECT_TTL: 30, INSPECT_MAX: 2,
  CLUES: [0.25, 0.5, 0.75],
};
if (process.env.FAST) Object.assign(R, { PRANK_START: 2, PRANK_COOL: 3, REVEAL_MIN: 3, REVEAL_MAX: 4, BELL_START: 2, MEETING_COOL: 2, DISCUSS: 6, VOTE: 6, RESULT: 3, ROLE_CARD: 4, BLACKOUT: 8, LOST_START: 3, LOST_GAP: 4, LOST_JIT: 3, LOST_TTL: 30, URGENT_TTL: 10, LUNCH_TTL: 5, INSPECT_TTL: 6 });
const KIND_NAME = { shelf: "책장 쓰러뜨리기", books: "책 흩뜨리기", water: "수도꼭지 틀어 놓기", door: "문 잠그기",
  locker: "사물함 털기", toy: "장난감 상자 털기", plane: "종이비행기 날리기", chalk: "칠판 분필 가루",
  tissue: "휴지 풀어 놓기", balls: "공 바구니 쏟기" };
const SPECIAL_NAME = { detective: "탐정", photo: "사진부", captain: "반장" };
const LOST_KIND = ["동전", "지우개", "실내화"];  // lost0.png, lost1.png, lost2.png
// 복도 바닥 칸 (분실물이 떨어지는 곳)
const HALL = [];
for (let y = 15; y <= 19; y++) for (let x = 1; x < MAP.W; x++) if (MAP.grid[y][x] === ".") HALL.push([x, y]);
const AREA = Object.fromEntries(MAP.areas.map(a => [a.id, a]));
const DOOR = Object.fromEntries(MAP.doors.map(d => [d.id, d]));
const TASK = Object.fromEntries(MAP.tasks.map(t => [t.id, t]));
const SPOT = Object.fromEntries(MAP.pranks.map(p => [p.id, p]));

// 교사 비밀번호 (코드에는 알아볼 수 없는 해시값만 들어 있어요)
const TEACHER_PASS_HASH = "a83d11f43fd751f909fa3b6c4f8db461439d58e7527cbf536af0707aa4e629e0";
function teacherPassOk(p) { return require("crypto").createHash("sha256").update("whoscience:" + String(p || "")).digest("hex") === TEACHER_PASS_HASH; }
const rooms = new Map();
const now = () => Date.now();
const rid = () => crypto.randomBytes(9).toString("base64url");
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function areaAt(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  for (const d of MAP.doors) if (d.tiles.some(t => t[0] === tx && t[1] === ty)) return d.area;
  for (const a of MAP.areas) if (tx >= a.x0 && tx <= a.x1 && ty >= a.y0 && ty <= a.y1) return a.id;
  return null;
}
function newCode() {
  for (let i = 0; i < 200; i++) {
    const c = String(1000 + Math.floor(Math.random() * 9000));
    if (!rooms.has(c)) return c;
  }
  return null;
}
// ---------- 밸런스: 학생 수 × 놀이 시간 → 장난꾸러기 수·심부름 양·장난 쉬는 시간 ----------
// 큰 학교 맵에서 심부름 1개 ≈ 20초(과학 문제 ≈ 30초: 3학년은 문제 읽는 데 시간이 더 걸려요).
// 3학년판: 장난꾸러기를 영어판(6학년)보다 적게, 심부름 양도 조금 적게.
const IMP_TABLE = { 5: [[4, 1], [15, 2]], 8: [[4, 1], [13, 2], [23, 3]], 10: [[4, 1], [12, 2], [21, 3]] };
const PER_HELPER = { off: { 5: 8, 8: 12, 10: 15 }, eng: { 5: 6, 8: 9, 10: 11 } };
function autoImps(n, minutes = 8) { let k = 1; for (const [min, v] of IMP_TABLE[minutes] || IMP_TABLE[8]) if (n >= min) k = v; return k; }
function balance(n, settings) {
  const m = settings.minutes;
  const imps = settings.imps ? Math.min(settings.imps, capImps(n)) : autoImps(n, m);
  const per = PER_HELPER[settings.english && settings.english !== "off" ? "eng" : "off"][m] || 14;
  const helpers = Math.max(0, n - imps);
  return { n, imps, auto: !settings.imps, perHelper: per, helpers, target: helpers * per, cool: R.PRANK_COOL + 5 * (imps - 1) };
}
function capImps(n) { return Math.max(1, Math.min(4, Math.floor((n - 1) / 4))); }

function makeRoom() {
  const code = newCode();
  const room = {
    code, hostToken: rid(), tv: null, created: now(), lastActive: now(),
    settings: { imps: 0, minutes: 8, reveal: true, english: "mix", custom: [], clues: true, special: false, footprints: true },  // english = 과학 문제 판(off·2·3·mix·custom)
    phase: "lobby", paused: false,
    players: new Map(), // token -> player
    streak: new Map(), // token -> 연속 장난꾸러기 횟수
    rejoin: [], // {reqId, token, sid}
    game: null,
  };
  rooms.set(code, room);
  return room;
}
function pub(p) { return { id: p.id, name: p.name, look: p.look, on: p.connected }; }
function playersArr(room) { return [...room.players.values()]; }

// ---------- 게임 시작 ----------
function startGame(room) {
  const ps = playersArr(room);
  const n = ps.length;
  const bal = balance(n, room.settings); let k = bal.imps;
  // 3판 연속 장난꾸러기 방지
  let pool = shuffle(ps.filter(p => (room.streak.get(p.token) || 0) < 2));
  if (pool.length < k) pool = shuffle(ps.slice());
  const imps = new Set(pool.slice(0, k).map(p => p.token));
  for (const p of ps) room.streak.set(p.token, imps.has(p.token) ? (room.streak.get(p.token) || 0) + 1 : 0);
  const spawns = shuffle(MAP.spawns.slice());
  ps.forEach((p, i) => {
    p.role = imps.has(p.token) ? "imp" : "helper";
    p.cleaner = false; p.bellUsed = false; p.lastPrank = -999; p.doneCount = 0; p.pendingTask = 0;
    const s = spawns[i % spawns.length];
    p.x = s[0] + 0.5; p.y = s[1] + 0.5; p.dir = 3; p.moving = false;
    p.tasks = pickTasks([]);
    p.vote = undefined; p.special = null; p.specialUsed = false; p.hist = []; p.lastArea = null;
    p.stat = { task: 0, clean: 0, meet: 0, prank: 0, lost: 0, urgent: 0 };
    p.carry = 0;
  });
  if (room.settings.special) {
    const hs = shuffle(ps.filter(p => !imps.has(p.token)));
    const nSp = n >= 16 ? 3 : n >= 8 ? 2 : 1;
    shuffle(["detective", "photo", "captain"]).slice(0, nSp).forEach((sp, i) => { if (hs[i]) hs[i].special = sp; });
  }
  const helpers = ps.filter(p => p.role === "helper").length;
  room.game = {
    t: 0, // 놀이 시간(초, 회의 중 멈춤)
    limit: room.settings.minutes * 60,
    target: Math.max(1, helpers * bal.perHelper), perHelper: bal.perHelper, prankCool: process.env.FAST ? R.PRANK_COOL : bal.cool,
    shown: 0, pendingPts: 0, nextFlush: R.FLUSH,
    pending: [], // 숨은 장난 {spot, revealAt, by}
    messes: [], // {id, spot, kind, area, x, y, at, cleaned, used}
    lastMeetingEnd: -999,
    meeting: null, result: null, winner: null, reason: "",
    roleUntil: now() + R.ROLE_CARD * 1000,
    impNames: ps.filter(p => p.role === "imp").map(p => p.name),
    id: rid(), clues: [], clueStage: 0, log: [], track: {}, nextTrack: 0, blackout: null, blackoutUsed: false, photos: [],
    lost: [], nextLost: R.LOST_START, event: null, inspectUntil: 0, urgentUsed: 0, lunchUsed: false, inspectUsed: 0,
  };
  room.phase = "roles";
  room.paused = false;
  for (const p of ps) {
    const s = sock(p);
    if (s) s.emit("role", roleInfo(room, p));
  }
  broadcastState(room);
}
function roleInfo(room, p) {
  const mates = p.role === "imp" ? playersArr(room).filter(q => q.role === "imp" && q !== p).map(q => q.name) : [];
  return { role: p.role, mates, left: Math.max(0, room.game.roleUntil - now()), english: room.settings.english, x: p.x, y: p.y, special: p.special, specialOn: room.settings.special };
}
function pickTasks(exclude) {
  const byArea = {};
  for (const t of MAP.tasks) if (!exclude.includes(t.id)) (byArea[t.area] ||= []).push(t.id);
  const areas = shuffle(Object.keys(byArea)).slice(0, 4);
  return areas.map(a => ({ id: shuffle(byArea[a])[0], done: false }));
}
function sock(p) { return p.sid ? io.sockets.sockets.get(p.sid) : null; }

// ---------- 진행 ----------
function activeMesses(g) { return g.messes.filter(m => !m.cleaned); }
function liveImps(room) { return playersArr(room).filter(p => p.role === "imp" && !p.cleaner); }
function voters(room) { return playersArr(room).filter(p => !p.cleaner); }

function endGame(room, winner, reason) {
  const g = room.game;
  if (!g || room.phase === "end") return;
  g.winner = winner; g.reason = reason;
  room.phase = "end";
  if (winner && room.settings.reveal) g.replay = {
    len: Math.round(g.t), imps: playersArr(room).filter(p => p.role === "imp").map(p => ({ ...pub(p), track: g.track[p.id] || [] })), log: g.log,
  };
  broadcastState(room);
  io.to(room.code).emit("end", { winner, reason, imps: room.settings.reveal && winner ? playersArr(room).filter(p => p.role === "imp").map(pub) : null });
}
function checkWin(room) {
  const g = room.game; if (!g || room.phase === "end") return;
  if (g.shown >= g.target) return endGame(room, "helper", "모두의 심부름을 다 했어요");
  if (liveImps(room).length === 0) return endGame(room, "helper", "장난꾸러기를 모두 찾았어요");
  if (activeMesses(g).length >= R.MESS_LOSE) return endGame(room, "imp", "어질러진 곳이 5곳이 되었어요");
  const helpersVoting = playersArr(room).filter(p => p.role === "helper" && !p.cleaner).length;
  if (helpersVoting <= liveImps(room).length) return endGame(room, "imp", "투표할 도우미가 너무 적어졌어요");
  if (g.t >= g.limit) return endGame(room, "imp", "놀이 시간이 다 지났어요");
}

function tick(room, dt) {
  const g = room.game;
  if (!g || room.paused) return;
  if (room.phase === "roles" && now() >= g.roleUntil) { room.phase = "play"; broadcastState(room); return; }
  if (room.phase === "play") {
    g.t += dt;
    if (g.t >= g.nextTrack) {
      g.nextTrack += R.TRACK;
      for (const p of liveImps(room)) (g.track[p.id] ||= []).push([Math.round(g.t), +p.x.toFixed(1), +p.y.toFixed(1)]);
    }
    if (g.blackout && g.t >= g.blackout.until) { g.blackout = null; io.to(room.code).emit("power", { on: true }); broadcastState(room); }
    // 분실물
    if (g.t >= g.nextLost && g.lost.length < R.LOST_MAX && HALL.length) {
      g.nextLost = g.t + R.LOST_GAP + Math.random() * R.LOST_JIT;
      const [lx, ly] = HALL[Math.floor(Math.random() * HALL.length)];
      if (!g.lost.some(i => i.x === lx && i.y === ly)) {
        const it = { id: "L" + rid().slice(0, 5), x: lx, y: ly, kind: Math.floor(Math.random() * 3), until: g.t + R.LOST_TTL };
        g.lost.push(it);
        io.to(room.code).emit("gevent", { type: "lostdrop", kind: LOST_KIND[it.kind] });
      }
    }
    g.lost = g.lost.filter(i => i.until > g.t);
    // 이벤트 시간 끝
    if (g.event && g.t >= g.event.until) {
      const ev = g.event; g.event = null;
      if (ev.type === "urgent") io.to(room.code).emit("gevent", { type: "urgentFail", task: TASK[ev.task].name, area: AREA[TASK[ev.task].area].name });
      if (ev.type === "lunch") {
        const inCafe = playersArr(room).filter(p => p.connected && areaAt(p.x, p.y) === "cafe");
        const bonus = g.target * R.LUNCH_PER * inCafe.length;
        g.shown = Math.min(g.target, g.shown + bonus);
        g.log.push({ t: Math.round(g.t), e: "lunch", n: inCafe.length });
        io.to(room.code).emit("gevent", { type: "lunchDone", n: inCafe.length, pct: Math.round(bonus / g.target * 100 * 10) / 10 });
      }
      broadcastState(room);
    }
    // 숨은 장난 드러나기
    for (const pd of g.pending.slice()) {
      if (g.t >= pd.revealAt) {
        g.pending.splice(g.pending.indexOf(pd), 1);
        const s = SPOT[pd.spot];
        const m = { id: "m" + rid().slice(0, 6), spot: s.id, kind: s.kind, area: s.door ? DOOR[s.door].area : s.area, x: s.x, y: s.y, ax: s.ax, ay: s.ay, door: s.door || null, at: Math.round(g.t), cleaned: false, used: false };
        if (room.settings.footprints) {
          // 장난친 지 5초쯤 뒤 범인이 있던 곳 → 떠난 방향 발자국
          const tr = g.track[pd.byId] || [];
          const after = tr.find(q => q[0] >= pd.placedAt + 5) || tr[tr.length - 1];
          if (after) { const dx = after[1] - (s.ax + 0.5), dy = after[2] - (s.ay + 0.5); const L = Math.hypot(dx, dy); if (L > 0.8) { m.fx = +(dx / L).toFixed(2); m.fy = +(dy / L).toFixed(2); } }
        }
        // 문 잠그기는 그 방 이름으로 보여 줌
        g.messes.push(m);
        g.shown = Math.max(0, g.shown - g.target * R.MESS_PENALTY);
        g.log.push({ t: m.at, e: "reveal", area: m.area, kind: m.kind });
        io.to(room.code).emit("reveal", { area: m.area });
      }
    }
    if (g.t >= g.nextFlush) {
      g.shown = Math.min(g.target, g.shown + g.pendingPts); g.pendingPts = 0; g.nextFlush += R.FLUSH;
      if (room.settings.clues) while (g.clueStage < R.CLUES.length && g.shown / g.target >= R.CLUES[g.clueStage]) { g.clueStage++; giveClue(room); }
    }
    checkWin(room);
  } else if (room.phase === "meeting" || room.phase === "vote" || room.phase === "result") {
    const mt = g.meeting;
    if (now() >= mt.until) {
      if (room.phase === "meeting") {
        room.phase = "vote"; mt.until = now() + R.VOTE * 1000;
        for (const p of room.players.values()) p.vote = undefined;
      } else if (room.phase === "vote") finishVote(room);
      else { room.phase = "play"; g.lastMeetingEnd = g.t; g.meeting = null; checkWin(room); }
      broadcastState(room);
    }
  }
}

function openMeeting(room, caller, type, mess) {
  const g = room.game;
  caller.stat && caller.stat.meet++;
  room.phase = "meeting";
  if (mess) mess.used = true;
  g.meeting = { caller: pub(caller), type, where: mess ? AREA[mess.area].name : "교무실", until: now() + R.DISCUSS * 1000, result: null, photos: g.photos.splice(0) };
  g.log.push({ t: Math.round(g.t), e: "meeting", by: caller.name, type });
  if (g.blackout) { g.blackout = null; io.to(room.code).emit("power", { on: true }); }
  for (const p of room.players.values()) p.vote = undefined;
  io.to(room.code).emit("meeting", { caller: pub(caller), type, where: g.meeting.where });
  broadcastState(room);
}
function finishVote(room) {
  const g = room.game; const mt = g.meeting;
  const tally = new Map(); let skip = 0;
  for (const p of voters(room)) {
    const w = p.special === "captain" ? 2 : 1;
    if (!p.vote) skip += w;
    else tally.set(p.vote, (tally.get(p.vote) || 0) + w);
  }
  let best = null, bestN = 0, tie = false;
  for (const [id, n] of tally) { if (n > bestN) { best = id; bestN = n; tie = false; } else if (n === bestN) tie = true; }
  let res;
  if (best && !tie && bestN > skip) {
    const p = [...room.players.values()].find(q => q.id === best);
    p.cleaner = true;
    res = { picked: pub(p), imp: p.role === "imp" };
    g.log.push({ t: Math.round(g.t), e: "vote", name: p.name, imp: p.role === "imp" });
  } else res = { picked: null };
  mt.result = res;
  room.phase = "result";
  mt.until = now() + R.RESULT * 1000;
  io.to(room.code).emit("voteResult", res);
}

// ---------- 단서 카드 (과학판은 한국어만 보여 줘요) ----------
const COLOR_KO = { red: "빨간색", blue: "파란색", yellow: "노란색", green: "초록색", purple: "보라색", pink: "분홍색", orange: "주황색", gray: "회색", brown: "갈색" };
const ACC = {
  glasses: ["is wearing glasses", "안경을 썼어요", "is NOT wearing glasses", "안경을 쓰지 않았어요"],
  cap: ["is wearing a cap", "야구 모자를 썼어요", "is NOT wearing a cap", "야구 모자를 쓰지 않았어요"],
  beanie: ["is wearing a beanie", "털모자를 썼어요", "is NOT wearing a beanie", "털모자를 쓰지 않았어요"],
  ribbon: ["has a hair ribbon", "머리에 리본을 달았어요", "does NOT have a hair ribbon", "머리에 리본이 없어요"],
  headband: ["is wearing a headband", "머리띠를 했어요", "is NOT wearing a headband", "머리띠를 하지 않았어요"],
  hairclip: ["has a hair clip", "머리핀을 꽂았어요", "does NOT have a hair clip", "머리핀이 없어요"],
  scarf: ["is wearing a scarf", "목도리를 했어요", "is NOT wearing a scarf", "목도리를 하지 않았어요"],
  bag: ["is carrying a bag", "가방을 멨어요", "is NOT carrying a bag", "가방을 메지 않았어요"],
};
const hasAcc = (o, a) => (o.accs || []).includes(a);
function clueCands(L) {
  const out = [];
  const hat = hasAcc(L, "cap") || hasAcc(L, "beanie");
  out.push({ k: "hat", v: hat, test: o => (hasAcc(o, "cap") || hasAcc(o, "beanie")) === hat, en: hat ? "is wearing a hat" : "is NOT wearing a hat", ko: hat ? "모자를 썼어요" : "모자를 쓰지 않았어요" });
  for (const a of Object.keys(ACC)) {
    const has = hasAcc(L, a);
    out.push({ k: "acc:" + a + has, test: o => hasAcc(o, a) === has, en: ACC[a][has ? 0 : 2], ko: ACC[a][has ? 1 : 3] });
  }
  out.push({ k: "hair", test: o => o.hair === L.hair, en: `has ${L.hair} hair`, ko: `머리카락이 ${L.hair === "black" ? "검은색" : "갈색"}이에요` });
  if (L.shirt) {
    out.push({ k: "shirt+", test: o => o.shirt == null || o.shirt === L.shirt, en: `is wearing ${L.shirt === "orange" ? "an" : "a"} ${L.shirt} shirt`, ko: `${COLOR_KO[L.shirt]} 옷을 입었어요` });
    for (const c of Object.keys(COLOR_KO)) if (c !== L.shirt) out.push({ k: "shirt-" + c, test: o => o.shirt == null || o.shirt !== c, en: `is NOT wearing ${c === "orange" ? "an" : "a"} ${c} shirt`, ko: `${COLOR_KO[c]} 옷을 입지 않았어요` });
  }
  return out;
}
function giveClue(room) {
  const g = room.game; const imps = liveImps(room); if (!imps.length) return;
  const target = imps[Math.floor(Math.random() * imps.length)];
  const L = LOOKS[target.look] || LOOKS[0];
  const others = playersArr(room).filter(p => p !== target && !p.cleaner && p.role === "helper");
  const used = new Set(g.clues.map(c => c.k));
  let best = [];
  for (const c of clueCands(L)) {
    if (used.has(c.k)) continue;
    const elim = others.filter(o => !c.test(LOOKS[o.look] || {})).length;
    if (elim === 0) continue;
    const left = others.length - elim;
    // 처음 단서는 너무 세지 않게(후보가 2명 이상 남게)
    let score = g.clueStage < 3 && left < 2 ? elim * 0.3 : elim;
    // 3학년: '~하지 않았어요' 단서보다 '~했어요' 단서를 먼저 (헷갈리지 않게)
    if (/false$|^shirt-/.test(c.k) || (c.k === "hat" && !c.v)) score *= 0.6;
    best.push({ c, score: score + Math.random() * 1.5 });
  }
  best.sort((a, b) => b.score - a.score);
  const pick = best[0]; if (!pick) return;
  const many = liveImps(room).length > 1;
  const clue = { k: pick.c.k, en: (many ? "One of the pranksters " : "The prankster ") + pick.c.en + ".", ko: (many ? "장난꾸러기 중 한 명은 " : "장난꾸러기는 ") + pick.c.ko + ".", at: Math.round(g.t), n: g.clues.length + 1 };
  g.clues.push(clue);
  g.log.push({ t: clue.at, e: "clue", en: clue.en, ko: clue.ko });
  io.to(room.code).emit("clue", clue);
}

// ---------- 열심왕 (활동 점수) ----------
// 심부름 10점 · 치우기 15점 · 회의 열기 10점 · 장난 20점(판 끝 공개가 켜져 있을 때만 점수·표시)
function mvpList(room) {
  const reveal = room.settings.reveal;
  const list = playersArr(room).map(p => {
    const st = p.stat || { task: 0, clean: 0, meet: 0, prank: 0, lost: 0, urgent: 0 };
    let score = st.task * 10 + st.clean * 15 + st.meet * 10 + (st.lost || 0) * 5 + (st.urgent || 0) * 15;
    if (reveal) score += st.prank * 20;
    const row = { id: p.id, name: p.name, look: p.look, task: st.task, clean: st.clean, meet: st.meet, lost: st.lost || 0, urgent: st.urgent || 0, score };
    if (reveal) { row.prank = st.prank; row.imp = p.role === "imp"; }
    return row;
  });
  list.sort((a, b) => b.score - a.score || b.task - a.task);
  return list;
}

// ---------- 상태 보내기 ----------
function tvState(room) {
  const g = room.game;
  const base = { code: room.code, phase: room.phase, paused: room.paused, settings: room.settings, players: playersArr(room).map(pub),
    rejoin: room.rejoin.map(r => ({ reqId: r.reqId, name: room.players.get(r.token)?.name })),
    balance: balance(room.players.size, room.settings) };
  if (!g) return base;
  return Object.assign(base, {
    t: Math.floor(g.t), limit: g.limit, progress: g.shown / g.target,
    messes: g.messes.filter(m => !m.cleaned).map(m => ({ area: m.area, name: AREA[m.area].name, at: m.at })),
    meeting: g.meeting && { caller: g.meeting.caller, type: g.meeting.type, where: g.meeting.where, left: Math.max(0, Math.ceil((g.meeting.until - now()) / 1000)), result: g.meeting.result },
    voted: room.phase === "vote" ? voters(room).filter(p => p.vote !== undefined).length : 0,
    voterCount: voters(room).length,
    cleaners: playersArr(room).filter(p => p.cleaner).map(p => p.id),
    winner: g.winner, reason: g.reason,
    impsRevealed: room.phase === "end" && room.settings.reveal && g.winner ? playersArr(room).filter(p => p.role === "imp").map(pub) : null,
    roleLeft: room.phase === "roles" ? Math.max(0, Math.ceil((g.roleUntil - now()) / 1000)) : 0,
    clues: g.clues, blackout: g.blackout ? Math.ceil(g.blackout.until - g.t) : 0,
    inspect: g.inspectUntil && g.t < g.inspectUntil ? Math.ceil(g.inspectUntil - g.t) : 0,
    gevent: g.event ? { type: g.event.type, left: Math.max(0, Math.ceil(g.event.until - g.t)), area: g.event.area ? AREA[g.event.area].name : null, task: g.event.task ? TASK[g.event.task].name : null } : null,
    evUse: { urgent: R.URGENT_MAX - g.urgentUsed, lunch: g.lunchUsed ? 0 : 1, inspect: R.INSPECT_MAX - g.inspectUsed },
    photos: g.meeting ? g.meeting.photos : [],
    replay: room.phase === "end" ? g.replay || null : null,
    mvp: room.phase === "end" ? mvpList(room) : null,
    stats: room.phase === "end" ? { id: g.id, winner: g.winner, t: Math.round(g.t), pct: Math.round(g.shown / g.target * 100),
      found: playersArr(room).filter(p => p.role === "imp" && p.cleaner).length, total: playersArr(room).filter(p => p.role === "imp").length, n: room.players.size } : null,
  });
}
function playerState(room, p) {
  const g = room.game;
  const s = { phase: room.phase, paused: room.paused, me: pub(p), code: room.code, players: playersArr(room).map(pub), settings: { english: room.settings.english, custom: room.settings.custom } };
  if (!g) return s;
  s.t = Math.floor(g.t); s.limit = g.limit; s.progress = g.shown / g.target;
  s.role = p.role; s.cleaner = p.cleaner; s.tasks = p.tasks; s.bellUsed = p.bellUsed;
  s.messCount = activeMesses(g).length;
  s.messes = activeMesses(g).map(m => ({ id: m.id, kind: m.kind, x: m.x, y: m.y, ax: m.ax, ay: m.ay, door: m.door, used: m.used, area: m.area, at: m.at, fx: m.fx, fy: m.fy }));
  s.lockedDoors = activeMesses(g).filter(m => m.door).map(m => m.door);
  s.cleaners = playersArr(room).filter(q => q.cleaner).map(q => q.id);
  s.canMeet = g.t - g.lastMeetingEnd >= R.MEETING_COOL;
  s.bellOpen = g.t >= R.BELL_START;
  if (p.role === "imp") { s.prankReady = Math.max(0, Math.max(R.PRANK_START - g.t, p.lastPrank + g.prankCool - g.t)); s.mates = playersArr(room).filter(q => q.role === "imp" && q !== p).map(q => q.id); s.busySpots = g.pending.map(pd => pd.spot).concat(activeMesses(g).map(m => m.spot)); }
  if (g.meeting) s.meeting = { caller: g.meeting.caller, type: g.meeting.type, where: g.meeting.where, left: Math.max(0, Math.ceil((g.meeting.until - now()) / 1000)), result: g.meeting.result, myVote: p.vote, photos: g.meeting.photos };
  s.clues = g.clues; s.blackout = g.blackout ? Math.ceil(g.blackout.until - g.t) : 0;
  s.lost = g.lost.map(i => ({ id: i.id, x: i.x, y: i.y, kind: i.kind }));
  s.carry = p.carry;
  s.inspect = g.inspectUntil && g.t < g.inspectUntil ? Math.ceil(g.inspectUntil - g.t) : 0;
  if (g.event) s.gevent = { type: g.event.type, left: Math.max(0, Math.ceil(g.event.until - g.t)), task: g.event.task || null, area: g.event.area || null };
  s.fixers = g.blackout ? g.blackout.fixers.length : 0;
  s.special = p.special; s.specialUsed = p.specialUsed;
  if (p.role === "imp") s.blackoutReady = room.settings.special && !g.blackoutUsed && !p.cleaner && g.t >= R.PRANK_START;
  if (room.phase === "end") {
    const l = mvpList(room); const i = l.findIndex(x => x.id === p.id);
    if (i >= 0) { s.myStats = l[i]; s.myRank = i + 1; s.totalN = l.length; }
    s.winner = g.winner; s.reason = g.reason; s.impsRevealed = room.settings.reveal && g.winner ? playersArr(room).filter(q => q.role === "imp").map(pub) : null; }
  return s;
}
function broadcastState(room) {
  if (room.tv) io.to(room.tv).emit("tvState", tvState(room));
  for (const p of room.players.values()) { const s = sock(p); if (s) s.emit("state", playerState(room, p)); }
}
function sendPositions(room) {
  if (room.phase !== "play" && room.phase !== "roles") return;
  const ps = playersArr(room);
  for (const p of ps) {
    const s = sock(p); if (!s) continue;
    const myArea = areaAt(p.x, p.y);
    const near = [];
    for (const q of ps) {
      if (q === p || !q.connected) continue;
      if (dist(p.x, p.y, q.x, q.y) > R.VIEW) continue;
      const qa = areaAt(q.x, q.y);
      if (qa !== myArea && !(isDoorTile(p.x, p.y) || isDoorTile(q.x, q.y))) continue;
      near.push([q.id, +q.x.toFixed(2), +q.y.toFixed(2), q.dir, q.moving ? 1 : 0, q.flash && q.flash.until > now() ? q.flash.text : 0]);
    }
    s.volatile.emit("pos", near);
  }
}
function messDist(p, m) { if (m.door) { const d = DOOR[m.door]; return dist(p.x, p.y, d.x + 1, d.y + 1.5) - 1.2; } return dist(p.x, p.y, m.ax + 0.5, m.ay + 0.5); }
function isDoorTile(x, y) { const tx = Math.floor(x), ty = Math.floor(y); return MAP.doors.some(d => d.tiles.some(t => t[0] === tx && t[1] === ty)); }

// ---------- 소켓 ----------
io.on("connection", socket => {
  let room = null, me = null, isTV = false;

  socket.on("tvCreate", (data, ack) => {
    if (typeof data === "function") { ack = data; data = {}; }
    if (!teacherPassOk((data || {}).pass)) return ack && ack({ err: "교사 비밀번호가 달라요" });
    const r = makeRoom();
    if (!r.code) return ack && ack({ err: "방을 만들 수 없어요" });
    room = r; isTV = true; r.tv = socket.id; socket.join(r.code);
    ack && ack({ code: r.code, host: r.hostToken });
    broadcastState(r);
  });
  socket.on("tvResume", ({ code, host }, ack) => {
    const r = rooms.get(String(code));
    if (!r || r.hostToken !== host) return ack && ack({ err: "방이 닫혔어요" });
    room = r; isTV = true; r.tv = socket.id; socket.join(r.code);
    ack && ack({ code: r.code, host: r.hostToken });
    broadcastState(r);
  });
  socket.on("tv", (msg) => {
    if (!isTV || !room || room.tv !== socket.id) return;
    room.lastActive = now();
    const g = room.game;
    switch (msg.a) {
      case "settings": {
        const s = msg.s || {};
        if (room.phase !== "lobby") break;
        if ([0, 1, 2, 3, 4].includes(s.imps)) room.settings.imps = s.imps;
        if ([5, 8, 10].includes(s.minutes)) room.settings.minutes = s.minutes;
        if (typeof s.reveal === "boolean") room.settings.reveal = s.reveal;
        if (typeof s.clues === "boolean") room.settings.clues = s.clues;
        if (typeof s.special === "boolean") room.settings.special = s.special;
        if (typeof s.footprints === "boolean") room.settings.footprints = s.footprints;
        if (["off", "2", "3", "mix", "custom"].includes(s.english)) room.settings.english = s.english;
        if (Array.isArray(s.custom)) room.settings.custom = s.custom.slice(0, 200).map(q => (Array.isArray(q) ? q.slice(0, 5).map(x => String(x).slice(0, 160)) : null)).filter(q => q && q.length >= 3);
        break;
      }
      case "start":
        if (room.phase === "lobby" && room.players.size >= 4) startGame(room);
        break;
      case "pause":
        if (g && room.phase !== "lobby" && room.phase !== "end") {
          room.paused = !room.paused;
          if (g.meeting) { if (room.paused) g.meeting.frozen = g.meeting.until - now(); else g.meeting.until = now() + (g.meeting.frozen || 0); }
          if (room.phase === "roles") { if (room.paused) g.roleFrozen = g.roleUntil - now(); else g.roleUntil = now() + (g.roleFrozen || 0); }
        }
        break;
      case "plus30":
        if (g && g.meeting && (room.phase === "meeting")) g.meeting.until += 30000;
        break;
      case "skipMeeting":
        if (g && g.meeting && (room.phase === "meeting" || room.phase === "vote")) g.meeting.until = now();
        break;
      case "endGame":
        if (g && room.phase !== "lobby") { endGame(room, null, "선생님이 판을 끝냈어요"); }
        break;
      case "again":
        if (room.phase === "end") {
          room.phase = "lobby"; room.game = null; room.paused = false;
          for (const [tok, p] of room.players) if (!p.connected) room.players.delete(tok);
          io.to(room.code).emit("lobby");
        }
        break;
      case "kick": {
        if (room.phase !== "lobby") break;
        const p = [...room.players.values()].find(q => q.id === msg.id);
        if (p) { const s = sock(p); room.players.delete(p.token); if (s) { s.emit("kicked"); s.leave(room.code); } }
        break;
      }
      case "rename": {
        if (room.phase !== "lobby") break;
        const p = [...room.players.values()].find(q => q.id === msg.id);
        const nm = cleanName(msg.name);
        if (p && nm && ![...room.players.values()].some(q => q !== p && q.name === nm)) p.name = nm;
        break;
      }
      case "admit": {
        const req = room.rejoin.find(r => r.reqId === msg.reqId);
        room.rejoin = room.rejoin.filter(r => r !== req);
        if (req && msg.ok) {
          const p = room.players.get(req.token); const s = io.sockets.sockets.get(req.sid);
          if (p && s) { s.emit("admitted", { token: p.token, code: room.code }); }
        } else if (req) { const s = io.sockets.sockets.get(req.sid); if (s) s.emit("joinErr", "선생님이 들여보내지 않았어요"); }
        break;
      }
      case "event": {
        if (!g || room.phase !== "play" || room.paused) break;
        if (msg.kind === "urgent" && !g.event && g.urgentUsed < R.URGENT_MAX) {
          const t = MAP.tasks[Math.floor(Math.random() * MAP.tasks.length)];
          g.event = { type: "urgent", task: t.id, area: t.area, until: g.t + R.URGENT_TTL }; g.urgentUsed++;
          g.log.push({ t: Math.round(g.t), e: "urgent", area: t.area });
          io.to(room.code).emit("gevent", { type: "urgent", task: t.name, area: AREA[t.area].name, en: AREA[t.area].en });
        } else if (msg.kind === "lunch" && !g.event && !g.lunchUsed) {
          g.event = { type: "lunch", until: g.t + R.LUNCH_TTL }; g.lunchUsed = true;
          io.to(room.code).emit("gevent", { type: "lunch", sec: R.LUNCH_TTL });
        } else if (msg.kind === "inspect" && g.inspectUsed < R.INSPECT_MAX && g.t >= (g.inspectUntil || 0)) {
          g.inspectUntil = g.t + R.INSPECT_TTL; g.inspectUsed++;
          g.log.push({ t: Math.round(g.t), e: "inspect" });
          io.to(room.code).emit("gevent", { type: "inspect", sec: R.INSPECT_TTL });
        }
        break;
      }
      case "close":
        io.to(room.code).emit("closed");
        rooms.delete(room.code);
        room = null;
        return;
    }
    broadcastState(room);
  });

  // ----- 학생 -----
  socket.on("join", ({ code, name, token }, ack) => {
    const r = rooms.get(String(code || "").trim());
    if (!r) return ack && ack({ err: "방 번호를 다시 확인해요" });
    // 같은 기기로 다시 들어오기
    if (token && r.players.has(token)) {
      const p = r.players.get(token);
      p.sid = socket.id; p.connected = true; room = r; me = p; socket.join(r.code);
      ack && ack({ ok: true, token: p.token, code: r.code, resumed: true });
      if (r.game && r.phase !== "lobby") socket.emit("role", roleInfo(r, p));
      broadcastState(r);
      return;
    }
    const nm = cleanName(name);
    if (!nm) return ack && ack({ err: "별명은 2~8자로 써요" });
    if (r.phase !== "lobby") {
      const p = [...r.players.values()].find(q => q.name === nm);
      if (p && !p.connected) {
        const reqId = rid();
        r.rejoin.push({ reqId, token: p.token, sid: socket.id });
        broadcastState(r);
        return ack && ack({ wait: true });
      }
      return ack && ack({ err: "놀이 중이에요. 한 판 끝나고 들어와요" });
    }
    if (r.players.size >= 30) return ack && ack({ err: "방이 꽉 찼어요 (30명)" });
    if ([...r.players.values()].some(q => q.name === nm)) return ack && ack({ err: "같은 별명이 있어요. 다른 별명을 골라요" });
    const used = new Set([...r.players.values()].map(p => p.look));
    const free = shuffle([...Array(32).keys()].filter(i => !used.has(i)));
    const p = { id: rid().slice(0, 8), token: rid(), name: nm, look: free[0] ?? 0, sid: socket.id, connected: true, x: 33, y: 17, dir: 3, moving: false };
    r.players.set(p.token, p);
    room = r; me = p; socket.join(r.code);
    r.lastActive = now();
    ack && ack({ ok: true, token: p.token, code: r.code });
    broadcastState(r);
  });

  socket.on("move", (m) => {
    if (!room || !me || room.paused || (room.phase !== "play" && room.phase !== "roles")) return;
    if (!Array.isArray(m)) return;
    const [x, y, dir, moving] = m;
    if (typeof x !== "number" || typeof y !== "number" || !isFinite(x) || !isFinite(y)) return;
    if (x < 0 || y < 0 || x >= MAP.W || y >= MAP.H) return;
    me.x = x; me.y = y; me.dir = dir | 0; me.moving = !!moving;
    if (room.game && room.phase === "play") {
      const a = areaAt(x, y);
      if (a && a !== me.lastArea) { me.lastArea = a; me.hist.push({ a, t: Math.round(room.game.t) }); if (me.hist.length > 12) me.hist.shift(); }
    }
  });

  socket.on("act", (msg, ack) => {
    const done = (r) => ack && ack(r || { ok: true });
    if (!room || !me || !room.game || room.paused || room.phase !== "play") return done({ err: "지금은 할 수 없어요" });
    const g = room.game;
    switch (msg.a) {
      case "task": {
        const t = me.tasks.find(x => x.id === msg.id && !x.done); const T = TASK[msg.id];
        if (!t || !T || dist(me.x, me.y, T.ax + 0.5, T.ay + 0.5) > R.ACT_RANGE + 0.6) return done({ err: "너무 멀어요" });
        t.done = true;
        me.stat && me.stat.task++;
        if (me.role === "helper") g.pendingPts += 1;
        me.flash = { text: T.name + " 끝!", until: now() + 2500 };
        if (me.tasks.every(x => x.done)) me.tasks = pickTasks(me.tasks.map(x => x.id));
        broadcastStateOne(room, me);
        if (me.role === "helper") checkWin(room);
        return done();
      }
      case "clean": {
        const m = g.messes.find(x => x.id === msg.id && !x.cleaned);
        if (!m || messDist(me, m) > R.ACT_RANGE + 0.8) return done({ err: "너무 멀어요" });
        m.cleaned = true;
        me.stat && me.stat.clean++;
        g.log.push({ t: Math.round(g.t), e: "clean", area: m.area, name: me.name });
        me.flash = { text: "깨끗이 치웠어요!", until: now() + 2500 };
        broadcastState(room);
        return done();
      }
      case "prank": {
        if (me.role !== "imp" || me.cleaner) return done({ err: "할 수 없어요" });
        if (g.inspectUntil && g.t < g.inspectUntil) return done({ err: "불시 점검 중이에요! 조금 뒤에요" });
        if (g.t < R.PRANK_START || g.t - me.lastPrank < g.prankCool) return done({ err: "아직 쉬는 중이에요" });
        const s = SPOT[msg.id];
        if (!s || dist(me.x, me.y, s.ax + 0.5, s.ay + 0.5) > R.ACT_RANGE + 0.6) return done({ err: "너무 멀어요" });
        if (g.pending.some(pd => pd.spot === s.id) || g.messes.some(m => !m.cleaned && m.spot === s.id)) return done({ err: "이미 장난친 곳이에요" });
        me.lastPrank = g.t;
        me.stat && me.stat.prank++;
        g.pending.push({ spot: s.id, by: me.token, byId: me.id, placedAt: g.t, revealAt: g.t + R.REVEAL_MIN + Math.random() * (R.REVEAL_MAX - R.REVEAL_MIN) });
        g.log.push({ t: Math.round(g.t), e: "prank", name: me.name, id: me.id, kind: s.kind, area: s.door ? DOOR[s.door].area : s.area, x: s.ax + 0.5, y: s.ay + 0.5 });
        broadcastStateOne(room, me);
        return done({ ok: true, text: KIND_NAME[s.kind] + " 성공!" });
      }
      case "report": {
        if (me.cleaner) return done({ err: "청소 당번은 회의를 열 수 없어요" });
        if (g.t - g.lastMeetingEnd < R.MEETING_COOL) return done({ err: "조금 뒤에 열 수 있어요" });
        const m = g.messes.find(x => x.id === msg.id && !x.cleaned && !x.used);
        if (!m || messDist(me, m) > R.REPORT_RANGE + 0.8) return done({ err: "너무 멀어요" });
        openMeeting(room, me, "report", m);
        return done();
      }
      case "bell": {
        if (me.cleaner) return done({ err: "청소 당번은 회의를 열 수 없어요" });
        if (me.bellUsed) return done({ err: "비상벨은 한 판에 한 번이에요" });
        if (g.t < R.BELL_START) return done({ err: "시작하고 45초 뒤부터 눌러요" });
        if (g.t - g.lastMeetingEnd < R.MEETING_COOL) return done({ err: "조금 뒤에 열 수 있어요" });
        if (dist(me.x, me.y, MAP.bell.ax + 0.5, MAP.bell.ay + 0.5) > R.ACT_RANGE + 1) return done({ err: "비상벨 앞에서 눌러요" });
        me.bellUsed = true;
        openMeeting(room, me, "bell", null);
        return done();
      }
      case "blackout": {
        if (me.role !== "imp" || me.cleaner || !room.settings.special) return done({ err: "할 수 없어요" });
        if (g.blackoutUsed) return done({ err: "정전은 한 판에 한 번이에요" });
        if (g.t < R.PRANK_START) return done({ err: "아직 쓸 수 없어요" });
        g.blackoutUsed = true; g.blackout = { until: g.t + R.BLACKOUT, fixers: [] };
        g.log.push({ t: Math.round(g.t), e: "blackout", name: me.name });
        io.to(room.code).emit("power", { on: false });
        broadcastState(room);
        return done({ ok: true, text: "정전!" });
      }
      case "fix": {
        if (!g.blackout) return done({ err: "불이 켜져 있어요" });
        if (!MAP.breaker.spots.some(([x, y]) => dist(me.x, me.y, x + 0.5, y + 0.5) <= R.ACT_RANGE + 0.6)) return done({ err: "차단기 앞에서 눌러요" });
        if (!g.blackout.fixers.includes(me.id)) g.blackout.fixers.push(me.id);
        if (g.blackout.fixers.length >= 2) { g.blackout = null; io.to(room.code).emit("power", { on: true }); me.flash = { text: "불이 켜졌어요!", until: now() + 2500 }; }
        broadcastState(room);
        return done({ ok: true, n: g.blackout ? g.blackout.fixers.length : 2 });
      }
      case "investigate": {
        if (me.special !== "detective" || me.specialUsed || me.cleaner) return done({ err: "할 수 없어요" });
        const q = [...room.players.values()].find(x => x.id === msg.id);
        if (!q || q === me) return done({ err: "친구를 골라요" });
        me.specialUsed = true;
        const since = g.t - 60; const list = [];
        for (const h of q.hist.slice().reverse()) { if (h.t < since && list.length) break; if (!list.some(l => l.a === h.a)) list.push(h); if (list.length >= 3) break; }
        broadcastStateOne(room, me);
        return done({ ok: true, name: q.name, places: list.map(h => ({ name: AREA[h.a].name, t: h.t })) });
      }
      case "urgent": {
        const ev = g.event;
        if (!ev || ev.type !== "urgent") return done({ err: "지금은 없어요" });
        const T = TASK[ev.task];
        if (dist(me.x, me.y, T.ax + 0.5, T.ay + 0.5) > R.ACT_RANGE + 0.6) return done({ err: "너무 멀어요" });
        g.event = null;
        g.shown = Math.min(g.target, g.shown + g.target * R.URGENT_BONUS);
        me.stat.urgent++;
        g.log.push({ t: Math.round(g.t), e: "urgentDone", name: me.name });
        me.flash = { text: "긴급 방송 해결!", until: now() + 2500 };
        io.to(room.code).emit("gevent", { type: "urgentDone", by: me.name, task: T.name });
        broadcastState(room);
        return done({ ok: true });
      }
      case "pick": {
        const it = g.lost.find(x => x.id === msg.id);
        if (!it) return done({ err: "이미 없어요" });
        if (me.carry >= 2) return done({ err: "두 개까지만 들 수 있어요" });
        if (dist(me.x, me.y, it.x + 0.5, it.y + 0.5) > 1.4) return done({ err: "너무 멀어요" });
        g.lost = g.lost.filter(x => x !== it);
        me.carry++;
        me.flash = { text: LOST_KIND[it.kind] + " 주웠어요!", until: now() + 2000 };
        broadcastState(room);
        return done({ ok: true, kind: LOST_KIND[it.kind] });
      }
      case "lostbox": {
        if (!me.carry) return done({ err: "주운 분실물이 없어요" });
        const B = MAP.lostbox;
        if (dist(me.x, me.y, B.ax + 0.5, B.ay + 0.5) > R.ACT_RANGE + 0.8) return done({ err: "교무실 보관함 앞에서 해요" });
        if (me.role === "helper") g.pendingPts += me.carry;
        me.stat.lost += me.carry;
        me.flash = { text: `분실물 ${me.carry}개 맡겼어요!`, until: now() + 2500 };
        me.carry = 0;
        broadcastStateOne(room, me);
        return done({ ok: true });
      }
      case "photo": {
        if (me.special !== "photo" || me.specialUsed || me.cleaner) return done({ err: "할 수 없어요" });
        me.specialUsed = true;
        const a = areaAt(me.x, me.y);
        const who = playersArr(room).filter(q => q.connected && q !== me && areaAt(q.x, q.y) === a && dist(q.x, q.y, me.x, me.y) <= 7).map(pub);
        const ph = { t: Math.round(g.t), area: AREA[a] ? AREA[a].name : "", by: me.name, who };
        g.photos.push(ph);
        broadcastStateOne(room, me);
        return done({ ok: true, photo: ph });
      }
    }
    done({ err: "?" });
  });

  socket.on("vote", ({ id }, ack) => {
    if (!room || !me || !room.game || room.phase !== "vote" || me.cleaner || me.vote !== undefined) return ack && ack({ err: "투표할 수 없어요" });
    if (id && ![...room.players.values()].some(p => p.id === id && !p.cleaner)) return ack && ack({ err: "?" });
    me.vote = id || null;
    ack && ack({ ok: true });
    broadcastState(room);
    if (voters(room).every(p => p.vote !== undefined || !p.connected)) { room.game.meeting.until = now(); }
  });

  socket.on("disconnect", () => {
    if (isTV && room && room.tv === socket.id) { room.tv = null; return; }
    if (room && me && me.sid === socket.id) {
      me.connected = false; me.sid = null;
      if (room.phase === "lobby") room.players.delete(me.token);
      broadcastState(room);
    }
  });
});
function broadcastStateOne(room, p) { const s = sock(p); if (s) s.emit("state", playerState(room, p)); if (room.tv) io.to(room.tv).emit("tvState", tvState(room)); }

function cleanName(n) {
  n = String(n || "").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim();
  const len = [...n.replace(/ /g, "")].length;
  if (len < 2 || [...n].length > 9) return null;
  return n;
}

// ---------- 루프 ----------
let last = now(), slow = 0, pos = 0;
setInterval(() => {
  const t = now(); const dt = (t - last) / 1000; last = t;
  slow += dt; pos += dt;
  for (const room of rooms.values()) tick(room, dt);
  if (pos >= 0.15) { pos = 0; for (const room of rooms.values()) sendPositions(room); }
  if (slow >= 1) {
    slow = 0;
    for (const [code, room] of rooms) {
      if (room.phase !== "lobby") broadcastState(room);
      const idle = !room.tv && ![...room.players.values()].some(p => p.connected);
      if (idle && t - room.lastActive > 30 * 60 * 1000) rooms.delete(code);
      if (t - room.created > 6 * 3600 * 1000) rooms.delete(code);
      if (!idle) room.lastActive = t;
    }
  }
}, 100);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("listening on " + PORT));
