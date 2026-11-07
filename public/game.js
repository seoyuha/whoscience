// 누가 어질렀지? — 학생 태블릿
"use strict";
const $ = id => document.getElementById(id);
const show = id => $(id).classList.remove("hide");
const hide = id => $(id).classList.add("hide");
const SCREENS = ["home", "wait", "roleScr", "game", "meetScr", "voteScr", "resScr", "endScr"];
function screen(id) { for (const s of SCREENS) $(s).classList.toggle("hide", s !== id); }
let toastT = 0;
function toast(msg, ms = 1800) { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), ms); }
const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };

// ---------- 인트로 영상 (한 번 보면 이 탭에서는 다시 안 나와요) ----------
(() => {
  const ov = $("introOv"); if (!ov) return;
  let seen = false; try { seen = sessionStorage.getItem("wm_intro") === "1"; } catch (e) {}
  if (seen) { ov.remove(); return; }
  const v = $("introV");
  const end = () => {
    if (ov.classList.contains("off")) return;
    ov.classList.add("off"); try { sessionStorage.setItem("wm_intro", "1"); } catch (e) {}
    try { v.pause(); } catch (e) {}
    setTimeout(() => ov.remove(), 700);
  };
  v.addEventListener("ended", end);
  $("introSkip").onclick = end;
  $("introSnd").onclick = e => { e.stopPropagation(); v.muted = false; v.volume = 1; $("introSnd").classList.add("hide"); };
  ov.addEventListener("click", e => { if (e.target === ov || e.target === v) end(); });
  const t = setTimeout(() => { if (v.readyState < 2) end(); }, 3500); // 느린 인터넷이면 건너뜀
  v.addEventListener("playing", () => clearTimeout(t), { once: true });
  v.play && v.play().catch(() => {});
})();

// 아바타 (chars.png: 줄=모습, 칸 27=앞모습 서 있기)
function avatar(look, scale = 3, full = false) {
  const h = full ? 24 : 15, y0 = full ? 8 : 9;
  return `<span class="av" style="width:${16 * scale}px;height:${h * scale}px;background-size:${448 * scale}px ${1024 * scale}px;background-position:-${27 * 16 * scale}px -${(look * 32 + y0) * scale}px"></span>`;
}

const ADJ = ["포근한", "즐거운", "쫄깃한", "별빛", "웃는", "초록", "엉뚱한", "통통", "꿈꾸는", "까만", "반짝", "몽글", "씩씩한", "느긋한", "졸린", "용감한", "푸른", "달콤한", "보송", "새콤한"];
const NOUN = ["사슴", "코알라", "기린", "수박", "도넛", "단풍잎", "색종이", "키위", "붕어빵", "수달", "크레용", "망고", "펭귄", "사과", "참외", "만두", "고래", "토끼", "호떡", "구름"];
let myName = ADJ[Math.random() * ADJ.length | 0] + " " + NOUN[Math.random() * NOUN.length | 0];

// ---------- 자원 ----------
let MAP, GRID, imgMap, imgChars, imgMess, imgSmall, imgDoor, imgBroom, imgBreakerOff, imgBell, imgBolt, imgLost = [];
const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
try { document.fonts.load('16px "Galmuri14"'); document.fonts.load('16px "Galmuri11"'); } catch (e) {}
const ready = Promise.all([
  fetch("assets/map.json").then(r => r.json()).then(m => { MAP = m; GRID = m.grid.map(r => r.split("")); }),
  load("assets/map.png").then(i => imgMap = i), load("assets/chars.png").then(i => imgChars = i),
  load("assets/mess.png").then(i => imgMess = i), load("assets/door_closed.png").then(i => imgDoor = i), load("assets/broom.png").then(i => imgBroom = i), load("assets/breaker_closed.png").then(i => imgBreakerOff = i), load("assets/ui/icon_bell.png").then(i => imgBell = i), load("assets/ui/icon_blackout.png").then(i => imgBolt = i), load("assets/lost0.png").then(i => imgLost[0] = i), load("assets/lost1.png").then(i => imgLost[1] = i), load("assets/lost2.png").then(i => imgLost[2] = i), load("assets/map_small.png").then(i => imgSmall = i),
]);
const MESS_IDX = { shelf: 0, books: 1, water: 2, door: 3, locker: 4, toy: 5, plane: 6, chalk: 7, tissue: 8, balls: 9 };
const KIND_NAME = { shelf: "책장 쓰러뜨리기", books: "책 흩뜨리기", water: "수도꼭지 틀어 놓기", door: "문 잠그기", locker: "사물함 털기", toy: "장난감 상자 털기", plane: "종이비행기 날리기", chalk: "칠판 분필 가루", tissue: "휴지 풀어 놓기", balls: "공 바구니 쏟기" };
const IC = n => `<img class="pi" src="assets/ui/icon_${n}.png" alt="">`;
const SPECIAL = { detective: ["탐정", IC("detective"), "한 판에 한 번, 친구 한 명이 최근 1분 동안 들른 방 3곳을 볼 수 있어요"], photo: ["사진부", IC("photo"), "한 판에 한 번 사진을 찍으면, 그 방에 있던 친구들이 다음 회의 때 TV에 나와요"], captain: ["반장", IC("captain"), "투표할 때 내 표는 2표로 세요. 비밀로 해요!"] };

// ---------- 처음 화면 ----------
const qs = new URLSearchParams(location.search);
if (qs.get("room")) { $("code").value = qs.get("room").replace(/\D/g, "").slice(0, 4); $("codeHint").textContent = "QR로 채웠어요"; }
$("nameShow").textContent = myName;
$("dice").onclick = () => { myName = ADJ[Math.random() * ADJ.length | 0] + " " + NOUN[Math.random() * NOUN.length | 0]; $("nameShow").textContent = myName; };
$("typeName").onclick = () => {
  const n = prompt("별명을 써요 (2~8자, 진짜 이름은 쓰지 않아요)", "");
  if (n == null) return;
  const t = n.trim();
  if ([...t.replace(/ /g, "")].length < 2 || [...t].length > 9) return toast("별명은 2~8자로 써요");
  myName = t; $("nameShow").textContent = myName;
};
$("code").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); $("codeHint").textContent = ""; });

