# O site (Starlight)

Este repositório é, ao mesmo tempo, o repositório de specs canônicas e o site
que as renderiza em [brazilian-utils.com.br](https://brazilian-utils.com.br).
Este arquivo explica a parte do site. O `README.md` explica as specs.
O plano completo, com a pesquisa que levou a estas decisões, está em `plan.md`.

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

## Dependências e segurança

Só quatro dependências diretas, todas em versão exata (sem `^`), escolhidas em 2026-09-09
depois de conferir o GitHub Advisory Database e a proveniência no npm:

| Pacote | Versão | Proveniência | Advisories na versão |
| --- | --- | --- | --- |
| `astro` | 7.3.2 | SLSA (GitHub Actions do repo `withastro/astro`) | nenhuma; a 7.3.2 corrige o RCE via AVIF da 7.2.x |
| `@astrojs/starlight` | 0.42.0 | SLSA (GitHub Actions do repo `withastro/starlight`) | nenhuma |
| `sharp` | 0.35.4 | SLSA | nenhuma; toda 0.34.x tem duas advisories high (libheif, libvips) |
| `js-yaml` | 4.3.2 | sem atestado (publicado pelo mantenedor) | nenhuma; já está na árvore do Astro e do Starlight, então não adiciona pacote |

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
specs/<id>/            regra (spec.md, spec_en.md), meta.yaml, test-cases.json, references/
libs.yaml              as bibliotecas e de onde puxar o uso de cada uma (hoje: JavaScript e Python)
fixtures/usage/        cópias temporárias do uso, até cada lib ter docs/usage/ no próprio repo
scripts/fetch-usage    baixa <repo>/docs/usage/<util>.md de cada lib e quebra por operação em .cache/usage/
scripts/generate-pages gera src/content/docs/[pt-br/]utils/<id>.mdx a partir de cada meta.yaml
src/components/        UtilHeader, SpecBody, References, Usage, TestCases, ParityMatrix, LibCards, Head
src/content/docs/      páginas escritas à mão (home, primeiros passos, contribuindo, paridade), en na raiz e pt-br/
src/content/i18n/      strings da interface dos componentes
src/styles/brand.css   paleta e fonte do repositório brand
```

Uma página de utilitário é: `UtilHeader` (resumo + badges por lib) → `SpecBody` (o spec.md
renderizado como está) → `References` (links de references.md) → `Usage` (uma aba por lib em cada
operação, JavaScript por padrão, sincronizadas no site todo) → `TestCases` (tabela do
test-cases.json).

Adicionar um utilitário ao site = criar `specs/<id>/` com `meta.yaml`. Adicionar uma linguagem =
uma entrada em `libs.yaml` (Go, Ruby, Rust, .NET e Erlang entram assim quando for a hora).

## Idiomas

Inglês na raiz (`/`), português em `/pt-br/`. Na primeira visita, se o navegador prefere
português e não existe escolha salva, a página em inglês redireciona para a mesma página em
`/pt-br/` e grava a preferência (`localStorage["bu:lang"]`). O seletor de idioma do Starlight
também grava a escolha, e a escolha sempre vence a detecção. Implementado em
`src/components/Head.astro`.

Página ou spec sem tradução cai para o outro idioma com um aviso. `npm run check:i18n -- --strict`
falha no CI quando falta a versão de um idioma.

## Deploy

`.github/workflows/site-deploy.yml` publica no GitHub Pages a cada push em `main`, uma vez por
dia, e quando uma biblioteca envia `repository_dispatch` com `event_type=lib-released` na
release (ver a página "Arquivos de uso" do site). `site-check.yml` roda `npm audit`,
`check:i18n --strict` e o build em todo PR.

Enquanto o domínio ainda aponta para o Pages do repositório `javascript`, publique em
`brazilian-utils.github.io/docs` definindo `SITE_URL` e `BASE_PATH` no workflow (já está
comentado lá). Ao mover o CNAME para este repositório, remova as duas variáveis.

## Pendências conhecidas

- `lastUpdated` está desligado no `astro.config.mjs` porque a pasta ainda não é um repositório
  git; ligar quando estiver no repo `docs`.
- Os PDFs de `specs/*/references/` não foram copiados para esta pasta; ao mesclar no repositório
  `docs` eles já existem lá. Os nomes com espaços e acentos funcionam, mas ficam feios na URL.
- `fixtures/usage/` só tem JavaScript e Python, que são também as únicas libs em `libs.yaml`.
- O `brand` não tem ícone para Go, Ruby, Rust, .NET e Erlang; os ícones das abas vêm do Starlight.
- `spec.md` e `test-cases.json` do CPF discordam sobre entrada formatada. Não afeta o site,
  afeta os adapters.
