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

## Modelos prontos (Sketchfab) — `tools/baker/gltf.js`
O baker aceita arquivos `.glb` em `tools/baker/models/` e usa o modelo procedural só quando o arquivo não existe. Ele centraliza e normaliza o tamanho do modelo, liga as sombras e marca como "tela" (máscara `data`, onde o reel passa) as malhas cujo nome (ou nome do material) casa com o `screen` configurado em `MODELS`.

Modelos em uso (OBSERVADO: metadados `asset.extras` de cada `.glb` exportado pelo Sketchfab):

| Arquivo | Modelo | Autor | Licença | Tela (reel) |
|---|---|---|---|---|
| `playstation_5_dualsense.glb` | [Playstation 5 Dualsense](https://sketchfab.com/3d-models/playstation-5-dualsense-878c1f882808477ab81c2fe86d5a3936) | AHarmlessPotato | CC BY 4.0 | plano de cantos arredondados no touchpad (`screenPlane` com `radius`/`lift`, encaixado por raycast `-y`) |
| `xbox_controller.glb` | [Xbox Controller](https://sketchfab.com/3d-models/xbox-controller-32d17951703b4e05abed11a1c65f5909) | umkhero | CC BY 4.0 | — |
| `nintendo_switch.glb` | [Nintendo Switch](https://sketchfab.com/3d-models/nintendo-switch-b94e6a6a8c564fee81c2d794da6c5712) | gabrieljuan0322 | CC BY 4.0 | malhas `screen_19`, `screen001`, `cube_screen_glass` |
| `gameboy.glb` | [GAMEBOY](https://sketchfab.com/3d-models/gameboy-4a1da0cefa904c4eae895338bd6f3334) | grimmorf | CC BY 4.0 | plano fixo na profundidade do LCD, atrás do vidro (`screenPlane`) |

Calibração (rodada 5), verificada sobrepondo o contorno da máscara `data` a um bake sem o plano:
- Inclinação (`pitch`): Xbox −18° e DualSense −68° (o eixo do arquivo é invertido), de frente como o Switch (−14°).
- Game Boy: o material do arquivo é `BLEND` e o vidro da tela, quase transparente, projetava uma sombra sólida (o "quadro" preto deslocado sobre a tela). `alphaTest: 0.5` descarta o vidro na cor, na sombra e nos passes de dados.
- A máscara `data` agora é assada em meia resolução (512 px por quadro), com bordas da tela mais nítidas.
- O shader de runtime clareia o objeto com o reel só dentro da máscara; no original o efeito vale para o objeto inteiro, o que "fantasmava" o reel no corpo branco do Game Boy.

Os créditos CC BY aparecem no site, no rodapé de todas as páginas com `PageFooter`/`NextFooter` (`src/components/ModelCredits.tsx`, dados em `MODEL_CREDITS` de `src/data/site.ts`).

Passos: baixar cada modelo no Sketchfab (exige login) como GLB → salvar em `tools/baker/models/` com o nome configurado em `MODELS` (`tools/baker/models.js`) → `node tools/bake.mjs playstation switch xbox handheld` → `python tools/make-med.py`. O console do baker lista os nomes e caixas das malhas, para ajustar `screen`, `screenPlane`, `rotation` e `hide`.
