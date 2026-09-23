//! brazilian-utils API contract harness.
//!
//! Runs the language-agnostic conformance suite vendored in `api-contract/` (see its README.md)
//! against this crate: one test per case, named by the case id.
//!
//! This is a `harness = false` test target (see `[[test]] name = "api_contract"` in Cargo.toml):
//! stable Rust cannot register tests at run time, so `main` below is a tiny libtest look-alike that
//! prints one `test <case id> ... ok | FAILED | ignored, <reason>` line per case and exits non-zero
//! on failure. It understands the usual arguments: `cargo test --test api_contract -- <filter>`,
//! `--exact`, `--skip <filter>`, `--list`.
//!
//! Maintaining it: when a contract function is implemented, add one line to `registry()`.
//! Set `API_CONTRACT_NETWORK=1` to also run the cases of network functions.

use std::collections::BTreeMap;
use std::fs;
use std::panic::{self, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use brazilian_utils::{
    boleto, cep, cnh, cnpj, cpf, currency, email, legal_nature, legal_process, license_plate,
    phone, pis, renavam, voter_id,
};
use serde_json::{Map, Value};

// ---------------------------------------------------------------------------------------------
// Registry: contract function id -> this crate's implementation.
// ---------------------------------------------------------------------------------------------

/// Why a call produced no value.
enum CallError {
    /// The lib failed the idiomatic way (`Err`, or a panic): what `throws: true` expects.
    Threw(String),
    /// The case's arguments cannot be passed to this lib's signature (a registry limitation,
    /// never counted as "throws").
    BadArgs(String),
}

impl std::fmt::Display for CallError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            CallError::Threw(why) => write!(f, "an error ({why})"),
            CallError::BadArgs(why) => write!(f, "unsupported arguments ({why})"),
        }
    }
}

type Outcome = Result<Value, CallError>;
type Adapter = fn(&[Value]) -> Outcome;

