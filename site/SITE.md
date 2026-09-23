# O site (Starlight)

Use esta página para rodar, montar e publicar o site de documentação das brazilian-utils. O site
mora no api-validator. As páginas saem do contrato (`../contract`), das bibliotecas
(`../libs/*.json`, bloco `site`), dos arquivos de uso de cada biblioteca e dos resultados da
última execução do validador. Ninguém escreve aqui à mão o conteúdo de um utilitário. O
`plan.md` guarda a pesquisa que levou ao desenho (histórico).

## Rodar localmente

Requer **Node 22.12 ou mais novo** (exigência do Astro 7) e npm 10.9+.

```bash
npm install       # primeira vez: gera o package-lock.json
npm ci            # depois disso, instalação reproduzível
npm run dev       # busca os arquivos de uso, gera as páginas e sobe o Astro
npm run build     # mesmo fluxo, saída em dist/
npm run check:i18n
npm audit         # precisa sair limpo; o CI falha em qualquer severidade
npm run a11y      # depois do build: axe-core em cada tipo de página, tema claro e escuro
```

O `npm run a11y` precisa de `playwright` e `axe-core`, que não são dependências do site. Instale
os dois só para rodar: `npm i --no-save playwright axe-core && npx playwright install chromium`.
Ele falha quando alguma regra do WCAG 2.1 (A e AA) ou das boas práticas do axe quebra. Se o site
foi gerado com um caminho (`SITE_URL=https://…/api-validator`), passe `BASE_PATH=/api-validator`.

Sem rede? `USAGE_SOURCE=fixtures npm run dev` monta as abas só a partir de `fixtures/usage/`.
`USAGE_SOURCE=local` lê os checkouts em `../.repos/` (os que o validador usou), com guias e
demos. Com `GITHUB_TOKEN` no ambiente, o limite da API do GitHub sobe (opcional).

Para ver a situação por biblioteca (chips, páginas `/libs/<lib>/`, matriz de paridade, badges),
rode antes o validador na raiz do repositório:

```bash
npx tsx src/cli.ts check --tests   # output/<lib>.report.json
npx tsx src/cli.ts diff            # output/diff.json (opcional: divergências)
npx tsx src/cli.ts site-data       # site/.generated/status.json, public/badges/, public/cases/
```

Sem esses passos, o site compila do mesmo jeito, só que sem a situação.

## Dependências e segurança

O site tem só três dependências diretas, todas em versão exata (sem `^`). Nós as escolhemos em
2026-09-09, depois de conferir o GitHub Advisory Database e a proveniência no npm:

| Pacote | Versão | Proveniência | Advisories na versão |
| --- | --- | --- | --- |
| `astro` | 7.3.2 | SLSA (GitHub Actions do repo `withastro/astro`) | nenhuma. A 7.3.2 corrige o RCE via AVIF da 7.2.x |
| `@astrojs/starlight` | 0.42.0 | SLSA (GitHub Actions do repo `withastro/starlight`) | nenhuma |
| `sharp` | 0.35.4 | SLSA | nenhuma. Toda 0.34.x tem duas advisories high (libheif, libvips) |

Recomendamos um `.npmrc` na raiz com `ignore-scripts=true`, `save-exact=true`, `audit=true`,
`audit-level=low` e `fund=false`. Assim, nenhuma dependência executa código no `npm ci`. `sharp`
e `esbuild` funcionam assim porque trazem binários prontos em `optionalDependencies`. Por isso,
os scripts `dev` e `build` chamam `prepare:content` de forma explícita. Eles não usam hooks
`pre*`, porque o npm também pula esses hooks com `ignore-scripts`.

Os workflows usam actions fixadas por SHA de commit, com a tag no comentário. Para atualizar:

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
scripts/fetch-libs           clona cada lib no `usage.ref`, roda o `prepare`, lê arquivos de uso, página de
                             referência e guias, e copia os assets das demos para public/lib-assets/<lib>/
scripts/generate-pages       gera src/content/docs/[pt-br/]utils/<slug>.mdx, libs/<lib>.mdx e guides/<lib>/<guia>.mdx
src/lib/registry.mjs         único lugar que sabe ler tudo isso
src/lib/guides.mjs           parser dos guias (example → variant → file, demos, links); testado em ../test/site.test.ts
src/components/              UtilHeader, SpecBody, OpsIntro, OpStatus, OpNotes, Usage, Cases,
                             TryIt, References, LibStatus, ParityMatrix, LibCards, GuideHeader, LiveDemo, Head