// ---------- 네트워크 ----------
let net = null; // {emit(ev,data,cb), practice}
let S = null; // 최근 상태
let myId = null, myRole = null, myMates = [], englishMode = "off";
let socket = null;
function onlineNet() {
  socket = io({ transports: ["websocket", "polling"] });
  socket.on("connect", () => {
    const tok = LS.get("wm_token"), code = LS.get("wm_code");
    if (tok && code && joined) socket.emit("join", { code, token: tok }, r => { if (r && r.err) { LS.del("wm_token"); location.reload(); } });
  });
  socket.on("state", onState);
  socket.on("role", onRole);
  socket.on("pos", onPos);
  socket.on("reveal", () => {});
  socket.on("clue", c => { if (S && (S.phase === "play")) showClueToast(c); });
  socket.on("gevent", ev => {
    if (!S || S.phase === "lobby") return;
    const M = {
      urgent: () => engOn() && ev.en ? `📢 Emergency! Someone needs help in ${ev.en}!` : `📢 긴급 방송! ${ev.area}: ${ev.task}`,
      urgentDone: () => `✅ ${ev.by}${josa(ev.by, "이", "가")} 긴급 방송을 해결했어요! 막대 +3%`,
      urgentFail: () => "긴급 방송 시간이 지났어요...",
      lunch: () => engOn() ? `🍚 Lunch time! Go to the cafeteria! (${ev.sec}s)` : `🍚 급식 시간! ${ev.sec}초 안에 급식실로 모여요!`,
      lunchDone: () => `🍚 ${ev.n}명이 모였어요! 막대 +${ev.pct}%`,
      inspect: () => `🔍 불시 점검! ${ev.sec}초 동안 장난 금지`,
      lostdrop: () => `복도 어딘가에 ${ev.kind}${josa(ev.kind, "이", "가")} 떨어졌어요!`,
    };
    if (M[ev.type]) toast(M[ev.type](), 3200);
  });
  socket.on("power", ({ on }) => { if (!S || S.phase !== "play") return; toast(on ? "💡 불이 다시 켜졌어요!" : (myRole === "imp" ? "정전! 들키지 않게 움직여요" : "⚡ 정전! 복도 차단기를 두 명이 함께 고쳐요"), 2600); });
  socket.on("meeting", () => { holdCancel(); hide("quizOv"); hide("mapOv"); });
  socket.on("voteResult", () => {});
  socket.on("end", () => {});
  socket.on("lobby", () => {});
  socket.on("kicked", () => { LS.del("wm_token"); alert("대기실에서 나왔어요"); location.href = "/"; });
  socket.on("closed", () => { LS.del("wm_token"); alert("선생님이 방을 닫았어요"); location.href = "/"; });
  socket.on("admitted", ({ token, code }) => { LS.set("wm_token", token); LS.set("wm_code", code); joined = true; socket.emit("join", { code, token }, r => { if (r.ok) toast("다시 들어왔어요!"); }); });
  socket.on("joinErr", m => { $("joinErr").textContent = m; });
  return { emit: (ev, d, cb) => socket.emit(ev, d, cb), practice: false };
}
let joined = false;
$("joinBtn").onclick = async () => {
  const code = $("code").value;
  if (code.length !== 4) return ($("joinErr").textContent = "방 번호 4자리를 써요");
  await ready;
  if (!net) net = onlineNet();
  $("joinErr").textContent = "";
  net.emit("join", { code, name: myName }, r => {
    if (!r) return;
    if (r.err) return ($("joinErr").textContent = r.err);
    if (r.wait) return ($("joinErr").textContent = "선생님이 들여보내 줄 때까지 기다려요");
    joined = true; LS.set("wm_token", r.token); LS.set("wm_code", r.code);
  });
};
// 같은 기기로 다시 들어오기
(async () => {
  const tok = LS.get("wm_token"), code = LS.get("wm_code");
  if (!tok || !code) return;
  if (qs.get("room") && qs.get("room") !== code) return;
  await ready;
  net = onlineNet();
  socket.emit("join", { code, token: tok }, r => { if (r && r.ok) joined = true; else { LS.del("wm_token"); } });
})();

// ---------- 상태 처리 ----------
let lastPhase = null, prankReadyAt = 0, roleLeftAt = 0, mySpecial = null, specialOn = false;
function onState(s) {
  S = s; myId = s.me.id;
  if (s.role) myRole = s.role;
  if (s.role === "imp") prankReadyAt = performance.now() + (s.prankReady || 0) * 1000;
  if (s.phase !== "play") holdCancel();
  if (s.paused) show("pauseOv"); else hide("pauseOv");
  switch (s.phase) {
    case "lobby": renderWait(); screen("wait"); myRole = null; others.clear(); seen.length = 0; mySpecial = null; votePick = null; voteSent = false; voteKey = ""; hide("quizOv"); hide("mapOv"); break;
    case "roles": screen("roleScr"); renderRoleBody("roleBody"); break;
    case "play": if (lastPhase !== "play") { screen("game"); fitCanvas(); } renderHud(); break;
    case "meeting": hide("quizOv"); hide("mapOv"); renderMeeting(); screen("meetScr"); break;
    case "vote": renderVote(); screen("voteScr"); break;
    case "result": renderResult(); screen("resScr"); break;
    case "end": renderEnd(); screen("endScr"); LS.del("wm_token_unused"); break;
  }
  lastPhase = s.phase;
}
function onRole(r) {
  myRole = r.role; myMates = r.mates; englishMode = r.english; mySpecial = r.special; specialOn = r.specialOn;
  roleLeftAt = performance.now() + r.left;
  if (typeof r.x === "number") { me.x = r.x; me.y = r.y; }
  renderRoleBody("roleBody"); renderRoleBody("roleBody2");
}
setInterval(() => { if (S && S.phase === "roles") $("roleCnt").textContent = Math.max(0, Math.ceil((roleLeftAt - performance.now()) / 1000)); }, 250);

