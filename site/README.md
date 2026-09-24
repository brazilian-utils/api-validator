# O site (Next.js + Fumadocs)

Use esta página para rodar, montar e publicar o site de documentação do Brazilian Utils. O site
mora no repositório docs. As páginas saem do contrato (`../contract`), das bibliotecas
(`../libs/*.json`, bloco `site`), dos arquivos de uso de cada biblioteca e dos resultados da
última execução do validador. Ninguém escreve aqui à mão o conteúdo de um utilitário. O
`DESIGN.md` explica o visual.

O site é um app [Next.js](https://nextjs.org) com [Fumadocs](https://fumadocs.dev), exportado
como HTML estático (`output: 'export'`). Não há servidor: o GitHub Pages serve a pasta `out/`.

## Rodar localmente

Requer **Node 22.12 ou mais novo** e npm 10.9+.

```bash
npm ci            # instalação reproduzível
npm run dev       # busca os arquivos de uso e sobe o Next em modo dev
npm run build     # mesmo fluxo, saída estática em out/
npm run preview   # serve out/ como o GitHub Pages serve (base path incluído)
npm run lint      # ESLint (Next.js, React hooks, jsx-a11y)
npm run typecheck # TypeScript
npm run check:i18n
npm audit         # precisa sair limpo; o CI falha em qualquer severidade
npm run a11y      # depois do build: axe-core em cada tipo de página
npm run design    # depois do build: detector do Impeccable (padrões de interface gerada por IA)
```

O `npm run a11y` precisa de `playwright` e `axe-core`, que não são dependências do site. Instale
os dois só para rodar: `npm i --no-save playwright axe-core && npx playwright install chromium`.
Ele testa cada tipo de página no tema claro e no escuro (desktop) e no tema claro num celular,
com todos os acordeões abertos. Ele falha quando alguma regra do WCAG 2.1 (A e AA) ou das boas
práticas do axe quebra.

Sem rede? `USAGE_SOURCE=fixtures npm run dev` monta as abas só a partir de `fixtures/usage/`.
`USAGE_SOURCE=local` lê os checkouts em `../.repos/` (os que o validador usou), com guias e
demos. Com `GITHUB_TOKEN` no ambiente, o limite da API do GitHub sobe (opcional).

Para ver a situação por biblioteca (marcas, páginas `/libs/<lib>/`, matriz de paridade, badges),
rode antes o validador na raiz do repositório:

```bash
npx tsx src/cli.ts check --tests   # output/<lib>.report.json
npx tsx src/cli.ts diff            # output/diff.json (opcional: divergências)
npx tsx src/cli.ts site-data       # site/.generated/status.json, public/badges/, public/cases/
```

Sem esses passos, o build baixa a situação da última execução publicada (`/status.json` e os
badges do site no ar, ver `scripts/fetch-site-data.mjs`). Sem rede, o site compila do mesmo
jeito, só que sem a situação.

## Dependências e segurança

Todas as dependências estão em versão exata (sem `^`). As principais:

| Pacote | Para quê |
| --- | --- |
| `next`, `react`, `react-dom` | o app e a exportação estática |
| `fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx` | layout, busca, componentes (abas, acordeões, tabelas de tipos), MDX |
| `tailwindcss`, `@tailwindcss/postcss` | estilos (o tema do Fumadocs é Tailwind) |
| `shiki`, `unified`, `remark-*`, `hast-util-to-jsx-runtime` | Markdown do contrato e das bibliotecas, com destaque de código |
| `geist`, `simple-icons`, `lucide-react` | fontes e ícones, sem CDN |
| `@brazilian-utils/brazilian-utils` | a biblioteca de referência que roda no navegador (campo da home, caixa "Teste com JavaScript") |

`npm audit --audit-level=low` roda no CI e precisa sair limpo.

O `site-check.yml` usa actions fixadas por SHA de commit, com a tag no comentário. Para atualizar:

```bash
gh api repos/actions/checkout/commits/<tag> --jq .sha
```

## Como o site é montado

```
../contract/<domínio>/       uma pasta por domínio, em kebab-case (cpf/, license-plate/):
                             contract.json (título, resumo, categoria, funções, assinaturas e
                             casos), spec.en.md, spec.pt-br.md, references.md e, opcional,
                             references/*.pdf
../contract/_categories.json grupos do menu
../libs/<lib>.json           bloco "site": rótulo, instalação, registry, onde ficam os arquivos de uso
.generated/status.json       escrito por `docs site-data`: situação por lib e função
fixtures/usage/<lib>/        arquivos de uso até cada lib ter docs/usage/ no próprio repo
scripts/fetch-libs.mjs       clona cada lib no `usage.ref`, roda o `prepare`, lê arquivos de uso, página
                             de referência e guias, e copia os assets das demos para public/lib-assets/<lib>/
content/docs/                páginas escritas à mão: <página>.mdx em inglês, <página>.pt-br.mdx em português;
                             o meta.json de cada pasta dá a ordem no menu (uma página nova só precisa do .mdx)
src/content/i18n/            strings da interface (en.json, pt-br.json)
src/lib/registry.mjs         único lugar que sabe ler tudo isso (também usado pelo validador e pelos testes)
src/lib/guides.mjs           parser dos guias (example → variant → file, demos, links); testado em ../test/site.test.ts
src/lib/tree.tsx             o menu: cinco seções (Utilitários, Bibliotecas, Guias, Como contribuir, Sobre)
src/lib/meta.ts              SEO: título, descrição, canonical, hreflang, Open Graph
src/lib/search-index.ts      o que a busca encontra (inclusive o nome de cada função em cada linguagem)
src/components/pages/        home, utilitário, biblioteca, paridade, guia, página MDX
src/app/(en)/, (pt)/pt-br/   as rotas, uma árvore por idioma (cada uma com seu <html lang>)
```

Nenhuma página de utilitário, biblioteca ou guia existe como arquivo: as rotas `utils/[id]`,
`libs/[id]` e `guides/[lib]/[slug]` geram uma página por item dos dados no build. Adicionar um
domínio ao contrato adiciona a página; adicionar `../libs/<lib>.json` adiciona a aba e a página
da biblioteca.

Uma página de utilitário tem estas partes, nesta ordem:

1. Resumo e, para cada biblioteca, quantas funções ela implementa (e desde qual versão).
2. Uma seção por função:
   - a assinatura, destacada como código
   - a situação em cada biblioteca
   - a descrição do contrato, e as decisões pendentes como aviso
   - a tabela de parâmetros
   - uma aba por biblioteca, sincronizadas no site todo (a escolha fica salva)
   - a caixa "Teste com JavaScript": roda a biblioteca JavaScript no navegador
   - os casos compartilhados, com o resultado em cada biblioteca
3. Guias que usam o utilitário.
4. A especificação longa (`spec.*.md`), quando existe.
5. Fontes oficiais e cópias locais dos documentos.

Os títulos `##` dos arquivos de uso são os ids das funções do contrato (`isValid`, `format`, …).

## Idiomas

O inglês fica na raiz (`/`) e o português em `/pt-br/`. Na primeira visita, a página em inglês
redireciona para a mesma página em `/pt-br/` quando o navegador prefere português e não existe
escolha salva. O redirecionamento grava a preferência (`localStorage["bu:lang"]`). O seletor de
idioma do cabeçalho também grava a escolha, e a escolha sempre vence a detecção. A implementação
fica em `src/components/html.tsx` e `src/components/provider.tsx`.

Uma especificação ou um guia sem tradução cai para o outro idioma com um aviso.

O `summary` e a `description` de uma função do contrato aceitam duas formas:

- uma string: só inglês
- um objeto bilíngue: `{ "en": ..., "pt-BR": ... }`

O validador usa sempre o texto em inglês. O site mostra o texto no idioma da página e, se ele
faltar, mostra o inglês.

`npm run check:i18n` (`scripts/check-i18n.mjs`) lista o que falta em cada idioma:

- o título e o resumo de cada domínio
- o `summary` e a `description` de cada função, nos dois idiomas (uma string conta só como
  inglês)
- o par `spec.en.md` e `spec.pt-br.md` de cada domínio
- o `<página>.pt-br.mdx` de cada página escrita à mão
- cada string de interface de `en.json` em `pt-br.json`

Com `--strict`, o script falha no CI quando falta a versão de um idioma.

## SEO, desempenho e acessibilidade

- Cada página tem título, descrição, URL canônica, `hreflang` para o outro idioma, Open Graph e
  Twitter card (`public/og.png`). A home tem dados estruturados (JSON-LD: site, organização,
  uma `SoftwareSourceCode` por biblioteca). O build gera `sitemap.xml` (com os pares de idioma)
  e `robots.txt`.
- A busca roda no navegador sobre um índice gerado no build (`/api/search`). O motor e o índice
  só carregam quando alguém abre a busca.
- Os links não fazem prefetch: num host estático, cada prefetch é uma requisição, e há páginas
  com centenas de links.
- A biblioteca JavaScript (para a caixa "Teste com JavaScript") só carrega quando a caixa abre. O campo da home
  carrega só as funções que usa (`format*`, `parse*`, `isValid*`, `generate*` dos documentos da amostra).
- Contraste AA em todo texto, nos dois temas, inclusive nos blocos de código (temas de alto
  contraste do Shiki). `src/components/a11y.client.tsx` completa a marcação do Fumadocs onde o
  axe pede (nomes das regiões de código, sumário como navegação, rolagem por teclado).

## Deploy

Um pipeline só faz tudo: `.github/workflows/conformance.yml`. Ele roda o validador (check, diff,
issues), o `site-data` e o build do site. Ele publica `out/` no GitHub Pages quando
`vars.PUBLISH_SITE == 'true'`. Ele roda a cada merge em `main` (contrato, libs, site), uma vez
por dia, e quando uma biblioteca manda `repository_dispatch` com `event_type=lib-released` na
release. `SITE_URL` é a URL pública com o caminho (padrão
`https://<org>.github.io/docs`); o caminho vira o `basePath` do Next. `site-check.yml`
roda em todo PR que toca `contract/`, `libs/` ou `site/`: `npm audit`, `check:i18n --strict`,
`lint` sem avisos, `typecheck`, o build (com os arquivos de uso e os guias das bibliotecas), a
verificação de acessibilidade (`npm run a11y`) e a de design (`npm run design`).

## Nomes de arquivo

Todo arquivo e toda pasta que criamos usa kebab-case: `license-plate/`, `spec.pt-br.md`,
`getting-started.pt-br.mdx`, `pt-br.json`. Os ids dentro do JSON continuam em camelCase
(`licensePlate.isValid`), porque são identificadores. Ficam de fora só os nomes que uma
ferramenta ou uma convenção fixa: `README.md`, `DESIGN.md`, `LICENSE`, `CONTRIBUTING.md`,
`Cargo.toml`, os arquivos que começam com `_` (ignorados pelo validador) e as fixtures escritas
na convenção de cada linguagem.

## Deploy de revisão (Vercel)

Cada push e cada PR que mexe no site, no contrato, nas libs ou no schema ganha um deploy de
revisão na Vercel, com o link no PR. A configuração é o `vercel.json` na raiz do repositório (o
projeto da Vercel usa a raiz como Root Directory): instala e monta `site/` e publica `site/out/`.

Na Vercel o site fica na raiz do domínio (sem `basePath`). Nenhum deploy da Vercel entra em
buscador, em três camadas: o header `X-Robots-Tag: noindex, nofollow, noarchive` em toda resposta
(`vercel.json`), a meta `robots` `noindex, nofollow` em toda página e um `robots.txt` sem sitemap
(ele deixa o robô entrar, porque só assim ele lê o `noindex`). As URLs canônicas apontam para
`SITE_URL`. Para o dia em que a Vercel servir o site oficial: `SITE_INDEXABLE=true` tira a meta, e
o header sai do `vercel.json`. A Vercel não roda
o validador (precisaria de todas as linguagens), então o build baixa a situação da última execução
publicada. O `ignoreCommand` pula o build quando nada que o site usa mudou desde o último deploy. Não
precisa de variável de ambiente. As opcionais são `SITE_URL`, `SITE_DATA_URL` e `GITHUB_TOKEN`
(sem token, a versão de cada lib sai da tag mais nova, lida com `git ls-remote`). `SITE_DATA=skip`
monta sem a situação. O check de PR (`site-check.yml`) também baixa a situação publicada.

## Pendências conhecidas

- Ainda não trouxemos do repositório `docs` os PDFs de referência
  (`contract/<domínio>/references/*.pdf`). A página já lista os que existirem.
- JavaScript entra com o que já tem. `docs/utilities.md` (en e pt-br) vira as abas de uso e as
  convenções da página da biblioteca. `docs/guides/` vira os guias com demo ao vivo (lidos de
  `main`, como no site atual da biblioteca). As outras bibliotecas ainda não têm `docs/usage/`,
  então o site usa `fixtures/usage/`. Para adotar, basta copiar a pasta.
- Guias e demos dependem da CDN (jsDelivr, esm.sh), como no site atual da biblioteca JavaScript.
