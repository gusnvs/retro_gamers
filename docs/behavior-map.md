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
Implementação (rodada 3): como na referência, a cena de destino é a **página nova real**. No clique, a página atual vira uma textura (snapshot do DOM visível via `html-to-image` + o quadro atual do WebGL), o quad mostra essa textura (com `uvFrom`: zoom ×2,2, rotação, barrel e RGB shift do shader original), a rolagem é zerada e a rota troca por baixo dele no mesmo instante; a página nova aparece pelos furos da máscara, já com seus objetos 3D. Em `uTransition = 1` o quad está totalmente transparente e é removido, sem nenhum corte. O header troca de tema aos 55% da transição.
- Rodada 4 (cena de saída viva): uma foto estática deixava a página antiga "congelada" no meio da transição. Agora a textura `tFrom` é um render target redesenhado a cada quadro (`stage.liveFrom`): ao fundo, o snapshot do DOM só com as partes estáticas; por cima, o reel (canvas `data-scene-live="reel"`, com o recorte `inset` do quadro), os marquees (`data-scene-marquee="x|y"`: título do detalhe, pílula e coluna vertical do Contato) continuando a rolar, e os objetos 3D da página antiga "adotados" pela cena de saída: continuam girando com o mouse e o reel continua passando nas telas até o fim da transição, quando são descartados. Como na referência, onde a cena antiga continua sendo renderizada durante a troca (OBSERVADO: `RootScene` desenha as duas cenas em render targets).
- Vale para **todos** os links internos (header, logo, seta de voltar, rodapés, cards, menu mobile) — interceptados em `src/components/SceneLinks.tsx`. Cliques durante uma transição são ignorados (como o `setBusState("transitioning")` da referência).
- Primeira carga: o loader entrega para o mesmo shader em modo `uFirst` (preto fora da máscara, esfera de pontos centrada). Duração usada 1,7 s (INFERIDO: as capturas da referência mostram a página em < 0,7 s após a esfera, mais curto que os 3,9 s do código).

## Páginas de detalhe — `/loja/[slug]`
Estrutura da referência `/projects/[slug]`: hero 100vh na cor primária com marquee 29rem na cor secundária, objeto 3D min(55vw, 800px), barra Categoria/Desde; reel; título com 1ª linha recuada; linhas Categoria / Desde / Na loja / Sobre; CTA com barra grossa; galeria `DetailMedia` (blocos retrato 49,87% e paisagem 100%, padding 5,2083vw 9,375vw, fundo na cor secundária); footer do próximo item nas cores dele. Header usa a cor terciária, sem blend, com seta "voltar para a loja" e o logo.
