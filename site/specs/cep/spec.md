---
id: cep
title: "CEP"
language: pt-BR
references:
  - lei 6.538/1978
---

# CEP - Código de Endereçamento Postal 

## Resumo

O CEP é um conjunto numérico constituído de oito algarismos, que orienta e acelera o encaminhamento, o tratamento e a distribuição de objetos de correspondência, por meio da sua atribuição a localidades, logradouros, unidades dos Correios, serviços, órgãos públicos, empresas e edifícios.

## Operações

- **Validação**: Verificar se um CEP sem formatação contém exatamente `8` dígitos numéricos.
- **Formatação**: Apresentar o CEP no formato padrão `XXXXX-XXX`.
- **Remoção de símbolos**: Remover os caracteres `.` e `-` da entrada.
- **Geração**: Gerar um CEP aleatório de `8` dígitos.

## Regras de validação

1. A entrada deve conter exatamente `8` dígitos numéricos.

## Algoritmo detalhado

1. Verificar se a entrada contém exatamente `8` caracteres.
2. Verificar se todos os caracteres são dígitos numéricos.
3. Retornar válido se ambas as condições forem atendidas, caso contrário, retornar inválido.

## Regex

- CEP sem formatação: `^\d{8}$`
- CEP formatado: `^\d{5}-\d{3}$`

## Exemplos

- Válido: `01310200` 
- Inválido: `01310-200` (a validação aceita apenas CEPs sem formatação)
- Inválido: `12345` (deve conter exatamente 8 caracteres)
- Inválido: `123456789` (deve conter exatamente 8 caracteres)
- Inválido: `abcdefgh` (deve conter apenas dígitos numéricos)
