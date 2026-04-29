const root = document.querySelector("#gameRoot");
const gameSideRanking = document.querySelector("#gameSideRanking");
const actions = document.querySelector("#gameActions");
const title = document.querySelector("#gameTitle");
const hint = document.querySelector("#gameHint");
const homeScreen = document.querySelector("#homeScreen");
const gameScreen = document.querySelector("#gameScreen");
const userStatus = document.querySelector("#userStatus");
const gameHomeButton = document.querySelector("#gameHomeButton");
const opacitySlider = document.querySelector("#opacitySlider");
const opacityValue = document.querySelector("#opacityValue");
const tabs = [...document.querySelectorAll(".tab")];
const confirmModal = document.querySelector("#confirmModal");
const confirmTitle = document.querySelector("#confirmTitle");
const confirmText = document.querySelector("#confirmText");
const cancelRestart = document.querySelector("#cancelRestart");
const confirmRestart = document.querySelector("#confirmRestart");
const authModal = document.querySelector("#authModal");
const authTitle = document.querySelector("#authTitle");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
const nicknameField = document.querySelector("#nicknameField");
const submitAuthButton = document.querySelector("#submitAuth");
const cancelAuth = document.querySelector("#cancelAuth");

const suits = ["spades", "hearts", "diamonds", "clubs"];
const suitMarks = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const values = Object.fromEntries(ranks.map((rank, index) => [rank, index + 1]));
const redSuits = new Set(["hearts", "diamonds"]);

let currentGame = "klondike";
let state = null;
let drag = null;
let dragGhost = null;
let draggedElements = [];
let mineTimer = null;
let cardSeq = 0;
let pendingGame = null;
let pendingAction = null;
let klondikeDrawCount = 1;
let currentUser = JSON.parse(localStorage.getItem("jerryUser") || "null");
let authMode = "login";

const gameInfo = {
  klondike: ["클론다이크 솔리테어", "A부터 K까지 네 무늬를 foundation에 올려보세요."],
  spider: ["스파이더 솔리테어", "같은 무늬 K부터 A까지 완성한 줄을 제거하세요."],
  freecell: ["프리셀", "빈 칸 4개를 활용해서 모든 카드를 foundation에 올려보세요."],
  minesweeper: ["지뢰찾기", "숫자를 단서로 지뢰를 피하고 모든 안전 칸을 여세요."],
};

const gameCards = [
  ["klondike", "클론다이크", "윈도우 감성의 대표 솔리테어"],
  ["spider", "스파이더", "같은 무늬의 K-A 줄을 완성"],
  ["freecell", "프리셀", "빈 칸 네 개로 푸는 전략 카드 퍼즐"],
  ["minesweeper", "지뢰찾기", "숫자를 따라 안전 칸을 찾아내기"],
];

const rankingSummaryModes = [
  { kind: "score", mode: "overall", label: "주간 점수 랭킹", game: "overall", period: "weekly" },
  { kind: "score", mode: "overall", label: "전체 점수 랭킹", game: "overall", period: "all" },
  { kind: "activity", mode: "activity", label: "오늘 최다 클리어", game: "activity", period: "daily" },
  { kind: "activity", mode: "activity", label: "이번 주 최다 클리어", game: "activity", period: "weekly" },
];

const gameRankingModes = [
  { kind: "score", mode: "klondike-draw-1", label: "클론다이크 1장", game: "klondike", period: "weekly" },
  { kind: "score", mode: "klondike-draw-3", label: "클론다이크 3장", game: "klondike", period: "weekly" },
  { kind: "score", mode: "spider-1-suit", label: "스파이더 1벌", game: "spider", period: "weekly" },
  { kind: "score", mode: "spider-2-suit", label: "스파이더 2벌", game: "spider", period: "weekly" },
  { kind: "score", mode: "spider-4-suit", label: "스파이더 4벌", game: "spider", period: "weekly" },
  { kind: "score", mode: "freecell-standard", label: "프리셀", game: "freecell", period: "weekly" },
  { kind: "score", mode: "minesweeper-beginner", label: "지뢰찾기 초급", game: "minesweeper", period: "weekly" },
  { kind: "score", mode: "minesweeper-intermediate", label: "지뢰찾기 중급", game: "minesweeper", period: "weekly" },
  { kind: "score", mode: "minesweeper-expert", label: "지뢰찾기 고급", game: "minesweeper", period: "weekly" },
];

tabs.forEach((tab) => {
  tab.addEventListener("click", () => handleTabClick(tab.dataset.game));
});
gameHomeButton.addEventListener("click", showHome);
opacitySlider.addEventListener("input", () => applyOpacity(Number(opacitySlider.value)));
applyOpacity(Number(localStorage.getItem("jerryOpacity") || 100));

cancelRestart.addEventListener("click", closeRestartModal);
confirmRestart.addEventListener("click", () => {
  const action = pendingAction;
  const game = pendingGame;
  closeRestartModal();
  if (action) action();
  else if (game) startGame(game);
});
confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal) closeRestartModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeRestartModal();
    closeAuthModal();
  }
});
cancelAuth.addEventListener("click", closeAuthModal);
authModal.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuthModal();
});
authModal.querySelectorAll("[data-auth-mode]").forEach((buttonEl) => {
  buttonEl.addEventListener("click", () => setAuthMode(buttonEl.dataset.authMode));
});
authForm.addEventListener("submit", submitAuth);

function handleTabClick(game) {
  if (!hasGameProgress()) {
    startGame(game);
    return;
  }

  openRestartModal({
    game,
    action: () => startGame(game),
  });
}

