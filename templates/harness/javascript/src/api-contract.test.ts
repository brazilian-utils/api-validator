/**
 * Conformance harness for the shared brazilian-utils API contract.
 *
 * `api-contract/` (repo root) is a vendored, language-agnostic copy of the contract's test vectors
 * (refreshed by the doc bot; never edit it here). This file maps each contract function
 * id to the function of this lib that implements it (the REGISTRY below) and runs every case as its
 * own test, named by the case id. The rules it follows are in `api-contract/README.md` and
 * `api-contract/cases/index.json` (`comparison`).
 *
 * - A contract function missing from the registry is skipped as "not implemented".
 * - `network: true` functions are skipped unless `API_CONTRACT_NETWORK=1`.
 * - Case ids listed in `api-contract/skip.json` are skipped with the reason given there
 *   (`API_CONTRACT_NO_SKIP=1` runs them anyway).
 * - A registry id the contract does not know fails (typo or renamed contract function).
 * - `cases/equality.json` checks that `jsonEqual` compares values like every other lib's harness.
 *
 * The JSON files are loaded with dynamic `import()` + `with { type: "json" }` relative to this
 * file, so the harness does not depend on the working directory and runs under Vitest (Node and
 * browser mode), Bun and Deno alike.
 */
import { describe, expect, test } from "./_internals/test/runtime";
import {
	addBusinessDays,
	capitalize,
	convertCurrencyToWords,
	convertDateToWords,
	convertLicensePlateToMercosul,
	convertNumberToWords,
	differenceInBusinessDays,
	formatBoleto,
	formatCaepf,
	formatCei,
	formatCep,
	formatCertidao,
	formatCnae,
	formatCnh,
	formatCno,
	formatCnpj,
	formatCns,
	formatCpf,
	formatCurrency,
	formatIban,
	formatLegalNature,
	formatLicensePlate,
	formatNcm,
	formatNfeKey,
	formatPassport,
	formatPhone,
	formatPis,
	formatProcessoJuridico,
	formatVoterId,
	generateBoleto,
	generateCep,
	generateCnh,
	generateCnpj,
	generateCpf,
	generateLegalNature,
	generateLicensePlate,
	generatePassport,
	generatePhone,
	generatePis,
	generatePixPayload,
	generateProcessoJuridico,
	generateRenavam,
	generateVoterId,
	getAddressInfoByCep,
	getAreaCodeInfo,
	getAreaCodesByState,
	getBankByCode,
	getBankByIspb,
	getBanks,
	getBoletoInfo,
	getCbo,
	getCepInfoByAddress,
	getCertidaoInfo,
	getCfop,
	getCnae,
	getFormatLicensePlate,
	getHolidays,
	getIbanInfo,
	getLegalNature,
	getLegalNatures,
	getLegalNaturesByCategory,
	getMunicipalities,
	getMunicipalityByCode,
	getNfeKeyInfo,
	getPixKeyInfo,
	getPixPayloadInfo,
	getStateByIbgeCode,
	getStateCodeByName,
	getStateNameByCode,
	getStates,
	getTimezoneByState,
	isBusinessDay,
	isHoliday,
	isValidBankAccount,
	isValidBoleto,
	isValidCaepf,
	isValidCbo,
	isValidCei,
	isValidCep,
	isValidCertidao,
	isValidCfop,
	isValidCnae,
	isValidCnh,
	isValidCno,
	isValidCnpj,
	isValidCns,
	isValidCpf,
	isValidCreditCard,
	isValidCsosn,
	isValidCst,
	isValidEmail,
	isValidIban,
	isValidIe,
	isValidLandlinePhone,
	isValidLegalNature,
	isValidLicensePlate,
	isValidMobilePhone,
	isValidNcm,
	isValidNfeKey,
	isValidPassport,
	isValidPhone,
	isValidPis,
	isValidPixKey,
	isValidPixPayload,
	isValidProcessoJuridico,
	isValidRegistroProfissional,
	isValidRenavam,
	isValidServicePhone,
	isValidVin,
	isValidVoterId,
	parseBoleto,
	parseCaepf,
	parseCbo,
	parseCei,
	parseCep,
	parseCertidao,
	parseCfop,
	parseCnae,
	parseCnh,
	parseCno,
	parseCnpj,
	parseCns,
	parseCpf,
	parseCurrency,
	parseIban,
	parseLegalNature,
	parseLicensePlate,
	parseNcm,
	parseNfeKey,
	parsePassport,
	parsePhone,
	parsePis,
	parseProcessoJuridico,
	parseVoterId,
	removeAccents,
	subBusinessDays,
	type IsValidIeParams,
} from "./index";

