import { isValidCpf } from "./cpf";
export { isValidCpf, formatCpf, type FormatCpfOptions } from "./cpf";
export type { StateCode } from "./cpf";
export { generateCpf } from "./cpf";
/** @deprecated Use `isValidCpf`. */
export const isValidCPF: typeof isValidCpf = isValidCpf;
export const VERSION = "1.0.0";
export class ValidationError extends Error {}