function applyOpacity(value) {
  const opacity = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 100));
  opacitySlider.value = String(opacity);
  opacityValue.textContent = `${opacity}%`;
  document.documentElement.style.setProperty("--app-opacity", String(opacity / 100));
  localStorage.setItem("jerryOpacity", String(opacity));
}

function openRestartModal({ game = currentGame, action, text, confirmLabel } = {}) {
  pendingGame = game;
  pendingAction = action;
  confirmTitle.textContent = "새 게임을 시작하겠습니까?";
  confirmText.textContent =
    text ||
    (game === currentGame
      ? `${gameInfo[game][0]} 진행 상황이 사라집니다.`
      : `${gameInfo[currentGame][0]} 진행 상황이 사라지고 ${gameInfo[game][0]}으로 이동합니다.`);
  confirmRestart.textContent = confirmLabel || (game === currentGame ? "새 게임" : "이동하기");
  confirmModal.classList.remove("hidden");
  confirmRestart.focus();
}

function closeRestartModal() {
  pendingGame = null;
  pendingAction = null;
  confirmModal.classList.add("hidden");
}

function hasGameProgress() {
  return Boolean(state?.dirty);
}

function markProgress() {
  if (state) state.dirty = true;
  if (isCardGame()) startGameTimer();
}

function isCardGame() {
  return ["klondike", "freecell", "spider"].includes(currentGame);
}

function recordMove() {
  if (state && isCardGame()) state.moves += 1;
  markProgress();
}

function startGameTimer() {
  if (mineTimer || !state || state.won) return;
  mineTimer = setInterval(() => {
    if (!state.won && !state.ended) {
      state.seconds += 1;
      updateGameStatsDisplay();
    }
  }, 1000);
}

function updateGameStatsDisplay() {
  const stats = document.querySelector("#gameStats");
  if (stats && state) stats.textContent = gameStatsText();
}

function gameStatsText(extra = "") {
  const parts = [];
  if (typeof state.moves === "number") parts.push(`이동 ${state.moves}`);
  parts.push(`시간 ${formatTime(state.seconds || 0)}`);
  if (extra) parts.push(extra);
  return parts.join(" · ");
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function createStatsMessage(extra = "") {
  const el = message(gameStatsText(extra));
  el.id = "gameStats";
  el.classList.add("stat-line");
  return el;
}

function showHome() {
  if (hasGameProgress()) {
    openRestartModal({
      action: () => {
        state.dirty = false;
        showHome();
      },
      text: `${gameInfo[currentGame][0]} 진행 상황이 사라지고 메인으로 이동합니다.`,
      confirmLabel: "메인으로",
    });
    return;
  }

  clearInterval(mineTimer);
  mineTimer = null;
  gameScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");
  actions.innerHTML = "";
  root.innerHTML = "";
  state = null;
  renderHome();
}

function enterGame(game) {
  homeScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  startGame(game);
}

function startGame(game) {
  clearInterval(mineTimer);
  mineTimer = null;
  currentGame = game;
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.game === game));
  title.textContent = gameInfo[game][0];
  hint.textContent = gameInfo[game][1];
  root.innerHTML = "";
  actions.innerHTML = "";
  drag = null;

  if (game === "minesweeper") initMinesweeper();
  if (game === "klondike") initKlondike();
  if (game === "freecell") initFreeCell();
  if (game === "spider") initSpider();
  loadGameSideRanking();
}

function renderUserStatus() {
  if (!currentUser) {
    userStatus.innerHTML = `<button class="action primary" type="button" id="openAuthTop">로그인</button>`;
    userStatus.querySelector("#openAuthTop").addEventListener("click", openAuthModal);
    return;
  }

  if (currentUser.guest) {
    userStatus.innerHTML = `<button class="action primary" type="button" id="openAuthTop">로그인</button>`;
    userStatus.querySelector("#openAuthTop").addEventListener("click", openAuthModal);
    return;
  }

  userStatus.innerHTML = `
    <span class="status-pill">${escapeHtml(currentUser.nickname)}</span>
    <button class="action" type="button" id="logoutButton">로그아웃</button>
  `;
  userStatus.querySelector("#logoutButton").addEventListener("click", logout);
}

