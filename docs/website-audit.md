# Auditoria do website de referência — buttermax.net

Data da inspeção: 2026-10-14. Navegador: Chrome 155 com `--remote-debugging-port=9222` (perfil separado).
Ferramentas: REA (`list_browser_targets`, `inspect_web_page`, `capture_web_screenshot`), Playwright 1.64 via CDP, scripts em `_research/tools` (pasta local, fora do git).

Legenda: **OBSERVADO** (confirmado diretamente) · **INFERIDO** (hipótese com evidência) · **NÃO VERIFICADO** · **NÃO REPRODUZÍVEL**.

## 1. Tecnologias

| Item | Status | Evidência |
|---|---|---|
| Next.js (pages router), CSS Modules | OBSERVADO | REA `inspect_web_page`: chunks `/_next/static/chunks/pages/{index,projects,profile,contact}-*.js`, classes `Header_header__Z8PUO` |
| Engine WebGL própria "Hydra" (Active Theory-like): `assets/js/app.<ts>.js` (1,1 MB), `hydra-thread.js`, `assets/shaders/compiled.vs`, `assets/data/uil.json` | OBSERVADO | lista de requests (`_research/ref/network.json`) |
| Lenis (smooth scroll, wrapper `.lenis.lenis-smooth`) | OBSERVADO | DOM |
| GSAP (inline `translate: none; rotate: none; scale: none`) | INFERIDO | assinatura de estilos inline no DOM |
| Framer Motion (`AnimatePresence mode="popLayout"` no slideshow) | OBSERVADO | `pages/index-*.js` |
| Lottie (loader e ícones "Dna"/"Arrow") | OBSERVADO | `assets/js/lib/lottie.min.js`, SVGs `__lottie_element_*` |
| Texto renderizado em WebGL (MSDF, `fonts/Decagram-*.png/json`); DOM com `visibility:hidden` serve de layout | OBSERVADO | DOM + requests |
| Fluid sim do mouse (`mousefluid`, curl/pressure/advection shaders) | OBSERVADO | `compiled.vs`, `uil.json` |
| CMS: `storage.googleapis.com/bx-site-cms/cms/projects-production.json` | OBSERVADO | requests |

## 2. Rotas

| Rota | Conteúdo |
|---|---|
| `/` | hero (wordmark + slideshow 3D), reel, "Who we are" + grid 3×3, footer "Reach out" |
| `/projects` | "All works": título, filtros (All/Branding/Web/Game/AI/Platform), grid escuro |
| `/projects/:slug` | 9 páginas de case (fora do escopo de reconstrução — conteúdo de clientes da Buttermax) |
| `/profile` | título gigante bicolor, device 3D, processo, prêmios, locais |
| `/contact` | marquee vertical "GET IN TOUCH", device 3D, formulário, newsletter |

## 3. Seções da home (1440×900, rem = 10px)

| Seção | Geometria observada |
|---|---|
| Header fixo | altura 13rem; margens 5rem; logo 36×39 @ (50,46); ícone central 83×39 @ (679,46); 3 botões 109×36, borda 2px, raio 20px, gap .5rem; `mix-blend-mode: difference` |
| Hero | padding-top 13rem; `LogoShape` 100vw×25vw, top −10%; slide 600×600 @ (420,178); rodapé (dna/seta) bottom 5rem |
| Reel | 100vh, vídeo `reel_desktop.mp4` em `object-fit: cover` (enquadramentos com moldura/desfoque fazem parte do vídeo) |
| Grid | padding 13rem 14.1rem 10rem; título 7.2rem/.83, ls −.05em, 1ª linha à direita; grid 3 col, itens quadrados, `box-shadow` 1px rgba(16,16,16,.1) |
| Footer | 55vh, fundo #101010, título 15rem, e-mail 2.6rem, pills sociais |

## 4. Recursos (assets)

- Objetos 3D: **não são malhas**. Cada objeto (gameboy, dashboard, boombox, keycard, controller, tablet, magnifying-glass, glove, laptop, headphones) é um *flipbook* 4×4 pré-renderizado com passes `diffuse` (4096²), `alpha` (2048²), `position`, `mv` (motion vectors), `data` (máscara de tela) e às vezes `glass` (1024²). OBSERVADO.
- Fontes: Decagram Medium/SemiBold (Eduardo Manso / Emtype, EULA comercial). NÃO REPRODUZÍVEL (licença).
- Vídeo do reel, imagens de cases e logos de clientes: propriedade da Buttermax/clientes. NÃO REUTILIZADOS.

## 5. Limitações da inspeção

- O `inspect_web_page` do REA é passivo: não retorna valores de atributos/estilos; medidas vieram de Playwright (`getBoundingClientRect`, `getComputedStyle`).
- `compare_web_screenshots` do REA exige os PNGs completos inline; as comparações foram feitas com scripts locais (pixel/IoU/bbox) sobre capturas Playwright.
- Abas em segundo plano não renderizam WebGL: capturas REA de abas ocultas mostram o estado da intro (registrado após falsa pista sobre escala do wordmark).
- Comportamento do backend (formulário/newsletter) NÃO VERIFICADO — não foram feitos envios reais.