fn registry() -> BTreeMap<&'static str, Adapter> {
    let entries: [(&'static str, Adapter); 41] = [
        // boleto
        ("boleto.isValid", |a| ok(boleto::is_valid(s(a, 0)?))),
        // cep
        ("cep.format", |a| ok(cep::format_cep(s(a, 0)?))),
        ("cep.generate", |a| {
            none(a)?;
            ok(cep::generate())
        }),
        ("cep.isValid", |a| ok(cep::is_valid(s(a, 0)?))),
        ("cep.removeSymbols", |a| ok(cep::remove_symbols(s(a, 0)?))),
        // cnh
        ("cnh.isValid", |a| ok(cnh::is_valid_cnh(s(a, 0)?))),
        // cnpj (the contract's optional argument is a version/params; the lib's is a branch
        // number, so only the no-argument form is mapped)
        ("cnpj.format", |a| ok(cnpj::format_cnpj(s(a, 0)?))),
        ("cnpj.generate", |a| {
            none(a)?;
            ok(cnpj::generate(None))
        }),
        ("cnpj.isValid", |a| ok(cnpj::is_valid(s(a, 0)?))),
        ("cnpj.removeSymbols", |a| ok(cnpj::remove_symbols(s(a, 0)?))),
        // cpf
        ("cpf.format", |a| ok(cpf::format_cpf(s(a, 0)?))),
        ("cpf.generate", |a| {
            none(a)?;
            ok(cpf::generate())
        }),
        ("cpf.isValid", |a| ok(cpf::is_valid(s(a, 0)?))),
        ("cpf.removeSymbols", |a| ok(cpf::remove_symbols(s(a, 0)?))),
        // currency
        ("currency.convertToWords", |a| {
            ok(currency::convert_real_to_text(n(a, 0)?))
        }),
        ("currency.format", |a| {
            ok(currency::format_currency(n(a, 0)?))
        }),
        // email
        ("email.isValid", |a| ok(email::is_valid(s(a, 0)?))),
        // legalNature
        ("legalNature.getDescription", |a| {
            ok(legal_nature::get_description(s(a, 0)?))
        }),
        ("legalNature.isValid", |a| {
            ok(legal_nature::is_valid(s(a, 0)?))
        }),
        ("legalNature.list", |a| {
            none(a)?;
            ok(legal_nature::list_all())
        }),
        // legalProcess
        ("legalProcess.format", |a| {
            ok(legal_process::format_legal_process(s(a, 0)?))
        }),
        ("legalProcess.isValid", |a| {
            ok(legal_process::is_valid(s(a, 0)?))
        }),
        ("legalProcess.removeSymbols", |a| {
            ok(legal_process::remove_symbols(s(a, 0)?))
        }),
        // licensePlate
        ("licensePlate.convertToMercosul", |a| {
            ok(license_plate::convert_to_mercosul(s(a, 0)?))
        }),
        ("licensePlate.format", |a| {
            ok(license_plate::format_license_plate(s(a, 0)?))
        }),
        ("licensePlate.generate", |a| {
            ok(license_plate::generate(opt_s(a, 0)?))
        }),
        ("licensePlate.getFormat", |a| {
            ok(license_plate::get_format(s(a, 0)?))
        }),
        ("licensePlate.removeSymbols", |a| {
            ok(license_plate::remove_symbols(s(a, 0)?))
        }),
        // phone
        ("phone.format", |a| ok(phone::format_phone(s(a, 0)?))),
        ("phone.generate", |a| ok(phone::generate(opt_s(a, 0)?))),
        ("phone.removeInternationalDialingCode", |a| {
            ok(phone::remove_international_dialing_code(s(a, 0)?))
        }),
        ("phone.removeSymbols", |a| {
            ok(phone::remove_symbols(s(a, 0)?))
        }),
        // pis
        ("pis.format", |a| ok(pis::format_pis(s(a, 0)?))),
        ("pis.generate", |a| {
            none(a)?;
            ok(pis::generate())
        }),
        ("pis.isValid", |a| ok(pis::is_valid(s(a, 0)?))),
        ("pis.removeSymbols", |a| ok(pis::remove_symbols(s(a, 0)?))),
        // renavam
        ("renavam.generate", |a| {
            none(a)?;
            ok(renavam::generate())
        }),
        ("renavam.isValid", |a| ok(renavam::is_valid(s(a, 0)?))),
        // voterId
        ("voterId.format", |a| {
            ok(voter_id::format_voter_id(s(a, 0)?))
        }),
        ("voterId.generate", |a| ok(voter_id::generate(opt_s(a, 0)?))),
        ("voterId.isValid", |a| ok(voter_id::is_valid(s(a, 0)?))),
    ];
    let registry = BTreeMap::from(entries);
    assert_eq!(registry.len(), entries.len(), "duplicate registry id");
    registry
}

// Argument and result adapters for the registry.

/// Argument `i` as a string.
fn s(args: &[Value], i: usize) -> Result<&str, CallError> {
    match positional(args, i)? {
        Value::String(v) => Ok(v),
        other => Err(bad(format!("argument {i}: expected a string, got {other}"))),
    }
}

/// Optional argument `i` as a string (absent or null -> `None`).
fn opt_s(args: &[Value], i: usize) -> Result<Option<&str>, CallError> {
    arity(args, i + 1)?;
    match args.get(i) {
        None | Some(Value::Null) => Ok(None),
        Some(_) => s(args, i).map(Some),
    }
}

/// Argument `i` as a number.
fn n(args: &[Value], i: usize) -> Result<f64, CallError> {
    let value = positional(args, i)?;
    value
        .as_f64()
        .ok_or_else(|| bad(format!("argument {i}: expected a number, got {value}")))
}

/// The function takes no arguments (or none of the contract's optional ones is supported).
fn none(args: &[Value]) -> Result<(), CallError> {
    if args.is_empty() {
        Ok(())
    } else {
        Err(bad(format!(
            "this lib takes no arguments, got {}",
            args.len()
        )))
    }
}

/// Required argument `i`, which must be the last one this lib accepts.
fn positional(args: &[Value], i: usize) -> Result<&Value, CallError> {
    arity(args, i + 1)?;
    args.get(i)
        .ok_or_else(|| bad(format!("missing argument {i}")))
}

/// At most `max` arguments (the contract's extra optional ones are not supported by this lib).
fn arity(args: &[Value], max: usize) -> Result<(), CallError> {
    if args.len() > max {
        return Err(bad(format!(
            "at most {max} argument(s), got {}",
            args.len()
        )));
    }
    Ok(())
}

