"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Category, HudState, RacerGame, SessionStats } from "@/game/racer/Game";
import s from "./Racer.module.css";

const CAT_LABEL: Record<Category, string> = {
  playstation: "PlayStation",
  xbox: "Xbox",
  nintendo: "Nintendo",
  sega: "Sega",
};

interface RecordRow {
  score: number;
  at: number;
}

const RECORDS_KEY = "rsr:records";

function readRecords(): RecordRow[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]");
    return Array.isArray(v) ? v.filter((r) => typeof r?.score === "number").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecord(score: number): { list: RecordRow[]; best: boolean } {
  const list = readRecords();
  const best = !list.length || score > list[0].score;
  const next = [...list, { score, at: Date.now() }].sort((a, b) => b.score - a.score).slice(0, 5);
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(next));
  } catch {}
  return { list: next, best };
}

const fmtTime = (t: number) => {
  const v = Math.max(0, Math.ceil(t));
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
};
const fmtDist = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}K` : String(Math.round(m)));

export default function RacerClient() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pops = useRef<HTMLDivElement>(null);
  const game = useRef<RacerGame | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [feed, setFeed] = useState<{ id: number; text: string }[]>([]);
  const [over, setOver] = useState<(SessionStats & { best: boolean }) | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRecords(readRecords());
    let g: RacerGame | null = null;
    let cancelled = false;
    let id = 0;
    import("@/game/racer/Game").then(async ({ RacerGame }) => {
      if (cancelled) return;
      g = new RacerGame(canvas.current!, pops.current!, {
        hud: setHud,
        feed: (text) => {
          const k = ++id;
          setFeed((f) => [...f.slice(-3), { id: k, text }]);
          window.setTimeout(() => setFeed((f) => f.filter((x) => x.id !== k)), 2600);
        },
        over: (st) => {
          const { list, best } = saveRecord(st.score);
          setRecords(list);
          setOver({ ...st, best });
        },
      });
      game.current = g;
      await g.init();
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      g?.dispose();
      game.current = null;
    };
  }, []);

  const play = useCallback(() => {
    setOver(null);
    game.current?.start();
  }, []);
  const menu = useCallback(() => {
    setOver(null);
    game.current?.toMenu();
  }, []);

  useEffect(() => {
    if (hud?.phase === "playing") setOver(null);
  }, [hud?.phase]);

  const phase = hud?.phase ?? "menu";
  const mult = hud?.mult ?? 1;

  return (
    <div className={s.root} data-phase={phase}>
      <canvas ref={canvas} className={s.canvas} aria-label="Arena do Retro Smash Racer" data-scene-skip />
      <div ref={pops} className={s.pops} aria-hidden="true" />

      {/* top bar */}
      <Link href="/" className={s.logo} aria-label="Voltar para a Retro Gamers">
        <span>Retro Smash</span>
        <span>Racer</span>
      </Link>
      {phase !== "menu" && (
        <div className={s.scoreBox} aria-live="polite">
          <div className={s.multRing}>
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="28" className={s.ringBg} />
              <circle cx="32" cy="32" r="28" className={s.ringFg} style={{ strokeDashoffset: 176 - ((mult - 1) / 2) * 176 }} />
            </svg>
            <span className={s.multLabel}>mult.</span>
            <span className={s.multValue}>x{mult.toFixed(1)}</span>
            <span className={s.multDist}>
              {fmtDist(hud?.distance ?? 0)}
              <br />
              metros
            </span>
          </div>
          <div className={s.score}>
            <strong>{hud?.score ?? 0}</strong>
            <span>fichas</span>
          </div>
          <div className={s.timer}>{fmtTime(hud?.time ?? 0)}</div>
        </div>
      )}
      {phase === "playing" && (
        <button type="button" className={s.pause} aria-label="Pausar (P)" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "p" }))}>
          <span />
          <span />
        </button>
      )}

      {/* side HUD */}
      {(phase === "playing" || phase === "paused") && (
        <>
          <ul className={s.powers} aria-label="Itens">
            <li className={s.off}>
              <i className={s.icoFire} />x<b>0</b>
            </li>
            <li className={s.off}>
              <i className={s.icoBoom} />x<b>0</b>
            </li>
            <li>
              <i className={s.icoNitro} />
              <span className={s.nitroBar}>
                <span style={{ transform: `scaleX(${hud?.nitro ?? 0})` }} />
              </span>
            </li>
          </ul>
          <ul className={s.cats} aria-label="Objetos derrubados por categoria">
            {(Object.keys(CAT_LABEL) as Category[]).map((c) => (
              <li key={c}>
                <span className={s.catRing}>{hud?.cats[c] ?? 0}</span>
                <span className={s.catLabel}>{CAT_LABEL[c]}</span>
              </li>
            ))}
          </ul>
          <ul className={s.feed}>
            {feed.map((f) => {
              const [a, ...b] = f.text.split(" ");
              return (
                <li key={f.id}>
                  <strong>{a}</strong> <span>{b.join(" ")}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* bottom bar */}
      <div className={s.fps}>
        <strong>{hud?.fps ?? 0}</strong>
        <span>FPS</span>
      </div>
      <ul className={s.controls} aria-label="Controles">
        <li>
          <span className={s.arrows} aria-hidden="true">
            <kbd>↑</kbd>
            <kbd>←</kbd>
            <kbd>↓</kbd>
            <kbd>→</kbd>
          </span>
          Dirigir
        </li>
        <li className={s.off}>
          <kbd>Q</kbd>Atirar
        </li>
        <li className={s.off}>
          <kbd>E</kbd>Bomba
        </li>
        <li>
          <kbd className={s.wide}>⇧</kbd>Nitro
        </li>
        <li>
          <kbd className={s.space} aria-label="Espaço" />
          Pular
        </li>
        <li>
          <kbd>R</kbd>Reiniciar
        </li>
      </ul>

      {/* menu */}
      {phase === "menu" && (
        <section className={s.menu} aria-label="Menu do jogo">
          <h1 className={s.title}>
            <span className={s.outline}>Como</span>
            <span className={s.playRow}>
              Jogar
              <button type="button" className={s.enter} onClick={play} disabled={loading} aria-label="Jogar (Enter)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 5v8H7m0 0 4-4m-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
                </svg>
              </button>
            </span>
          </h1>
          <p className={s.lead}>Derrube os ícones de PlayStation, Xbox, Nintendo e Sega. Cada batida vale fichas, os blocos ? valem o triplo e batidas seguidas sobem o multiplicador. Moedas dão fichas extras; estrelas, mais 5 segundos.</p>
          <div className={s.player}>
            <span className={s.avatar} aria-hidden="true" />
            <span>
              <strong>Invader</strong>
              <small>Piloto Retro Gamers</small>
            </span>
          </div>
          {loading && <p className={s.loading}>Carregando a arena…</p>}
        </section>
      )}
      {phase === "menu" && (
        <aside className={s.records} aria-label="Melhores partidas">
          <h2>Melhores partidas</h2>
          {records.length ? (
            <ol>
              {records.map((r, i) => (
                <li key={r.at}>
                  <span>{i + 1}</span>
                  <span>{new Date(r.at).toLocaleDateString("pt-BR")}</span>
                  <strong>{r.score}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p>Nenhuma partida ainda. Os recordes ficam salvos neste navegador.</p>
          )}
        </aside>
      )}

      {phase === "paused" && (
        <section className={s.overlay} aria-label="Pausa">
          <h2 className={s.big}>Pausa</h2>
          <div className={s.overActions}>
            <button type="button" onClick={menu}>
              Menu principal <kbd>Esc</kbd>
            </button>
            <button type="button" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "p" }))}>
              Continuar <kbd>P</kbd>
            </button>
          </div>
        </section>
      )}

      {phase === "over" && over && (
        <section className={s.overlay} aria-label="Detalhes da sessão">
          <h2 className={s.big}>Detalhes da sessão</h2>
          <div className={s.columns}>
            <div>
              <h3>Pontuação</h3>
              <dl className={s.boxed}>
                <div>
                  <dt>Pontuação total</dt>
                  <dd>
                    {over.best && <em>recorde</em>}
                    {over.score}
                  </dd>
                </div>
                <div>
                  <dt>Melhor recorde</dt>
                  <dd>{records[0]?.score ?? over.score}</dd>
                </div>
                <div>
                  <dt>Maior combo</dt>
                  <dd>{over.bestCombo}</dd>
                </div>
              </dl>
              <dl>
                {(Object.keys(CAT_LABEL) as Category[]).map((c) => (
                  <div key={c}>
                    <dt>{CAT_LABEL[c]}</dt>
                    <dd>{hud?.cats[c] ?? 0}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h3>Estatísticas</h3>
              <dl>
                <div>
                  <dt>Objetos derrubados</dt>
                  <dd>{over.smashed}</dd>
                </div>
                <div>
                  <dt>Blocos ?</dt>
                  <dd>{over.bonus}</dd>
                </div>
                <div>
                  <dt>Moedas</dt>
                  <dd>{over.coins}</dd>
                </div>
                <div>
                  <dt>Distância</dt>
                  <dd>{fmtDist(over.distance)} M</dd>
                </div>
                <div>
                  <dt>Velocidade máx.</dt>
                  <dd>{Math.round(over.topSpeed * 3.6)} KM/H</dd>
                </div>
                <div>
                  <dt>Fase</dt>
                  <dd>{over.stage}</dd>
                </div>
                <div>
                  <dt>Duração</dt>
                  <dd>{fmtTime(over.duration)} MIN</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className={s.overActions}>
            <button type="button" onClick={menu}>
              Menu principal <kbd>Esc</kbd>
            </button>
            <button type="button" onClick={play}>
              Jogar de novo <kbd>R</kbd>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
