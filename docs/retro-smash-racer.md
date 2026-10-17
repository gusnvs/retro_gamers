# Retro Smash Racer — análise, plano e status

Rota: `/retro-smash-racer` (link "Jogar" no menu). Referência: https://awards.racing/race.
Branch: `feat/retro-smash-racer`.

## 1. Análise da referência (REA + Playwright, 16/10/2026)

| Item | Status | Evidência |
|---|---|---|
| Nuxt (Vue) + Vite | OBSERVADO | `analyze_web_bundle` ev_9b4ce6fc…, chunks `/_nuxt/*.js` |
| Three.js com `WebGPURenderer` (fallback WebGL2) | OBSERVADO | `module.ae3c07ebaf53.js` (2,5 MB): `WebGPURenderer`, `__THREE__`, nós TSL (`uView`, `previousModelMatrix`) |
| Física Bullet compilada em WASM, veículo por raycast | OBSERVADO | `physics.202608121411.wasm` (541 KB) + loader Emscripten com `btVector3`, `btQuaternion`, `Vehicle`, `WheelPhysicalParameters`, `PhysicsContext` |
| glTF com Draco, KTX2/Basis, meshopt; IBL em EXR | OBSERVADO | strings do módulo; `common/env/studio/*.exr` |
| Áudio do motor em camadas (idle/low/med/high on/off, maxRPM) + 6 faixas | OBSERVADO | `common/sounds/engine/*.wav`, `common/tracks/*.mp3` |
| Backend próprio: identidade, sessão, checkpoints com token JWT, ranking, online | OBSERVADO | `api.awards.racing/api/{player/identity, session/start, race-result/checkpoint, best-drivers, online-count, total-racers}` |
| Arena vista de cima (não é pista), objetos físicos que voam ao bater e pontuam ("+1 likes") | OBSERVADO | capturas `_research/awards/race_sheet.jpg` |
| Multiplicador ("mult. x1.0") com distância, 4 notas por categoria, fases que trocam a cor do piso | OBSERVADO | HUD; piso azul `#1b1e91` → rosa `#d4246d` amostrados |
| Controles: setas = dirigir, Q = tiro, E = bomba, ⇧ = nitro, espaço = pulo, R = reiniciar | OBSERVADO | barra inferior do HUD |
| Inimigos, chefe, armadura/escudo/vida, história | INFERIDO | nomes de sons (`EnemyDeath`, `BossKilled`, `ArmorCollected`…); não observados em jogo |
| Tela "Session details" (Score/Stats, Main menu ESC, Play again R) | OBSERVADO | `_research/awards/race_hud.png` |
| Peso: ~18 MB na 1ª partida (8 MB de música; cenário 1,5 MB) | OBSERVADO | `performance` resource timing |
| Fonte Druk Wide (500/900, itálico) | OBSERVADO | `document.fonts`; licença comercial → **NÃO REPRODUZÍVEL**, substituída por Archivo com largura 125% |

HUD medido a 1440×900: placar 42px/900; rótulos 13–14px/500 (espaçamento 0,42px); anéis laterais 18px/500; barra de controles a ~65px do rodapé; FPS 14px/900.

Não reutilizamos código, modelos, sons ou textos do awards.racing (sem autorização). Personagens e objetos são da Retro Gamers (invader) ou genéricos (cartucho, console, controle, ficha de fliperama) — nada de personagens ou logos de terceiros.

## 2. Plano em fases

1. **Protótipo (feito nesta rodada):** kart com física de veículo, arena, câmera, objetos que voam e pontuam.
2. **Versão inicial jogável (em grande parte feita):** HUD, multiplicador, moedas e tempo, nitro, pulo, fases de cor, tela de sessão, recordes locais. Falta: sons, controle por toque, ajuste fino da direção.
3. **Nível referência:** tiro (Q) e bomba (E), inimigos e chefe, power-ups (escudo/vida), mais personagens/karts customizáveis, trilha, pós-processamento (desfoque de profundidade), modelos GLB próprios. Ranking **local** (sem servidor), por decisão do projeto.

## 3. Status

| Funcionalidade | Status |
|---|---|
| Rota, link no menu, tela cheia sem header/rastro do site | PASS (teste Playwright) |
| Kart (Rapier `DynamicRayCastVehicleController`), direção, ré/freio, nitro, pulo, desvirar automático | PASS (teste: velocidade > 3 m/s após 1,5 s) |
| Arena com piso em células (shader Voronoi), 3 fases de cor a cada 25 s, muretas | OBSERVADO em captura |
| 118 objetos físicos em 4 categorias + invasores bônus (×3), reaparecem 5 s após batidos | OBSERVADO em captura |
| Moedas (+5 × mult) e corações (+5 s) | OBSERVADO em captura |
| HUD: logo, mult + distância, placar, tempo, pausa, itens, categorias, avisos, FPS, controles | OBSERVADO em captura |
| Menu "Como jogar", pausa, detalhes da sessão, recordes locais (`localStorage`) | PASS (menu/pausa no teste); sessão: NOT TESTED automatizado |
| Tiro (Q) e bomba (E) | NÃO IMPLEMENTADO (aparecem apagados no HUD) |
| Inimigos, chefe, escudo/vida | NÃO IMPLEMENTADO |
| Sons e trilha | NÃO IMPLEMENTADO |
| Controle por toque (celular) | NÃO IMPLEMENTADO — no celular o jogo abre, mas sem controles |
| Desfoque de profundidade / pós-processamento | NÃO IMPLEMENTADO |
| Transição de cena ao sair do jogo | Funciona, mas o canvas do jogo não entra na foto da página (`data-scene-skip`) |
| Build de produção | PASS (rota 110 kB; motor e física carregados sob demanda) |
