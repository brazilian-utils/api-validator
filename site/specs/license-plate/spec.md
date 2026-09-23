---
id: placa-de-carro
title: "Placa de Carro"
language: pt-BR
references:
  - lei-9503-1997
---

# Placa de Identificação Veicular

## Resumo

Placas de identificação veicular são chapas dianteiras e traseiras afixadas ao veículo, contendo 7 caracteres alfanuméricos individualizados.

## Operações

- **Validação**: Verificar se a placa de identificação veicular é válida conforme regras oficiais.
- **Formatação**: Apresentar a placa no formato padrão `LLLNLNN` ou `LLLNNNN`, `L` refere-se à letra, e `N` ao numeral.
- **Geração**: Gera uma placa de carro válida no formato especificado. Caso nenhum formato seja fornecido, ele retornará uma placa de carro no formato Mercosul.

## Regras de validação

### Padrão Mercosul
1. Deve ser composta de 7 (sete) caracteres alfanuméricos na sequência `LLLNLNN`.

### Padrão Pré-Mercosul
1. Deve conter 7 (sete) caracteres alfanuméricos individualizados, sendo o primeiro grupo composto por 3 (três), resultante do arranjo, com repetição de 26 (vinte e seis) letras, tomadas três a três, e o segundo grupo composto por 4 (quatro), resultante do arranjo, com repetição de 10 (dez) algarismos, tomados quatro a quatro, formando a sequência `LLLNNNN`.

## Algoritmo detalhado

1. Remover espaços em branco no início e no fim da entrada.
2. Verificar se a entrada possui exatamente 7 caracteres.
3. Verificar se são caracteres alfanuméricos.
4. Verificar se a entrada segue um dos padrões válidos:
   - Mercosul: `LLLNLNN`
   - Pré-Mercosul: `LLLNNNN`
5. Caso a entrada não siga nenhum dos padrões, a placa é considerada inválida.

## Regex

- Input bruto: `^[A-Za-z0-9 -]{1,}$`
- Apenas caracteres (padrão pré-Mercosul ou Mercosul): `^(?:[A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2})$`

## Exemplos

- Válido: `ABC1234` (Padrão pré-Mercosul)
- Válido: `ABC1D23` (Padrão Mercosul)
- Inválido: `AB12345` (não segue nenhum formato válido)
- Inválido: `ABCD123` (quantidade incorreta de letras)
- Inválido: `ABC123` (menos de 7 caracteres)
- Inválido: `ABC12D4` (ordem incorreta dos caracteres)
