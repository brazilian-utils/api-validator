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

## Funções

- **Validação**: Verificar se um CEP sem formatação contém exatamente `8` dígitos.
- **Formatação**: Mostrar o CEP no formato padrão `XXXXX-XXX`.
- **Remoção de símbolos**: Remover os caracteres `.` e `-` da entrada.
- **Geração**: Gerar um CEP aleatório de `8` dígitos.

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
- Inválido: `01310-200` (a validação aceita apenas CEPs sem formatação)
- Inválido: `12345` (deve conter exatamente `8` caracteres)
- Inválido: `123456789` (deve conter exatamente `8` caracteres)
- Inválido: `abcdefgh` (deve conter apenas dígitos)
