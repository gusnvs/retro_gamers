# Mapa de comportamentos

Formato: elemento — gatilho → estado resultante (referência → implementação).

## Global
- **Loader** — carregamento → logo em #101010 vira pontos e "explode" em esfera de pontos coloridos, página revelada. Impl.: pixels do invader montam, viram pontos, colapsam e explodem (GSAP, ~2.6s). Respeita `prefers-reduced-motion`.
- **Smooth scroll** — wheel → Lenis (`lerp 0.1`). Scrollbar nativa oculta + indicador fino à direita (difference blend).
- **Header** — hover no botão → `::before` sobe de baixo (`scaleY` .45s ease-out-cubic) e texto vira #101010; página ativa = botão preenchido. Cor da marca com `mix-blend-mode: difference` (preto sobre fundo da marca, cor da marca sobre escuro).
- **Menu mobile (<1025px)** — clique no círculo → overlay com `clip-path inset(10%)→inset(0)` .65s; Esc fecha; troca de rota fecha.
- **Transição de rota** — corte para #101010 (~150ms) e fade-out .45s.
- **Cookie banner** — entra após o loader; Aceitar/Recusar → sai e grava escolha em `localStorage` (não há analytics nesta versão).

## Objetos 3D (shader motion-vector portado 1:1)
- **Rotação** — posição X do mouse (com `+0.1·sin(t)`, `smoothstep(.1,.9)`, `lerp .08`/frame) escolhe o frame 1..15 do flipbook; blend entre frames por motion vectors.
- **Entrada** — `uTransition 0→1` (2–2.4s, easeInOutCubic): escala 0.7→1, sobe 0.4, gira 0.1rad, dissolução pixelada com arco-íris guiada pelo passe `position`.
- **Hover** — ao entrar na silhueta (teste de alpha no frame atual): `uClickUv`, `uClickTime=0`, `uInside=1`; pulso em anel + pixelização; `uInside` decai 0.01/frame, `uClickTime += dt/1200`.
- **Tela** — onde `data.r>0`, o reel é projetado em espaço de tela com RGB shift e scanlines proporcionais à velocidade do scroll.
- **Ondulação idle** — senos no vertex shader (amplitude 0.01–0.015, rotação ±0.04).

## Home
- **Slideshow do hero** — a cada 10s (`setInterval 1e4`): objeto atual sai (1.4s) e o próximo entra (2s, atraso .35s); clique no objeto avança. Ordem: PlayStation → Switch → Xbox → logo.
- **Wordmark** — "Retro" revelado por clip (0.9s), "Gamers" por clip (1.4s); tagline e ícones com fade.
- **Seta ↓** — bob contínuo; clique rola 1 viewport (Lenis 1.4s).
- **Reel** — cenas de 3.2s; cenas alternam entre moldura inset (10.9%/7.5%) com fundo desfocado e tela cheia; moldura com parallax de mouse.
- **"Quem somos"** — linhas sobem com stagger .07s ao entrar na viewport.
- **Card do grid** — hover → círculo da cor do card (47% de uma camada 124%, transborda o card) segue o ponteiro com atraso; dentro: marquee contínuo e label/badge recoloridos. Clique → transição de cena para `/loja/[slug]`. Em telas sem hover o painel colorido fica visível.

## Loja
- Filtros → `router.replace('/loja?categoria=x')`, sublinhado anima da direita/esquerda (.75s), grid refaz entrada com stagger.

## Contato
- Validação no submit: obrigatórios (nome, e-mail, mensagem) e formato de e-mail; estados error → loading (0.9s) → success. **Nenhum dado é enviado** (sem backend). `?assunto=` pré-preenche o assunto (vindo dos cards da Loja).
- Newsletter: valida o e-mail localmente; não envia.

## Rastro do mouse (pixelado) — `src/lib/trail.ts`, `src/components/TrailOverlay.tsx`
Referência (OBSERVADO nos shaders `DrawShader`, `GLUIShapeBridgeShader`, `GLUITextBridgeShader`, `splatShader`): um buffer `tDraw` (R = rastro do ponteiro com decaimento ×0.94/frame, G = densidade de fluido) é lido por todos os elementos; formas trocam `uColor→uColor2` onde `fluid*2 > 0.5`, textos ficam arco-íris (> 0.5) e brancos (> 0.8–1.0).
Implementação (pedido: pixelado em vez de pincel): campo em grade de células (~16px), splat por segmento com queda `1 − cubicOut` (igual ao `splatShader`), decaimento 0.955 + difusão para o espalhamento de fluido, ruído nas bordas a 12 fps.
- Fundo da marca (hero, "Quem somos", contato, footers claros): núcleo → fundo preto e texto branco; franja → fundo preto e texto arco-íris (`backdrop-filter`).
- Fundos escuros (footer da home, Loja, Sobre): `difference` com a cor da marca (escuro → azul, texto azul → preto).
- Cards do grid: o rastro revela a cor do card e o marquee (mesma camada do hover, recortada pelas células).
- Reel: interferência de TV antiga — faixas do vídeo deslocadas (tearing) + estática granulada.
- Objetos 3D: o campo alimenta `tDraw` do shader (pixelização/matiz na tela do aparelho), como na referência.
- Desligado em telas touch e com `prefers-reduced-motion`.

## Transição card → página de detalhe — `src/gl/sceneTransition.ts`, `src/lib/sceneNav.ts`
Referência (OBSERVADO: `SceneTransition.fs`, `RootScene.navigate`, `TR_DURATION = 2600`): `uTransition 0→1` em 2,6 s easeInOutCubic, `uBlur 1→1.3` e `uSize2 .35→−.2` easeOutCubic; grade de pontos (`uZoom 23`) + círculo crescente centrados no clique, borda arco-íris; cena antiga ampliada (×2,2) e girada; cena nova de 0,6×→1×.
Implementação: shader portado 1:1 num quad de tela cheia; a cena nova é desenhada num canvas (fundo na cor do item + título gigante na posição do hero de detalhe); a página antiga (DOM) recebe a ampliação/rotação por CSS a partir do ponto do clique; a rota troca quando a máscara cobre a tela (~1,5 s) e o quad sai com fade de 0,3 s. Medido: pontos aparecem em ~1,15 s (ref. 1,146 s), campo de pontos em ~1,44 s (ref. 1,40 s).
- Também é usada nos cards da Loja e no footer "próximo item" das páginas de detalhe.
- Primeira carga: o loader entrega para o mesmo shader em modo `uFirst` (preto fora da máscara, esfera de pontos centrada). Duração usada 1,7 s (INFERIDO: as capturas da referência mostram a página em < 0,7 s após a esfera, mais curto que os 3,9 s do código).

## Páginas de detalhe — `/loja/[slug]`
Estrutura da referência `/projects/[slug]`: hero 100vh na cor primária com marquee 29rem na cor secundária, objeto 3D min(55vw, 800px), barra Categoria/Desde; reel; título com 1ª linha recuada; linhas Categoria / Desde / Na loja / Sobre; CTA com barra grossa; galeria `DetailMedia` (blocos retrato 49,87% e paisagem 100%, padding 5,2083vw 9,375vw, fundo na cor secundária); footer do próximo item nas cores dele. Header usa a cor terciária, sem blend, com seta "voltar para a loja" e o logo.