function renderWait() {
  $("waitCode").textContent = S.code; $("waitN").textContent = S.players.length;
  $("waitMe").innerHTML = avatar(S.me.look, 5, true) + `<div class="jua" style="font-size:1.5rem">${esc(S.me.name)}</div>`;
  $("waitGrid").innerHTML = S.players.map(p => `<span class="${p.id === myId ? "me" : ""}">${avatar(p.look, 1.6)}${esc(p.name)}</span>`).join("");
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function renderRoleBody(id) {
  const look = S ? S.me.look : 0;
  let h = avatar(look, 6, true);
  if (myRole === "imp") {
    h += `<h3>장난꾸러기</h3><p>지도의 <b style="color:var(--red)">빨간 점</b>이 장난 자리<br>그 앞에서 하기를 3초 꾹<br>40초쯤 뒤에 어질러져요<br>들키지 않게 심부름하는 척!</p>`;
    if (myMates.length) h += `<p class="mates">같은 편: <b>${myMates.map(esc).join(", ")}</b></p>`;
  } else if (myRole === "helper") {
    h += `<h3>도우미</h3><p>심부름을 하고 어질러진 곳을 치워요<br>어질러진 곳을 보면 <b>발견!</b><br>누구를 언제 어디서 봤는지 기억해요</p>`;
  }
  if (myRole === "imp" && specialOn) h += `<p style="color:var(--red)">${IC("blackout")} 한 번은 <b>정전</b>을 일으킬 수 있어요 (같은 편 모두 합쳐 한 번)</p>`;
  if (mySpecial && SPECIAL[mySpecial]) h += `<p class="mates" style="color:var(--blue)">${SPECIAL[mySpecial][1]} 특별 역할: <b style="color:var(--blue)">${SPECIAL[mySpecial][0]}</b><br><small>${SPECIAL[mySpecial][2]}</small></p>`;
  if (quizOn()) h += `<p style="color:var(--blue)">심부름을 할 때 과학 문제를 풀어요</p>`;
  $(id).innerHTML = h;
}
// 역할 카드: 누르고 있는 동안만 보임
const rc = $("roleCard");
const coverOn = () => $("roleCover").classList.remove("hide"), coverOff = () => $("roleCover").classList.add("hide");
rc.addEventListener("pointerdown", e => { e.preventDefault(); coverOff(); });
["pointerup", "pointerleave", "pointercancel"].forEach(ev => rc.addEventListener(ev, coverOn));
// 놀이 중 내 별명 길게 누르기 → 역할 보기
let chipT = 0;
$("meChip").addEventListener("pointerdown", () => { chipT = setTimeout(() => { renderRoleBody("roleBody2"); show("roleOv"); }, 500); });
["pointerup", "pointerleave", "pointercancel"].forEach(ev => $("meChip").addEventListener(ev, () => { clearTimeout(chipT); hide("roleOv"); }));

const TASK_EN = {
  "칠판 지우기": "erase the board", "책상 줄 맞추기": "line up the desks", "교과서 나눠 주기": "hand out the textbooks", "화분에 물 주기": "water the plant",
  "창문 닦기": "clean the windows", "반납 책 꽂기": "put the books back", "책상 정리": "tidy the desk", "지구본 닦기": "clean the globes",
  "실험 도구 씻기": "wash the lab tools", "컴퓨터 끄기": "turn off the computers", "마우스 정리": "tidy the mice", "세면대 닦기": "clean the sinks",
  "휴지 채우기": "refill the toilet paper", "출석부 갖다 놓기": "bring the attendance book", "복사지 채우기": "refill the copy paper",
  "구급상자 채우기": "fill the first aid kit", "침대 정리": "make the beds", "방송 장비 끄기": "turn off the broadcast desk", "마이크 정리": "put away the microphone",
  "수저통 채우기": "fill the spoon box", "식탁 닦기": "wipe the tables", "물감 정리": "put away the paints", "그림 걸기": "hang the picture",
  "악보 나눠 주기": "hand out the music sheets", "의자 정리": "put the chairs back", "스크린 내리기": "pull down the screen", "의자 줄 맞추기": "line up the chairs",
  "공 정리하기": "put away the balls", "매트 정리": "fold the mats", "줄넘기 정리": "put away the jump ropes", "트로피 닦기": "polish the trophies",
  "사물함 정리": "tidy the lockers", "분리수거 하기": "sort the recycling", "실내화 정리": "tidy the indoor shoes", "게시판 붙이기": "put up a poster",
};
// 과학판: englishMode 값은 과학 문제 판(off·2·3·mix·custom)이에요. 영어 문장 보이기는 모두 꺼요.
const quizOn = () => englishMode && englishMode !== "off";
const engOn = () => false;
function taskEn(T) { const a = MAP.areas.find(x => x.id === T.area); return `Go to ${a ? a.en : "?"} and ${TASK_EN[T.name] || T.name}.`; }
function taskById(id) { return MAP.tasks.find(t => t.id === id); }
function areaName(id) { const a = MAP.areas.find(a => a.id === id); return a ? a.name : ""; }
let hudKey = "";
function renderHud() {
  if (!S) return;
  const key = JSON.stringify([S.tasks, S.me.name, S.me.look, S.cleaner]);
  if (key !== hudKey) {
    hudKey = key;
    const done = S.tasks.filter(t => t.done).length;
    $("taskN").textContent = done + "/4";
    $("taskList").innerHTML = S.tasks.map(t => { const T = taskById(t.id);
      return engOn() ? `<li class="${t.done ? "done" : ""} en" data-id="${t.id}"><i></i><span>${esc(taskEn(T))}</span></li>`
        : `<li class="${t.done ? "done" : ""}"><i></i><span><span class="pl">${areaName(T.area)}</span> · ${T.name}</span></li>`; }).join("");
    $("taskList").querySelectorAll("li.en").forEach(li => li.onclick = e => { e.stopPropagation(); const T = taskById(li.dataset.id); toast(`힌트: ${areaName(T.area)} · ${T.name}`, 2200); });
    $("taskHd").textContent = engOn() ? "Today's Errands" : "오늘의 심부름";
    $("meChip").innerHTML = avatar(S.me.look, 2) + esc(S.me.name) + (S.cleaner ? " " + IC("broom") : "");
  }
  const pct = Math.round(S.progress * 100);
  $("progBar").style.width = pct + "%"; $("progTxt").textContent = pct + "%";
  $("messTxt").textContent = S.messCount ? `어질러진 곳 ${S.messCount}/5` : "";
  $("timeTxt").textContent = fmt(S.limit - S.t);
  renderClues();
  $("clueBox").style.top = (40 + $("taskBox").offsetHeight) + "px";
  const spOk = S.special && !S.specialUsed && !S.cleaner && SPECIAL[S.special] && S.special !== "captain";
  $("spBtn").classList.toggle("hide", !spOk);
  if (spOk) $("spBtn").innerHTML = `<span class="ic">${SPECIAL[S.special][1]}</span>${S.special === "photo" ? "사진" : "조사"}`;
  $("boBtn").classList.toggle("hide", !(myRole === "imp" && S.blackoutReady));
  $("blackBar").classList.toggle("hide", !S.blackout);
  if (S.blackout) $("blackBar").innerHTML = `${IC("blackout")} 정전 ${S.blackout}초 · 복도 차단기를 두 명이 고쳐요 (${S.fixers}/2)`;
  let ev = "";
  if (S.gevent && S.gevent.type === "urgent") { const T = taskById(S.gevent.task); ev = engOn() ? `📢 Emergency! ${taskEn(T)} (${S.gevent.left}s)` : `📢 긴급! ${areaName(T.area)} · ${T.name} (${S.gevent.left}초)`; }
  else if (S.gevent && S.gevent.type === "lunch") ev = engOn() ? `🍚 Go to the cafeteria! (${S.gevent.left}s)` : `🍚 급식실로 모여요! (${S.gevent.left}초)`;
  else if (S.inspect) ev = `🔍 불시 점검! 장난 금지 ${S.inspect}초`;
  else if (S.carry) ev = `들고 있는 분실물 ${S.carry}개 → 교무실 보관함에 맡겨요`;
  $("evBar").classList.toggle("hide", !ev);
  if (ev) $("evBar").textContent = ev;
}
let clueKey = "";
function clueText(c) { return `<b>${esc(c.ko)}</b>`; }
function renderClues() {
  const k = JSON.stringify(S.clues || []); if (k === clueKey) return; clueKey = k;
  const cs = S.clues || [];
  $("clueBox").classList.toggle("hide", !cs.length);
  $("clueBox").innerHTML = `<span class="tape pink">단서 카드 ${cs.length}</span>` + cs.map(c => `<div class="clue">${clueText(c)}</div>`).join("");
}
function showClueToast(c) {
  const el = $("clueToast"); el.innerHTML = `<div class="jua" style="font-size:1rem;color:var(--red)">${IC("clue")} 새 단서 카드!</div>${clueText(c)}`;
  el.classList.add("on"); clearTimeout(showClueToast.t); showClueToast.t = setTimeout(() => el.classList.remove("on"), 5000);
}
$("taskBox").onclick = () => $("taskBox").classList.toggle("fold");

// ---------- 회의·투표·결과 ----------
function renderMeeting() {
  const m = S.meeting; if (!m) return;
  $("meetCaller").innerHTML = avatar(m.caller.look, 5, true) + `<div class="jua" style="font-size:1.4rem">${esc(m.caller.name)}</div>`;
  $("meetTitle").textContent = m.type === "bell" ? "비상벨을 눌렀어요!" : m.where + "에서 발견!";
  $("meetTime").textContent = m.left;
  $("meetTip").innerHTML = `이렇게 말해요: <b>나는 ___에서 ___를 봤어요.</b> · 친구 탓 말고 증거로`;
  renderMeetExtra();
}
function areaEn(id) { const a = MAP.areas.find(x => x.id === id); return a ? a.en : ""; }
function renderMeetExtra() {
  const eng = false;
  const rows = seen.slice(-8).reverse().map(v => `<li><span class="pix">${fmt(v.t)}</span> ${esc(areaName(v.area))} — <b>${esc(v.name)}</b>${eng ? `<br><small>I saw ${esc(v.name)} in ${esc(areaEn(v.area))} at ${fmt(v.t)}.</small>` : ""}</li>`).join("");
  let h = `<div class="mx"><h4>📒 내가 본 것</h4>${rows ? `<ul>${rows}</ul>` : `<p>아직 본 친구가 없어요</p>`}</div>`;
  const cs = S.clues || [];
  if (cs.length) h += `<div class="mx"><h4>${IC("clue")} 단서 카드</h4>${cs.map(c => `<div class="clue">${clueText(c)}</div>`).join("")}</div>`;
  const ph = (S.meeting && S.meeting.photos) || [];
  if (ph.length) h += `<div class="mx"><h4>${IC("photo")} 사진</h4>${ph.map(p => `<p><span class="pix">${fmt(p.t)}</span> ${esc(p.area)}: ${p.who.length ? p.who.map(w => esc(w.name)).join(", ") : "아무도 없었어요"}</p>`).join("")}</div>`;
  if (inv) h += `<div class="mx"><h4>${IC("detective")} 조사 결과</h4><p><b>${esc(inv.name)}</b>: ${inv.places.map(p => `${esc(p.name)}(${fmt(p.t)})`).join(" → ") || "기록 없음"}</p></div>`;
  $("meetExtra").innerHTML = h;
}
let votePick = null, voteSent = false, voteKey = "";
function renderVote() {
  const m = S.meeting;
  $("voteTime").textContent = m ? m.left : "";
  const sent = m && m.myVote !== undefined && m.myVote !== null || voteSent;
  const key = JSON.stringify([S.players.map(p => p.id), S.cleaners, S.cleaner, sent]);
  if (key === voteKey) return;
  voteKey = key;
  if (S.cleaner) {
    $("voteTitle").textContent = "청소 당번은 이번 투표를 쉬어요";
    $("voteGrid").innerHTML = ""; $("skipBtn").disabled = true; $("voteBtn").disabled = true; $("votePick").textContent = "";
    return;
  }
  $("voteTitle").textContent = sent ? "냈어요! 친구들을 기다려요" : "장난꾸러기 같은 친구를 골라요";
  const list = S.players.filter(p => p.id !== myId && !S.cleaners.includes(p.id));
  $("voteGrid").innerHTML = list.map(p => `<button data-id="${p.id}" class="${votePick === p.id ? "sel" : ""}" ${sent ? "disabled" : ""}>${avatar(p.look, 4)}<span>${esc(p.name)}</span></button>`).join("");
  $("skipBtn").disabled = sent; $("voteBtn").disabled = sent || !votePick;
  $("voteGrid").querySelectorAll("button").forEach(b => b.onclick = () => {
    votePick = b.dataset.id; voteKey = ""; renderVote();
    $("votePick").textContent = "고른 친구: " + S.players.find(p => p.id === votePick).name;
  });
}
function sendVote(id) {
  net.emit("vote", { id }, r => { if (r && r.ok) { voteSent = true; voteKey = ""; renderVote(); toast(id ? "냈어요!" : "건너뛰었어요"); } });
}
$("skipBtn").onclick = () => sendVote(null);
$("voteBtn").onclick = () => votePick && sendVote(votePick);
function renderResult() {
  votePick = null; voteSent = false; voteKey = "";
  const r = S.meeting && S.meeting.result; if (!r) return;
  if (!r.picked) $("resBox").innerHTML = `<h2>아무도 뽑히지 않았어요</h2><p>다시 심부름하러 가요!</p>`;
  else $("resBox").innerHTML = avatar(r.picked.look, 7, true) + `<h2>${esc(r.picked.name)}${josa(r.picked.name, "은", "는")} 장난꾸러기${r.imp ? "였어요" : "가 아니었어요"}</h2>` +
    `<div class="stamp ${r.imp ? "" : "no"}">${r.imp ? "장난꾸러기!" : "도우미"}</div><p>${esc(r.picked.name)}${josa(r.picked.name, "은", "는")} 이제 청소 당번이에요. 계속 함께해요!</p>`;
}
function josa(w, a, b) { const c = w.charCodeAt(w.length - 1); if (c < 0xac00 || c > 0xd7a3) return b; return (c - 0xac00) % 28 ? a : b; }
function renderEnd() {
  const w = S.winner;
  const mine = myRole === "imp" ? "imp" : "helper";
  let h = `<span class="tape">판 끝</span>`;
  if (!w) h += `<h2>판을 끝냈어요</h2><p>선생님이 판을 끝냈어요</p>`;
  else {
    h += `<h2>${w === "helper" ? "도우미 팀 승리!" : "장난꾸러기 팀 승리!"}</h2><p style="font-size:1.2rem">${esc(S.reason)}</p>`;
    h += `<div class="stamp ${w === mine ? "" : "no"}">${w === mine ? "우리 팀이 이겼어요!" : "아쉬워요!"}</div>`;
    if (S.myStats) {
      const m = S.myStats;
      h += `<p style="margin:.3em 0">📒 내 기록 — 심부름 ${m.task}개 · 치우기 ${m.clean}개 · 회의 열기 ${m.meet}번${"prank" in m && m.prank ? ` · 장난 ${m.prank}개` : ""}<br><b style="color:var(--blue)">${m.score}점 · 열심왕 ${S.myRank}위 / ${S.totalN}명</b></p>`;
    }
    if (S.impsRevealed) h += `<p>이번 판 장난꾸러기는</p><div>${S.impsRevealed.map(p => `<span style="display:inline-block;margin:4px 10px">${avatar(p.look, 4)}<br><b style="color:var(--red)">${esc(p.name)}</b></span>`).join("")}</div>`;
  }
  h += `<p style="color:var(--ink2)">선생님이 '한 판 더'를 누르면 대기실로 가요</p>`;
  if (net && net.practice) h += `<button class="y" onclick="location.href='/'">처음으로</button>`;
  $("endBox").innerHTML = h;
}

// ---------- 놀이 화면 (캔버스) ----------
const cv = $("cv"), ctx = cv.getContext("2d");
const fog = document.createElement("canvas"), fctx = fog.getContext("2d");
let DPR = 1, TP = 48, VW = 0, VH = 0;
function fitCanvas() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  VW = cv.clientWidth; VH = cv.clientHeight;
  cv.width = VW * DPR; cv.height = VH * DPR; fog.width = cv.width; fog.height = cv.height;
  TP = Math.max(30, Math.min(64, Math.min(VW / 21, VH / 13)));
}
window.addEventListener("resize", () => { if (!$("game").classList.contains("hide")) fitCanvas(); });

