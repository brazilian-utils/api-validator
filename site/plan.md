# Brazilian Utils · plano da documentação unificada

> **Histórico.** Este é o plano original, de quando as specs moravam no repositório `docs`
> (`specs/<util>/meta.yaml`, `test-cases.json`, `libs.yaml`). O desenho mudou: a spec agora é o
> contrato do api-validator (`contract/<domínio>.json`), as bibliotecas estão em `libs/*.json`
> e os casos de teste são os do contrato. Como o site funciona hoje: `SITE.md`.

Data: 2026-09-09. Pesquisa feita ao vivo nos repos da org `brazilian-utils`, no site atual e nas docs dos frameworks. Links das fontes no fim.

---

## 1. Resumo executivo

**A org já tem a base pronta e não está usando.** O repo `brazilian-utils/docs` já é um repositório de **especificações canônicas** (`specs/<util>/spec.md` + `spec_en.md` + `test-cases.json` + PDFs oficiais em `references/`). O que falta é o **site** que renderiza essas specs e, para cada utilitário, mostra como usar em cada linguagem.

Princípio de separação:

- **Repo `docs`** = só o que é comum a todas as libs: o que é o utilitário, a regra, o documento oficial, os casos de teste, os dois idiomas. Nada de código de lib aqui.
- **Cada repo de lib** = como usar aquele utilitário naquela linguagem, num arquivo por utilitário, em formato combinado. O site **puxa esses arquivos no build** e monta as abas.

Recomendação em uma frase: **transformar o repo `docs` no site oficial, gerado com Starlight (Astro), onde cada página de utilitário é a spec (regra + documento oficial) seguida de abas de uso por linguagem com JavaScript como padrão, cujo conteúdo vem de `docs/usage/<util>.md` dentro de cada repo de lib, em pt-BR e en com detecção pelo navegador.**

Decisões principais:

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde mora o site | Repo `brazilian-utils/docs` (já existe, CC BY 4.0, CODEOWNERS, workflows) | Specs são a fonte de verdade; o site é a renderização delas |
| Onde mora o "como usa" | `docs/usage/<util>.md` em cada repo de lib | Quem muda a API muda a doc no mesmo PR; maintainer da lib é dono do seu conteúdo |
| Como o site pega | Script de build lê um `libs.yaml` e baixa os arquivos via API do GitHub; libs disparam rebuild ao publicar release | Sem submodule, sem clone, sem copiar conteúdo |
| Framework | **Starlight (Astro)**. Plano B: Docusaurus | i18n nativo com fallback visível, abas com `syncKey` persistente, busca por idioma sem serviço externo, importa Markdown como componente |
| Unidade da doc | **Uma página por utilitário** (CPF, CNPJ, CEP…), organizada pelas **operações** da spec (validar, formatar, remover símbolos, gerar) | Já é como as specs estão escritas; nomes de função divergem entre libs, operações não |
| Uso | Uma aba por linguagem em cada operação, **JS como aba padrão**; a aba só mostra como aquela lib faz | A regra é uma (a spec); a aba é só uso |
| Paridade | Derivada dos arquivos de uso: existe `usage/cpf.md` na lib e tem a seção `## format`, então a lib formata CPF | Zero registro manual |
| Idiomas | `en` na raiz `/`, `pt-br` em `/pt-br/`; detecção via `navigator.languages` só na primeira visita; escolha manual salva e vence | Site estático não vê `Accept-Language`; Astro só detecta em SSR |
| Domínio | `brazilian-utils.com.br` migra do Pages do repo `javascript` para o repo `docs` | Hoje o domínio está preso à lib JS |
| Versionamento | Não versionar o site; o uso vem da última release de cada lib | 7 libs com ritmos diferentes viram matriz impossível |

---

## 2. O que existe hoje (verificado)

### 2.1 A org

13 repositórios. Libs ativas, todas com README bilíngue em formatos diferentes:

| Repo | Linguagem | Stars | Pacote | Doc hoje |
|---|---|---|---|---|
| `javascript` | TypeScript | 1669 | `@brazilian-utils/brazilian-utils` 2.3.0 | Site Docsify em brazilian-utils.com.br |
| `python` | Python | 522 | `brutils` 2.5.0 (Poetry) | README.md + README_EN.md monolíticos |
| `dotnet` | F#/C# | 25 | `BrazilianUtils` (NuGet) | README + README_EN |
| `go` | Go | 12 | `github.com/brazilian-utils/go` | README único com PT e EN na mesma página |
| `ruby` | Ruby | 10 | gem `br-utils` | README único PT/EN + pasta `examples/` |
| `erlang` | Erlang | 8 | `brutils` (Hex) | README + README_EN no padrão do Python |
| `rust` | Rust | 7 | crate `brazilian_utils` | README PT/EN + docs.rs |

Infra da org: `docs` (specs), `brand` (logos, paleta, fonte Samba), `.github` (perfil). Mantida pela Cumbuca Dev. Times existentes na org: só `python-core-team`, `python-maintainers`, `python-writers`.

### 2.2 JavaScript (lib principal)

- Uma pasta por função em `src/` (`is-valid-cpf/`, `format-cpf/`, `parse-cpf/`, `generate-cpf/`…), 70+ utilitários, JSDoc com `@example` em cada função. Tooling Vite+, Vitest, pnpm, release-it.
- Doc: **Docsify** servido pelo GitHub Pages do próprio repo (`main:/docs`, CNAME `brazilian-utils.com.br`, build "legacy"). Já tem `/pt-br/` com navbar EN/PT, sem detecção automática.
- Conteúdo: um único `utilities.md` com todas as funções em lista plana, um exemplo por função, sem descrição da regra nem fonte oficial. Issue #240 (2021) pedia agrupar por categoria; fechada sem resolver.
- Detalhes que quebram: o `index.html` do Docsify carrega o README via `raw.githubusercontent.com/brazilian-utils/brazilian-utils/main/README.md` (nome antigo do repo) e aponta `repo:` para o nome antigo. Docsify renderiza Markdown no cliente: sem HTML estático, sem SEO real, rotas com `#/`, sem fallback de idioma, sem abas sincronizadas.

### 2.3 Python

- Módulos por domínio (`brutils/cpf.py`, `cnpj.py`, `cep.py`, `phone.py`, `ibge/`, `legal_nature.py`…), funções expostas flat (`from brutils import is_valid_cpf`). Docstrings Google-style com `Example:` em doctest.
- Doc: README.md (PT) + README_EN.md, ~60 funções documentadas uma a uma. **Issue #470** descreve o problema com clareza: conflitos de merge constantes porque todo PR de feature edita os mesmos dois arquivos, e propõe dividir a doc em um arquivo por utilitário. É exatamente o que a convenção `docs/usage/<util>.md` faz.
- Governança madura: CONTRIBUTING de 14 passos, CODEOWNERS, CORE_TEAM, MAINTAINING, bot "bora!" para atribuir issue.

### 2.4 O repo `docs` (specs)

