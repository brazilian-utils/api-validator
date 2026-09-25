---
id: cnpj
title: "CNPJ"
language: pt-BR
references:
  - in-rfb-2119-2022
  - in-rfb-2229-2024
---

# CNPJ: Cadastro Nacional da Pessoa Jurídica

## Resumo

O CNPJ é o número de identificação que a Receita Federal atribui a empresas, órgãos públicos e outras entidades no Brasil. Tem 14 caracteres: 8 da raiz, 4 da ordem do estabelecimento e 2 dígitos verificadores. Os CNPJs emitidos antes do início do formato alfanumérico usam apenas dígitos. Desde julho de 2026, novas inscrições podem conter letras maiúsculas e dígitos nos 12 primeiros caracteres. Os 2 dígitos verificadores continuam apenas numéricos.

## Regras de validação

1. A entrada deve conter exatamente 14 caracteres.
2. Os 12 primeiros caracteres podem conter dígitos de `0` a `9` e letras de `A` a `Z`. Com `version: 2`, a validação lê letras minúsculas como maiúsculas.
3. Os 2 últimos caracteres são os dígitos verificadores e devem ser numéricos.
4. Os dígitos verificadores devem vir do algoritmo do módulo 11.
5. Para calcular os dígitos verificadores, converta os 12 primeiros caracteres em valores numéricos. Use o código ASCII decimal de cada caractere e subtraia `48`.

   Exemplos:
   - `0` → `48 - 48 = 0`
   - `9` → `57 - 48 = 9`
   - `A` → `65 - 48 = 17`
   - `B` → `66 - 48 = 18`
   - `Z` → `90 - 48 = 42`

## Algoritmo

1. Verificar se a entrada tem exatamente 14 caracteres.
2. Verificar se os 12 primeiros caracteres são alfanuméricos e os 2 últimos são numéricos.
3. Converter os caracteres alfanuméricos em valores numéricos:
   - Os dígitos mantêm o seu valor.
   - As letras passam a valer o seu código ASCII decimal menos `48`.
4. Calcular o primeiro dígito verificador (DV1):
   - Para os 12 primeiros caracteres, distribuir os pesos de `2` a `9` da direita para a esquerda. Recomeçar em `2` após o peso `9`.
   - Multiplicar cada valor pelo seu peso e somar os resultados.
   - Calcular o resto da divisão da soma por `11`.
   - Se o resto for `0` ou `1`, o DV1 é `0`. Se não, o DV1 é `11 - resto`.
5. Calcular o segundo dígito verificador (DV2):
   - Adicionar o DV1 ao fim da sequência. Para esses 13 caracteres, distribuir os pesos de `2` a `9` da direita para a esquerda.
   - Multiplicar cada valor pelo seu peso e somar os resultados.
   - Calcular o resto da divisão da soma por `11`.
   - Se o resto for `0` ou `1`, o DV2 é `0`. Se não, o DV2 é `11 - resto`.
6. Comparar os dígitos verificadores calculados com os 2 últimos caracteres do CNPJ.

## Regex

- CNPJ sem formatação: `^[A-Z0-9]{12}[0-9]{2}$`
- CNPJ formatado: `^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}/[A-Z0-9]{4}-[0-9]{2}$`

## Exemplos

- Válido: `03560714000142` (CNPJ numérico válido)
- Válido: `9359QAG9000184` (CNPJ alfanumérico válido)
- `03.560.714/0001-42`: decisão pendente. A referência (JS) aceita, as outras bibliotecas não.
- Inválido: `00111222000133` (dígitos verificadores inválidos)
- Inválido: `12ABC34501DE3X` (os dígitos verificadores devem ser numéricos)
- Inválido: `12ABC34501DE3` (deve conter exatamente 14 caracteres)
- Inválido: `12ABC34501DE345` (deve conter exatamente 14 caracteres)
