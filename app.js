const root = document.querySelector("#gameRoot");
const actions = document.querySelector("#gameActions");
const title = document.querySelector("#gameTitle");
const hint = document.querySelector("#gameHint");
const tabs = [...document.querySelectorAll(".tab")];

const suits = ["spades", "hearts", "diamonds", "clubs"];
const suitMarks = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const values = Object.fromEntries(ranks.map((rank, index) => [rank, index + 1]));
const redSuits = new Set(["hearts", "diamonds"]);

let currentGame = "klondike";
let state = null;
let drag = null;
let mineTimer = null;
let cardSeq = 0;

const gameInfo = {
  klondike: ["클론다이크 솔리테어", "A부터 K까지 네 무늬를 foundation에 올려보세요."],
  spider: ["스파이더 솔리테어", "같은 무늬 K부터 A까지 완성한 줄을 제거하세요."],
  freecell: ["프리셀", "빈 칸 4개를 활용해서 모든 카드를 foundation에 올려보세요."],
  minesweeper: ["지뢰찾기", "숫자를 단서로 지뢰를 피하고 모든 안전 칸을 여세요."],
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => startGame(tab.dataset.game));
});

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
  el.addEventListener("change", () => onChange(el.value));
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
    el.addEventListener("dragend", () => (drag = null));
    el.addEventListener("dblclick", () => autoMove(card.id, source, index));
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
  if (currentGame === "spider") clearSpiderRuns();
  renderCurrent();
}

function autoMove(cardId, source, index) {
  if (currentGame === "spider") return;
  const pile = pileBySource(source);
  const card = pile[index];
  if (!card || index !== pile.length - 1) return;
  const foundationIndex = state.foundation.findIndex((foundation) => canFoundation(card, foundation));
  if (foundationIndex === -1) return;
  pile.pop();
  revealLastTableau(source);
  state.foundation[foundationIndex].push(card);
  renderCurrent();
}

function initKlondike() {
  state = {
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
  button("새 게임", initKlondike, true);
  button("카드 넘기기", drawKlondike);
  renderCurrent();
}

function drawKlondike() {
  if (state.stock.length) {
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
  } else {
    state.stock = state.waste.reverse().map((card) => ({ ...card, faceUp: false }));
    state.waste = [];
  }
  renderCurrent();
}

function initFreeCell() {
  const cards = shuffle(deck()).map((card) => ({ ...card, faceUp: true }));
  state = {
    free: [[], [], [], []],
    foundation: [[], [], [], []],
    tableau: Array.from({ length: 8 }, () => []),
  };
  cards.forEach((card, index) => state.tableau[index % 8].push(card));
  button("새 게임", initFreeCell, true);
  renderCurrent();
}

function initSpider(suitCount = 1) {
  const activeSuits = suitCount === 1 ? ["spades"] : suitCount === 2 ? ["spades", "hearts"] : suits;
  const packs = 8 / activeSuits.length;
  const cards = shuffle(deck(packs, activeSuits));
  state = {
    stock: [],
    completed: 0,
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
}

function dealSpider() {
  if (!state.stock.length || state.tableau.some((pile) => pile.length === 0)) return;
  const row = state.stock.pop();
  row.forEach((card, index) => {
    card.faceUp = true;
    state.tableau[index].push(card);
  });
  clearSpiderRuns();
  renderCurrent();
}

function clearSpiderRuns() {
  for (const pile of state.tableau) {
    if (pile.length < 13) continue;
    const run = pile.slice(-13);
    if (run[0].value === 13 && run[12].value === 1 && isSameSuitRun(run)) {
      pile.splice(-13);
      state.completed += 1;
      if (pile.length && !pile[pile.length - 1].faceUp) pile[pile.length - 1].faceUp = true;
    }
  }
}

function renderCurrent() {
  if (currentGame === "klondike") renderKlondike();
  if (currentGame === "freecell") renderFreeCell();
  if (currentGame === "spider") renderSpider();
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
  left.append(stock, renderTopPile("", "waste-0", state.waste, "waste-0"));

  const foundations = document.createElement("div");
  foundations.className = "pile-group";
  state.foundation.forEach((pile, index) => foundations.append(renderTopPile("foundation", `foundation-${index}`, pile, `foundation-${index}`)));
  top.append(left, foundations);

  const tableau = document.createElement("div");
  tableau.className = "tableau";
  tableau.style.setProperty("--columns", 7);
  state.tableau.forEach((pile, index) => tableau.append(renderPile("", `tableau-${index}`, pile, `tableau-${index}`)));

  board.append(top, tableau, winMessage(state.foundation.flat().length === 52, "클론다이크 클리어!"));
  root.append(board);
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
  top.append(free, foundations);

  const tableau = document.createElement("div");
  tableau.className = "tableau";
  tableau.style.setProperty("--columns", 8);
  state.tableau.forEach((pile, index) => tableau.append(renderPile("", `tableau-${index}`, pile, `tableau-${index}`)));

  board.append(top, tableau, winMessage(state.foundation.flat().length === 52, "프리셀 클리어!"));
  root.append(board);
}

function renderSpider() {
  root.innerHTML = "";
  const board = document.createElement("div");
  board.className = "solitaire";
  const top = document.createElement("div");
  top.className = "row top-row";
  top.append(message(`남은 배분 ${state.stock.length}회 · 완성 ${state.completed}/8`));
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
  board.append(top, tableau, winMessage(state.completed === 8, "스파이더 클리어!"));
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
    size,
    mineCount,
    started: false,
    ended: false,
    won: false,
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

startGame(currentGame);