fn bad(message: String) -> CallError {
    CallError::BadArgs(message)
}

/// The result in JSON form (`Option::None` -> `null`, maps -> objects).
fn ok<T: serde::Serialize>(value: T) -> Outcome {
    serde_json::to_value(value).map_err(|e| CallError::Threw(format!("not serializable: {e}")))
}

// ---------------------------------------------------------------------------------------------
// Comparison (cases/index.json -> comparison; self-tested against cases/equality.json).
// ---------------------------------------------------------------------------------------------

/// Object key as compared: lowercased, only a-z and 0-9 (`zipCode` == `zip_code`).
fn flat_key(key: &str) -> String {
    key.chars()
        .flat_map(char::to_lowercase)
        .filter(char::is_ascii_alphanumeric)
        .collect()
}

fn values_equal(expected: &Value, actual: &Value) -> bool {
    match (expected, actual) {
        (Value::Null, _) => actual.is_null(),
        (Value::Number(e), Value::Number(a)) => {
            let (e, a) = (
                e.as_f64().unwrap_or(f64::NAN),
                a.as_f64().unwrap_or(f64::NAN),
            );
            (e - a).abs() <= 1e-9 * e.abs().max(1.0)
        }
        (Value::Array(e), Value::Array(a)) => {
            e.len() == a.len() && e.iter().zip(a).all(|(e, a)| values_equal(e, a))
        }
        (Value::Object(e), Value::Object(a)) => {
            let flat = |o: &Map<String, Value>| -> BTreeMap<String, Value> {
                o.iter().map(|(k, v)| (flat_key(k), v.clone())).collect()
            };
            let (e, a) = (flat(e), flat(a));
            e.keys().chain(a.keys()).all(|k| {
                values_equal(
                    e.get(k).unwrap_or(&Value::Null),
                    a.get(k).unwrap_or(&Value::Null),
                )
            })
        }
        (Value::Bool(e), Value::Bool(a)) => e == a,
        (Value::String(e), Value::String(a)) => e == a,
        _ => false,
    }
}

// ---------------------------------------------------------------------------------------------
// The suite.
// ---------------------------------------------------------------------------------------------

/// `api-contract/` at the crate root (or `$API_CONTRACT_DIR`), whatever the working directory.
fn contract_dir() -> PathBuf {
    std::env::var_os("API_CONTRACT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("api-contract"))
}

fn read_json(path: &Path) -> Value {
    let text =
        fs::read_to_string(path).unwrap_or_else(|e| panic!("cannot read {}: {e}", path.display()));
    serde_json::from_str(&text)
        .unwrap_or_else(|e| panic!("invalid JSON in {}: {e}", path.display()))
}

fn field<'a>(value: &'a Value, key: &str) -> &'a Value {
    value.get(key).unwrap_or(&Value::Null)
}

/// One native test.
struct Test {
    name: String,
    run: Box<dyn Fn() -> Status>,
}

enum Status {
    Pass,
    Fail(String),
    Skip(String),
}

