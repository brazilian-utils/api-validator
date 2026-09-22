pub fn is_valid(cpf: &str) -> bool { cpf.len() == 11 }

/// Formats.
pub fn format_cpf(cpf: &str) -> Option<String> {
    let brace = '{';
    Some(cpf.to_string())
}

#[deprecated(note = "use is_valid")]
pub fn validate(cpf: &str) -> bool { is_valid(cpf) }

pub(crate) fn internal() {}
fn private() {}

pub mod nested {
    pub fn deep(x: i32) -> i32 { x }
}
