# Design system — Retro Gamers (derivado de buttermax.net)

Fonte da verdade: CSS e medidas da referência. Única troca de identidade pedida: **amarelo #ffd600 → azul smurf** e o nome.

## Tokens (`src/app/globals.css`)

| Token | Valor | Referência |
|---|---|---|
| `--brand` | `#3da9f4` (azul smurf) | `#ffd600` |
| `--black` | `#101010` | `#101010` |
| `--white` | `#ffffff` | `#ffffff` |
| `--line` | `hsla(0,0%,6%,.1)` | idem (grid) |
| `--ease-out-cubic` | `cubic-bezier(.215,.61,.355,1)` | idem (botões, header) |
| `--ease-out-quad` | `cubic-bezier(.25,.46,.45,.94)` | idem (cookie) |
| cor do pulso 3D | `uLightColor` = brand | laranja fixo `(1,.5,0)` no shader original |

Cores dos cards (hover) mantêm a paleta da referência (`#ff5b49`, `#b7ff95`, `#ff6600`, `#101010`, `#d4b4ed`, `#fb7a01`, `#5793d0`, `#a6e1f5`, `#efefef`).

## Tipografia

| Uso | Referência | Implementação |
|---|---|---|
| Base | Decagram 500/600/800 (licença comercial) | **Archivo** 500/600/800 — mesma frase em 72px/−.05em: Decagram 820px × Archivo 815px (teste `_research/ref/fonttest.png`) |
| Wordmark script | lettering "max" em WebGL | **Sacramento** com traço de 15px (monoline) |
| Root size | `max(10px, min(12px, 1.302vw))`; ≥1025px `max(10px, min(12px, .5208vw))` | idêntico |

Escalas usadas (rem): header button 1/1.2/1.4; título "Who we are" 2 → 7.2 (≥1200); footer título 4.8 → 8 → 7.95 → 15; marquee 4.8 → 8 → 7.95 → 7.2.

## Breakpoints

768, 1025, 1200, 1400, 1500, 1700 px (mesmos da referência) + `max-height: 750px` para o slide.

## Componentes

`Header` (difference blend), `HeaderButton` (fill vertical .45s), `CookieBanner`, `Loader`, `SplitLines` (linhas medidas, 1ª à direita), `MVObject` (objeto 3D ligado a um placeholder DOM), `HeroSlideshow`, `Reel`, `GridItem` (variantes `home`/`list`), `PageFooter` (`dark`/`brand`), `ScrollIndicator`, `PageTransition`.
