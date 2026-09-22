//! Fixture crate. `pub fn fake()` in a comment must be ignored.
pub mod cpf;
mod private_mod;
pub(crate) mod crate_only;

pub use private_mod::reexported as renamed;
pub use crate::cpf::{is_valid as is_valid_cpf, format_cpf};

pub fn root_fn<'a, T: AsRef<str>>(value: &'a str, count: Option<u8>) -> Result<Vec<String>, String> where T: Clone {
    let _s = "pub fn in_string() {}";
    Ok(vec![])
}

#[cfg(test)]
mod tests {
    pub fn test_only() {}
}
