---
id: cpf
title: "CPF"
language: pt-BR
references:
  - IN RFB nº 2.172/2024
  - lei 14.534/2023
---

# CPF: Cadastro de Pessoas Físicas

## Resumo

O CPF é um identificador nacional de 11 dígitos. Os 8 primeiros dígitos são o número de inscrição, escolhido ao acaso. O nono dígito indica a Região Fiscal responsável pela inscrição. Os 2 últimos dígitos são dígitos verificadores. Desde janeiro de 2023, o Brasil usa o CPF como número único de identificação.

## Funções

- **Validação**: Verificar se um CPF sem formatação é válido conforme as regras oficiais.
- **Formatação**: Mostrar o CPF no formato padrão `XXX.XXX.XXX-YY`.
- **Interpretação**: Remover os caracteres `.` e `-` e manter apenas os dígitos.
- **Geração**: Gerar um CPF válido, ao acaso ou conforme regras específicas.

## Regras de validação

1. A entrada deve conter exatamente 11 caracteres.
2. Os dígitos verificadores vêm do algoritmo padrão (mod 11).
3. Sequências com todos os dígitos iguais (por exemplo, `00000000000`) são inválidas.

## Algoritmo

1. Rejeitar a entrada se o tamanho != 11 ou se for uma sequência repetida.
2. Calcular o primeiro dígito verificador (DV1):
   - Multiplicar os 9 primeiros dígitos pelos pesos 10..2.
   - Somar os resultados.
   - DV1 = (soma % 11 < 2 ? 0 : 11 - (soma % 11))
3. Calcular o segundo dígito verificador (DV2):
   - Multiplicar os 10 primeiros dígitos (incluindo DV1) pelos pesos 11..2.
   - Somar os resultados.
   - DV2 = (soma % 11 < 2 ? 0 : 11 - (soma % 11))
4. Comparar DV1 e DV2 com os 2 últimos dígitos.

## Regex

- CPF sem formatação: `^\d{11}$`
- CPF formatado: `^\d{3}\.\d{3}\.\d{3}-\d{2}$`

## Exemplos

- Válido: `11144477735`
- Inválido: `111.444.777-35` (a validação aceita apenas CPFs sem formatação)
- Inválido: `00000000000` (sequência repetida)
- Inválido: `1114447773` (deve conter exatamente 11 caracteres)
- Inválido: `111444777355` (deve conter exatamente 11 caracteres)
