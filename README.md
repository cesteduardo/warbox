# Warbox TV — site

Site institucional e comercial da Warbox TV: páginas reais, HTML estático, zero dependências.

## Rodar

```bash
npm start        # gera dist/ e serve em http://localhost:4321
npm run build    # só gera dist/
```

Requer Node 18+. Nenhum `npm install` é necessário.

## Estrutura

```
src/
  layout.html          moldura comum (head, header, footer, dock)
  partials/            blocos reutilizáveis — usados com {{> nome}}
    header, footer, plans, pay, faq, help, cta, eps, team, fm, goat-typer, i-arrow
  pages/               uma página por arquivo
    index.html         → /
    planos.html        → /planos/
    recursos.html      → /recursos/
    canais.html        → /canais/          (Programas)
    como-funciona.html → /como-funciona/
    dispositivos.html  → /dispositivos/
    faq.html           → /faq/
    contato.html       → /contato/
    assinar.html       → /assinar/         (conversão — leva ao checkout do app)
    login.html         → /login/           (leva ao login do app)
    404.html           → /404.html
public/                copiado como está para dist/
  css/styles.css       folha única (tokens no topo)
  js/main.js           interações, sem bibliotecas
  assets/, fonts/
dist/                  saída pronta para publicar (gerada)
```

### Criar uma página nova

Crie `src/pages/nome.html` com front-matter e rode o build — ela sai em `/nome/`,
com header, footer e sitemap automáticos:

```html
---
title: Título — Warbox TV
description: Texto para buscadores
nav: nome
---
<section class="phero">…</section>
{{> cta}}
```

Para destacá-la no menu, adicione um link com `data-nav="nome"` em `src/partials/header.html`.

## Publicação

Publique o conteúdo de `dist/` em qualquer hospedagem estática (Netlify, Vercel,
Cloudflare Pages, S3…). Em serviços com build, use `node build.mjs` como comando
e `dist` como pasta de saída. O domínio canônico fica em `SITE_URL` no `build.mjs`.

## Notas

- A copy é a original do site; só a apresentação mudou.
- O chip "Ao vivo agora" é controlado por `IS_LIVE` em `public/js/main.js`
  (no app real deve vir de `/api/live/status`).
- `/assinar/?plano=chefia` (ou `pika`, `coco`) já abre com o plano escolhido.
- A lista de aparelhos de `/dispositivos/` (Smart TV, TV Box etc.) deve ser preenchida
  apenas com o que for confirmado — há um comentário no arquivo indicando onde.
