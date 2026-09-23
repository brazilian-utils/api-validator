<!-- Usage examples for the brazilian-utils docs site: one `## <operation>` section per contract function.
     Sections were scaffolded by `api-validator usage --scaffold` from the shared cases this lib passes; edit them freely. -->

## isValid

```csharp
using BrazilianUtils;

Cpf.IsValid("83159562131");  // true
Cpf.IsValid("83159562132");  // false
Cpf.IsValid("00000000000");  // false
```

## format

```csharp
using BrazilianUtils;

Cpf.Format("83159562131");  // "831.595.621-31"
Cpf.Format("02746891972");  // "027.468.919-72"
Cpf.Format("52708175602");  // "527.081.756-02"
```

## generate

```csharp
using BrazilianUtils;

Cpf.Generate();  // random valid value
```