function renderHome() {
  renderUserStatus();
  homeScreen.innerHTML = `
    <section class="home-panel game-picker">
      <div class="panel-head">
        <h2>게임 선택</h2>
        <p>${currentUser && !currentUser.guest ? "클리어 기록은 랭킹에 저장됩니다." : "로그인하지 않아도 게스트로 바로 플레이할 수 있습니다."}</p>
      </div>
      <div class="game-cards">
        ${gameCards
          .map(
            ([id, name, description]) => `
              <button class="game-card" type="button" data-start-game="${id}">
                <span>${name}</span>
                <small>${description}</small>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="home-panel ranking-panel">
      <div class="panel-head">
        <h2>랭킹 요약</h2>
        <p>잘하는 사람과 많이 하는 사람을 함께 보여줍니다.</p>
      </div>
      <div class="ranking-board summary-board" id="summaryRankingBoard"></div>
    </section>

    <section class="home-panel ranking-panel">
      <div class="panel-head">
        <h2>게임별 주간 랭킹</h2>
        <p>각 게임과 난이도별 이번 주 최고 점수입니다.</p>
      </div>
      <div class="ranking-board" id="gameRankingBoard"></div>
    </section>
  `;

  homeScreen.querySelectorAll("[data-start-game]").forEach((buttonEl) => {
    buttonEl.addEventListener("click", () => enterGame(buttonEl.dataset.startGame));
  });
  loadRankingBoard();
}

async function loadRankingBoard() {
  await Promise.all([loadRankingSection("#summaryRankingBoard", rankingSummaryModes), loadRankingSection("#gameRankingBoard", gameRankingModes)]);
}

async function loadRankingSection(selector, configs) {
  const board = homeScreen.querySelector(selector);
  board.innerHTML = configs.map(({ label }) => rankingCardTemplate(label, "랭킹을 불러오는 중입니다.")).join("");

  const results = await Promise.allSettled(configs.map((config) => fetchRanking(config)));
  board.innerHTML = results
    .map((result, index) => {
      const config = configs[index];
      if (result.status === "rejected") return rankingCardTemplate(config.label, "랭킹 API 연결 전입니다.");
      return rankingCardTemplate(
        config.label,
        renderRankingRows(result.value.rankings, config.kind === "score" && config.mode === "overall", config.kind),
        result.value.me,
      );
    })
    .join("");
}

async function loadGameSideRanking() {
  if (!gameSideRanking || gameScreen.classList.contains("hidden") || !state) return;
  const config = getCurrentRankingConfig();
  if (!config) {
    gameSideRanking.innerHTML = "";
    return;
  }

  const requestedMode = config.mode;
  const activityConfig = { ...config, kind: "activity", period: "daily" };
  gameSideRanking.innerHTML = [
    rankingCardTemplate(`${config.label} 주간 랭킹`, "랭킹을 불러오는 중입니다."),
    rankingCardTemplate(`${config.label} 오늘 클리어 횟수`, "랭킹을 불러오는 중입니다."),
  ].join("");
  try {
    const [scoreResult, activityResult] = await Promise.all([fetchRanking(config), fetchRanking(activityConfig)]);
    if (getCurrentMode() !== requestedMode || gameScreen.classList.contains("hidden")) return;
    gameSideRanking.innerHTML = [
      rankingCardTemplate(`${config.label} 주간 랭킹`, renderRankingRows(scoreResult.rankings, false), scoreResult.me),
      rankingCardTemplate(
        `${config.label} 오늘 클리어 횟수`,
        renderRankingRows(activityResult.rankings, false, "activity"),
        activityResult.me,
      ),
    ].join("");
  } catch (error) {
    if (getCurrentMode() !== requestedMode || gameScreen.classList.contains("hidden")) return;
    gameSideRanking.innerHTML = [
      rankingCardTemplate(`${config.label} 주간 랭킹`, "랭킹 API 연결 전입니다."),
      rankingCardTemplate(`${config.label} 오늘 클리어 횟수`, "랭킹 API 연결 전입니다."),
    ].join("");
  }
}

function getCurrentRankingConfig() {
  const mode = getCurrentMode();
  if (!mode) return null;
  return gameRankingModes.find((config) => config.mode === mode) || null;
}

async function fetchRanking({ kind, mode, game, period }) {
  try {
    const userQuery =
      currentUser && !currentUser.guest && currentUser.id
        ? `&userPk=${encodeURIComponent(currentUser.id)}`
        : currentUser && !currentUser.guest && currentUser.user_id
          ? `&userId=${encodeURIComponent(currentUser.user_id)}`
          : "";
    const periodQuery = `&period=${encodeURIComponent(period || "weekly")}`;
    const activityFilterQuery =
      kind === "activity" && game && game !== "activity"
        ? `${game ? `&game=${encodeURIComponent(game)}` : ""}${mode ? `&mode=${encodeURIComponent(mode)}` : ""}`
        : "";
    const url =
      kind === "activity"
        ? `/api/rankings?kind=activity&limit=5${activityFilterQuery}${periodQuery}${userQuery}`
        : mode === "overall"
          ? `/api/rankings?overall=true&limit=5${periodQuery}${userQuery}`
          : `/api/rankings?game=${game}&mode=${mode}&limit=5${periodQuery}${userQuery}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Ranking request failed.");
    return response.json();
  } catch (error) {
    throw error;
  }
}

function rankingCardTemplate(titleText, content, me = null) {
  return `
    <article class="ranking-card">
      <div class="ranking-card-head">
        <h3>${titleText}</h3>
        ${renderMyRankBadge(me)}
      </div>
      <div class="ranking-list">${content}</div>
    </article>
  `;
}

function renderMyRankBadge(me) {
  if (!currentUser || currentUser.guest) return "";
  if (!me) return `<span class="my-rank empty">내 기록 없음</span>`;
  return `<span class="my-rank">내 순위 ${me.rank}위</span>`;
}

function renderRankingRows(rows, overall, kind = "score") {
  if (!rows.length) return `<p class="empty-ranking">아직 기록이 없습니다.</p>`;
  return rows
    .map((row, index) => {
      const score = kind === "activity" ? `${row.clears}회` : overall ? row.total_score : row.score;
      const seconds = overall ? row.total_seconds : row.seconds;
      const moves = overall ? row.total_moves : row.moves;
      const displayName = row.nickname || row.user_id || "Player";
      const safeName = escapeHtml(displayName);
      return `
        <div class="ranking-row">
          <strong>${index + 1}</strong>
          <span title="${safeName}" tabindex="0">${safeName}</span>
          <b>${score}</b>
          <small>${kind === "activity" ? `${row.total_score}점 · ${row.total_seconds}s` : `${seconds}s${moves ? ` · ${moves} moves` : ""}`}</small>
        </div>
      `;
    })
    .join("");
}

