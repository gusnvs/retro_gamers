# Status de implementação

## Implementado (verificado)

| Funcionalidade | Verificação |
|---|---|
| Home: loader, header, hero com wordmark + slideshow 3D (PS, Switch, Xbox, logo), reel, "Quem somos", grid 3×3 com objetos 3D e hover, footer | capturas + testes Playwright |
| Shader motion-vector da referência portado (rotação pelo mouse, transição, pulso no hover, reel nas telas) | visual + `src/gl/shaders.ts` |
| 9 objetos 3D assados no formato da referência (diffuse/alpha/position/mv/data, 4×4) | `public/assets/mv`, `tools/bake.mjs` |
| Páginas Loja (filtros por categoria), Sobre, Contato, 404 | testes Playwright |
| Menu mobile, header ativo, transição de rota, scroll suave, indicador de scroll | testes Playwright |
| Responsivo 1920 → 375 sem overflow horizontal | teste automatizado em 5 viewports |
| Rastro do mouse pixelado (hero, reel com interferência de TV, "Quem somos", cards, footers, páginas internas) | teste Playwright + capturas `_research/ref/sheet_trail_local.jpg` |
| 9 páginas de detalhe `/loja/[slug]` (equivalentes às páginas de projeto) | teste Playwright (todas carregam sem erro) |
| Transição de cena card → detalhe (shader da referência portado) e revelação inicial | teste Playwright + capturas `_research/ref/sheet_detailtrans_local.jpg` |
| Testes Playwright (dev) | 20/20 PASS — `next build` desta rodada ainda não executado |
| Acessibilidade básica: landmarks, `aria-label` nos objetos 3D, foco visível, `aria-current`, `prefers-reduced-motion` | revisão manual |

## Simulado / sem integração real

| Item | Situação |
|---|---|
| Formulário de contato | Valida e simula envio local. **Nenhum dado é enviado.** Mostra aviso e link do Instagram. Precisa de um endpoint real (e-mail/WhatsApp/CRM) definido pela loja. |
| Newsletter | Apenas validação local. |
| Cookie banner | Guarda a escolha em `localStorage`; não há analytics instalado. |
| Reel | Animação procedural em canvas (cenas retrô). A referência usa um vídeo; substituir quando houver vídeo da loja. |
| Catálogo da Loja | 9 categorias de layout; não há produtos, preços nem estoque (sem fonte de dados da loja). Itens marcados `placeholder` em `src/data/site.ts`. |

## Não reproduzido (com justificativa)

| Item | Motivo |
|---|---|
| Fonte Decagram | Licença comercial (Emtype). Substituída por Archivo. Basta comprar a licença e trocar `--font-base`. |
| Assets da Buttermax (renders, vídeo, cases, logos) | Sem autorização de uso; substituídos por conteúdo Retro Gamers. |
| Conteúdo dos cases `/projects/:slug` | Conteúdo de clientes da Buttermax; a estrutura foi recriada em `/loja/[slug]` com conteúdo Retro Gamers. |
| Texto em WebGL (MSDF) | Texto em DOM com a mesma geometria. |
| Simulação de fluido Navier–Stokes do mouse | Substituída, a pedido, por um campo pixelado com difusão (mesmos limiares e regras de cor). |
| Fotos/vídeos dos cases | Galeria usa quadros do próprio objeto 3D (vários ângulos) e cenas do reel; conteúdo das categorias marcado como a confirmar com a loja. |
| Pós-processamento (bloom, RGB shift global) | Não implementado. |

## Riscos / próximos passos sugeridos
1. Modelos 3D de maior fidelidade (ver `docs/3d-pipeline.md`).
2. Vídeo real do reel (`/public/media/reel.mp4`).
3. Backend do formulário.
4. Catálogo real (CMS) para a Loja.
