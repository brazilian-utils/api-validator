---
id: cpf
title: "CPF"
language: pt-BR
references:
  - IN RFB nº 2.172/2024
  - lei 14.534/2023
---

# CPF — Cadastro de Pessoas Físicas

## Resumo

O CPF é um identificador nacional de 11 dígitos. Os 8 primeiros dígitos correspondem ao número de inscrição e são escolhidos aleatoriamente, o nono dígito define a Região Fiscal responsável pela inscrição, os 2 últimos dígitos são dígitos verificadores. Desde Janeiro de 2023 o Brasil passou a adotar o CPF como número único de identificação.

## Operações

- **Validação**: Verificar se um CPF sem formatação é válido conforme as regras oficiais.
- **Formatação**: Apresentar o CPF no formato padrão `XXX.XXX.XXX-YY`.
- **Remoção de símbolos**: Remover os caracteres `.` e `-`, mantendo apenas os dígitos numéricos.
- **Geração**: Gera um CPF válido aleatório ou seguindo regras específicas.

## Regras de validação

1. A entrada deve conter exatamente 11 caracteres.
2. Dígitos verificadores calculados pelo algoritmo padrão (mod 11).
3. Sequências com todos os dígitos iguais (ex.: `00000000000`) são inválidas.

## Algoritmo detalhado

1. Rejeitar se tamanho != 11 ou se é sequência repetida
2. Calcular primeiro dígito verificador (DV1):
   - Multiplicar os 9 primeiros dígitos pelos pesos 10..2
   - Somar os resultados
   - DV1 = (soma % 11 < 2 ? 0 : 11 - (soma % 11))
3. Calcular segundo dígito verificador (DV2):
   - Multiplicar os 10 primeiros dígitos (incluindo DV1) pelos pesos 11..2
   - Somar os resultados
   - DV2 = (soma % 11 < 2 ? 0 : 11 - (soma % 11))
4. Comparar DV1 e DV2 com os dígitos finais

## Regex

- CPF sem formatação: `^\d{11}$`
- CPF formatado: `^\d{3}\.\d{3}\.\d{3}-\d{2}$`

## Exemplos

- Válido: `11144477735` 
- Inválido: `111.444.777-35` (a validação aceita apenas CPFs sem formatação)
- Inválido: `00000000000` (sequência repetida)
- Inválido: `1114447773` (deve conter exatamente 11 caracteres)
- Inválido: `111444777355` (deve conter exatamente 11 caracteres)
