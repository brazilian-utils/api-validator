namespace Lib {
  public static class Cnpj {
    /* public static bool Commented(string s) */
    public static bool IsValid(string cnpj) => cnpj.Length == 14;
    public static string? Format(string cnpj, bool pad = false) { var s = "{"; return cnpj; }
    [Obsolete("x")] public static bool Validate(string cnpj) => IsValid(cnpj);
    private static bool Hidden(string x) => true;
    public static string Generate(params int[] parts) => "";
  }
}