type Json = boolean | number | string | null | Json[] | { [key: string]: Json };

type Expectation =
	| { returns: Json }
	| { throws: true }
	| { matches: string }
	| { satisfies: string };

type ContractCase = {
	id: string;
	args: Json[];
	expect: Expectation;
	repeat?: number;
};

type ContractFunction = {
	id: string;
	network?: boolean;
	cases: ContractCase[];
};

type DomainFile = { domain: string; functions: ContractFunction[] };

type EqualityPair = { expected: Json; actual: Json; equal: boolean; why: string };

type Implementation = (args: Json[]) => unknown;

/**
 * Calls `fn` with the case's JSON arguments as its positional parameters. Functions whose
 * signature does not line up with the contract's `params` get a hand-written adapter instead.
 */
const positional =
	<Args extends unknown[]>(fn: (...args: Args) => unknown): Implementation =>
	(args) =>
		fn(...(args as unknown[] as Args));

/**
 * Contract function id -> the function of this lib that implements it, one line per function,
 * grouped by domain. Adding a util to the contract means adding its line here.
 */
const REGISTRY: Record<string, Implementation> = {
	// areaCode
	"areaCode.getInfo": positional(getAreaCodeInfo),
	"areaCode.listByState": positional(getAreaCodesByState),

	// bank
	"bank.getByCode": positional(getBankByCode),
	"bank.getByIspb": positional(getBankByIspb),
	"bank.list": positional(getBanks),

	// bankAccount
	"bankAccount.isValid": positional(isValidBankAccount),

	// boleto
	"boleto.format": positional(formatBoleto),
	"boleto.generate": positional(generateBoleto),
	"boleto.getInfo": positional(getBoletoInfo),
	"boleto.isValid": positional(isValidBoleto),
	"boleto.parse": positional(parseBoleto),

	// caepf
	"caepf.format": positional(formatCaepf),
	"caepf.isValid": positional(isValidCaepf),
	"caepf.parse": positional(parseCaepf),

	// cbo
	"cbo.get": positional(getCbo),
	"cbo.isValid": positional(isValidCbo),
	"cbo.parse": positional(parseCbo),

	// cei
	"cei.format": positional(formatCei),
	"cei.isValid": positional(isValidCei),
	"cei.parse": positional(parseCei),

	// cep
	"cep.format": positional(formatCep),
	"cep.generate": positional(generateCep),
	"cep.getAddressInfo": positional(getAddressInfoByCep),
	"cep.getInfoByAddress": positional(getCepInfoByAddress),
	"cep.isValid": positional(isValidCep),
	"cep.parse": positional(parseCep),

	// certidao
	"certidao.format": positional(formatCertidao),
	"certidao.getInfo": positional(getCertidaoInfo),
	"certidao.isValid": positional(isValidCertidao),
	"certidao.parse": positional(parseCertidao),

	// cfop
	"cfop.get": positional(getCfop),
	"cfop.isValid": positional(isValidCfop),
	"cfop.parse": positional(parseCfop),

	// cnae
	"cnae.format": positional(formatCnae),
	"cnae.get": positional(getCnae),
	"cnae.isValid": positional(isValidCnae),
	"cnae.parse": positional(parseCnae),

	// cnh
	"cnh.format": positional(formatCnh),
	"cnh.generate": positional(generateCnh),
	"cnh.isValid": positional(isValidCnh),
	"cnh.parse": positional(parseCnh),

	// cno
	"cno.format": positional(formatCno),
	"cno.isValid": positional(isValidCno),
	"cno.parse": positional(parseCno),

	// cnpj
	"cnpj.format": positional(formatCnpj),
	"cnpj.generate": positional(generateCnpj),
	"cnpj.isValid": positional(isValidCnpj),
	"cnpj.parse": positional(parseCnpj),

	// cns
	"cns.format": positional(formatCns),
	"cns.isValid": positional(isValidCns),
	"cns.parse": positional(parseCns),

	// cpf
	"cpf.format": positional(formatCpf),
	"cpf.generate": positional(generateCpf),
	"cpf.isValid": positional(isValidCpf),
	"cpf.parse": positional(parseCpf),

	// creditCard
	"creditCard.isValid": positional(isValidCreditCard),

	// csosn
	"csosn.isValid": positional(isValidCsosn),

	// cst
	"cst.isValid": positional(isValidCst),

	// currency
	"currency.convertToWords": positional(convertCurrencyToWords),
	"currency.format": positional(formatCurrency),
	"currency.parse": positional(parseCurrency),

	// date
	"date.addBusinessDays": positional(addBusinessDays),
	"date.convertToWords": positional(convertDateToWords),
	"date.differenceInBusinessDays": positional(differenceInBusinessDays),
	"date.getHolidays": positional(getHolidays),
	"date.isBusinessDay": positional(isBusinessDay),
	"date.isHoliday": positional(isHoliday),
	"date.subBusinessDays": positional(subBusinessDays),

	// email
	"email.isValid": positional(isValidEmail),

	// iban
	"iban.format": positional(formatIban),
	"iban.getInfo": positional(getIbanInfo),
	"iban.isValid": positional(isValidIban),
	"iban.parse": positional(parseIban),

	// ie
	// The object form: `positional` would pick the deprecated `(stateCode, ie)` overload.
	"ie.isValid": ([params]) => isValidIe(params as unknown as IsValidIeParams),

	// legalNature
	"legalNature.format": positional(formatLegalNature),
	"legalNature.generate": positional(generateLegalNature),
	"legalNature.get": positional(getLegalNature),
	"legalNature.isValid": positional(isValidLegalNature),
	"legalNature.list": positional(getLegalNatures),
	"legalNature.listByCategory": positional(getLegalNaturesByCategory),
	"legalNature.parse": positional(parseLegalNature),

	// legalProcess
	"legalProcess.format": positional(formatProcessoJuridico),
	"legalProcess.generate": positional(generateProcessoJuridico),
	"legalProcess.isValid": positional(isValidProcessoJuridico),
	"legalProcess.parse": positional(parseProcessoJuridico),

	// licensePlate
	"licensePlate.convertToMercosul": positional(convertLicensePlateToMercosul),
	"licensePlate.format": positional(formatLicensePlate),
	"licensePlate.generate": positional(generateLicensePlate),
	"licensePlate.getFormat": positional(getFormatLicensePlate),
	"licensePlate.isValid": positional(isValidLicensePlate),
	"licensePlate.parse": positional(parseLicensePlate),

	// municipality
	"municipality.getByCode": positional(getMunicipalityByCode),
	"municipality.list": positional(getMunicipalities),

	// ncm
	"ncm.format": positional(formatNcm),
	"ncm.isValid": positional(isValidNcm),
	"ncm.parse": positional(parseNcm),

	// nfeKey
	"nfeKey.format": positional(formatNfeKey),
	"nfeKey.getInfo": positional(getNfeKeyInfo),
	"nfeKey.isValid": positional(isValidNfeKey),
	"nfeKey.parse": positional(parseNfeKey),

	// number
	"number.convertToWords": positional(convertNumberToWords),

	// passport
	"passport.format": positional(formatPassport),
	"passport.generate": positional(generatePassport),
	"passport.isValid": positional(isValidPassport),
	"passport.parse": positional(parsePassport),

	// phone
	"phone.format": positional(formatPhone),
	"phone.generate": positional(generatePhone),
	"phone.isValid": positional(isValidPhone),
	"phone.isValidLandline": positional(isValidLandlinePhone),
	"phone.isValidMobile": positional(isValidMobilePhone),
	"phone.isValidService": positional(isValidServicePhone),
	"phone.parse": positional(parsePhone),

	// pis
	"pis.format": positional(formatPis),
	"pis.generate": positional(generatePis),
	"pis.isValid": positional(isValidPis),
	"pis.parse": positional(parsePis),

	// pixKey
	"pixKey.getInfo": positional(getPixKeyInfo),
	"pixKey.isValid": positional(isValidPixKey),

	// pixPayload
	"pixPayload.generate": positional(generatePixPayload),
	"pixPayload.getInfo": positional(getPixPayloadInfo),
	"pixPayload.isValid": positional(isValidPixPayload),

	// registroProfissional
	"registroProfissional.isValid": positional(isValidRegistroProfissional),

	// renavam
	"renavam.generate": positional(generateRenavam),
	"renavam.isValid": positional(isValidRenavam),

	// state
	"state.getByIbgeCode": positional(getStateByIbgeCode),
	"state.getCodeByName": positional(getStateCodeByName),
	"state.getNameByCode": positional(getStateNameByCode),
	"state.getTimezone": positional(getTimezoneByState),
	"state.list": positional(getStates),

	// text
	"text.capitalize": positional(capitalize),
	"text.removeAccents": positional(removeAccents),

	// vin
	"vin.isValid": positional(isValidVin),

	// voterId
	"voterId.format": positional(formatVoterId),
	"voterId.generate": positional(generateVoterId),
	"voterId.isValid": positional(isValidVoterId),
	"voterId.parse": positional(parseVoterId),
};

