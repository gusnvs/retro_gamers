# Validação visual

Capturas: Playwright 1.64 conectado ao Chrome 155 (CDP 9222), DPR 1, cookies recusados, mouse no centro, espera de 9–11s para o fim da intro. Scripts e imagens ficam em `_research/` (local, ignorado no git — contém capturas da referência, que não devem ser redistribuídas).

Viewports testados: 1920×1080, 1440×900, 1366×768, 768×1024, 390×844, 375×812.

## 1. Geometria DOM (1440×900) — referência × implementação

| Elemento | Referência | Implementação | Δ |
|---|---|---|---|
| Logo do header | 50,46 · 36×39 | 50,47 · 39×27 (invader) | forma diferente por design |
| Emblema central | 679,46 · 83×39 | 679,47 · 83×36 | ≤3px |
| Botões do header | 1053/1167/1281 · 109×36 | 1053/1167/1281 · 109×36 | 0 (após ocultar a scrollbar nativa) |
| Slide do hero | 420,178 · 600×600 | 420,178 · 600×600 | 0 |
| Rodapé do hero (dna/seta) | y=814 | y=814 | 0 |
| Seta ↓ | 702,814 · 36 | 702,818 · 36 | 4px (animação bob) |
| Tagline | 115,~350 | 111,~347 | ≤4px |
| Reel | y=900 · h=900 | y=900 · h=900 | 0 |
| Bloco "Quem somos" | 141,1930 · w1148 | 141,1930 · w1158 | 0 / +10 (largura de viewport 1430 vs 1440) |
| Grid | y=2395, célula 383 | y=2405, célula 386 | +10px (título com 1 linha a mais) |
| Footer | y=3643 · h=495 | y=3663 · h=495 | +20px (acúmulo acima) |

## 2. Caixa delimitadora de "tinta" escura por região (máx. |Δ| em px)

Métrica independente da cor da marca: pixels com luminância < 70, bbox por região (`_research/tools/bbox.py`, resultados em `_research/ref/vp/bbox.json`).

| Viewport | logo header | ícone central | navegação | 1ª palavra do wordmark |
|---|---|---|---|---|
| 1920×1080 | 5 | 1 | 0 | 16 |
| 1440×900 | 87* | 1 | 0 | 11 |
| 1366×768 | 5 | 96* | 160* | 11 |
| 768×1024 | 18 | 16 | 0 | 6 |
| 390×844 | 5 | 14 | 109* | 4 |
| 375×812 | 5 | 13 | 103* | 3 |

\* Não é desalinhamento do header: o ascendente alto do "G" de "Gamers" (Sacramento) entra na faixa do header (o "max" original não sobe tanto). Nos demais casos os elementos coincidem com a referência em ≤16px.

IoU de máscaras de tinta também foi calculado (`metrics.json`), mas é pouco informativo aqui porque os textos mudaram (Butter↔Retro, WORKS↔LOJA).

## 3. Comparações lado a lado (local)

`_research/ref/final_cmp_home_a.jpg`, `final_cmp_home_b.jpg`, `final_cmp_loja.jpg`, `final_cmp_sobre.jpg`, `final_cmp_contato.jpg`, overlays `ref/vp/overlay_*.png`.

## 4. Divergências e correções aplicadas (ciclos de refinamento)

| Severidade | Divergência | Correção |
|---|---|---|
| CRÍTICO | Faixa preta no topo (margin colapsando) | `padding-top` no hero |
| CRÍTICO | Erro de runtime no reel (índice de cena negativo) | clamp do tempo |
| ALTO | Header deslocado 15px (scrollbar nativa) | scrollbar oculta + indicador custom |
| ALTO | Seta do hero à direita | 3ª coluna mantida, só o texto oculto (CSS original) |
| ALTO | Moldura do reel animada por scroll (hipótese errada) | moldura por cena (faz parte do vídeo original) |
| ALTO | Título "Nossa loja" e filtros cortados | `fit-content` + `justify-content: safe flex-end` |
| ALTO | Título do Sobre não cabia em 29rem | palavras curtas factuais |
| MÉDIO | Wordmark 30–40px fora de posição | reposicionado (centro, 7.5%→92.7% da largura) |
| MÉDIO | Objetos pequenos na célula; símbolos PS com artefatos | re-bake com enquadramento 94%, sombras, rim azul, símbolos em textura |
| MÉDIO | Círculo de hover menor | raio 47% |
| MÉDIO | Acentos cortados nas linhas | padding/margin compensados nas linhas |
| BAIXO | Overflow horizontal 8–10px no mobile | `main { overflow-x: clip }` |

## 5. Pendências conhecidas

- Os objetos 3D são modelos procedurais (three.js); a referência usa renders fotorrealistas de modelos detalhados. Ver `docs/3d-pipeline.md`.
- "Gamers" em fonte Sacramento difere do lettering exclusivo "max".
- Hover do card usa círculo com clip-path; a referência usa simulação de fluido (blob orgânico).
- Não há métrica de "similaridade %" global: o conteúdo foi trocado de propósito (marca, cor, textos, objetos), o que torna um diff de pixels global sem significado.