/// Every test of the suite: registry self-checks, the equality self-test, then one per case.
fn collect_tests() -> Vec<Test> {
    let dir = contract_dir();
    let registry = registry();
    let network = std::env::var("API_CONTRACT_NETWORK").is_ok_and(|v| v == "1");
    let skips: BTreeMap<String, String> = match read_json(&dir.join("skip.json")) {
        Value::Object(map) => map
            .into_iter()
            .map(|(id, why)| (id, why.as_str().unwrap_or("skip.json").to_owned()))
            .collect(),
        _ => BTreeMap::new(),
    };

    let mut domain_files: Vec<PathBuf> = fs::read_dir(dir.join("cases"))
        .unwrap_or_else(|e| panic!("cannot list {}/cases: {e}", dir.display()))
        .map(|entry| entry.expect("readable directory entry").path())
        .filter(|p| p.extension().is_some_and(|x| x == "json"))
        .filter(|p| !p.ends_with("index.json") && !p.ends_with("equality.json"))
        .collect();
    domain_files.sort();
    let functions: Vec<Value> = domain_files
        .iter()
        .flat_map(
            |p| match read_json(p).get_mut("functions").map(Value::take) {
                Some(Value::Array(fns)) => fns,
                _ => panic!("{}: no `functions` array", p.display()),
            },
        )
        .collect();

    let mut tests = Vec::new();

    // Registry entries unknown to the suite fail (a typo, or a renamed contract function).
    let known: Vec<&str> = functions.iter().filter_map(|f| f["id"].as_str()).collect();
    let unknown: Vec<String> = registry
        .keys()
        .filter(|id| !known.contains(id))
        .map(|id| id.to_string())
        .collect();
    tests.push(Test {
        name: "registry::ids_are_contract_functions".into(),
        run: Box::new(move || match unknown.is_empty() {
            true => Status::Pass,
            false => Status::Fail(format!("not in the suite: {}", unknown.join(", "))),
        }),
    });

    // The comparison function judges every pair of cases/equality.json like every other lib.
    if let Value::Array(pairs) = read_json(&dir.join("cases").join("equality.json")) {
        for (i, pair) in pairs.into_iter().enumerate() {
            tests.push(Test {
                name: format!(
                    "equality#{i} ({})",
                    field(&pair, "why").as_str().unwrap_or("")
                ),
                run: Box::new(move || {
                    let (expected, actual) = (field(&pair, "expected"), field(&pair, "actual"));
                    let want = field(&pair, "equal").as_bool().unwrap_or(true);
                    match values_equal(expected, actual) == want {
                        true => Status::Pass,
                        false => Status::Fail(format!(
                            "values_equal({expected}, {actual}) should be {want}"
                        )),
                    }
                }),
            });
        }
    }

    for function in functions {
        let id = field(&function, "id")
            .as_str()
            .unwrap_or_default()
            .to_owned();
        let adapter = registry.get(id.as_str()).copied();
        let offline = !field(&function, "network").as_bool().unwrap_or(false) || network;
        let Value::Array(cases) = function["cases"].clone() else {
            continue;
        };
        for case in cases {
            let name = field(&case, "id").as_str().unwrap_or(&id).to_owned();
            let skip = match (&adapter, skips.get(&name)) {
                (None, _) => Some("not implemented".to_owned()),
                _ if !offline => Some("network function (set API_CONTRACT_NETWORK=1)".to_owned()),
                (_, Some(why)) => Some(format!("skip.json: {why}")),
                _ => None,
            };
            let registry = registry.clone();
            tests.push(Test {
                name,
                run: Box::new(move || match (&skip, adapter) {
                    (Some(why), _) => Status::Skip(why.clone()),
                    (None, Some(adapter)) => run_case(&case, adapter, &registry),
                    (None, None) => unreachable!(),
                }),
            });
        }
    }
    tests
}

/// Call the lib, turning a panic into `Threw` (a panicking function "throws").
fn call(adapter: Adapter, args: &[Value]) -> Outcome {
    panic::catch_unwind(AssertUnwindSafe(|| adapter(args))).unwrap_or_else(|payload| {
        let message = payload
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| payload.downcast_ref::<String>().cloned())
            .unwrap_or_default();
        Err(CallError::Threw(format!("panicked: {message}")))
    })
}

fn run_case(case: &Value, adapter: Adapter, registry: &BTreeMap<&str, Adapter>) -> Status {
    let args = match &case["args"] {
        Value::Array(args) => args.clone(),
        _ => Vec::new(),
    };
    let expect = field(case, "expect");
    if let Some(target) = expect.get("satisfies").and_then(Value::as_str) {
        if !registry.contains_key(target) {
            return Status::Skip(format!("{target} is not implemented by this lib"));
        }
    }
    let repeat = case.get("repeat").and_then(Value::as_u64).unwrap_or(1);
    for _ in 0..repeat {
        let outcome = call(adapter, &args);
        if let Err(CallError::BadArgs(why)) = &outcome {
            return Status::Fail(format!(
                "arguments {case_args} not supported: {why}",
                case_args = case["args"]
            ));
        }
        if let Err(message) = check(expect, outcome, registry) {
            return Status::Fail(message);
        }
    }
    Status::Pass
}

