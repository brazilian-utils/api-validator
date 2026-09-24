---
id: cep
title: "CEP"
language: pt-BR
references:
  - lei 6.538/1978
---

# CEP: Código de Endereçamento Postal

## Resumo

O CEP é um código numérico de oito algarismos. Os Correios atribuem esses códigos a localidades, logradouros, unidades dos Correios, serviços, órgãos públicos, empresas e edifícios. Os códigos orientam e aceleram o encaminhamento, o tratamento e a distribuição de objetos de correspondência.

## Regras de validação

1. A entrada deve conter exatamente `8` dígitos.

## Algoritmo

1. Verificar se a entrada contém exatamente `8` caracteres.
2. Verificar se todos os caracteres são dígitos.
3. Se as duas condições forem verdadeiras, retornar válido. Se não, retornar inválido.

## Regex

- CEP sem formatação: `^\d{8}$`
- CEP formatado: `^\d{5}-\d{3}$`

## Exemplos

- Válido: `01310200`
- `01310-200`: decisão pendente. A referência (JS) aceita, as outras bibliotecas não.
- Inválido: `12345` (deve conter exatamente `8` caracteres)
- Inválido: `123456789` (deve conter exatamente `8` caracteres)
- Inválido: `abcdefgh` (deve conter apenas dígitos)