// ---------------------------------------------------------------------------------------------
// Loading the vendored suite
// ---------------------------------------------------------------------------------------------

type JsonModule = { default: unknown };

// One path segment per variable, so bundlers (Vite's dynamic-import-vars) can resolve the import.
const readCasesFile = async (name: string): Promise<unknown> =>
	((await import(`../api-contract/cases/${name}.json`, { with: { type: "json" } })) as JsonModule)
		.default;

const readContractFile = async (name: string): Promise<unknown> =>
	((await import(`../api-contract/${name}.json`, { with: { type: "json" } })) as JsonModule)
		.default;

const { domains } = (await readCasesFile("index")) as { domains: string[] };
const equalityPairs = (await readCasesFile("equality")) as EqualityPair[];
const skipList = (await readContractFile("skip")) as Record<string, string>;
const domainFiles = (await Promise.all(
	domains.map((domain) => readCasesFile(domain)),
)) as DomainFile[];

/** Whether an opt-in env var is set to "1" (Node/Bun `process.env`, or `Deno.env`). */
const envFlag = (name: string): boolean => {
	const { process } = globalThis as { process?: { env?: Record<string, string | undefined> } };
	if (process?.env !== undefined) return process.env[name] === "1";
	return typeof Deno !== "undefined" && Deno.env.get(name) === "1";
};

