---
id: placa-de-carro
title: "Placa de Carro"
language: pt-BR
references:
  - lei-9503-1997
---

# Placa de identificação veicular

## Resumo

Placas de identificação veicular são as chapas dianteira e traseira fixadas no veículo. Uma placa tem 7 letras e dígitos.

## Funções

- **Validação**: Verificar se a placa de identificação veicular é válida conforme as regras oficiais.
- **Formatação**: Converter a placa para maiúsculas e adicionar um hífen às placas no formato antigo (`ABC-1234`). Placas Mercosul (`ABC1D23`) não têm separador. `L` é uma letra e `N` é um algarismo.
- **Geração**: Gerar uma placa válida no formato indicado. Se você não indicar um formato, a função retorna uma placa no formato Mercosul.

## Regras de validação

### Padrão Mercosul
1. A placa tem 7 letras e dígitos na sequência `LLLNLNN`.

### Padrão pré-Mercosul
1. A placa tem 7 letras e dígitos na sequência `LLLNNNN`, em dois grupos:
   - O primeiro grupo tem 3 letras (`A` a `Z`).
   - O segundo grupo tem 4 dígitos.

## Algoritmo

1. Remover os espaços em branco no início e no fim da entrada.
2. Verificar se a entrada tem exatamente 7 caracteres.
3. Verificar se todos os caracteres são alfanuméricos.
4. Verificar se a entrada segue um dos padrões válidos:
   - Mercosul: `LLLNLNN`
   - Pré-Mercosul: `LLLNNNN`
5. Se a entrada não seguir nenhum dos padrões, a placa é inválida.

## Regex

- Entrada bruta: `^[A-Za-z0-9 -]{1,}$`
- Apenas caracteres (padrão pré-Mercosul ou Mercosul): `^(?:[A-Z]{3}[0-9]{4}|[A-Z]{3}[0-9][A-Z][0-9]{2})$`

## Exemplos

- Válido: `ABC1234` (padrão pré-Mercosul)
- Válido: `ABC1D23` (padrão Mercosul)
- Inválido: `AB12345` (não segue nenhum formato válido)
- Inválido: `ABCD123` (quantidade incorreta de letras)
- Inválido: `ABC123` (menos de 7 caracteres)
- Inválido: `ABC12D4` (ordem incorreta dos caracteres)