Criado out/2025, specs adicionadas jul–ago/2026 (CPF, CNPJ, CEP, placa; phone em aberto na #16). Estrutura de cada spec:

```
specs/cpf/
├── spec.md          # pt-BR: resumo, operações, regras de validação, algoritmo, regex, exemplos
├── spec_en.md
├── test-cases.json  # casos por operação: { "in": ..., "out": ... }
└── references/      # PDFs oficiais (IN RFB 2.172/2024, Lei 14.534/2023…) + references.md
adapters/runJavascriptTests.js   # vazio (placeholder)
adapters/run_python_tests.py     # vazio (placeholder)
```

O `spec.md` já é, literalmente, a seção "descrição + lógica + documento do governo" que você pediu. CODEOWNERS aponta para os times Python.

### 2.5 O que as libs fazem de diferente hoje

Isso **não vira texto na doc**. A doc mostra a regra (spec) e o uso (aba de cada lib). Fica registrado só para saber o que o site vai expor:

- **Nomes.** JS v2 usa `isValidCpf/formatCpf/parseCpf/generateCpf` (`parse` = remover símbolos). Python `is_valid_cpf/remove_symbols_cpf`. Go `cpf.IsValid`. Ruby `BrazilianUtils::CPFUtils.is_valid`. Rust `cpf::is_valid`. .NET `Cpf.IsValid`. Erlang `brutils:is_valid_cpf`. Organizar a página por operação absorve isso: cada aba mostra o nome daquela lib.
- **Cobertura.** Só JS tem inscrição estadual, conta bancária, cidades/estados, `getBoletoInfo`. Só Python tem passaporte, natureza jurídica, extenso, IBGE, feriados. Ruby e Rust já têm boleto e extenso. A matriz de paridade vira a lista de "ajude a portar".
- **Spec × test-cases.** A spec de CPF diz que `111.444.777-35` é inválido ("aceita apenas sem formatação"), mas o `test-cases.json` da mesma spec diz `true`. Os dois arquivos precisam concordar; é conteúdo do repo `docs`, então entra no roadmap.

---

## 3. Proposta

### 3.1 Anatomia de uma página de utilitário

URL: `/utils/cpf/` (en) e `/pt-br/utils/cpf/`. Sidebar agrupada por categoria (Documentos, Empresas, Endereço, Financeiro, Telefonia, Veículos, Texto e datas), resolvendo a issue #240 do JS.

1. **Cabeçalho**: nome, categoria, resumo de uma linha, badges por linguagem (implementado / parcial / não implementado). Vem de `meta.yaml` + presença dos arquivos de uso.
2. **O que é**: o "Resumo" da spec. Contexto para quem não é brasileiro.
3. **Regras e algoritmo**: seções "Regras de validação", "Algoritmo detalhado", "Regex" da spec, importadas direto do `spec.md`.
4. **Fonte oficial**: lista de `references/references.md` com link, PDF no repo e data de acesso.
5. **Uso, por operação**: para cada operação da spec (Validar, Formatar, Remover símbolos, Gerar, e as extras como Buscar endereço), um bloco de abas por linguagem, **JavaScript como aba padrão**, na ordem JS, Python, Go, Ruby, Rust, .NET, Erlang. O conteúdo de cada aba é a seção correspondente do `docs/usage/cpf.md` **do repo daquela lib**. A seleção de linguagem vale para o site inteiro (`syncKey`). Linguagem sem o arquivo ou sem a seção mostra "ainda não disponível, veja como portar".
6. **Casos de teste**: tabela renderizada de `test-cases.json`. É documentação de graça e deixa a spec auditável.
7. **Ver também**.

Não existe seção "diferenças entre implementações". A regra é uma só e está na spec. A aba da linguagem nunca explica desvio; ela mostra o uso.

A página MDX fica pequena, porque tudo é importado ou buscado:

```mdx
---
title: CPF
description: Cadastro de Pessoas Físicas
---
import Spec from '../../../../specs/cpf/spec_en.md';
import { UtilHeader, Usage, TestCases, References } from '@components';

<UtilHeader util="cpf" />
<Spec />
<References util="cpf" />
<Usage util="cpf" default="javascript" />
<TestCases util="cpf" />
```

Astro importa Markdown como componente, então `spec.md` continua sendo o único lugar onde a regra é escrita. A versão `pt-br` importa `spec.md`, a `en` importa `spec_en.md`. O `<Usage>` lê os arquivos baixados das libs.

Como fica o bloco "Validar" na página de CPF:

```
[ JavaScript ] [ Python ] [ Go ] [ Ruby ] [ Rust ] [ .NET ] [ Erlang ]
┌──────────────────────────────────────────────────────────────────┐
│ import { isValidCpf } from '@brazilian-utils/brazilian-utils';   │
│                                                                  │
│ isValidCpf('11144477735');  // true                              │
│ isValidCpf('00000000000');  // false                             │
└──────────────────────────────────────────────────────────────────┘
```

Trocar para Python aqui troca em todas as operações desta página e em todas as outras páginas do site.

### 3.2 O contrato: `docs/usage/<util>.md` em cada lib

Cada repo de lib passa a ter uma pasta `docs/usage/` com **um arquivo Markdown por utilitário**, com nome igual ao id da spec (`cpf.md`, `cnpj.md`, `cep.md`, `license-plate.md`…). Formato fixo, propositalmente simples:

```markdown
---
since: 2.0.0            # opcional: versão da lib em que o utilitário entrou
---

## validate

```js
import { isValidCpf } from '@brazilian-utils/brazilian-utils';

isValidCpf('11144477735'); // true
isValidCpf('00000000000'); // false
```

## format

```js
import { formatCpf } from '@brazilian-utils/brazilian-utils';

formatCpf('11144477735'); // '111.444.777-35'
formatCpf('111444777', { pad: true }); // '000.111.444-77'
```

## remove-symbols

```js
import { parseCpf } from '@brazilian-utils/brazilian-utils';

parseCpf('111.444.777-35'); // '11144477735'
```

## generate

```js
import { generateCpf } from '@brazilian-utils/brazilian-utils';

generateCpf(); // CPF válido aleatório
```
```

Regras do contrato:

- Os `##` são os **ids de operação** definidos em `specs/<util>/meta.yaml` no repo `docs` (`validate`, `format`, `remove-symbols`, `generate`, e extras como `address-lookup`). Título desconhecido é ignorado e reportado no build.
- Dentro de cada seção: um bloco de código e, se quiser, uma ou duas linhas de texto. Nada de explicar a regra, isso é a spec.
- Código e comentários em inglês. Se a lib quiser versão em português, cria `docs/usage/cpf.pt-br.md`; se não existir, o site usa o arquivo único nos dois idiomas. Código não se traduz.
- Sem o arquivo, a lib aparece como "não implementa". Sem a seção, aquela operação aparece como "não disponível nesta linguagem".
- A lib é dona do arquivo: quem muda a API edita o `usage` no mesmo PR, e o CODEOWNERS de cada repo já cobre isso.

Por que Markdown e não JSON/YAML: contribuidor de Ruby ou Erlang edita sem ferramenta, renderiza bonito no GitHub, e o README da lib pode ser **gerado** a partir desses arquivos (é a proposta da issue #470 do Python, agora sem YAML).

Como cada lib migra o que já tem:

- **JavaScript**: quebrar `docs/utilities.md` em `docs/usage/<util>.md`, um por domínio (~20 arquivos). É recorte, não escrita nova.
- **Python**: mover cada seção do README para `docs/usage/<util>.md`; README vira instalação + 3 exemplos + link. Fecha a #470.
- **Go, Ruby, Rust, .NET, Erlang**: mesma coisa a partir dos READMEs atuais, que já são organizados por utilitário.

Validade dos exemplos é responsabilidade da lib, com a ferramenta nativa de cada uma: Python roda `doctest` nos blocos, Go usa `Example` tests, Rust já roda doc-tests, JS pode ter um teste Vitest que importa os blocos. O repo `docs` não executa código de lib; ele só checa no build que os arquivos existem, têm frontmatter válido e usam ids de operação conhecidos.

### 3.3 Como o site puxa os arquivos

`libs.yaml` no repo `docs` é o único lugar que lista as linguagens:

```yaml
- id: javascript
  label: JavaScript
  repo: brazilian-utils/javascript
  ref: latest-release        # ou um branch, ex.: main
  path: docs/usage
  default: true
- id: python
  label: Python
  repo: brazilian-utils/python
  ref: latest-release
  path: docs/usage
- id: go
  ...
```

Build:

1. `scripts/fetch-usage.mjs` resolve `ref` (a última release via API do GitHub, para a doc bater com o pacote publicado), baixa o conteúdo de `path` de cada repo via API de conteúdo (sem clone, sem submodule) e grava em `.cache/usage/<lang>/<util>.md`. Cacheado no CI; falha de um repo não derruba o build, só marca a linguagem como indisponível e avisa.
2. Uma content collection `usage` do Astro (loader `glob` sobre `.cache/usage`) expõe isso para o `<Usage>`.
3. `<Usage util="cpf">` cruza `meta.yaml` (operações) × `libs.yaml` (linguagens) × arquivos baixados e monta as abas.

Quando rebuildar:

- **Ao publicar release em qualquer lib**: um step de uma linha no workflow de release da lib manda `repository_dispatch` para o `docs`. Precisa de um token de org (GitHub App ou PAT fine-grained com escopo só nesse evento).
- **Diariamente** por `schedule`, como rede de segurança.
- **Em PR no `docs`**, com preview.

Adicionar uma linguagem nova = uma entrada no `libs.yaml` + ícone no `brand`. Nada mais muda no site.

### 3.4 Paridade sem manutenção manual

Presença de arquivo e de seção já é a matriz: utilitário × linguagem × operação. Página `/reference/parity/` gerada no build a partir do `.cache/usage`. Serve também como página de "contribua": cada célula vazia é uma issue em potencial. O `since` do frontmatter vira o badge "desde vX".

### 3.5 Framework

Critérios que pesam aqui: i18n nativo com fallback, abas persistentes entre páginas, Markdown que contribuidor de Ruby ou Erlang edita sem saber React, busca por idioma, importar `spec.md` sem copiar, renderizar Markdown vindo de fora, hospedagem estática grátis.

| | Starlight (Astro) | Docusaurus 3.10 | Docsify (atual) | VitePress | Fumadocs | MkDocs Material |
|---|---|---|---|---|---|---|
| i18n | Nativo; página sem tradução cai para o padrão **com aviso** "not available in your language yet" | Nativo, maduro, Crowdin; docs não descrevem fallback | Pastas por idioma, sem fallback | Pastas; sem fallback de página | Delegado ao next-intl | Seletor de idioma; sem fallback |
| Abas sincronizadas | `<Tabs syncKey>`, persiste entre páginas | `<Tabs groupId>` em localStorage + `queryString` | Plugin, sem persistência | Plugin | Nativo | Content tabs ligadas |
| Busca por idioma | Pagefind embutido, sem serviço | Algolia DocSearch (grátis p/ OSS) ou local | Plugin simples | Algolia / local | Orama | Lunr por idioma |
| Detecção de idioma do navegador | Não (só SSR); snippet no cliente | Não ("melhor no servidor"); snippet | Não | Não; dica de cookie `nf_lang` Netlify | Middleware Next | Não |
| Importar Markdown externo / remoto | `import` de `.md` + content layer com loader `glob` sobre qualquer pasta | Plugin remote-content / remark include | Embed via `[](file ':include')` | `<!--@include-->` | Via MDX | Plugin `snippets` |
| HTML estático / SEO | Sim, zero JS por padrão | Sim, SPA React | **Não** (renderiza no cliente) | Sim | Sim | Sim |
| Versionamento | Plugin | Nativo | Não | Não | Plugin | mike |
| Peso p/ contribuidor | MD/MDX, sem React | MDX + React | MD puro | MD + Vue | Next + React | MD + Python |

**Veredito**: Docsify não atende (sem HTML estático, sem fallback, sem abas persistentes, sem import limpo). Starlight atende todos os critérios sem plugin, e o content layer do Astro foi feito exatamente para "conteúdo que vem de outro lugar". Docusaurus atende quase todos e tem ecossistema maior; vale se a comunidade JS preferir React. Nenhum dos outros ganha nesse cenário.

### 3.6 Dois idiomas

- `defaultLocale: 'root'` com `lang: 'en'` (URLs sem prefixo) e `locales: { 'pt-br': { label: 'Português (Brasil)', lang: 'pt-BR' } }`. Starlight gera `hreflang`, sitemap e sidebar traduzida.
- Specs: `spec.md` (PT) e `spec_en.md` (EN) já existem lado a lado. Adotar o modelo do OpenTelemetry para drift: frontmatter `source_hash` ou `default_lang_commit` no arquivo traduzido, e um `npm run check:i18n` no CI que lista o que ficou para trás. Template de PR exige tocar os dois arquivos.
- Uso: código não se traduz. O arquivo `usage/<util>.md` da lib serve os dois idiomas; `usage/<util>.pt-br.md` é opcional.
- Strings da UI (labels de aba, "Ainda não disponível", "Desde v") em `src/content/i18n/pt-BR.json`.

Detecção pelo navegador (inline no `<head>` das páginas EN, antes do paint, via `components.Head` do Starlight):

```js
(function () {
  try {
    if (localStorage.getItem('bu:lang')) return;               // escolha manual vence
    var wantsPt = (navigator.languages || [navigator.language])
      .some(function (l) { return /^pt\b/i.test(l); });
    if (wantsPt && !location.pathname.startsWith('/pt-br/')) {
      localStorage.setItem('bu:lang', 'pt-br');                 // não repete a checagem
      location.replace('/pt-br' + location.pathname + location.search + location.hash);
    }
  } catch (e) { /* sem storage: fica em inglês */ }
})();
```

O seletor de idioma do Starlight recebe um listener que grava `bu:lang` com a escolha. Se o host for Netlify ou Cloudflare, dá para somar um redirect por `Language` só na raiz `/`, respeitando cookie; no GitHub Pages fica só o cliente. Crawler não executa o redirect, então o EN na raiz continua indexável.

### 3.7 Estrutura final do repo `docs`

```
docs/
├── specs/<util>/{spec.md, spec_en.md, test-cases.json, meta.yaml, references/}
├── adapters/                           # roda test-cases.json em cada lib (já existe, vazio)
├── libs.yaml                           # as linguagens e de onde puxar o uso
├── astro.config.mjs                    # Starlight, locales, sidebar por categoria
├── src/
│   ├── content/docs/                   # en na raiz, pt-br/ espelho; páginas MDX finas
│   ├── content/i18n/pt-BR.json
│   ├── content.config.ts               # collection `usage` apontando para .cache/usage
│   ├── components/{UtilHeader,Usage,TestCases,References}.astro
│   └── styles/brand.css                # paleta #009C3B #FFDF00 #3E4095, fonte Samba
├── scripts/{fetch-usage,check-i18n,build-sidebar}.mjs
├── .cache/usage/<lang>/<util>.md       # gerado, ignorado no git
└── .github/workflows/{build-and-deploy,check-i18n}.yml
```

E em **cada repo de lib**:

```
docs/usage/
├── cpf.md
├── cnpj.md
├── cep.md
└── ...
```

Identidade visual sai do repo `brand`: verde `#009C3B`, amarelo `#FFDF00`, azul `#3E4095`, fonte Samba para títulos. Faltam ícones para Go, Ruby, Rust, .NET e Erlang no `brand` (só existem JS e Python).

### 3.8 Governança

- Repo `docs`: CODEOWNERS só para `specs/**` (time de specs, Cumbuca) e para o site (`src/**`, `scripts/**`). Nada de conteúdo de lib aqui, então nada de time por linguagem aqui.
- Cada lib: seu CODEOWNERS já cobre `docs/usage/**`. Maintainer da lib revisa o uso da lib. Pré-requisito: times de maintainers para as 5 linguagens que ainda não têm (hoje só Python).
- Template de PR "novo utilitário" no `docs`: spec PT + EN, `test-cases.json`, `meta.yaml` com operações, referências com PDF.
- Template de PR "novo utilitário" em cada lib: código + testes + `docs/usage/<util>.md`.
- A **spec** é a referência de comportamento. Lib que desvia tem bug, pego pelos `adapters/` rodando `test-cases.json`. Nada disso aparece na doc.
- Guia "Como portar um utilitário para uma nova linguagem": ler spec, passar nos `test-cases.json`, criar `docs/usage/<util>.md`, pedir entrada no `libs.yaml`.

---

## 4. Quem já fez algo parecido

- **Sentry Docs** (Next.js + MDX): um site, seletor de plataforma persistente, conteúdo comum + `platform-includes/` por SDK. É o modelo estrutural mais próximo, com uma diferença: lá o conteúdo por plataforma mora no repo de docs; aqui mora na lib, que é o que faz sentido para uma org de 7 repos independentes.
- **OpenTelemetry** (Hugo multilingual): spec separada das docs por linguagem, `default_lang_commit` no frontmatter das traduções + `npm run check:i18n` para drift, banner de "desatualizado". Copiar o mecanismo de drift.
- **libphonenumber**: uma implementação canônica, ports precisam passar nos mesmos testes. Aqui a "canônica" é a spec + `test-cases.json`.
- **Stripe / Twilio**: a UX das abas por linguagem lembrada entre páginas, com uma linguagem padrão.
- **Faker** (contra-exemplo): fakerjs e Faker Python com docs, nomes e features separados. É onde a org chega se cada lib continuar com seu README.
- Não encontrei outra org de "utils de país" com doc unificada multi-linguagem. A combinação spec canônica + uso puxado das libs parece inédita e vale contar na home.

---

## 5. Pontos de atenção

- **Spec × test-cases**: corrigir a contradição sobre entrada formatada (CPF) no repo `docs`.
- **Token para o `repository_dispatch`**: GitHub App da org ou PAT fine-grained guardado como secret em cada lib. Sem isso o site só atualiza no `schedule` diário, o que também é aceitável no começo.
- **Rate limit da API do GitHub no build**: 7 repos × ~20 arquivos cabe folgado no limite autenticado; usar `GITHUB_TOKEN` do Actions e cachear `.cache/usage` por SHA.
- **Migração de URL**: `brazilian-utils.com.br` sai do Pages do repo `javascript` e vai para o `docs`. Manter no `javascript/docs/index.html` um stub que traduz rotas hash antigas (`/#/utilities`, `/#/pt-br/getting-started`) para as novas URLs. Atualizar links dos 7 READMEs.
- **Nomes de arquivo em `references/`** com espaços e acentos (ex.: `INSTRUÇÃO NORMATIVA RFB Nº 2.172…pdf`) quebram links em alguns hosts; renomear para slugs e manter o título em `references.md`.
- **Dados sensíveis**: exemplos só com números vindos de `generate()` ou dos `test-cases.json`, nunca CPF/CNPJ reais. Deixar explícito o que a lib não faz (consulta na Receita, LGPD).
- **CNPJ alfanumérico** (vigente desde jul/2026): a spec já cobre; a página mostra os dois formatos e a matriz diz quais libs suportam.
- **Consultas de rede** (CEP via ViaCEP, feriados): documentar como "integração", não validação, com nota de rate limit e offline.
- **Busca**: Pagefind indexa por idioma sem serviço. Se quiser mais, Algolia DocSearch é grátis para OSS.
- **Acessibilidade e tema**: claro/escuro, abas navegáveis por teclado, contraste da paleta (amarelo `#FFDF00` só como detalhe, nunca como texto).
- **Link checker** no CI: fontes do governo somem do ar; por isso os PDFs ficam no repo.

---

## 6. Roadmap

1. **Decisões (1 semana, issue no `docs`)**: Starlight vs Docusaurus, host (Pages vs Netlify/Cloudflare), aprovar o contrato `docs/usage/<util>.md` com os maintainers das libs, acertar spec × test-cases, criar times por linguagem.
2. **Esqueleto (1–2 semanas)**: Starlight no repo `docs`, locales, sidebar por categoria, `libs.yaml`, `fetch-usage`, componentes `UtilHeader/Usage/TestCases/References`, detecção de idioma, tema com a paleta. Piloto com as 4 specs existentes (CPF, CNPJ, CEP, placa) puxando `usage` de JS e Python.
3. **Migração de uso nas libs (paralelo, um PR por lib)**: JS recorta `utilities.md`; Python recorta o README; as outras 5 fazem o mesmo a partir dos READMEs. Cada PR adiciona o step de `repository_dispatch` no release.
4. **Conteúdo do `docs` (contínuo, comunidade)**: specs que faltam, na ordem dos utilitários mais usados (phone já está em aberto). Uma issue por utilitário, com o bot "bora!".
5. **Virar a chave**: CNAME para o `docs`, stub de redirect no `javascript`, READMEs encurtados, `adapters/` rodando `test-cases.json` em todas as libs.

---

## 7. Fontes

Repos e site atual:
- https://github.com/brazilian-utils/docs · https://github.com/brazilian-utils/javascript · https://github.com/brazilian-utils/python · https://github.com/brazilian-utils/brand
- https://brazilian-utils.com.br (Docsify; config em `javascript/docs/index.html`)
- Issue Python #470 (conflitos no README) · Issue JS #240 (agrupar por categoria) · Issue docs #16 (spec phone)

Frameworks:
- Starlight i18n: https://starlight.astro.build/guides/i18n/ · Tabs `syncKey`: https://starlight.astro.build/components/tabs/
- Astro i18n (preferredLocale só em SSR): https://docs.astro.build/en/guides/internationalization/ · Content layer / loaders: https://docs.astro.build/en/guides/content-collections/
- Docusaurus i18n (sem detecção automática): https://docusaurus.io/docs/i18n/introduction · Tabs `groupId`: https://docusaurus.io/docs/markdown-features/tabs
- VitePress i18n: https://vitepress.dev/guide/i18n · Fumadocs i18n: https://fumadocs.dev/docs/internationalization · MkDocs Material: https://squidfunk.github.io/mkdocs-material/setup/changing-the-language/
- Comparativos 2026: https://docsio.co/blog/starlight-vs-docusaurus · https://www.pkgpulse.com/guides/best-documentation-frameworks-2026 · https://www.pkgpulse.com/guides/fumadocs-vs-nextra-v4-vs-starlight-documentation-sites-2026

Referências de estrutura:
- Sentry Docs: https://github.com/getsentry/sentry-docs · https://docs.sentry.io/contributing/approach/write-sdk-docs/
- OpenTelemetry localização (drift `default_lang_commit`): https://opentelemetry.io/docs/contributing/localization/
- GitHub `repository_dispatch`: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#repository_dispatch