const me = { x: 33.5, y: 17.5, dir: 3, moving: false, anim: 0, flash: null };
const others = new Map(); // id -> {x,y,tx,ty,dir,moving,anim,flash,seen}
const seen = []; let inv = null; const pickReq = new Set();
function onPos(list) {
  const t = performance.now();
  for (const [id, x, y, dir, mv, fl] of list) {
    let o = others.get(id);
    if (!o) { o = { x, y, anim: 0 }; others.set(id, o); }
    if (t - (o.seen || 0) > 1000) { o.x = x; o.y = y; }
    o.tx = x; o.ty = y; o.dir = dir; o.moving = !!mv; o.flash = fl || null; o.seen = t;
    if (S && S.phase === "play") {
      const a = areaAt(me.x, me.y), p = S.players.find(q => q.id === id);
      if (a && p) { const last = [...seen].reverse().find(v => v.id === id); if (!last || last.area !== a || S.t - last.t > 20) seen.push({ id, name: p.name, area: a, t: S.t }); if (seen.length > 60) seen.shift(); }
    }
  }
}
function lockedTiles() {
  const set = new Set();
  if (!S || !S.lockedDoors) return set;
  for (const d of MAP.doors) if (d.lock && S.lockedDoors.includes(d.id)) for (const [x, y] of d.tiles) set.add(x + "," + y);
  return set;
}
let LOCKED = new Set();
function solidAt(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= MAP.W || ty >= MAP.H) return true;
  if (GRID[ty][tx] === "#") return true;
  return LOCKED.has(tx + "," + ty);
}
function boxFree(x, y) {
  return !solidAt(x - 0.32, y - 0.2) && !solidAt(x + 0.32, y - 0.2) && !solidAt(x - 0.32, y + 0.12) && !solidAt(x + 0.32, y + 0.12);
}
function areaAt(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  for (const d of MAP.doors) if (d.tiles.some(t => t[0] === tx && t[1] === ty)) return d.area;
  for (const a of MAP.areas) if (tx >= a.x0 && tx <= a.x1 && ty >= a.y0 && ty <= a.y1) return a.id;
  return null;
}
function onDoor(x, y) { const tx = Math.floor(x), ty = Math.floor(y); return MAP.doors.find(d => d.tiles.some(t => t[0] === tx && t[1] === ty)); }

