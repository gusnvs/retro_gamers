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

### Qualidade dos objetos do hero (playstation, switch, xbox, logo)
- **Modelagem por SDF** (`tools/baker/sdf.js`): carcaças moldadas (controles, Joy-Cons, logo) são descritas como campos de distância e poligonizadas com Surface Nets — superfícies lisas, grips tubulares, linha de partição entre as metades, poços dos analógicos e furos dos botões escavados, grade do alto-falante. Botões/analógicos são posicionados na superfície com `placeOn`.
- **Logo**: contorno dos pixels arredondado por morfologia 2D (`morphSDF`), corpo em metal azul cromado com face de esmalte branco rebaixada.
- **Materiais**: `grained()` adiciona micro-textura em espaço de objeto (rugosidade + bump), estável entre os 16 frames.
- **Luz** (`tools/baker/bake.js`): ambiente de estúdio (softboxes + faixa azul da marca) e **oclusão de ambiente** acumulada por shadow maps (72 direções fixas no espaço do modelo) aplicada antes do tone mapping.
- Os 5 objetos do grid usam `legacyEnv: true, ao: 0` em `MODELS` para manter a aparência original até ganharem modelos no mesmo nível.
- Prévias rápidas sem tocar em `public/`: `BAKE_OUT=<pasta> BAKE_CELL=512 node tools/bake.mjs logo` (`BAKE_DEBUG=1` mostra só o AO, `2` sem AO).

Logo: a grade de pixels está em `INVADER` (`tools/baker/models.js`) e `INVADER_ROWS` (`src/components/icons.tsx`). Foi lida a partir da imagem enviada no chat; ajuste as linhas se algum pixel divergir do arquivo original.

## Para chegar ao nível da referência
- Trocar os modelos procedurais por modelos detalhados (Blender, ou geração por IA como Meshy/Higgsfield + limpeza no Blender) e renderizar os mesmos passes com Cycles (AOVs Position/Vector/Alpha + máscara por material). O formato de saída já é o que o site consome — basta respeitar a grade 4×4 e os nomes de arquivo.
- Geração por IA tem custo por modelo e pede aprovação antes de usar créditos.
