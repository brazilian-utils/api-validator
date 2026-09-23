# O site (Starlight)

O site de documentação das brazilian-utils, que mora no api-validator: as páginas saem do
contrato (`../contract`), das bibliotecas (`../libs/*.json`, bloco `site`), dos arquivos de uso
de cada biblioteca e dos resultados da última execução do validador. Nada de conteúdo de
utilitário é escrito aqui à mão. O `plan.md` guarda a pesquisa que levou ao desenho (histórico).

## Rodando localmente

Requer **Node 22.12 ou mais novo** (exigência do Astro 7) e npm 10.9+.

```bash
npm install       # primeira vez: gera o package-lock.json
npm ci            # depois disso, instalação reproduzível
npm run dev       # busca os arquivos de uso, gera as páginas e sobe o Astro
npm run build     # mesmo fluxo, saída em dist/
npm run check:i18n
npm audit         # precisa sair limpo; o CI falha em qualquer severidade
```

Sem rede? `USAGE_SOURCE=fixtures npm run dev` monta as abas só a partir de `fixtures/usage/`.
Com `GITHUB_TOKEN` no ambiente o limite da API do GitHub sobe (opcional).

Situação por biblioteca (chips, páginas `/libs/<lib>/`, matriz de paridade, badges): rode o
validador antes, na raiz do repositório:

```bash
npx tsx src/cli.ts check --tests   # output/<lib>.report.json
npx tsx src/cli.ts diff            # output/diff.json (opcional: divergências)
npx tsx src/cli.ts site-data       # site/.generated/status.json, public/badges/, public/cases/
```

Sem isso o site compila igual, só sem situação.

## Dependências e segurança

Só três dependências diretas, todas em versão exata (sem `^`), escolhidas em 2026-09-09
depois de conferir o GitHub Advisory Database e a proveniência no npm:

| Pacote | Versão | Proveniência | Advisories na versão |
| --- | --- | --- | --- |
| `astro` | 7.3.2 | SLSA (GitHub Actions do repo `withastro/astro`) | nenhuma; a 7.3.2 corrige o RCE via AVIF da 7.2.x |
| `@astrojs/starlight` | 0.42.0 | SLSA (GitHub Actions do repo `withastro/starlight`) | nenhuma |
| `sharp` | 0.35.4 | SLSA | nenhuma; toda 0.34.x tem duas advisories high (libheif, libvips) |

Recomendado um `.npmrc` na raiz com `ignore-scripts=true`, `save-exact=true`, `audit=true`,
`audit-level=low` e `fund=false`: nenhuma dependência executa código no `npm ci`. `sharp` e
`esbuild` funcionam assim porque trazem binários prontos em `optionalDependencies`. Por isso os
scripts `dev` e `build` chamam `prepare:content` explicitamente em vez de usar hooks `pre*`, que
o npm também pula com `ignore-scripts`.

Os workflows usam actions pinadas por SHA de commit, com a tag no comentário. Para atualizar:

```bash
gh api repos/actions/checkout/commits/<tag> --jq .sha
```

## Como o site é montado

```
../contract/<domínio>.json   título, resumo, categoria, funções, assinaturas e casos (a spec)
../contract/<domínio>/       spec.en.md, spec.pt-BR.md, references.md (texto longo, opcional)
../contract/_categories.json grupos da barra lateral
../libs/<lib>.json           bloco "site": rótulo, ícone, instalação, registry, onde ficam os arquivos de uso
.generated/status.json       escrito por `api-validator site-data`: situação por lib e função
fixtures/usage/<lib>/        arquivos de uso até cada lib ter docs/usage/ no próprio repo
                             (gerados por `api-validator usage --scaffold` a partir dos casos que a lib passa)
scripts/fetch-usage          baixa <repo>/docs/usage/<util>.md da última release de cada lib e quebra por operação
scripts/generate-pages       gera src/content/docs/[pt-br/]utils/<slug>.mdx e libs/<lib>.mdx
src/lib/registry.mjs         único lugar que sabe ler tudo isso
src/components/              UtilHeader, SpecBody, OpsIntro, OpStatus, OpNotes, Usage, Cases,
                             References, LibStatus, ParityMatrix, LibCards, Head
src/integrations/            base-links: prefixa o base path nos links das páginas escritas à mão
src/content/docs/            páginas escritas à mão (home, primeiros passos, contribuindo, paridade), en na raiz e pt-br/
src/content/i18n/            strings da interface dos componentes
```

Uma página de utilitário é: `UtilHeader` (resumo, situação por lib, relacionados) → `SpecBody`
(o spec.*.md, quando existe) → **Uso**, uma seção por operação: assinatura, `OpStatus` (chip por
lib), descrição do contrato, `OpNotes` (rede, depreciada), `Usage` (uma aba por lib,
sincronizadas no site todo) e `Cases` (os casos compartilhados com o resultado de cada lib) →
**Fontes oficiais** (`References`).

Adicionar um utilitário ao site = adicionar o domínio ao contrato. Adicionar uma biblioteca =
`../libs/<lib>.json` com o bloco `site`. Os títulos `##` dos arquivos de uso são os ids de operação
do contrato (`isValid`, `format`, …).

## Idiomas

Inglês na raiz (`/`), português em `/pt-br/`. Na primeira visita, se o navegador prefere
português e não existe escolha salva, a página em inglês redireciona para a mesma página em
`/pt-br/` e grava a preferência (`localStorage["bu:lang"]`). O seletor de idioma do Starlight
também grava a escolha, e a escolha sempre vence a detecção. Implementado em
`src/components/Head.astro`.

Página ou domínio sem tradução cai para o outro idioma com um aviso. `npm run check:i18n -- --strict`
falha no CI quando falta a versão de um idioma.

## Deploy

Um pipeline só: `.github/workflows/conformance.yml` roda o validador (check, diff, issues),
`site-data`, e o build do site, e publica no GitHub Pages quando `vars.PUBLISH_SITE == 'true'`.
Roda a cada merge em `main` (contrato, libs, site), uma vez por dia, e quando uma biblioteca
manda `repository_dispatch` com `event_type=lib-released` na release. `SITE_URL` é a URL
pública com o caminho (padrão `https://<org>.github.io/api-validator`); o caminho vira o `base`
do Astro. `site-check.yml` roda `npm audit`, `check:i18n --strict` e o build (com os fixtures) em
todo PR que toca `contract/`, `libs/` ou `site/`.

## Pendências conhecidas

- Os PDFs de referência (`contract/<domínio>/references/*.pdf`) ainda não foram trazidos do
  repositório `docs`; `References` já lista os que existirem.
- O `brand` não tem ícone para Erlang; as outras abas usam os ícones do Starlight.
- As bibliotecas ainda não têm `docs/usage/`: o site usa `fixtures/usage/`. Adotar é copiar a pasta.
