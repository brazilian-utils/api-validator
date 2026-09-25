// Prelude of the generated Rust conformance runner (see runner.ts).
use std::fmt::Write as _;

trait Emit {
    fn emit(&self, out: &mut String);
}

fn esc(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            c if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

impl Emit for str { fn emit(&self, out: &mut String) { esc(self, out) } }
impl Emit for String { fn emit(&self, out: &mut String) { esc(self, out) } }
impl Emit for char { fn emit(&self, out: &mut String) { esc(&self.to_string(), out) } }
impl Emit for bool { fn emit(&self, out: &mut String) { out.push_str(if *self { "true" } else { "false" }) } }
impl Emit for () { fn emit(&self, out: &mut String) { out.push_str("null") } }
macro_rules! num {
    ($($t:ty),*) => { $(impl Emit for $t { fn emit(&self, out: &mut String) { let _ = write!(out, "{}", self); } })* }
}
num!(i8, i16, i32, i64, i128, isize, u8, u16, u32, u64, u128, usize, f32, f64);
impl<T: Emit + ?Sized> Emit for &T { fn emit(&self, out: &mut String) { (**self).emit(out) } }
impl<T: Emit + ?Sized> Emit for Box<T> { fn emit(&self, out: &mut String) { (**self).emit(out) } }
impl<T: Emit> Emit for Option<T> {
    fn emit(&self, out: &mut String) { match self { Some(v) => v.emit(out), None => out.push_str("null") } }
}
impl<T: Emit> Emit for [T] {
    fn emit(&self, out: &mut String) {
        out.push('[');
        for (i, v) in self.iter().enumerate() { if i > 0 { out.push(','); } v.emit(out); }
        out.push(']');
    }
}
impl<T: Emit> Emit for Vec<T> { fn emit(&self, out: &mut String) { self.as_slice().emit(out) } }
impl<A: Emit, B: Emit> Emit for (A, B) {
    fn emit(&self, out: &mut String) { out.push('['); self.0.emit(out); out.push(','); self.1.emit(out); out.push(']'); }
}

trait Outcome { fn record(self, id: &str, out: &mut String); }
impl<T: Emit, E: std::fmt::Debug> Outcome for Result<T, E> {
    fn record(self, id: &str, out: &mut String) {
        out.push_str("{\"id\":");
        esc(id, out);
        match self {
            Ok(v) => { out.push_str(",\"ok\":true,\"value\":"); v.emit(out); }
            Err(e) => { out.push_str(",\"ok\":false,\"error\":"); esc(&format!("{:?}", e), out); }
        }
        out.push('}');
    }
}

fn guard<R: Outcome>(id: &str, out: &mut String, f: impl FnOnce() -> R + std::panic::UnwindSafe) {
    match std::panic::catch_unwind(f) {
        Ok(r) => r.record(id, out),
        Err(p) => {
            let msg = p.downcast_ref::<&str>().map(|s| s.to_string())
                .or_else(|| p.downcast_ref::<String>().cloned()).unwrap_or_default();
            out.push_str("{\"id\":");
            esc(id, out);
            out.push_str(",\"ok\":false,\"error\":");
            esc(&format!("panic: {}", msg), out);
            out.push('}');
        }
    }
}