/// The expectation of a case (exactly one of `returns`, `throws`, `matches`, `satisfies`).
fn check(
    expect: &Value,
    outcome: Outcome,
    registry: &BTreeMap<&str, Adapter>,
) -> Result<(), String> {
    let shown = |o: &Outcome| match o {
        Ok(v) => v.to_string(),
        Err(e) => e.to_string(),
    };
    if let Some(want) = expect.get("returns") {
        return match &outcome {
            Ok(got) if values_equal(want, got) => Ok(()),
            _ => Err(format!("expected {want}, got {}", shown(&outcome))),
        };
    }
    if expect.get("throws").is_some() {
        return match outcome {
            Err(CallError::Threw(_)) => Ok(()),
            _ => Err(format!("expected an error, got {}", shown(&outcome))),
        };
    }
    if let Some(pattern) = expect.get("matches").and_then(Value::as_str) {
        let re = regex::Regex::new(pattern).map_err(|e| format!("bad pattern /{pattern}/: {e}"))?;
        return match &outcome {
            Ok(Value::String(got)) if re.is_match(got) => Ok(()),
            _ => Err(format!("expected /{pattern}/, got {}", shown(&outcome))),
        };
    }
    if let Some(target) = expect.get("satisfies").and_then(Value::as_str) {
        let value =
            outcome.map_err(|e| format!("expected a value satisfying {target}, got {e}"))?;
        return match call(registry[target], std::slice::from_ref(&value)) {
            Ok(Value::Bool(true)) => Ok(()),
            other => Err(format!(
                "{value} does not satisfy {target} (got {})",
                shown(&other)
            )),
        };
    }
    Err(format!("unknown expectation {expect}"))
}

// ---------------------------------------------------------------------------------------------
// A minimal libtest look-alike.
// ---------------------------------------------------------------------------------------------

fn main() -> ExitCode {
    let mut filters = Vec::new();
    let mut skip_filters = Vec::new();
    let (mut exact, mut list) = (false, false);
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--exact" => exact = true,
            "--list" => list = true,
            "--skip" => skip_filters.extend(args.next()),
            // libtest options taking a value, accepted and ignored.
            "--test-threads" | "--color" | "--format" | "--logfile" | "-Z" => {
                args.next();
            }
            a if a.starts_with('-') => {} // --nocapture, --quiet, --ignored, ...: not meaningful here
            _ => filters.push(arg),
        }
    }
    let matches = |name: &str, f: &String| {
        if exact {
            name == f
        } else {
            name.contains(f.as_str())
        }
    };
    let all = collect_tests();
    let total = all.len();
    let selected: Vec<Test> = all
        .into_iter()
        .filter(|t| filters.is_empty() || filters.iter().any(|f| matches(&t.name, f)))
        .filter(|t| !skip_filters.iter().any(|f| matches(&t.name, f)))
        .collect();
    let filtered_out = total - selected.len();

    if list {
        for t in &selected {
            println!("{}: test", t.name);
        }
        return ExitCode::SUCCESS;
    }

    println!("\nrunning {} tests", selected.len());
    // Silence the default panic message: a panic is reported as the case's result.
    let hook = panic::take_hook();
    panic::set_hook(Box::new(|_| {}));
    let (mut passed, mut ignored, mut failures) = (0, 0, Vec::new());
    for t in &selected {
        match (t.run)() {
            Status::Pass => {
                passed += 1;
                println!("test {} ... ok", t.name);
            }
            Status::Skip(why) => {
                ignored += 1;
                println!("test {} ... ignored, {why}", t.name);
            }
            Status::Fail(why) => {
                println!("test {} ... FAILED", t.name);
                failures.push((t.name.as_str(), why));
            }
        }
    }
    panic::set_hook(hook);

    if !failures.is_empty() {
        println!("\nfailures:\n");
        for (name, why) in &failures {
            println!("---- {name} ----\n{why}\n");
        }
        println!("failures:");
        for (name, _) in &failures {
            println!("    {name}");
        }
    }
    let verdict = if failures.is_empty() { "ok" } else { "FAILED" };
    println!(
        "\ntest result: {verdict}. {passed} passed; {} failed; {ignored} ignored; 0 measured; {filtered_out} filtered out\n",
        failures.len()
    );
    if failures.is_empty() {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}