/** Also run `network: true` functions. */
const networkOptIn = envFlag("API_CONTRACT_NETWORK");
/** Ignore skip.json, to see which listed cases pass now. */
const ignoreSkipList = envFlag("API_CONTRACT_NO_SKIP");

// ---------------------------------------------------------------------------------------------
// Comparison (cases/index.json -> comparison)
// ---------------------------------------------------------------------------------------------

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The JSON form of a result: dates as ISO strings, maps as objects, sets as arrays. */
const toJson = (value: unknown): Json => {
	if (value === undefined || value === null) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "bigint") return Number(value);
	if (value instanceof Map) return toJson(Object.fromEntries(value));
	if (value instanceof Set) return [...value].map((item) => toJson(item));
	if (Array.isArray(value)) return value.map((item) => toJson(item));
	if (isObject(value)) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJson(item)]));
	}
	if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
		return value;
	}
	return `<${typeof value}>`;
};

/** `zipCode`, `zip_code` and `ZipCode` are the same key; null fields are dropped. */
const normalizedEntries = (record: Record<string, unknown>): Map<string, unknown> =>
	new Map(
		Object.entries(record)
			.filter(([, item]) => item !== null && item !== undefined)
			.map(([key, item]) => [key.toLowerCase().replaceAll(/[^a-z0-9]/g, ""), item]),
	);

/** Whether `actual` equals the suite's `expected` value under the contract's comparison rules. */
const jsonEqual = (expected: unknown, actual: unknown): boolean => {
	if (typeof expected === "number") {
		return (
			typeof actual === "number" &&
			Math.abs(expected - actual) <= 1e-9 * Math.max(1, Math.abs(expected))
		);
	}
	if (Array.isArray(expected)) {
		return (
			Array.isArray(actual) &&
			actual.length === expected.length &&
			expected.every((item, index) => jsonEqual(item, actual[index]))
		);
	}
	if (isObject(expected)) {
		if (!isObject(actual)) return false;
		const want = normalizedEntries(expected);
		const got = normalizedEntries(actual);
		return (
			want.size === got.size &&
			[...want].every(([key, item]) => got.has(key) && jsonEqual(item, got.get(key)))
		);
	}
	return expected === actual;
};

