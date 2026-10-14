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
| Build de produção (`next build`) e testes em produção | 17/17 PASS (dev e prod) |
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
| Páginas de case `/projects/:slug` | Conteúdo de clientes da Buttermax; a Loja aponta para o Contato com o assunto preenchido. |
| Texto em WebGL (MSDF) e simulação de fluido do mouse | Texto feito em DOM com a mesma geometria; hover com círculo (sem fluido). |
| Pós-processamento (bloom, RGB shift global) | Não implementado. |

## Riscos / próximos passos sugeridos
1. Modelos 3D de maior fidelidade (ver `docs/3d-pipeline.md`).
2. Vídeo real do reel (`/public/media/reel.mp4`).
3. Backend do formulário.
4. Catálogo real (CMS) para a Loja.
