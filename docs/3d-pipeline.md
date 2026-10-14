# Pipeline 3D (motion-vector flipbooks)

## Como a referência faz (OBSERVADO)
Os objetos do buttermax.net **não são modelos carregados no navegador** (nenhum .glb é baixado). Cada objeto foi modelado e renderizado offline em 16 ângulos (grade 4×4) e exportado em passes:

| Passe | Tamanho | Uso no shader |
|---|---|---|
| `diffuse` | 4096² | cor final |
| `alpha` | 2048² | recorte e teste de hover |
| `position` | 1024² | posição normalizada (dissolução da transição, centro do pulso) |
| `mv` | 1024² | motion vectors para interpolar entre frames |
| `data` | 1024² | máscara da tela (onde o reel é projetado) |
| `glass` | 1024² | camada de vidro (alguns objetos) |

O shader (`MotionVectorShader`) escolhe o frame pela posição X do mouse. Não foi possível determinar qual software gerou os renders (provavelmente Blender/Cinema 4D com AOVs) — **não há indício de Meshy**.

## Como este projeto faz
1. `tools/baker/models.js` — modelos procedurais em three.js (PlayStation-style, Switch-style, Xbox-style, logo invader em voxels, portátil, cartucho, joystick Atari, TV CRT, headset). Meshes com `userData.screen = true` entram na máscara `data`.
2. `tools/baker/bake.js` — renderiza 16 ângulos (yaw), com supersampling 2×, e gera os mesmos passes (`mv` calculado a partir da transformação exata entre frames).
3. `node tools/bake.mjs [nomes…]` — abre o baker no Chrome (CDP 9222) e grava em `public/assets/mv/` + `manifest.json` (colunas, linhas, força do deslocamento, versão para cache).
4. `python tools/make-med.py` — gera as versões `-med` (2048²) usadas no grid.

Logo: a grade de pixels está em `INVADER` (`tools/baker/models.js`) e `INVADER_ROWS` (`src/components/icons.tsx`). Foi lida a partir da imagem enviada no chat; ajuste as linhas se algum pixel divergir do arquivo original.

## Para chegar ao nível da referência
- Trocar os modelos procedurais por modelos detalhados (Blender, ou geração por IA como Meshy/Higgsfield + limpeza no Blender) e renderizar os mesmos passes com Cycles (AOVs Position/Vector/Alpha + máscara por material). O formato de saída já é o que o site consome — basta respeitar a grade 4×4 e os nomes de arquivo.
- Geração por IA tem custo por modelo e pede aprovação antes de usar créditos.
