import Script from "next/script";

export default function HomePage() {
  return (
    <>
      <div className="fixed-opacity-control">
        <div className="opacity-control" aria-label="화면 투명도 조절">
          <span>투명도</span>
          <input id="opacitySlider" type="range" min="0" max="100" defaultValue="100" />
          <b id="opacityValue">100%</b>
        </div>
      </div>

      <main className="app">
        <header className="topbar">
          <div>
            <p className="eyebrow">Jerry&apos;s Arcade</p>
            <h1>Game of Memories</h1>
          </div>
          <div className="top-actions">
            <div className="user-status" id="userStatus" />
          </div>
        </header>

        <section id="homeScreen" className="home-screen" aria-live="polite" />

        <section id="gameScreen" className="game-screen hidden">
          <div className="game-nav">
            <button className="action home-action" type="button" id="gameHomeButton">
              ← 메인
            </button>
            <nav className="tabs" aria-label="게임 선택">
              <button className="tab active" data-game="klondike">
                클론다이크
              </button>
              <button className="tab" data-game="spider">
                스파이더
              </button>
              <button className="tab" data-game="freecell">
                프리셀
              </button>
              <button className="tab" data-game="minesweeper">
                지뢰찾기
              </button>
            </nav>
          </div>

          <section className="toolbar">
            <div>
              <h2 id="gameTitle">클론다이크 솔리테어</h2>
              <p id="gameHint">A부터 K까지 네 무늬를 foundation에 올려보세요.</p>
            </div>
            <div className="actions" id="gameActions" />
          </section>

          <div className="game-play-layout">
            <section id="gameRoot" className="game-root" aria-live="polite" />
            <aside className="game-ranking-panel" aria-label="현재 게임 랭킹">
              <div id="gameSideRanking" />
            </aside>
          </div>
        </section>
      </main>

      <div className="modal-backdrop hidden" id="confirmModal" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
        <div className="modal">
          <h3 id="confirmTitle">새 게임을 시작하겠습니까?</h3>
          <p id="confirmText">현재 진행 중인 판은 사라집니다.</p>
          <div className="modal-actions">
            <button className="action" type="button" id="cancelRestart">
              취소
            </button>
            <button className="action primary" type="button" id="confirmRestart">
              새 게임
            </button>
          </div>
        </div>
      </div>

      <div className="modal-backdrop hidden" id="authModal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <div className="modal">
          <h3 id="authTitle">로그인</h3>
          <div className="auth-tabs">
            <button className="action primary" type="button" data-auth-mode="login">
              로그인
            </button>
            <button className="action" type="button" data-auth-mode="register">
              회원가입
            </button>
          </div>
          <form className="auth-form" id="authForm">
            <label>
              아이디
              <input name="userId" autoComplete="username" required minLength={4} maxLength={32} />
            </label>
            <label id="nicknameField" className="hidden">
              닉네임
              <input name="nickname" maxLength={32} />
            </label>
            <label>
              비밀번호
              <input name="password" type="password" autoComplete="current-password" required minLength={8} />
            </label>
            <div className="modal-actions">
              <button className="action" type="button" id="cancelAuth">
                취소
              </button>
              <button className="action primary" type="submit" id="submitAuth">
                로그인
              </button>
            </div>
          </form>
          <p className="form-message" id="authMessage" />
        </div>
      </div>

      <Script src="/legacy/app.js" strategy="afterInteractive" />
    </>
  );
}
