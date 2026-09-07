import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  begin,
  createGame,
  MODES,
  WAVES,
  pause,
  resume,
  step,
  steer,
  skill,
  nextWave,
  rank,
  missionComplete,
  achievements,
  type Game,
  type Direction,
  type Temperature,
  type Style,
} from './model';
import {
  emptyRecords,
  readRecords,
  recordRun,
  saveRecords,
  type Records,
} from './storage';
import {
  scientificFacts,
  educationalNote,
  fictionalNote,
  disclaimer,
} from './science';
import './style.css';
const nf = new Intl.NumberFormat('ja-JP');
const KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowDown: 'down',
  s: 'down',
  S: 'down',
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  x: 'stop',
  X: 'stop',
};
function Board({ g }: { g: Game }) {
  const mode = MODES[g.temperature];
  // SVG needs an explicit image role for its dynamic, accessible arena description.
  // oxlint-disable jsx-a11y/prefer-tag-over-role
  return (
    <svg
      viewBox="0 0 510 510"
      role="img"
      aria-label={`酒母の迷路。自分は左から${g.player.x}、上から${g.player.y}。糖${g.collected}個、ハート${g.hp}。`}
      className="board"
      data-testid="board"
      data-status={g.status}
      data-x={g.player.x}
      data-y={g.player.y}
      data-step={mode.playerStep}
      data-wave={g.wave}
      data-hp={g.hp}
    >
      <defs>
        <pattern
          id="paper"
          width="15"
          height="15"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r=".7" fill="#d7cfb9" />
        </pattern>
      </defs>
      <rect width="510" height="510" fill="#f5f0df" />
      <rect width="510" height="510" fill="url(#paper)" />
      {[
        { x: 30, y: 30 },
        { x: 360, y: 30 },
        { x: 30, y: 360 },
        { x: 360, y: 360 },
      ].map((p, i) => (
        <rect
          key={i}
          {...p}
          width="120"
          height="120"
          rx="26"
          className={g.acid >= 60 ? 'zone active' : 'zone'}
        />
      ))}
      {g.tiles.flatMap((row, y) =>
        row
          .split('')
          .map((tile, x) =>
            tile === '#' ? (
              <rect
                key={`${x},${y}`}
                data-wall={`${x},${y}`}
                x={x * 30 + 3}
                y={y * 30 + 3}
                width="24"
                height="24"
                rx={x === 0 || y === 0 || x === 16 || y === 16 ? 8 : 9}
                fill={
                  x === 0 || y === 0 || x === 16 || y === 16
                    ? '#233c33'
                    : '#d6ceb9'
                }
                stroke="#233c33"
                strokeWidth="1.5"
              />
            ) : null,
          ),
      )}
      {g.pickups.map((p) => (
        <g
          key={`${p.x},${p.y}`}
          data-pickup={p.kind}
          data-x={p.x}
          data-y={p.y}
          transform={`translate(${p.x * 30 + 15} ${p.y * 30 + 15})`}
        >
          {p.kind === 'acid' ? (
            <>
              <rect
                x="-8"
                y="-8"
                width="16"
                height="16"
                rx="5"
                fill="#166a50"
                stroke="#152f25"
              />
              <path d="M-4 0H4M0 -4V4" stroke="#fff9e9" strokeWidth="2" />
            </>
          ) : p.kind === 'gold' ? (
            <>
              <path
                d="M0 -10L10 0L0 10L-10 0Z"
                fill="#efac20"
                stroke="#57420e"
                strokeWidth="2"
              />
              <circle r="3" fill="#fff8d6" />
            </>
          ) : (
            <circle r="4.3" fill="#bd7b0e" stroke="#75500c" strokeWidth="1" />
          )}
        </g>
      ))}
      {g.enemies.map((e) => (
        <g
          key={e.id}
          data-enemy={e.id}
          data-x={e.x}
          data-y={e.y}
          data-stunned={e.stunned > 0}
          className={`actor enemy ${e.stunned > 0 ? 'stunned' : ''}`}
          style={{
            transform: `translate(${e.x * 30 + 15}px,${e.y * 30 + 15}px)`,
          }}
        >
          <path
            d="M0 -12L5 -8L11 -8L10 -2L13 3L7 6L5 12L0 9L-5 12L-7 6L-13 3L-10 -2L-11 -8L-5 -8Z"
            fill={
              e.stunned > 0
                ? '#e9e5da'
                : e.type === 'chase'
                  ? '#edb834'
                  : e.type === 'ambush'
                    ? '#e48a57'
                    : '#c1b277'
            }
            stroke="#28392e"
            strokeWidth="2"
          />
          {e.stunned > 0 ? (
            <path
              d="M-6 -3l4 4m0 -4l-4 4m8 -4l4 4m0 -4l-4 4"
              stroke="#233c33"
              strokeWidth="1.5"
            />
          ) : (
            <>
              <circle cx="-4" cy="-2" r="2" fill="#233c33" />
              <circle cx="4" cy="-2" r="2" fill="#233c33" />
            </>
          )}
        </g>
      ))}
      <g
        className={`actor player ${g.dash > 0 ? 'dashing' : ''}`}
        style={{
          transform: `translate(${g.player.x * 30 + 15}px,${g.player.y * 30 + 15}px)`,
        }}
      >
        {g.invincible > 0 && (
          <circle
            r="17"
            fill="none"
            stroke="#15674e"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
        )}
        {g.pulse > 0 && (
          <circle
            className="pulse-ring"
            r={(g.style === 'breaker' ? 5 : 4) * 30}
            fill="#ed702029"
            stroke="#bd471d"
            strokeWidth="3"
          />
        )}
        <circle r="12" fill="#ec703c" stroke="#332e24" strokeWidth="2" />
        <circle
          cx="9"
          cy="-8"
          r="5"
          fill="#f7a37f"
          stroke="#332e24"
          strokeWidth="1.8"
        />
        <path
          d={
            g.direction === 'left'
              ? 'M-7 -3v2m6 -2v2'
              : g.direction === 'up'
                ? 'M-4 -6v2m7 -2v2'
                : 'M-2 -3v2m7 -2v2'
          }
          stroke="#272d25"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M-2 5Q1 8 5 4"
          fill="none"
          stroke="#272d25"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}
// oxlint-enable jsx-a11y/prefer-tag-over-role
function App() {
  const game = useRef<Game>(createGame());
  const [g, setG] = useState<Game>({ ...game.current });
  const [records, setRecords] = useState<Records>(emptyRecords);
  const [temperature, setTemperature] = useState<Temperature>('middle');
  const [style, setStyle] = useState<Style>('gatherer');
  const [seed, setSeed] = useState('260907');
  const [storageMessage, setStorageMessage] = useState(
    '記録はこの端末だけに保存',
  );
  const [pauseReason, setPauseReason] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const arena = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const recorded = useRef(false);
  const active =
    g.status === 'playing' || g.status === 'paused' || g.status === 'wave';
  const update = () => setG({ ...game.current });
  useEffect(() => {
    try {
      setRecords(readRecords(window.localStorage));
    } catch {
      setStorageMessage('保存を利用できません。今回のプレイは続けられます。');
    }
  }, []);
  useEffect(() => {
    let raf = 0,
      last = 0,
      acc = 0,
      paint = 0;
    const loop = (now: number) => {
      if (last) acc += Math.min((now - last) / 1000, 0.1);
      last = now;
      const before = game.current.status;
      while (acc >= 1 / 60) {
        step(game.current);
        acc -= 1 / 60;
      }
      if (
        (game.current.status === 'playing' && now - paint >= 32) ||
        before !== game.current.status
      ) {
        setG({ ...game.current });
        paint = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    if ((g.status === 'won' || g.status === 'lost') && !recorded.current) {
      recorded.current = true;
      setRecords((old) => {
        const next = recordRun(old, game.current);
        try {
          if (!saveRecords(window.localStorage, next))
            setStorageMessage(
              '保存できませんでした。今回のスコアは画面で確認できます。',
            );
        } catch {
          setStorageMessage('保存できませんでした。');
        }
        return next;
      });
    }
    if (['ready', 'paused', 'wave', 'won', 'lost'].includes(g.status))
      primary.current?.focus({ preventScroll: true });
    setAnnouncement(
      g.status === 'won'
        ? '全3ステージクリア！'
        : g.status === 'lost'
          ? game.current.reason
          : g.status === 'wave'
            ? 'ステージクリア。次のステージへ進めます。'
            : g.status === 'paused'
              ? '一時停止しました。再開するまで時間は進みません。'
              : '',
    );
  }, [g.status]);
  useEffect(() => {
    const autoPause = (reason: string) => {
      if (game.current.status === 'playing') {
        pause(game.current);
        setPauseReason(reason);
        setG({ ...game.current });
      }
    };
    const visibility = () => {
      if (document.hidden) autoPause('タブが非表示になったため停止しました。');
    };
    const blur = () =>
      autoPause('画面からフォーカスが外れたため停止しました。');
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting)
        autoPause('ゲーム画面が画面外になったため停止しました。');
    });
    if (arena.current) observer.observe(arena.current);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const s = game.current;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (s.status === 'playing') {
          pause(s);
          setPauseReason('');
        } else if (s.status === 'paused') resume(s);
        setG({ ...s });
        return;
      }
      if (s.status !== 'playing') return;
      if (KEYS[e.key]) {
        e.preventDefault();
        steer(s, KEYS[e.key]);
      } else if (
        (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) ||
        e.key === 'j' ||
        e.key === 'J'
      ) {
        e.preventDefault();
        if (!e.repeat) skill(s, 'pulse');
      } else if (e.key === 'Shift' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (!e.repeat) skill(s, 'dash');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const focusArena = () => arena.current?.focus({ preventScroll: true });
  const frameGame = () => {
    arena.current
      ?.closest('.field')
      ?.scrollIntoView({ block: 'start', behavior: 'instant' });
    focusArena();
  };
  const start = (same = false) => {
    game.current = createGame(
      same ? g.temperature : temperature,
      same ? g.style : style,
      same ? g.seed : Number(seed),
    );
    begin(game.current);
    recorded.current = false;
    setPauseReason('');
    update();
    frameGame();
  };
  const selectMode = (t: Temperature) => {
    setTemperature(t);
    game.current = createGame(t, style, Number(seed));
    update();
  };
  const selectStyle = (s: Style) => {
    setStyle(s);
    game.current = createGame(temperature, s, Number(seed));
    update();
  };
  const act = (kind: 'pulse' | 'dash') => {
    skill(game.current, kind);
    update();
    focusArena();
  };
  const move = (direction: Direction) => {
    steer(game.current, direction);
    update();
    focusArena();
  };
  const togglePause = () => {
    if (g.status === 'playing') {
      pause(game.current);
      setPauseReason('');
    } else resume(game.current);
    update();
    focusArena();
  };
  const wave = WAVES[g.wave];
  const terminal = g.status === 'won' || g.status === 'lost';
  return (
    <>
      <header className="brand-bar">
        <a href="#main" className="brand">
          <span className="sat-mark">SAT</span>
          <span>
            SAKE ART TOKYO<small>FERMENTATION PLAYGROUND</small>
          </span>
        </a>
        <span className="edition">PLAY NOTE / 01</span>
      </header>
      <main id="main">
        <div className="title-line">
          <div>
            <p className="eyebrow">酒母の中を、駆けめぐれ。</p>
            <h1>
              SHUBO <span>RUN</span>
              <i>酒母ラン</i>
            </h1>
          </div>
          <span className="local-stamp">
            3 STAGES
            <br />
            LOCAL ARCADE
          </span>
        </div>
        <div className="game-layout">
          <section className="setup" aria-label="プレイ設定">
            <div className="section-cap">
              01 / ENVIRONMENT <span>ゲーム内の相対環境</span>
            </div>
            <fieldset className="temperatures" aria-label="温度を選ぶ">
              {(Object.keys(MODES) as Temperature[]).map((t) => (
                <button
                  key={t}
                  disabled={active}
                  aria-pressed={temperature === t}
                  onClick={() => selectMode(t)}
                  className={`temp ${t}`}
                >
                  <span>{MODES[t].label}</span>
                  <small>×{MODES[t].multiplier.toFixed(1)}</small>
                </button>
              ))}
            </fieldset>
            <div className="mode-detail">
              <h2>{MODES[temperature].name}</h2>
              <p>{MODES[temperature].description}</p>
              <dl className="mode-facts">
                <div>
                  <dt>移動</dt>
                  <dd>
                    {temperature === 'low'
                      ? 'ゆっくり'
                      : temperature === 'high'
                        ? '高速'
                        : '標準'}
                  </dd>
                </div>
                <div>
                  <dt>競合</dt>
                  <dd>{MODES[temperature].enemies}体〜</dd>
                </div>
                <div>
                  <dt>酸ゲージ</dt>
                  <dd>+{MODES[temperature].acidRate}/秒</dd>
                </div>
              </dl>
            </div>
            <label className="style-select">
              プレイスタイル{' '}
              <select
                aria-label="プレイスタイル"
                disabled={active}
                value={style}
                onChange={(e) => selectStyle(e.target.value as Style)}
              >
                <option value="gatherer">採取家 / コンボ +1秒</option>
                <option value="breaker">突破役 / パルス強化</option>
              </select>
            </label>
            <details className="setup-extra">
              <summary>コース番号・スタイルの説明</summary>
              <p>
                {style === 'gatherer'
                  ? '1粒でエネルギー+8。コンボの猶予も長く、拾い続けるほど強い。'
                  : 'パルス消費30・射程5マス。採取でエネルギー+6。競合の間を切りひらく。'}
              </p>
              <label className="seed-label">
                コース番号（シード）
                <input
                  aria-label="コース番号"
                  type="number"
                  min="1"
                  max="4294967295"
                  disabled={active}
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  onBlur={() =>
                    setSeed(
                      String(createGame(temperature, style, Number(seed)).seed),
                    )
                  }
                />
              </label>
              <p className="small">
                同じ番号・温度・スタイルで、同じ配置に再挑戦できます。
              </p>
            </details>
          </section>
          <section className="field" aria-label="酒母アーケード">
            <div className="scoreboard">
              <div>
                <span className="stat-label">SCORE</span>
                <strong data-testid="score">
                  {nf.format(g.score).padStart(5, '0')}
                </strong>
              </div>
              <div className="stage-stat">
                <span className="stat-label">STAGE</span>
                <strong>
                  {String(g.wave + 1).padStart(2, '0')}
                  <em>/03</em>
                </strong>
              </div>
              <div>
                <span className="stat-label">TIME</span>
                <strong
                  className={g.timeLeft < 10 ? 'urgent' : ''}
                  data-testid="time"
                >
                  {Math.ceil(g.timeLeft)}
                  <em>s</em>
                </strong>
              </div>
              <button
                className="pause-button"
                disabled={!['playing', 'paused'].includes(g.status)}
                onClick={togglePause}
                aria-label={g.status === 'paused' ? '再開' : '一時停止'}
              >
                {g.status === 'paused' ? '▶' : 'Ⅱ'}
              </button>
            </div>
            <div className="mission-line">
              <span>
                <b>
                  糖 {g.collected}/{wave.goal}
                </b>
                <span className="wave-title"> · {wave.name}</span>
              </span>
              <span className="hearts" aria-label={`ハート残り${g.hp}`}>
                <span aria-hidden="true">
                  {'♥'.repeat(g.hp)}
                  <span className="empty-hearts">{'♡'.repeat(3 - g.hp)}</span>
                </span>
              </span>
            </div>
            {/* The focusable game surface owns arrow/WASD controls and is the focus return target. */}
            {/* oxlint-disable jsx-a11y/no-noninteractive-tabindex */}
            <div
              ref={arena}
              className="arena"
              tabIndex={0}
              role="application"
              aria-label="操作エリア。矢印またはWASDで移動、Jでパルス、Kでダッシュ、Xで停止、Pで一時停止。"
              aria-describedby="controls-help"
            >
              <Board g={g} />
              {g.status === 'playing' && (
                <>
                  <div className="combo-tag" aria-label={`${g.combo}コンボ`}>
                    <b>{g.combo}</b> COMBO{' '}
                    <span>
                      ×
                      {(1 + Math.min(3, Math.floor(g.combo / 5)) * 0.5).toFixed(
                        1,
                      )}
                    </span>
                  </div>
                  {g.messageLeft > 0 && (
                    <div className="game-toast">{g.message}</div>
                  )}
                </>
              )}
              {g.status !== 'playing' && (
                <div className="overlay">
                  <div
                    className={`overlay-card ${terminal ? 'result-card' : ''}`}
                  >
                    <p className="eyebrow">
                      {g.status === 'ready'
                        ? 'YOU ARE THE YEAST'
                        : g.status === 'paused'
                          ? 'TAKE A BREATH'
                          : g.status === 'wave'
                            ? 'STAGE COMPLETE'
                            : g.status === 'won'
                              ? 'ALL STAGES CLEAR'
                              : 'TRY ANOTHER ROUTE'}
                    </p>
                    <h2>
                      {g.status === 'ready' ? (
                        <>
                          糖を集めて、
                          <br />
                          道をひらこう。
                        </>
                      ) : g.status === 'paused' ? (
                        'ひと休み。'
                      ) : g.status === 'wave' ? (
                        `STAGE ${g.wave + 1} クリア`
                      ) : g.status === 'won' ? (
                        '踏破、おめでとう！'
                      ) : (
                        'もう一度、いける。'
                      )}
                    </h2>
                    {g.status === 'ready' ? (
                      <>
                        <p>
                          橙の酵母キャラを操作。
                          <br />
                          糖を集め、競合をかわす3ステージ。
                        </p>
                        <div className="start-instructions">
                          <span>◆ 糖を{wave.goal}個</span>
                          <span>♥ ハート3つ</span>
                          <span>✳ パルスで足止め</span>
                        </div>
                        <button
                          ref={primary}
                          className="primary"
                          onClick={() => start()}
                        >
                          プレイ開始 <span>→</span>
                        </button>
                        <p className="small">
                          矢印 / WASD または下の方向ボタン
                        </p>
                      </>
                    ) : g.status === 'paused' ? (
                      <>
                        <p>{pauseReason || '時間も競合も止まっています。'}</p>
                        <button
                          ref={primary}
                          className="primary"
                          onClick={togglePause}
                        >
                          プレイを再開 →
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            game.current = createGame(
                              temperature,
                              style,
                              Number(seed),
                            );
                            update();
                          }}
                        >
                          このプレイをやめる
                        </button>
                      </>
                    ) : g.status === 'wave' ? (
                      <>
                        <p>
                          追加ミッション：
                          {missionComplete(g)
                            ? '達成！ +500 × 温度倍率'
                            : '未達成。次の周回で挑戦！'}
                        </p>
                        <p>
                          次は糖を{WAVES[g.wave + 1].goal}個。
                          <br />
                          エネルギー+25で出発。
                        </p>
                        <button
                          ref={primary}
                          className="primary"
                          onClick={() => {
                            nextWave(game.current);
                            update();
                            focusArena();
                          }}
                        >
                          次のステージへ →
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="rank-line">
                          <b>{rank(g)}</b>
                          <div>
                            RANK
                            <strong>
                              {nf.format(g.score)}
                              <small> pts</small>
                            </strong>
                          </div>
                        </div>
                        <p>
                          {g.status === 'lost'
                            ? g.reason
                            : `3ステージ踏破 / ミッション ${g.missions}/3`}
                        </p>
                        <div className="result-mini">
                          <span>最大 {g.maxCombo}連鎖</span>
                          <span>糖 {g.totalCollected}個</span>
                          <span>接触 {g.totalHits}回</span>
                        </div>
                        <button
                          ref={primary}
                          className="primary"
                          onClick={() => start(true)}
                        >
                          同じコースで再挑戦 ↻
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            const next = (g.seed % 4294967294) + 1;
                            setSeed(String(next));
                            game.current = createGame(temperature, style, next);
                            update();
                          }}
                        >
                          別のコース・設定を選ぶ →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* oxlint-enable jsx-a11y/no-noninteractive-tabindex */}
            <div className="meters">
              <div>
                <label htmlFor="energy">
                  エネルギー <b>{Math.floor(g.energy)}</b>
                </label>
                <meter id="energy" min="0" max="100" value={g.energy} />
              </div>
              <div>
                <label htmlFor="acid">
                  酸性化 <small>架空</small> <b>{Math.floor(g.acid)}</b>
                </label>
                <meter id="acid" min="0" max="100" value={g.acid} />
              </div>
            </div>
            <div className="touch-controls" aria-label="タッチ操作">
              <div className="dpad">
                {(
                  [
                    { d: 'up', label: '上', icon: '↑' },
                    { d: 'left', label: '左', icon: '←' },
                    { d: 'stop', label: '停止', icon: '■' },
                    { d: 'right', label: '右', icon: '→' },
                    { d: 'down', label: '下', icon: '↓' },
                  ] as const
                ).map(({ d, label, icon }) => (
                  <button
                    key={d}
                    className={`direction ${d}`}
                    aria-label={label}
                    disabled={g.status !== 'playing'}
                    onClick={() => move(d)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <div className="skill-buttons">
                <button
                  className="pulse-button"
                  disabled={
                    g.status !== 'playing' ||
                    g.cooldown > 0 ||
                    g.energy < (style === 'breaker' ? 30 : 40)
                  }
                  onClick={() => act('pulse')}
                >
                  ✳ パルス{' '}
                  <small>J / {style === 'breaker' ? 30 : 40}消費</small>
                </button>
                <button
                  className="dash-button"
                  disabled={
                    g.status !== 'playing' || g.cooldown > 0 || g.energy < 25
                  }
                  onClick={() => act('dash')}
                >
                  ↗ ダッシュ <small>K / 25消費</small>
                </button>
                <span className="cooldown" data-testid="cooldown">
                  {g.cooldown > 0
                    ? `回復まで ${g.cooldown.toFixed(1)}秒`
                    : 'スキル準備OK'}
                </span>
              </div>
            </div>
            <p id="controls-help" className="control-help">
              方向を押すと進み続けます。■ / Xで停止。
              <br className="mobile-only" />
              矢印・WASD / J・Space：パルス / K・Shift：ダッシュ /
              P・Esc：ポーズ
            </p>
          </section>
          <aside className="notebook">
            <div className="section-cap">02 / FIELD NOTES</div>
            <h2>今回のミッション</h2>
            <p className="mission-note">
              {wave.mission}
              <span>達成で +500 × 温度倍率</span>
            </p>
            <ul className="legend">
              <li>
                <i className="dot sugar" />
                糖：採取目標 +1 / 基礎50点
              </li>
              <li>
                <i className="dot gold" />
                大粒の糖：目標 +1 / 基礎180点
              </li>
              <li>
                <i className="dot acid">+</i>緑の粒：酸ゲージ +18
              </li>
              <li>
                <i className="dot enemy-dot">✳</i>競合：接触でハート −1
              </li>
            </ul>
            <p className="small">
              酸ゲージ60以上で緑の区画の競合が減速。危険な接近採取は×1.5。どちらもゲーム専用のルールです。
            </p>
            <details>
              <summary>攻略ノート・全ルール</summary>
              <p>
                5連鎖ごとにコンボ倍率+0.5、最大×2.5。粒を拾うと連鎖の残り時間が戻ります。
              </p>
              <p>
                パルスは近くの競合を3.2秒停止。ダッシュは約1秒、1.65倍速で接触を無効化。スキルは回復時間を共有します。
              </p>
              <p>
                各ステージは45 / 50 / 55秒。糖18 / 24 /
                30個で通過。残り1秒あたり10点×温度倍率を加算します。
              </p>
              <p>
                S：全ミッション＋無傷で踏破、A：2ミッション以上で踏破、B：踏破、C：途中終了。
              </p>
              <p>
                途中の温度・スタイル変更はできません。ポーズから終了すると記録は保存されません。
              </p>
            </details>
          </aside>
        </div>
        <section className="records">
          <div>
            <p className="eyebrow">YOUR LOCAL RECORDS</p>
            <h2>自分の記録を、超えていく。</h2>
            <output className="small">
              {storageMessage} / 完走・終了 {records.runs}回
            </output>
          </div>
          <div className="highs">
            {(Object.keys(MODES) as Temperature[]).map((t) => (
              <div key={t}>
                <span>{MODES[t].label} BEST</span>
                <b data-testid={`best-${t}`}>{nf.format(records.high[t])}</b>
              </div>
            ))}
          </div>
          <div className="achievements" aria-label="実績">
            {[
              '初めての踏破',
              '20連鎖',
              '無傷の採取家',
              'スキルの使い手',
              '高めの挑戦者',
              'ミッション完遂',
            ].map((a) => (
              <span
                key={a}
                className={records.achievements.includes(a) ? 'unlocked' : ''}
              >
                {records.achievements.includes(a) ? '✓' : '○'} {a}
              </span>
            ))}
          </div>
          {terminal && achievements(g).length > 0 && (
            <p className="small">今回の達成：{achievements(g).join(' / ')}</p>
          )}
        </section>
        <section className="science">
          <div className="science-heading">
            <p className="eyebrow">03 / SCIENCE & FICTION</p>
            <h2>遊びと科学の、境界線。</h2>
            <p>{disclaimer}</p>
          </div>
          <details>
            <summary>出典とゲーム表現の違いを見る</summary>
            <div className="science-grid">
              <article>
                <span className="evidence fact">出典で確認</span>
                {scientificFacts.map((f) => (
                  <div key={f.title}>
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {f.source} ↗
                    </a>
                    <p className="small">確認日 {f.checkedOn}</p>
                  </div>
                ))}
              </article>
              <article>
                <span className="evidence teaching">教育用の簡略化</span>
                <p>{educationalNote.text}</p>
              </article>
              <article>
                <span className="evidence fiction">架空のゲーム係数</span>
                <p>{fictionalNote.text}</p>
                <p>
                  「低め・中間・高め」はゲーム内の相対環境です。実際の醸造温度や日程を示しません。
                </p>
              </article>
            </div>
          </details>
        </section>
      </main>
      <footer>
        <b>SAT / SHUBO RUN</b>
        <span>
          会員登録なし・広告なし・外部送信なし
          <br />
          LOCAL EXPERIMENT — 2026
        </span>
      </footer>
      <output className="sr-only" aria-live="polite">
        {announcement}
      </output>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