// 입력: 조이스틱 + 키보드
const joy = { on: false, id: null, sx: 0, sy: 0, dx: 0, dy: 0 };
const keys = {};
addEventListener("keydown", e => { keys[e.key.toLowerCase()] = true; if (e.key === " " && !holding) holdStart(); });
addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; if (e.key === " ") holdEnd(); });
cv.addEventListener("pointerdown", e => {
  if (joy.on) return;
  joy.on = true; joy.id = e.pointerId; joy.sx = e.clientX; joy.sy = e.clientY; joy.dx = joy.dy = 0;
  const j = $("joy"); j.style.left = e.clientX + "px"; j.style.top = e.clientY + "px"; show("joy");
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener("pointermove", e => {
  if (!joy.on || e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.sx, dy = e.clientY - joy.sy; const L = Math.hypot(dx, dy), M = 50;
  if (L > M) { dx *= M / L; dy *= M / L; }
  joy.dx = dx / M; joy.dy = dy / M;
  $("joyKnob").style.transform = `translate(${dx}px,${dy}px)`;
});
const joyEnd = e => { if (e.pointerId !== joy.id) return; joy.on = false; joy.dx = joy.dy = 0; hide("joy"); $("joyKnob").style.transform = ""; };
cv.addEventListener("pointerup", joyEnd); cv.addEventListener("pointercancel", joyEnd);

// ---------- 하기 / 발견 / 비상벨 ----------
let holding = false, holdT0 = 0, holdAct = null, curAct = null;
const near = (x, y, r) => Math.hypot(me.x - (x + 0.5), me.y - (y + 0.5)) <= r;
function nearMess(m, r) { if (m.door) { const d = MAP.doors.find(q => q.id === m.door); return Math.hypot(me.x - (d.x + 1), me.y - (d.y + 1.5)) - 1.2 <= r; } return near(m.ax, m.ay, r); }
function computeAction() {
  if (!S || S.phase !== "play" || S.paused) return null;
  const busy = S.busySpots || [];
  if (S.blackout && MAP.breaker.spots.some(([x, y]) => near(x, y, 1.6))) return { type: "fix", dur: 1500, key: "fix" };
  if (S.gevent && S.gevent.type === "urgent") { const T = taskById(S.gevent.task); if (T && near(T.ax, T.ay, 1.5)) return { type: "urgent", dur: 2500, key: "u" + T.id }; }
  if (myRole === "imp" && !S.cleaner) {
    for (const p of MAP.pranks) if (!busy.includes(p.id) && near(p.ax, p.ay, 1.5)) {
      const cool = Math.max(0, (prankReadyAt - performance.now()) / 1000);
      return { type: "prank", id: p.id, dur: 3000, cool, key: "p" + p.id };
    }
  }
  for (const m of S.messes || []) if (nearMess(m, 1.6)) return { type: "clean", id: m.id, dur: 3000, key: "c" + m.id };
  if (S.carry && near(MAP.lostbox.ax, MAP.lostbox.ay, 1.7)) return { type: "lostbox", dur: 1500, key: "box" };
  for (const t of S.tasks || []) if (!t.done) { const T = taskById(t.id); if (near(T.ax, T.ay, 1.5)) return { type: "task", id: t.id, dur: 3000 + (parseInt(t.id.slice(1)) % 3) * 1000, key: "t" + t.id, name: T.name }; }
  return null;
}
function holdStart() { if (!curAct || (curAct.cool > 0)) return; holding = true; holdT0 = performance.now(); holdAct = curAct.key; }
function holdEnd() { holding = false; holdAct = null; $("doRing").style.strokeDashoffset = 289; }
function holdCancel() { holdEnd(); }
const db = $("doBtn");
db.addEventListener("pointerdown", e => { e.preventDefault(); holdStart(); });
["pointerup", "pointerleave", "pointercancel"].forEach(ev => db.addEventListener(ev, holdEnd));
function holdTick() {
  if (!holding) return;
  if (!curAct || curAct.key !== holdAct) return holdEnd();
  const p = Math.min(1, (performance.now() - holdT0) / curAct.dur);
  $("doRing").style.strokeDashoffset = 289 * (1 - p);
  if (p >= 1) { const a = curAct; holdEnd(); finishAction(a); }
}
function finishAction(a) {
  if (a.type === "task") {
    if (quizOn()) return askQuiz(() => sendAct({ a: "task", id: a.id }, () => setFlash(a.name + " 끝!")));
    return sendAct({ a: "task", id: a.id }, () => setFlash(a.name + " 끝!"));
  }
  if (a.type === "clean") return sendAct({ a: "clean", id: a.id }, () => setFlash("깨끗이 치웠어요!"));
  if (a.type === "prank") return sendAct({ a: "prank", id: a.id }, r => setFlash(r.text || "장난 성공!"));
  if (a.type === "fix") return sendAct({ a: "fix" }, r => setFlash(r.n >= 2 ? "불이 켜졌어요!" : "차단기 1/2 · 한 명 더!"));
  if (a.type === "urgent") return sendAct({ a: "urgent" }, () => setFlash("긴급 방송 해결!"));
  if (a.type === "lostbox") return sendAct({ a: "lostbox" });
}
function setFlash(t) { me.flash = { text: t, until: performance.now() + 2500 }; }
function sendAct(msg, ok) { net.emit("act", msg, r => { if (r && r.err) toast(r.err); else ok && ok(r || {}); }); }
$("repBtn").onclick = () => {
  const m = (S.messes || []).find(m => !m.used && nearMess(m, 2.4));
  if (m) sendAct({ a: "report", id: m.id }); else toast("어질러진 곳 가까이에서 눌러요");
};
$("bellBtn").onclick = () => sendAct({ a: "bell" });
$("boBtn").onclick = () => { if (confirm("정전을 일으킬까요? (같은 편 모두 합쳐 한 번)")) sendAct({ a: "blackout" }, () => setFlash("정전!")); };
$("spBtn").onclick = () => {
  if (S.special === "photo") return sendAct({ a: "photo" }, r => { const p = r.photo; toast(`📷 찰칵! ${p.area}: ${p.who.length ? p.who.map(w => w.name).join(", ") : "아무도 없었어요"}`, 4000); });
  if (S.special === "detective") {
    $("invGrid").innerHTML = S.players.filter(p => p.id !== myId).map(p => `<button data-id="${p.id}">${avatar(p.look, 3)}<span>${esc(p.name)}</span></button>`).join("");
    $("invGrid").querySelectorAll("button").forEach(b => b.onclick = () => { hide("invOv"); sendAct({ a: "investigate", id: b.dataset.id }, r => { inv = r; toast(`🔍 ${r.name}: ${r.places.map(p => p.name + "(" + fmt(p.t) + ")").join(" → ") || "기록 없음"}`, 6000); }); });
    show("invOv");
  }
};
$("mapBtn").onclick = () => { drawBigMap(); show("mapOv"); };
function updateButtons() {
  curAct = computeAction();
  const cool = curAct && curAct.cool > 0;
  db.classList.toggle("on", !!curAct && !cool); db.classList.toggle("cool", !!cool);
  $("doArrow").classList.toggle("hide", !(curAct && curAct.type === "prank"));
  $("doLbl").textContent = curAct && curAct.type === "clean" ? "치우기" : curAct && curAct.type === "fix" ? "고치기" : curAct && curAct.type === "urgent" ? "해결!" : curAct && curAct.type === "lostbox" ? "맡기기" : "하기";
  $("doSub").textContent = cool ? `쉬는 중 ${Math.ceil(curAct.cool)}` : "꾹 누르기";
  const canMeet = S && !S.cleaner && S.canMeet;
  const rep = canMeet && (S.messes || []).some(m => !m.used && nearMess(m, 2.4));
  $("repBtn").classList.toggle("on", !!rep);
  const bell = canMeet && S.bellOpen && !S.bellUsed && near(MAP.bell.ax, MAP.bell.ay, 2.2);
  $("bellBtn").classList.toggle("on", !!bell);
  $("bellBtn").disabled = S && (S.bellUsed || S.cleaner);
}

// ---------- 과학 문제 (3학년 2학기 2단원·3단원) ----------
// 문제 형식: [문제, 정답, 오답1, 오답2, 해설]
function bank() {
  const m = englishMode, B = window.QBANK || {};
  if (m === "custom" && S.settings.custom && S.settings.custom.length) return S.settings.custom;
  if (B[m]) return B[m];
  return [].concat(B["2"] || [], B["3"] || []);
}
// 한 판 안에서는 같은 문제가 덜 나오게: 섞은 순서대로 꺼내 쓰기
let qDeck = [], qDeckKey = "";
function nextQ(b) {
  const key = englishMode + ":" + b.length;
  if (key !== qDeckKey || !qDeck.length) { qDeckKey = key; qDeck = b.map((_, i) => i).sort(() => Math.random() - 0.5); }
  return b[qDeck.pop()];
}
function askQuiz(onOk) {
  const b = bank(); if (!b.length) return onOk();
  const [q, ans, w1, w2, exp] = nextQ(b);
  const opts = [ans, w1, w2].filter(Boolean).sort(() => Math.random() - 0.5);
  $("quizQ").textContent = q;
  $("quizExp").classList.add("hide");
  $("quizOpts").innerHTML = opts.map((o, k) => `<button><span class="qn">${"①②③"[k]}</span>${esc(o)}</button>`).join("");
  $("quizOpts").querySelectorAll("button").forEach((btn, k) => btn.onclick = () => {
    if (opts[k] === ans) { hide("quizOv"); toast("정답! 참 잘했어요 👍"); onOk(); }
    else {
      // 틀리면: 정답과 해설을 보여 준 뒤 다른 문제를 다시 풀어요
      $("quizBox").classList.remove("shake"); void $("quizBox").offsetWidth; $("quizBox").classList.add("shake");
      $("quizOpts").querySelectorAll("button").forEach((b2, j) => { b2.disabled = true; if (opts[j] === ans) b2.classList.add("ok"); if (j === k) b2.classList.add("no"); });
      $("quizExp").innerHTML = `정답은 <b>${esc(ans)}</b>${exp ? `<br>${esc(exp)}` : ""}<br><small>잘 읽고 다른 문제를 풀어요</small>`;
      $("quizExp").classList.remove("hide");
      setTimeout(() => askQuiz(onOk), exp ? 4200 : 2600);
    }
  });
  show("quizOv");
}

// ---------- 그리기 ----------
let lastSend = 0, lastSent = "";
function frame(ts) {
  requestAnimationFrame(frame);
  if (!S || S.phase !== "play" || $("game").classList.contains("hide")) return;
  const dt = Math.min(0.05, (ts - (frame.last || ts)) / 1000); frame.last = ts;
  LOCKED = lockedTiles();
  // 이동
  let vx = joy.dx, vy = joy.dy;
  if (keys["arrowleft"] || keys["a"]) vx = -1; if (keys["arrowright"] || keys["d"]) vx = 1;
  if (keys["arrowup"] || keys["w"]) vy = -1; if (keys["arrowdown"] || keys["s"]) vy = 1;
  const L = Math.hypot(vx, vy);
  const qOpen = !$("quizOv").classList.contains("hide") || !$("mapOv").classList.contains("hide");
  me.moving = L > 0.15 && !S.paused && !qOpen;
  if (me.moving) {
    const sp = 4.2 * Math.min(1, L) / Math.max(1, L);
    const nx = me.x + vx * sp * dt, ny = me.y + vy * sp * dt;
    const stuck = !boxFree(me.x, me.y);
    if (stuck || boxFree(nx, me.y)) me.x = nx;
    if (stuck || boxFree(me.x, ny)) me.y = ny;
    me.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 0 : 2) : (vy < 0 ? 1 : 3);
    me.anim += dt * 10;
  }
  if (ts - lastSend > 100) {
    const k = `${me.x.toFixed(2)},${me.y.toFixed(2)},${me.dir},${me.moving}`;
    if (k !== lastSent || ts - lastSend > 1000) { net.emit("move", [+me.x.toFixed(2), +me.y.toFixed(2), me.dir, me.moving ? 1 : 0]); lastSent = k; lastSend = ts; }
  }
  for (const [id, o] of others) {
    if (ts - o.seen > 600) { others.delete(id); continue; }
    const k = Math.min(1, dt * 12); o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k;
    if (o.moving) o.anim += dt * 10;
  }
  if (S.lost && S.carry < 2) for (const it of S.lost) {
    if (near(it.x, it.y, 0.9) && !pickReq.has(it.id)) { pickReq.add(it.id); sendAct({ a: "pick", id: it.id }, () => {}); setTimeout(() => pickReq.delete(it.id), 1500); }
  }
  updateButtons(); holdTick();
  const a = areaAt(me.x, me.y); if (a) $("whereTxt").textContent = areaName(a);
  if (S.phase === "play") $("timeTxt").textContent = fmt(S.limit - S.t);
  draw(ts);
}
requestAnimationFrame(frame);

function drawChar(look, x, y, dir, moving, anim, sx, sy, broom) {
  const col = moving ? dir * 6 + (Math.floor(anim) % 6) : 24 + dir;
  const s = TP / 16;
  ctx.drawImage(imgChars, col * 16, look * 32, 16, 32, Math.round(sx(x) - 8 * s), Math.round(sy(y) - 30 * s), 16 * s, 32 * s);
  if (broom) ctx.drawImage(imgBroom, col * 16, 0, 16, 32, Math.round(sx(x) - 8 * s), Math.round(sy(y) - 30 * s), 16 * s, 32 * s);
}
function label(text, x, y, bg, fg = "#3a2e28", size = 13) {
  ctx.font = `${size}px Galmuri14, sans-serif`; const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = bg; ctx.strokeStyle = "#3a2e28"; ctx.lineWidth = 2;
  roundRect(x - w / 2, y - size - 6, w, size + 10, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y - size / 2 - 1);
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function visRects(x, y) {
  const a = areaAt(x, y); const rects = [];
  const add = id => {
    if (id === "hw" || id === "he") { const a1 = MAP.areas.find(q => q.id === "hw"), a2 = MAP.areas.find(q => q.id === "he"); rects.push([a1.x0, a1.fy, a2.x1, a2.y1]); for (const d of MAP.doors) rects.push(d.rect); return; }
    const A = MAP.areas.find(q => q.id === id); if (!A) return;
    rects.push([A.x0, A.fy, A.x1, A.y1]);
    for (const d of MAP.doors) if (d.area === id) rects.push(d.rect);
  };
  add(a);
  const d = onDoor(x, y); if (d) add("hw");
  return rects;
}
function draw(ts) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#2f2e3e"; ctx.fillRect(0, 0, VW, VH);
  const camX = me.x * TP - VW / 2, camY = (me.y - 0.6) * TP - VH / 2;
  const sx = x => x * TP - camX, sy = y => y * TP - camY;
  const k = TP / 48;
  // 맵
  const srcX = Math.max(0, camX / k), srcY = Math.max(0, camY / k);
  const dx = srcX * k - camX, dy = srcY * k - camY;
  const sw = Math.min(imgMap.width - srcX, VW / k + 2), sh = Math.min(imgMap.height - srcY, VH / k + 2);
  if (sw > 0 && sh > 0) ctx.drawImage(imgMap, srcX, srcY, sw, sh, dx, dy, sw * k, sh * k);
  // 어질러짐
  for (const m of S.messes || []) {
    const cx = m.door ? m.x + 1 : m.x + 0.5, cy = m.door ? m.y + 0.5 : m.y + 0.5;
    const i = MESS_IDX[m.kind];
    if (m.door) { const d = MAP.doors.find(q => q.id === m.door); const fy = d.y === 12 ? 13 : 21;
      for (const xx of [d.x, d.x + 1]) ctx.drawImage(imgDoor, sx(xx), sy(fy), TP, TP * 2); }
    ctx.drawImage(imgMess, i * 96, 0, 96, 96, sx(cx) - TP, sy(cy) - TP, TP * 2, TP * 2);
    const bob = Math.sin(ts / 200) * 3;
    ctx.fillStyle = "#e04a3f"; ctx.beginPath(); ctx.arc(sx(cx), sy(cy) - TP * 1.1 + bob, TP * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `bold ${TP * 0.3}px Galmuri14`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", sx(cx), sy(cy) - TP * 1.1 + bob + 1);
    if (m.fx != null && S.t - m.at < 12) {
      ctx.fillStyle = "rgba(70,60,80,0.75)";
      for (let i = 1; i <= 3; i++) {
        const px = cx + m.fx * i * 0.75, py = cy + m.fy * i * 0.75;
        const ox = -m.fy * 0.12 * (i % 2 ? 1 : -1), oy = m.fx * 0.12 * (i % 2 ? 1 : -1);
        ctx.beginPath(); ctx.ellipse(sx(px + ox), sy(py + oy), TP * 0.08, TP * 0.13, Math.atan2(m.fy, m.fx) + Math.PI / 2, 0, 7); ctx.fill();
      }
    }
  }
  // 분실물
  for (const it of S.lost || []) {
    const img = imgLost[it.kind]; if (!img) continue;
    const bob = Math.sin(ts / 260 + it.x) * 3;
    ctx.drawImage(img, sx(it.x + 0.5) - TP * 0.45, sy(it.y + 0.5) - TP * 0.45 + bob, TP * 0.9, TP * 0.9);
    ctx.fillStyle = "rgba(255,240,150,0.9)"; ctx.beginPath(); ctx.arc(sx(it.x + 0.5) + TP * 0.3, sy(it.y + 0.5) - TP * 0.4 + bob, 3, 0, 7); ctx.fill();
  }
  // 긴급 방송 자리
  if (S.gevent && S.gevent.type === "urgent") {
    const T = taskById(S.gevent.task);
    if (T) { const bob = Math.sin(ts / 150) * 5; const x = sx(T.x + 0.5), y = sy(T.y) - 14 + bob;
      ctx.fillStyle = "#e0302a"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y - 8, TP * 0.3, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = `bold ${TP * 0.38}px Galmuri14`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("!", x, y - 7); }
  }
  // 분실물 보관함 안내
  if (S.carry) label("분실물 보관함", sx(MAP.lostbox.x + 0.5), sy(MAP.lostbox.y) - 6 + Math.sin(ts / 250) * 3, "#ffe066");
  // 내 심부름 표시
  for (const t of S.tasks || []) if (!t.done) {
    const T = taskById(t.id); const bob = Math.sin(ts / 250) * 4;
    const x = sx(T.x + 0.5), y = sy(T.y) - 8 + bob;
    ctx.fillStyle = "#ffe066"; ctx.strokeStyle = "#3a2e28"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 9, y - 12); ctx.lineTo(x + 9, y - 12); ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // 비상벨 표시
  { const b = MAP.bell; const x = sx(b.x + 0.5), y = sy(b.y) - 18 + Math.sin(ts / 300) * 3; ctx.drawImage(imgBell, x - TP * 0.3, y - TP * 0.3, TP * 0.6, TP * 0.6); }
  if (S.blackout && imgBreakerOff) { const b = MAP.breaker; ctx.drawImage(imgBreakerOff, sx(b.x), sy(b.y), TP * 2, TP * 2); }
  // 사람들 (y 순서)
  const list = [...others.entries()].map(([id, o]) => ({ id, ...o, p: S.players.find(p => p.id === id) })).filter(o => o.p);
  list.push({ id: myId, x: me.x, y: me.y, dir: me.dir, moving: me.moving, anim: me.anim, p: S.me, self: true, flash: me.flash && me.flash.until > performance.now() ? me.flash.text : null });
  list.sort((a, b) => a.y - b.y);
  const dark = S.blackout && myRole !== "imp";
  for (const o of list) {
    if (dark && !o.self && Math.hypot(o.x - me.x, o.y - me.y) > 2.6) continue;
    drawChar(o.p.look, o.x, o.y, o.dir, o.moving, o.anim, sx, sy, (S.cleaners || []).includes(o.id) || (o.self && S.cleaner));
    const top = sy(o.y) - TP * 1.45;
    const cleaner = (S.cleaners || []).includes(o.id);
    if (o.self) label("나", sx(o.x), top, "#ffe066");
    else label(o.p.name + (cleaner ? " (청소 당번)" : ""), sx(o.x), top, (S.mates || []).includes(o.id) ? "#ffc1c1" : "#fff", "#3a2e28", 12);
    if (o.flash) label(o.flash, sx(o.x), top - 24, "#9fe0c4", "#3a2e28", 13);
  }
  // 시야 (둘레 5칸, 벽 너머 안 보임)
  fctx.setTransform(1, 0, 0, 1, 0, 0);
  fctx.globalCompositeOperation = "source-over"; fctx.clearRect(0, 0, fog.width, fog.height);
  fctx.fillStyle = "rgba(14,12,26,0.86)"; fctx.fillRect(0, 0, fog.width, fog.height);
  fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  fctx.globalCompositeOperation = "destination-out";
  fctx.save(); fctx.beginPath();
  for (const [x0, y0, x1, y1] of visRects(me.x, me.y)) fctx.rect(sx(x0), sy(y0), (x1 - x0 + 1) * TP, (y1 - y0 + 1) * TP);
  fctx.clip();
  const R = (S.blackout && myRole !== "imp" ? 2.2 : 5.2) * TP, cx = sx(me.x), cy = sy(me.y - 0.5);
  const g = fctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
  g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
  fctx.fillStyle = g; fctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  fctx.restore();
  // 벽 너머 가까운 곳은 살짝만
  fctx.globalCompositeOperation = "destination-out";
  const g2 = fctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.75); g2.addColorStop(0, "rgba(0,0,0,0.08)"); g2.addColorStop(1, "rgba(0,0,0,0)");
  fctx.fillStyle = g2; fctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(fog, 0, 0);
  if (S.blackout) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); const b = MAP.breaker; label("차단기를 고쳐요!", sx(b.x + 1), sy(b.y) - 8 + Math.sin(ts / 150) * 4, "#ffe066", "#3a2e28", 15); }
}