async function submitAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payload = {
    userId: String(form.get("userId") || "").trim(),
    password: String(form.get("password") || ""),
  };
  if (authMode === "register") payload.nickname = String(form.get("nickname") || "").trim();

  try {
    const response = await fetch(`/api/auth/${authMode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Auth failed.");
    currentUser = { ...data.user, guest: false };
    localStorage.setItem("jerryUser", JSON.stringify(currentUser));
    closeAuthModal();
    renderHome();
  } catch (error) {
    authMessage.textContent = error.message;
  }
}

function openAuthModal() {
  setAuthMode("login");
  authModal.classList.remove("hidden");
  authForm.elements.userId.focus();
}

function closeAuthModal() {
  authModal.classList.add("hidden");
  authForm.reset();
  authMessage.textContent = "";
}

function setAuthMode(mode) {
  authMode = mode;
  authTitle.textContent = mode === "register" ? "회원가입" : "로그인";
  nicknameField.classList.toggle("hidden", mode !== "register");
  submitAuthButton.textContent = mode === "register" ? "가입하기" : "로그인";
  authForm.elements.password.autocomplete = mode === "register" ? "new-password" : "current-password";
  authModal.querySelectorAll("[data-auth-mode]").forEach((buttonEl) => {
    buttonEl.classList.toggle("primary", buttonEl.dataset.authMode === mode);
  });
  authMessage.textContent = "";
}

function logout() {
  currentUser = null;
  localStorage.removeItem("jerryUser");
  renderHome();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function button(label, onClick, primary = false) {
  const el = document.createElement("button");
  el.className = `action${primary ? " primary" : ""}`;
  el.type = "button";
  el.textContent = label;
  el.addEventListener("click", onClick);
  actions.append(el);
  return el;
}

function select(options, onChange) {
  const el = document.createElement("select");
  el.className = "select";
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    el.append(option);
  });
  el.addEventListener("change", (event) => onChange(el.value, event, el));
  actions.append(el);
  return el;
}

function deck(count = 1, suitSet = suits) {
  const cards = [];
  for (let pack = 0; pack < count; pack++) {
    for (const suit of suitSet) {
      for (const rank of ranks) {
        cards.push({
          id: `${suit}-${rank}-${pack}-${cardSeq++}`,
          suit,
          rank,
          value: values[rank],
          faceUp: false,
        });
      }
    }
  }
  return cards;
}

function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function cardColor(card) {
  return redSuits.has(card.suit) ? "red" : "black";
}

function renderCard(card, source, index, offset = index) {
  const el = document.createElement("div");
  el.className = `card ${cardColor(card)}${card.faceUp ? "" : " face-down"}`;
  el.style.setProperty("--offset", offset);
  el.dataset.cardId = card.id;
  el.dataset.source = source;
  el.dataset.index = index;

  if (card.faceUp) {
    el.draggable = true;
    el.innerHTML = `<span class="rank">${card.rank}${suitMarks[card.suit]}</span><span class="suit">${suitMarks[card.suit]}</span><span class="rank corner">${card.rank}${suitMarks[card.suit]}</span>`;
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("dragend", onDragEnd);
    el.addEventListener("dblclick", () => autoMove(card.id, source, index));
  }

  if (state?.animatingDeal?.has(card.id)) {
    el.classList.add("deal-in");
    el.style.animationDelay = `${Math.min(index, 9) * 45}ms`;
  }
  if (state?.animatingComplete?.has(card.id)) {
    el.classList.add("complete-out");
    el.style.animationDelay = `${Math.min(index, 12) * 28}ms`;
  }

  return el;
}

function renderPile(className, target, cards, source, spacing = 26) {
  const pile = document.createElement("div");
  pile.className = `pile ${className}`;
  pile.dataset.target = target;
  pile.addEventListener("dragover", (event) => event.preventDefault());
  pile.addEventListener("drop", onDrop);
  cards.forEach((card, index) => {
    const cardEl = renderCard(card, source, index, spacing === 0 ? 0 : index);
    cardEl.style.top = `${index * spacing}px`;
    pile.append(cardEl);
  });
  return pile;
}

function renderTopPile(className, target, pile, source) {
  const el = renderPile(className, target, [], source, 0);
  const card = topCard(pile);
  if (card) el.append(renderCard(card, source, pile.length - 1, 0));
  return el;
}

function pileBySource(source) {
  const [type, rawIndex] = source.split("-");
  const index = Number(rawIndex);
  if (type === "waste") return state.waste;
  if (type === "stock") return state.stock;
  if (type === "tableau") return state.tableau[index];
  if (type === "foundation") return state.foundation[index];
  if (type === "free") return state.free[index];
  return [];
}

function removeDraggedCards() {
  const pile = pileBySource(drag.source);
  const moved = pile.splice(drag.index);
  revealLastTableau(drag.source);
  return moved;
}

function revealLastTableau(source) {
  if (!source.startsWith("tableau-")) return;
  const pile = pileBySource(source);
  if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
}

function topCard(pile) {
  return pile[pile.length - 1];
}

function canFoundation(card, pile) {
  if (!card.faceUp) return false;
  const top = topCard(pile);
  return top ? top.suit === card.suit && card.value === top.value + 1 : card.value === 1;
}

function canKlondikeTableau(cards, pile) {
  if (!cards.length) return false;
  const first = cards[0];
  const top = topCard(pile);
  return top
    ? top.faceUp && cardColor(top) !== cardColor(first) && first.value === top.value - 1
    : first.value === 13;
}

function canFreeCellTableau(cards, pile) {
  if (cards.length !== 1) return false;
  return canKlondikeTableau(cards, pile) || !pile.length;
}

function canSpiderTableau(cards, pile) {
  if (!cards.length) return false;
  if (!isSameSuitRun(cards)) return false;
  const first = cards[0];
  const top = topCard(pile);
  return top ? top.faceUp && first.value === top.value - 1 : true;
}

function isSameSuitRun(cards) {
  return cards.every((card, index) => {
    if (!card.faceUp) return false;
    if (index === 0) return true;
    return card.suit === cards[index - 1].suit && card.value === cards[index - 1].value - 1;
  });
}

function onDragStart(event) {
  const source = event.currentTarget.dataset.source;
  const index = Number(event.currentTarget.dataset.index);
  const pile = pileBySource(source);
  const cards = pile.slice(index);
  if (!cards[0]?.faceUp) {
    event.preventDefault();
    return;
  }
  if (currentGame === "freecell" && cards.length > 1) {
    event.preventDefault();
    return;
  }
  if (currentGame === "spider" && !isSameSuitRun(cards)) {
    event.preventDefault();
    return;
  }
  drag = { source, index, cards };
  event.dataTransfer.setData("text/plain", cards[0].id);
  markDraggedElements(source, index);
  setTransparentDragImage(event);
}

function setTransparentDragImage(event) {
  cleanupDragGhost();
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  const opacity = getComputedStyle(document.documentElement).getPropertyValue("--app-opacity").trim() || "1";
  ghost.style.opacity = Math.max(0.01, Number(opacity) * 0.12);

  drag.cards.slice(0, 5).forEach((card, index) => {
    const cardEl = renderCard(card, drag.source, drag.index + index, index);
    cardEl.style.position = "absolute";
    cardEl.style.left = "0";
    cardEl.style.top = `${index * 22}px`;
    cardEl.draggable = false;
    ghost.append(cardEl);
  });

  document.body.append(ghost);
  dragGhost = ghost;
  event.dataTransfer.setDragImage(ghost, 28, 28);
}

function onDragEnd() {
  drag = null;
  clearDraggedElements();
  cleanupDragGhost();
}

function cleanupDragGhost() {
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
}

function markDraggedElements(source, index) {
  clearDraggedElements();
  const opacity = getComputedStyle(document.documentElement).getPropertyValue("--app-opacity").trim() || "1";
  draggedElements = [...document.querySelectorAll(`[data-source="${source}"]`)].filter((el) => Number(el.dataset.index) >= index);
  draggedElements.forEach((el) => {
    el.classList.add("dragging-card");
    el.style.opacity = opacity;
  });
}

function clearDraggedElements() {
  draggedElements.forEach((el) => {
    el.classList.remove("dragging-card");
    el.style.opacity = "";
  });
  draggedElements = [];
}

function onDrop(event) {
  event.preventDefault();
  if (!drag) return;
  const target = event.currentTarget.dataset.target;
  if (target === drag.source) return;

  const [type, rawIndex] = target.split("-");
  const index = Number(rawIndex);
  let valid = false;

  if (currentGame === "klondike") {
    if (type === "foundation" && drag.cards.length === 1) valid = canFoundation(drag.cards[0], state.foundation[index]);
    if (type === "tableau") valid = canKlondikeTableau(drag.cards, state.tableau[index]);
  }

  if (currentGame === "freecell") {
    if (type === "foundation" && drag.cards.length === 1) valid = canFoundation(drag.cards[0], state.foundation[index]);
    if (type === "free" && drag.cards.length === 1 && state.free[index].length === 0) valid = true;
    if (type === "tableau") valid = canFreeCellTableau(drag.cards, state.tableau[index]);
  }

  if (currentGame === "spider") {
    if (type === "tableau") valid = canSpiderTableau(drag.cards, state.tableau[index]);
  }

  if (!valid) return;
  const moved = removeDraggedCards();
  if (type === "foundation") state.foundation[index].push(...moved);
  if (type === "free") state.free[index].push(...moved);
  if (type === "tableau") state.tableau[index].push(...moved);
  afterMove();
}

function afterMove() {
  recordMove();
  if (currentGame === "spider") clearSpiderRuns();
  renderCurrent();
  loadGameSideRanking();
}

function autoMove(cardId, source, index) {
  if (currentGame === "spider") return;
  const pile = pileBySource(source);
  const card = pile[index];
  if (!card || index !== pile.length - 1) return;
  const foundationIndex = state.foundation.findIndex((foundation) => canFoundation(card, foundation));
  if (foundationIndex === -1) return;
  recordMove();
  pile.pop();
  revealLastTableau(source);
  state.foundation[foundationIndex].push(card);
  renderCurrent();
  loadGameSideRanking();
}

function initKlondike(drawCount = klondikeDrawCount) {
  actions.innerHTML = "";
  klondikeDrawCount = Number(drawCount);
  state = {
    dirty: false,
    moves: 0,
    seconds: 0,
    won: false,
    scoreShown: false,
    drawCount: klondikeDrawCount,
    stock: shuffle(deck()),
    waste: [],
    foundation: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
  };
  for (let column = 0; column < 7; column++) {
    for (let row = 0; row <= column; row++) {
      const card = state.stock.pop();
      card.faceUp = row === column;
      state.tableau[column].push(card);
    }
  }
  button("새 게임", () => initKlondike(state.drawCount), true);
  const drawMode = select(
    [
      [1, "1장 넘기기"],
      [3, "3장 넘기기"],
    ],
    handleKlondikeDrawModeChange,
  );
  drawMode.value = String(state.drawCount);
  button("카드 넘기기", drawKlondike);
  renderCurrent();
  loadGameSideRanking();
}

function handleKlondikeDrawModeChange(value, event, drawMode) {
  const nextDrawCount = Number(value);
  if (nextDrawCount === state.drawCount) return;

  if (!hasGameProgress()) {
    initKlondike(nextDrawCount);
    return;
  }

  const previousDrawCount = state.drawCount;
  if (drawMode) drawMode.value = String(previousDrawCount);

  openRestartModal({
    game: "klondike",
    action: () => initKlondike(nextDrawCount),
    text: `넘기기 옵션을 ${nextDrawCount}장으로 바꾸면 현재 클론다이크 진행 상황이 사라집니다.`,
    confirmLabel: "변경하기",
  });
}

function drawKlondike() {
  recordMove();
  if (state.stock.length) {
    const count = Math.min(state.drawCount, state.stock.length);
    for (let index = 0; index < count; index++) {
      const card = state.stock.pop();
      card.faceUp = true;
      state.waste.push(card);
    }
  } else {
    state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    state.waste = [];
  }
  renderCurrent();
  loadGameSideRanking();
}

function initFreeCell() {
  actions.innerHTML = "";
  const cards = shuffle(deck()).map((card) => ({ ...card, faceUp: true }));
  state = {
    dirty: false,
    moves: 0,
    seconds: 0,
    won: false,
    scoreShown: false,
    free: [[], [], [], []],
    foundation: [[], [], [], []],
    tableau: Array.from({ length: 8 }, () => []),
  };
  cards.forEach((card, index) => state.tableau[index % 8].push(card));
  button("새 게임", initFreeCell, true);
  renderCurrent();
  loadGameSideRanking();
}

function initSpider(suitCount = 1) {
  const activeSuits = suitCount === 1 ? ["spades"] : suitCount === 2 ? ["spades", "hearts"] : suits;
  const packs = 8 / activeSuits.length;
  const cards = shuffle(deck(packs, activeSuits));
  state = {
    dirty: false,
    moves: 0,
    seconds: 0,
    won: false,
    scoreShown: false,
    suitCount,
    stock: [],
    completed: 0,
    pendingRunRemoval: false,
    animatingDeal: new Set(),
    animatingComplete: new Set(),
    tableau: Array.from({ length: 10 }, () => []),
  };
  for (let column = 0; column < 10; column++) {
    const count = column < 4 ? 6 : 5;
    for (let row = 0; row < count; row++) {
      const card = cards.pop();
      card.faceUp = row === count - 1;
      state.tableau[column].push(card);
    }
  }
  while (cards.length) {
    state.stock.push(cards.splice(0, 10).map((card) => ({ ...card, faceUp: false })));
  }
  actions.innerHTML = "";
  button("새 게임", () => initSpider(Number(document.querySelector("#spiderMode")?.value || suitCount)), true);
  const mode = select(
    [
      [1, "1벌"],
      [2, "2벌"],
      [4, "4벌"],
    ],
    (value) => initSpider(Number(value)),
  );
  mode.id = "spiderMode";
  mode.value = String(suitCount);
  button("한 줄 배분", dealSpider);
  renderCurrent();
  loadGameSideRanking();
}

function dealSpider() {
  if (!state.stock.length || state.tableau.some((pile) => pile.length === 0)) return;
  recordMove();
  const row = state.stock.pop();
  state.animatingDeal = new Set(row.map((card) => card.id));
  row.forEach((card, index) => {
    card.faceUp = true;
    state.tableau[index].push(card);
  });
  renderCurrent();
  loadGameSideRanking();
  setTimeout(() => {
    if (currentGame !== "spider" || !state) return;
    state.animatingDeal.clear();
    clearSpiderRuns();
    renderCurrent();
    loadGameSideRanking();
  }, 620);
}

function clearSpiderRuns() {
  if (state.pendingRunRemoval) return;
  for (const pile of state.tableau) {
    if (pile.length < 13) continue;
    const run = pile.slice(-13);
    if (run[0].value === 13 && run[12].value === 1 && isSameSuitRun(run)) {
      state.pendingRunRemoval = true;
      state.animatingComplete = new Set(run.map((card) => card.id));
      renderCurrent();
      setTimeout(() => {
        if (currentGame !== "spider" || !state) return;
        const currentRun = pile.slice(-13);
        if (currentRun.length === 13 && currentRun.every((card, index) => card.id === run[index].id)) {
          pile.splice(-13);
          state.completed += 1;
          if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
        }
        state.animatingComplete.clear();
        state.pendingRunRemoval = false;
        renderCurrent();
        loadGameSideRanking();
      }, 720);
      return;
    }
  }
}

function renderCurrent() {
  if (currentGame === "klondike") renderKlondike();
  if (currentGame === "freecell") renderFreeCell();
  if (currentGame === "spider") renderSpider();
}

function wrapTableau(tableau) {
  const wrap = document.createElement("div");
  wrap.className = "tableau-scroll";
  wrap.append(tableau);
  return wrap;
}

function renderKlondike() {
  root.innerHTML = "";
  const board = document.createElement("div");
  board.className = "solitaire";

  const top = document.createElement("div");
  top.className = "row top-row";
  const left = document.createElement("div");
  left.className = "pile-group";
  const stock = renderPile("", "stock-0", [], "stock-0", 0);
  stock.addEventListener("click", drawKlondike);
  if (state.stock.length) {
    const back = document.createElement("div");
    back.className = "card face-down stock-card";
    back.textContent = state.stock.length;
    stock.append(back);
  }
  left.append(stock, renderWastePile());

  const foundations = document.createElement("div");
  foundations.className = "pile-group";
  state.foundation.forEach((pile, index) => foundations.append(renderTopPile("foundation", `foundation-${index}`, pile, `foundation-${index}`)));
  top.append(left, createStatsMessage(), foundations);

  const tableau = document.createElement("div");
  tableau.className = "tableau";
  tableau.style.setProperty("--columns", 7);
  state.tableau.forEach((pile, index) => tableau.append(renderPile("", `tableau-${index}`, pile, `tableau-${index}`)));

  const won = state.foundation.flat().length === 52;
  if (won) finishGame("클론다이크 클리어!");
  board.append(top, wrapTableau(tableau), winMessage(won, "클론다이크 클리어!"));
  root.append(board);
}

function renderWastePile() {
  const pile = renderPile("", "waste-0", [], "waste-0", 0);
  const visible = state.waste.slice(-state.drawCount);
  const startIndex = state.waste.length - visible.length;
  visible.forEach((card, index) => {
    const cardEl = renderCard(card, "waste-0", startIndex + index, 0);
    cardEl.style.left = `${index * 24}px`;
    cardEl.style.top = "0";
    if (index < visible.length - 1) {
      cardEl.draggable = false;
      cardEl.removeAttribute("draggable");
    }
    pile.append(cardEl);
  });
  pile.style.width = `${82 + Math.max(0, visible.length - 1) * 24}px`;
  return pile;
}

function renderFreeCell() {
  root.innerHTML = "";
  const board = document.createElement("div");
  board.className = "solitaire";
  const top = document.createElement("div");
  top.className = "row top-row";
  const free = document.createElement("div");
  free.className = "pile-group";
  state.free.forEach((pile, index) => free.append(renderPile("free", `free-${index}`, pile, `free-${index}`, 0)));
  const foundations = document.createElement("div");
  foundations.className = "pile-group";
  state.foundation.forEach((pile, index) => foundations.append(renderTopPile("foundation", `foundation-${index}`, pile, `foundation-${index}`)));
  top.append(free, createStatsMessage(), foundations);

  const tableau = document.createElement("div");
  tableau.className = "tableau";
  tableau.style.setProperty("--columns", 8);
  state.tableau.forEach((pile, index) => tableau.append(renderPile("", `tableau-${index}`, pile, `tableau-${index}`)));

  const won = state.foundation.flat().length === 52;
  if (won) finishGame("프리셀 클리어!");
  board.append(top, wrapTableau(tableau), winMessage(won, "프리셀 클리어!"));
  root.append(board);
}

function renderSpider() {
  root.innerHTML = "";
  const board = document.createElement("div");
  board.className = "solitaire";
  const top = document.createElement("div");
  top.className = "row top-row";
  top.append(createStatsMessage(`남은 배분 ${state.stock.length}회 · 완성 ${state.completed}/8`));
  const stock = renderPile("", "stock-0", [], "stock-0", 0);
  stock.addEventListener("click", dealSpider);
  if (state.stock.length) {
    const back = document.createElement("div");
    back.className = "card face-down stock-card";
    back.textContent = state.stock.length;
    stock.append(back);
  }
  top.append(stock);

  const tableau = document.createElement("div");
  tableau.className = "tableau";
  tableau.style.setProperty("--columns", 10);
  state.tableau.forEach((pile, index) => tableau.append(renderPile("", `tableau-${index}`, pile, `tableau-${index}`, 22)));
  const won = state.completed === 8;
  if (won) finishGame("스파이더 클리어!");
  board.append(top, wrapTableau(tableau), winMessage(won, "스파이더 클리어!"));
  root.append(board);
}

function message(text) {
  const el = document.createElement("div");
  el.className = "message";
  el.textContent = text;
  return el;
}

function winMessage(won, text) {
  return won ? message(text) : document.createDocumentFragment();
}

function finishGame(titleText) {
  if (!state || state.scoreShown) return;
  state.won = true;
  state.scoreShown = true;
  clearInterval(mineTimer);
  mineTimer = null;
  const score = calculateScore();
  saveRanking(score);
  showScoreModal(titleText, score);
}

async function saveRanking(score) {
  if (!currentUser || currentUser.guest || !currentUser.id) {
    state.rankingStatus = "게스트 기록은 랭킹에 저장되지 않습니다.";
    return;
  }

  const mode = getCurrentMode();
  if (!mode) return;

  try {
    const response = await fetch("/api/rankings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userPk: currentUser.id,
        game: currentGame,
        mode,
        score,
        moves: typeof state.moves === "number" ? state.moves : null,
        seconds: state.seconds || 0,
      }),
    });

    state.rankingStatus = response.ok ? "랭킹에 저장되었습니다." : "랭킹 저장에 실패했습니다.";
  } catch (error) {
    state.rankingStatus = "랭킹 저장에 실패했습니다.";
  }
  updateScoreRankingStatus();
  loadGameSideRanking();
}

function getCurrentMode() {
  if (currentGame === "klondike") return `klondike-draw-${state.drawCount}`;
  if (currentGame === "freecell") return "freecell-standard";
  if (currentGame === "spider") return `spider-${state.suitCount}-suit`;
  if (currentGame === "minesweeper") {
    if (state.mineCount === 10) return "minesweeper-beginner";
    if (state.mineCount === 40) return "minesweeper-intermediate";
    return "minesweeper-expert";
  }
  return null;
}

function calculateScore() {
  if (currentGame === "klondike") {
    const base = state.drawCount === 3 ? 13000 : 10000;
    return Math.max(0, base - state.moves * 8 - state.seconds * 3);
  }
  if (currentGame === "freecell") {
    return Math.max(0, 12000 - state.moves * 10 - state.seconds * 2);
  }
  if (currentGame === "spider") {
    const base = { 1: 15000, 2: 22000, 4: 35000 }[state.suitCount] || 15000;
    return Math.max(0, base - state.moves * 8 - state.seconds * 2);
  }
  if (currentGame === "minesweeper") {
    const base = state.mineCount === 10 ? 5000 : state.mineCount === 40 ? 15000 : 30000;
    return Math.max(0, base - state.seconds * 10);
  }
  return 0;
}

function showScoreModal(titleText, score) {
  const existing = document.querySelector("#scoreModal");
  if (existing) existing.remove();

  const movesLine = typeof state.moves === "number" ? `<p>이동 횟수 ${state.moves}회</p>` : "";
  const rankingLine = `<p id="scoreRankingStatus">${state.rankingStatus || "랭킹 저장 중입니다."}</p>`;
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.id = "scoreModal";
  modal.innerHTML = `
    <div class="modal score-dialog" role="dialog" aria-modal="true" aria-labelledby="scoreTitle">
      <h3 id="scoreTitle">${titleText}</h3>
      <div class="score-value">${score.toLocaleString()}점</div>
      <p>시간 ${formatTime(state.seconds || 0)}</p>
      ${movesLine}
      ${rankingLine}
      <div class="modal-actions">
        <button class="action primary" type="button" id="closeScoreModal">확인</button>
      </div>
    </div>
  `;
  document.body.append(modal);
  modal.querySelector("#closeScoreModal").addEventListener("click", () => modal.remove());
  updateScoreRankingStatus();
}

function updateScoreRankingStatus() {
  const status = document.querySelector("#scoreRankingStatus");
  if (status && state?.rankingStatus) status.textContent = state.rankingStatus;
}

function initMinesweeper(size = 16, mineCount = 40) {
  clearInterval(mineTimer);
  actions.innerHTML = "";
  button("새 게임", () => initMinesweeper(size, mineCount), true);
  const difficulty = select(
    [
      ["9,10", "초급"],
      ["16,40", "중급"],
      ["24,99", "고급"],
    ],
    (value) => {
      const [nextSize, nextMines] = value.split(",").map(Number);
      initMinesweeper(nextSize, nextMines);
    },
  );
  difficulty.value = `${size},${mineCount}`;

  state = {
    dirty: false,
    size,
    mineCount,
    started: false,
    ended: false,
    won: false,
    scoreShown: false,
    flags: 0,
    seconds: 0,
    board: Array.from({ length: size * size }, (_, index) => ({
      index,
      mine: false,
      open: false,
      flagged: false,
      adjacent: 0,
    })),
  };
  renderMinesweeper();
  loadGameSideRanking();
}

function startMineTimer() {
  if (mineTimer) return;
  mineTimer = setInterval(() => {
    if (!state.ended) {
      state.seconds += 1;
      renderMineStats();
    }
  }, 1000);
}

function plantMines(firstIndex) {
  const forbidden = new Set([firstIndex, ...neighbors(firstIndex)]);
  const choices = state.board.map((cell) => cell.index).filter((index) => !forbidden.has(index));
  shuffle(choices);
  choices.slice(0, state.mineCount).forEach((index) => (state.board[index].mine = true));
  state.board.forEach((cell) => {
    cell.adjacent = neighbors(cell.index).filter((index) => state.board[index].mine).length;
  });
}

function neighbors(index) {
  const row = Math.floor(index / state.size);
  const col = index % state.size;
  const list = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < state.size && nc >= 0 && nc < state.size) list.push(nr * state.size + nc);
    }
  }
  return list;
}

function openCell(index) {
  const cell = state.board[index];
  if (state.ended || cell.open || cell.flagged) return;
  markProgress();
  if (!state.started) {
    state.started = true;
    plantMines(index);
    startMineTimer();
  }
  cell.open = true;
  if (cell.mine) {
    state.ended = true;
    clearInterval(mineTimer);
    state.board.forEach((item) => {
      if (item.mine) item.open = true;
    });
    renderMinesweeper();
    return;
  }
  if (cell.adjacent === 0) {
    neighbors(index).forEach((next) => openCell(next));
  }
  checkMineWin();
  renderMinesweeper();
}

function toggleFlag(index) {
  const cell = state.board[index];
  if (state.ended || cell.open) return;
  markProgress();
  cell.flagged = !cell.flagged;
  state.flags += cell.flagged ? 1 : -1;
  checkMineWin();
  renderMinesweeper();
}

function checkMineWin() {
  const safeOpen = state.board.filter((cell) => !cell.mine && cell.open).length;
  if (safeOpen === state.size * state.size - state.mineCount) {
    state.ended = true;
    state.won = true;
    clearInterval(mineTimer);
    finishGame("지뢰찾기 클리어!");
  }
}

function renderMineStats() {
  const minesLeft = document.querySelector("#minesLeft");
  const time = document.querySelector("#mineTime");
  const status = document.querySelector("#mineStatus");
  if (minesLeft) minesLeft.textContent = state.mineCount - state.flags;
  if (time) time.textContent = state.seconds;
  if (status) status.textContent = state.won ? "승리" : state.ended ? "실패" : "진행";
}

function renderMinesweeper() {
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "mines";
  wrap.innerHTML = `
    <div class="mine-panel">
      <div class="stat">💣 <span id="minesLeft">${state.mineCount - state.flags}</span></div>
      <div class="stat" id="mineStatus">${state.won ? "승리" : state.ended ? "실패" : "진행"}</div>
      <div class="stat">⏱ <span id="mineTime">${state.seconds}</span></div>
    </div>
  `;
  const board = document.createElement("div");
  board.className = "mine-board";
  board.style.setProperty("--size", state.size);
  state.board.forEach((cell) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `cell ${cell.open ? "" : "hidden"} ${cell.open && cell.mine ? "mine" : ""} ${cell.flagged ? "flagged" : ""} n${cell.adjacent}`;
    el.textContent = cell.flagged ? "⚑" : cell.open ? (cell.mine ? "✹" : cell.adjacent || "") : "";
    el.addEventListener("click", () => openCell(cell.index));
    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      toggleFlag(cell.index);
    });
    board.append(el);
  });
  wrap.append(board);
  root.append(wrap);
}

renderHome();