src/integrations/            base-links: prefixa o base path nos links das páginas escritas à mão
src/content/docs/            páginas escritas à mão (home, primeiros passos, contribuindo, paridade), en na raiz e pt-br/
src/content/i18n/            strings da interface dos componentes
```

Uma página de utilitário tem estas partes, nesta ordem:

1. `UtilHeader`: resumo, situação por biblioteca, relacionados.
2. `SpecBody`: o spec.*.md, quando existe.
3. **Uso**: uma seção por função, com estes componentes:
   - a assinatura
   - `OpStatus`: um chip por biblioteca
   - a descrição do contrato
   - `OpNotes`: rede, depreciada
   - `Usage`: uma aba por biblioteca, sincronizadas no site todo
   - `TryIt`: roda a implementação de referência no navegador
   - `Cases`: os casos compartilhados com o resultado de cada biblioteca
4. **Fontes oficiais** (`References`).

Um guia tem estas partes, nesta ordem:

1. `GuideHeader`: de qual biblioteca é o guia e que funções do contrato ele usa.
2. O texto do guia.
3. Cada grupo de exemplos em abas (framework → variante → arquivo, sincronizadas no site), com
   a `LiveDemo` acima dos arquivos.

As páginas de utilitário listam os guias que chamam as suas funções.

Para adicionar um utilitário ao site, adicione o domínio ao contrato. Para adicionar uma
biblioteca, crie `../libs/<lib>.json` com o bloco `site`. Os títulos `##` dos arquivos de uso
são os ids das funções do contrato (`isValid`, `format`, …).

## Idiomas

O inglês fica na raiz (`/`) e o português em `/pt-br/`. Na primeira visita, a página em inglês
pode redirecionar para a mesma página em `/pt-br/`. Isso acontece quando o navegador prefere
português e não existe escolha salva. O redirecionamento grava a preferência
(`localStorage["bu:lang"]`). O seletor de idioma do Starlight também grava a escolha, e a
escolha sempre vence a detecção. A implementação fica em `src/components/Head.astro`.

Uma página ou um domínio sem tradução cai para o outro idioma com um aviso.

O `summary` e a `description` de uma função do contrato aceitam duas formas:

- uma string: só inglês
- um objeto bilíngue: `{ "en": ..., "pt-BR": ... }`

O validador usa sempre o texto em inglês. O site mostra o texto no idioma da página e, se ele
faltar, mostra o inglês.

`npm run check:i18n` (`scripts/check-i18n.mjs`) lista o que falta em cada idioma:

- o título e o resumo de cada domínio
- o `summary` e a `description` de cada função, nos dois idiomas (uma string conta só como
  inglês)
- o par `spec.en.md` e `spec.pt-BR.md`, quando um domínio tem spec longa
- a versão em `pt-br/` de cada página escrita à mão

Com `--strict` (`npm run check:i18n -- --strict`), o script falha no CI quando falta a versão de
um idioma.

## Deploy

Um pipeline só faz tudo: `.github/workflows/conformance.yml`. Ele roda o validador (check, diff,
issues), o `site-data` e o build do site. Ele publica no GitHub Pages quando
`vars.PUBLISH_SITE == 'true'`. Ele roda a cada merge em `main` (contrato, libs, site), uma vez
por dia, e quando uma biblioteca manda `repository_dispatch` com `event_type=lib-released` na
release. `SITE_URL` é a URL pública com o caminho (padrão
`https://<org>.github.io/api-validator`). O caminho vira o `base` do Astro. `site-check.yml`
roda em todo PR que toca `contract/`, `libs/` ou `site/`: `npm audit`, `check:i18n --strict`, o
build (com os arquivos de uso e os guias das bibliotecas) e a verificação de acessibilidade
(`npm run a11y`).

## Pendências conhecidas

- Ainda não trouxemos do repositório `docs` os PDFs de referência
  (`contract/<domínio>/references/*.pdf`). `References` já lista os que existirem.
- O `brand` não tem ícone para Erlang. As outras abas usam os ícones do Starlight.
- JavaScript entra com o que já tem. `docs/utilities.md` (en e pt-br) vira as abas de uso e as
  convenções da página da biblioteca. `docs/guides/` vira os guias com demo ao vivo (lidos de
  `main`, como no site atual da biblioteca). As outras bibliotecas ainda não têm `docs/usage/`,
  então o site usa `fixtures/usage/`. Para adotar, basta copiar a pasta.
- Guias e demos dependem da CDN (jsDelivr, esm.sh), como no site atual da biblioteca JavaScript.