// 큰 지도
function drawBigMap() {
  const c = $("mapCv"), W = imgSmall.width, H = imgSmall.height, s = 12 / 1; // 1타일=12px
  c.width = W * 2; c.height = H * 2;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = true;
  g.drawImage(imgSmall, 0, 0, W * 2, H * 2);
  const Z = 24; // 1타일 = 24px
  g.textAlign = "center"; g.textBaseline = "middle";
  // 장난 자리 (장난꾸러기만)
  if (myRole === "imp" && !S.cleaner) for (const p of MAP.pranks) {
    const x = (p.door ? p.x + 1 : p.x + 0.5) * Z, y = (p.y + 0.5) * Z;
    g.fillStyle = "#e0302a"; g.strokeStyle = "#fff"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.stroke();
  }
  // 내 심부름 장소
  g.setLineDash([8, 6]);
  if (!engOn()) for (const t of S.tasks || []) if (!t.done) {
    const T = taskById(t.id); const A = MAP.areas.find(a => a.id === T.area);
    g.strokeStyle = "#2f6bd8"; g.lineWidth = 5; g.beginPath();
    g.ellipse((A.x0 + A.x1 + 1) / 2 * Z, (A.fy + A.y1 + 1) / 2 * Z, (A.x1 - A.x0 + 1) / 2 * Z + 4, (A.y1 - A.fy + 1) / 2 * Z + 4, 0, 0, 7); g.stroke();
  }
  g.setLineDash([]);
  // 장소 이름
  for (const A of MAP.areas) {
    if (A.id === "he") continue;
    const nm = engOn() ? (A.id === "hw" ? "Hallway 복도" : `${A.en.replace(/^the /, "").replace(/^./, c => c.toUpperCase())} ${A.name}`) : (A.id === "hw" ? "복도" : A.name);
    const x = A.id === "hw" ? 39 * Z : (A.x0 + A.x1 + 1) / 2 * Z, y = A.id === "hw" ? 17.3 * Z : (A.y0 + 1.5) * Z;
    g.font = engOn() ? "19px Galmuri14" : "26px Galmuri14"; const w = g.measureText(nm).width + 18;
    g.fillStyle = "rgba(255,250,240,.95)"; g.strokeStyle = "#3a2e28"; g.lineWidth = 3;
    g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - 18, w, 36, 10) : g.rect(x - w / 2, y - 18, w, 36); g.fill(); g.stroke();
    g.fillStyle = "#3a2e28"; g.fillText(nm, x, y + 1);
  }
  g.imageSmoothingEnabled = false;
  g.drawImage(imgBell, (MAP.bell.x + 0.5) * Z - 20, (MAP.bell.y + 0.5) * Z - 20, 40, 40);
  g.drawImage(imgBolt, (MAP.breaker.x + 1) * Z - 20, (MAP.breaker.y + 1) * Z - 20, 40, 40);
  // 나
  g.fillStyle = "#ffe066"; g.strokeStyle = "#3a2e28"; g.lineWidth = 4; g.beginPath(); g.arc(me.x * Z, me.y * Z, 14, 0, 7); g.fill(); g.stroke();
  g.fillStyle = "#3a2e28"; g.font = "18px Galmuri14"; g.fillText("나", me.x * Z, me.y * Z + 1);
}

