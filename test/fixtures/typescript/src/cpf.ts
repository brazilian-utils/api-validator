export type StateCode = "SP" | "RJ";
export type FormatCpfOptions = { pad?: boolean };
/** Checks a CPF. */
export function isValidCpf(cpf: string): boolean {
  return cpf.length === 11;
}
export const formatCpf = (value: string | number, options?: FormatCpfOptions): string => String(value);
export const generateCpf = (state?: StateCode) => "00000000000";
