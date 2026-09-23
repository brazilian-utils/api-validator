---
id: cnpj
title: "CNPJ"
language: pt-BR
references:
  - in-rfb-2119-2022
  - in-rfb-2229-2024
---

# CNPJ — Cadastro Nacional da Pessoa Jurídica

## Resumo

O CNPJ é um número de identificação único emitido pela Receita Federal para registrar empresas, órgãos públicos e outras entidades no Brasil. Ele possui 14 caracteres, sendo 8 da raiz, 4 da ordem do estabelecimento e 2 dígitos verificadores. Os CNPJs emitidos antes da implementação do formato alfanumérico utilizam apenas dígitos numéricos. Desde julho de 2026, novas inscrições podem conter letras maiúsculas e dígitos nos 12 primeiros caracteres, mantendo os 2 dígitos verificadores exclusivamente numéricos.

## Operações

- **Validação**: Verificar se um CNPJ sem formatação é válido conforme as regras oficiais.
- **Formatação**: Apresentar o CNPJ no formato `XX.XXX.XXX/XXXX-DV`, onde:
    - `X` – Caractere alfanumérico (algarismos de 0 a 9 e letras maiúsculas de A a Z).
    - `DV` – Dígitos verificadores calculados pelo algoritmo do módulo 11.
- **Remoção de símbolos**: Remover os caracteres `.`, `/` e `-`, mantendo apenas os caracteres alfanuméricos.
- **Geração**: Gera uma string de CNPJ válida aleatória.

## Regras de validação

1. A entrada deve conter exatamente 14 caracteres.
2. Os 12 primeiros caracteres podem conter dígitos de `0` a `9` e letras maiúsculas de `A` a `Z`.
3. Os 2 últimos caracteres correspondem aos dígitos verificadores e devem ser numéricos.
4. Os dígitos verificadores devem ser calculados pelo algoritmo do módulo 11.
5. Para o cálculo dos dígitos verificadores, os 12 primeiros caracteres devem ser convertidos em valores numéricos utilizando seu código ASCII decimal, subtraindo `48` do valor correspondente.
   
   Exemplos:
   - `0` → `48 - 48 = 0`
   - `9` → `57 - 48 = 9`
   - `A` → `65 - 48 = 17`
   - `B` → `66 - 48 = 18`
   - `Z` → `90 - 48 = 42`

## Algoritmo detalhado

1. Verificar se a entrada possui exatamente 14 caracteres.
2. Verificar se os 12 primeiros caracteres são alfanuméricos e os 2 últimos são numéricos.
3. Converter os caracteres alfanuméricos em valores numéricos:
   - Caracteres numéricos mantêm seu valor.
   - Letras são convertidas utilizando o valor ASCII decimal subtraído de `48`.
4. Calcular o primeiro dígito verificador (DV1):
   - Para os 12 primeiros caracteres, distribuir os pesos de `2` a `9` da direita para a esquerda, reiniciando em `2` após o peso `9`. 
   - Multiplicar cada valor pelo peso correspondente e somar os resultados.
   - Calcular o resto da divisão da soma por `11`.
   - Se o resto for `0` ou `1`, o DV1 será `0`; caso contrário, será `11 - resto`.
5. Calcular o segundo dígito verificador (DV2):
   - Para os 13 caracteres, adicionar o DV1 à sequência e distribuir novamente os pesos de `2` a `9` da direita para a esquerda.
   - Multiplicar cada valor pelo peso correspondente e somar os resultados.
   - Calcular o resto da divisão da soma por `11`.
   - Se o resto for `0` ou `1`, o DV2 será `0`; caso contrário, será `11 - resto`.
6. Comparar os dígitos verificadores calculados com os dois últimos caracteres do CNPJ.

## Regex

- CNPJ sem formatação: `^[A-Z0-9]{12}[0-9]{2}$`
- CNPJ formatado: `^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}/[A-Z0-9]{4}-[0-9]{2}$`

## Exemplos

- Válido: `03560714000142` (CNPJ numérico válido)
- Válido: `9359QAG9000184` (CNPJ alfanumérico válido)
- Inválido: `03.560.714/0001-42` (a validação aceita apenas CNPJs sem formatação)
- Inválido: `00111222000133` (dígitos verificadores inválidos)
- Inválido: `12ABC34501DE3X` (os dígitos verificadores devem ser numéricos)
- Inválido: `12abc34501DE35` (letras minúsculas não são permitidas)
- Inválido: `12ABC34501DE3` (deve conter exatamente 14 caracteres)
- Inválido: `12ABC34501DE345` (deve conter exatamente 14 caracteres)
