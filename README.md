# Retro Gamers — site

Reconstrução do layout/comportamento de buttermax.net com a identidade Retro Gamers (azul smurf, logo invader).

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npx playwright test
```

- 3D: `node tools/bake.mjs` (precisa de um Chrome com `--remote-debugging-port=9222`) e `python tools/make-med.py`. Detalhes em `docs/3d-pipeline.md`.
- Documentação: `docs/` (auditoria, design system, comportamentos, validação visual, status).
- `_research/` (ignorado no git) guarda as capturas e scripts de comparação com a referência.