// ---------------------------------------------------------------------------------------------
// Running a case
// ---------------------------------------------------------------------------------------------

type Outcome = { ok: true; value: Json } | { ok: false; error: unknown };

const invoke = async (implementation: Implementation, args: Json[]): Promise<Outcome> => {
	try {
		return { ok: true, value: toJson(await implementation(args)) };
	} catch (error) {
		return { ok: false, error };
	}
};

const show = (value: unknown): string =>
	value instanceof Error ? `${value.name}: ${value.message}` : JSON.stringify(value);

/** Runs the case once; returns why it failed, or `undefined` when it passed. */
const mismatch = async (
	implementation: Implementation,
	{ args, expect: expectation }: ContractCase,
): Promise<string | undefined> => {
	const outcome = await invoke(implementation, args);
	if ("throws" in expectation) {
		return outcome.ok ? `expected an error, got ${show(outcome.value)}` : undefined;
	}
	if (!outcome.ok) return `threw ${show(outcome.error)}`;
	const { value } = outcome;
	if ("returns" in expectation) {
		const pass =
			expectation.returns === null ? value === null : jsonEqual(expectation.returns, value);
		return pass ? undefined : `expected ${show(expectation.returns)}, got ${show(value)}`;
	}
	if ("matches" in expectation) {
		const pass = typeof value === "string" && new RegExp(expectation.matches).test(value);
		return pass ? undefined : `expected /${expectation.matches}/, got ${show(value)}`;
	}
	const check = await invoke(REGISTRY[expectation.satisfies], [value]);
	return check.ok && check.value === true
		? undefined
		: `${show(value)} does not satisfy ${expectation.satisfies}`;
};

/** Why this case is not run, or `undefined` when it is. */
const skipReason = (fn: ContractFunction, contractCase: ContractCase): string | undefined => {
	if (!Object.hasOwn(REGISTRY, fn.id)) return "not implemented";
	if (fn.network === true && !networkOptIn) return "network (set API_CONTRACT_NETWORK=1)";
	const listed = skipList[contractCase.id];
	if (listed !== undefined && !ignoreSkipList) return `skip.json: ${listed}`;
	const { expect: expectation } = contractCase;
	if ("satisfies" in expectation && !Object.hasOwn(REGISTRY, expectation.satisfies)) {
		return `${expectation.satisfies} not implemented`;
	}
	return undefined;
};

// A function with no cases yet (only a signature in the contract) has nothing to run.
const contractFunctions = domainFiles.flatMap((file) => file.functions);
const testedFunctions = contractFunctions.filter((fn) => fn.cases.length > 0);

describe("api contract", () => {
	test("every registry id is a contract function", () => {
		const known = new Set(contractFunctions.map((fn) => fn.id));
		expect(Object.keys(REGISTRY).filter((id) => !known.has(id))).toStrictEqual([]);
	});

	describe("equality self-test (cases/equality.json)", () => {
		for (const pair of equalityPairs) {
			test(`${pair.why}: ${JSON.stringify(pair.expected)} vs ${JSON.stringify(pair.actual)}`, () => {
				expect(jsonEqual(pair.expected, pair.actual)).toBe(pair.equal);
			});
		}
	});

	for (const fn of testedFunctions) {
		describe(fn.id, () => {
			for (const contractCase of fn.cases) {
				const reason = skipReason(fn, contractCase);
				const run = async (): Promise<void> => {
					const implementation = REGISTRY[fn.id];
					const runs = Array.from({ length: contractCase.repeat ?? 1 }, () =>
						mismatch(implementation, contractCase),
					);
					const problems = await Promise.all(runs);
					expect(problems.find((problem) => problem !== undefined)).toBeUndefined();
				};
				if (reason === undefined) test(contractCase.id, run);
				else {
					describe.skip(reason, () => {
						test(contractCase.id, run);
					});
				}
			}
		});
	}
});
