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
- **Card do grid** — hover → círculo da cor do card (47% de uma camada 124%, transborda o card) segue o ponteiro com atraso; dentro: marquee contínuo e label/badge recoloridos. Clique → `/loja?categoria=…`. Em telas sem hover o painel colorido fica visível.

## Loja
- Filtros → `router.replace('/loja?categoria=x')`, sublinhado anima da direita/esquerda (.75s), grid refaz entrada com stagger.

## Contato
- Validação no submit: obrigatórios (nome, e-mail, mensagem) e formato de e-mail; estados error → loading (0.9s) → success. **Nenhum dado é enviado** (sem backend). `?assunto=` pré-preenche o assunto (vindo dos cards da Loja).
- Newsletter: valida o e-mail localmente; não envia.