// 처음 화면 미리보기 그림
ready.then(() => {
  const c = $("peek"); if (!c) return; const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  g.drawImage(imgMap, 34 * 48 - 40, 2 * 48, 640 * 1.5, 300 * 1.5, 0, 0, 640, 300);
  const looks = [3, 9, 14, 21]; looks.forEach((l, i) => g.drawImage(imgChars, 27 * 16, l * 32, 16, 32, 160 + i * 90, 150, 32, 64));
});

// ---------- 혼자 연습하기 ----------
async function startPractice() {
  await ready;
  const role = confirm("장난꾸러기로 연습할까요?\n확인 = 장난꾸러기 · 취소 = 도우미") ? "imp" : "helper";
  net = practiceNet(role);
}
function practiceNet(role) {
  const tasksPick = (ex = []) => { const by = {}; for (const t of MAP.tasks) if (!ex.includes(t.id)) (by[t.area] ||= []).push(t.id); return Object.keys(by).sort(() => Math.random() - .5).slice(0, 4).map(a => ({ id: by[a][Math.random() * by[a].length | 0], done: false })); };
  const P = { id: "me", name: myName, look: Math.random() * 32 | 0, on: true };
  const st = { t: 0, limit: 300, target: 14, shown: 0, pend: 0, tasks: tasksPick(), messes: [], pending: [], lastPrank: -999, bellUsed: false, lastMeet: -999, phase: "play" };
  const N = { practice: true, emit(ev, d, cb) {
    if (ev !== "act") return;
    const r = act(d); cb && cb(r);
  } };
  function act(d) {
    if (d.a === "task") { const t = st.tasks.find(x => x.id === d.id); if (!t) return { err: "?" }; t.done = true; if (role === "helper") st.pend++; if (st.tasks.every(x => x.done)) st.tasks = tasksPick(st.tasks.map(x => x.id)); push(); return { ok: true }; }
    if (d.a === "clean") { st.messes = st.messes.filter(m => m.id !== d.id); push(); return { ok: true }; }
    if (d.a === "prank") { if (st.t < 5 || st.t - st.lastPrank < 15) return { err: "아직 쉬는 중이에요" }; const s = MAP.pranks.find(p => p.id === d.id); st.lastPrank = st.t; st.pending.push({ s, at: st.t + 10 }); push(); return { ok: true, text: KIND_NAME[s.kind] + " 성공! (연습: 10초 뒤 드러나요)" }; }
    if (d.a === "report") { const m = st.messes.find(x => x.id === d.id); if (m) m.used = true; toast("회의가 열려요! (연습이라 바로 이어서 해요)", 2500); st.lastMeet = st.t; push(); return { ok: true }; }
    if (d.a === "bell") { if (st.bellUsed) return { err: "비상벨은 한 판에 한 번이에요" }; if (!near(MAP.bell.ax, MAP.bell.ay, 2.5)) return { err: "비상벨 앞에서 눌러요" }; st.bellUsed = true; st.lastMeet = st.t; toast("비상벨! 회의가 열려요 (연습)", 2500); push(); return { ok: true }; }
  }
  function push() {
    onState({ phase: st.phase, paused: false, me: P, code: "연습", players: [P], settings: { english: englishMode }, t: Math.floor(st.t), limit: st.limit, progress: st.shown / st.target,
      role, cleaner: false, tasks: st.tasks, bellUsed: st.bellUsed, messCount: st.messes.length, messes: st.messes, lockedDoors: st.messes.filter(m => m.door).map(m => m.door), cleaners: [],
      canMeet: st.t - st.lastMeet >= 5, bellOpen: true, prankReady: Math.max(0, Math.max(5 - st.t, st.lastPrank + 15 - st.t)), busySpots: st.pending.map(p => p.s.id).concat(st.messes.map(m => m.spot)), mates: [],
      winner: st.winner, reason: st.reason, impsRevealed: null });
  }
  myRole = role; myMates = [];
  englishMode = confirm("과학 문제도 함께 연습할까요? (2단원·3단원 섞어서)\n확인 = 과학 문제 켜기 · 취소 = 끄기") ? "mix" : "off";
  const s0 = MAP.spawns[Math.random() * MAP.spawns.length | 0]; me.x = s0[0] + .5; me.y = s0[1] + .5;
  let flushAt = 10;
  setInterval(() => {
    if (st.phase !== "play") return;
    st.t += 1;
    for (const p of st.pending.slice()) if (st.t >= p.at) {
      st.pending.splice(st.pending.indexOf(p), 1);
      st.messes.push({ id: "m" + Math.random().toString(36).slice(2, 7), spot: p.s.id, kind: p.s.kind, x: p.s.x, y: p.s.y, ax: p.s.ax, ay: p.s.ay, door: p.s.door || null, used: false });
      st.shown = Math.max(0, st.shown - st.target * 0.02); toast("어딘가 어질러졌어요!");
    }
    if (st.t >= flushAt) { st.shown = Math.min(st.target, st.shown + st.pend); st.pend = 0; flushAt += 10; }
    if (st.shown >= st.target) { st.phase = "end"; st.winner = "helper"; st.reason = "모두의 심부름을 다 했어요"; }
    else if (st.messes.length >= 5) { st.phase = "end"; st.winner = "imp"; st.reason = "어질러진 곳이 5곳이 되었어요"; }
    else if (st.t >= st.limit) { st.phase = "end"; st.winner = role === "imp" ? "imp" : "imp"; st.reason = "연습 시간이 다 지났어요"; }
    push();
  }, 1000);
  screen("game"); fitCanvas(); push();
  toast(role === "imp" ? "장난꾸러기 연습! 지도의 빨간 점에서 장난쳐요" : "도우미 연습! 노란 화살표가 내 심부름이에요", 3000);
  return N;
}
