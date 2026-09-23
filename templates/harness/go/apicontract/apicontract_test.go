// Package apicontract_test runs the brazilian-utils API contract suite (vendored in
// ../api-contract, see its README.md) against this library.
//
// The registry below states which function of this library implements each contract
// function. Adding a function to the library = implementing it + one registry line.
//
//	go test ./apicontract/                          # run the suite
//	go test ./apicontract/ -v -run 'TestContract/cpf.isValid'
//	API_CONTRACT_NETWORK=1 go test ./apicontract/   # also run network functions
//	API_CONTRACT_NO_SKIP=1 go test ./apicontract/   # ignore skip.json (see what is fixed)
package apicontract_test

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"testing"

	"github.com/brazilian-utils/go/boleto"
	"github.com/brazilian-utils/go/cep"
	"github.com/brazilian-utils/go/cnh"
	"github.com/brazilian-utils/go/cnpj"
	"github.com/brazilian-utils/go/cpf"
	"github.com/brazilian-utils/go/currency"
	"github.com/brazilian-utils/go/date"
	"github.com/brazilian-utils/go/email"
	"github.com/brazilian-utils/go/legalnature"
	"github.com/brazilian-utils/go/legalprocess"
	"github.com/brazilian-utils/go/licenseplate"
	"github.com/brazilian-utils/go/phone"
	"github.com/brazilian-utils/go/pis"
	"github.com/brazilian-utils/go/renavam"
	"github.com/brazilian-utils/go/voterid"
)

// impl calls a library function with a case's JSON args and returns its result.
// A non-nil error means the call failed (what `throws: true` expects).
type impl func(args []any) (any, error)

// registry maps contract function ids to this library's implementation.
var registry = map[string]impl{
	// boleto
	"boleto.isValid": func(a []any) (any, error) { return boleto.IsValid(str(a, 0)), nil },

	// cep
	"cep.format":         func(a []any) (any, error) { return cep.Format(str(a, 0)), nil },
	"cep.generate":       func(a []any) (any, error) { return cep.Generate(), nil },
	"cep.getAddressInfo": func(a []any) (any, error) { return cep.GetAddressFromCEP(str(a, 0)) },
	"cep.isValid":        func(a []any) (any, error) { return cep.IsValid(str(a, 0)), nil },

	// cnh
	"cnh.isValid": func(a []any) (any, error) { return cnh.IsValid(str(a, 0)), nil },

	// cnpj
	"cnpj.format": func(a []any) (any, error) { return cnpj.Format(str(a, 0)), nil },
	// The contract's optional argument is a version; Go takes a branch number (0 = default).
	"cnpj.generate": func(a []any) (any, error) { return cnpj.Generate(0), nil },
	"cnpj.isValid":  func(a []any) (any, error) { return cnpj.IsValid(str(a, 0)), nil },

	// cpf
	"cpf.format":   func(a []any) (any, error) { return cpf.Format(str(a, 0)), nil },
	"cpf.generate": func(a []any) (any, error) { return cpf.Generate(), nil },
	"cpf.isValid":  func(a []any) (any, error) { return cpf.IsValid(str(a, 0)), nil },

	// currency
	"currency.convertToWords": func(a []any) (any, error) { return currency.ConvertRealToText(num(a, 0)), nil },
	"currency.format":         func(a []any) (any, error) { return currency.FormatCurrency(num(a, 0)), nil },

	// date
	"date.convertToWords": func(a []any) (any, error) { return date.ConvertDateToText(str(a, 0)), nil },

	// email
	"email.isValid": func(a []any) (any, error) { return email.IsValid(str(a, 0)), nil },

	// legalNature
	"legalNature.getDescription": func(a []any) (any, error) { return legalnature.GetDescription(str(a, 0)), nil },
	"legalNature.isValid":        func(a []any) (any, error) { return legalnature.IsValid(str(a, 0)), nil },
	"legalNature.list":           func(a []any) (any, error) { return legalnature.ListAll(), nil },

	// legalProcess
	"legalProcess.format":  func(a []any) (any, error) { return legalprocess.Format(str(a, 0)), nil },
	"legalProcess.isValid": func(a []any) (any, error) { return legalprocess.IsValid(str(a, 0)), nil },

	// licensePlate
	"licensePlate.convertToMercosul": func(a []any) (any, error) { return licenseplate.ConvertToMercosul(str(a, 0)), nil },
	"licensePlate.format":            func(a []any) (any, error) { return licenseplate.Format(str(a, 0)), nil },
	// Go requires the format; the contract's default is a Mercosul plate.
	"licensePlate.generate":  func(a []any) (any, error) { return licenseplate.Generate(optStr(a, 0, "LLLNLNN")), nil },
	"licensePlate.getFormat": func(a []any) (any, error) { return licenseplate.GetFormat(str(a, 0)), nil },

	// phone
	"phone.format": func(a []any) (any, error) { return phone.Format(str(a, 0)), nil },
	// Go requires the type; "" means mobile or landline at random.
	"phone.generate":                       func(a []any) (any, error) { return phone.Generate(optStr(a, 0, "")), nil },
	"phone.removeInternationalDialingCode": func(a []any) (any, error) { return phone.RemoveInternationalDialingCode(str(a, 0)), nil },
	"phone.removeSymbols":                  func(a []any) (any, error) { return phone.RemoveSymbols(str(a, 0)), nil },

	// pis
	"pis.format":   func(a []any) (any, error) { return pis.Format(str(a, 0)), nil },
	"pis.generate": func(a []any) (any, error) { return pis.Generate(), nil },
	"pis.isValid":  func(a []any) (any, error) { return pis.IsValid(str(a, 0)), nil },

	// renavam
	"renavam.isValid": func(a []any) (any, error) { return renavam.IsValid(str(a, 0)), nil },

	// voterId
	"voterId.format":   func(a []any) (any, error) { return voterid.Format(str(a, 0)), nil },
	"voterId.generate": func(a []any) (any, error) { return voterid.Generate(strs(a)...), nil },
	"voterId.isValid":  func(a []any) (any, error) { return voterid.IsValid(str(a, 0)), nil },
}

// ---- argument helpers: a JSON arg of the wrong type is a harness error, not a throw ----

type argError string

func str(a []any, i int) string {
	if i < len(a) {
		if s, ok := a[i].(string); ok {
			return s
		}
		panic(argError(fmt.Sprintf("argument %d: want a string, got %#v", i+1, a[i])))
	}
	panic(argError(fmt.Sprintf("argument %d is missing", i+1)))
}

func optStr(a []any, i int, def string) string {
	if i >= len(a) || a[i] == nil {
		return def
	}
	return str(a, i)
}

func strs(a []any) []string {
	out := make([]string, len(a))
	for i := range a {
		out[i] = str(a, i)
	}
	return out
}

func num(a []any, i int) float64 {
	if i < len(a) {
		if n, ok := a[i].(float64); ok {
			return n
		}
		panic(argError(fmt.Sprintf("argument %d: want a number, got %#v", i+1, a[i])))
	}
	panic(argError(fmt.Sprintf("argument %d is missing", i+1)))
}

// ---- suite format ----

type expect struct {
	Returns   json.RawMessage `json:"returns"` // present-but-null is kept as "null"
	Throws    bool            `json:"throws"`
	Matches   *string         `json:"matches"`
	Satisfies *string         `json:"satisfies"`
}

type testCase struct {
	ID     string `json:"id"`
	Args   []any  `json:"args"`
	Expect expect `json:"expect"`
	Repeat int    `json:"repeat"`
}

type function struct {
	ID      string     `json:"id"`
	Network bool       `json:"network"`
	Cases   []testCase `json:"cases"`
}

type domainFile struct {
	Domain    string     `json:"domain"`
	Functions []function `json:"functions"`
}

// contractDir finds api-contract/ from this file's location, whatever the working directory.
func contractDir(t *testing.T) string {
	t.Helper()
	var starts []string
	if _, file, _, ok := runtime.Caller(0); ok {
		starts = append(starts, filepath.Dir(file))
	}
	if wd, err := os.Getwd(); err == nil {
		starts = append(starts, wd)
	}
	for _, dir := range starts {
		for {
			candidate := filepath.Join(dir, "api-contract")
			if _, err := os.Stat(filepath.Join(candidate, "cases", "index.json")); err == nil {
				return candidate
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}
	t.Fatal("api-contract/cases/index.json not found above " + strings.Join(starts, ", "))
	return ""
}

func readJSON(t *testing.T, path string, v any) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(data, v); err != nil {
		t.Fatalf("%s: %v", path, err)
	}
}

func loadSuite(t *testing.T) (functions []function, skips map[string]string) {
	t.Helper()
	dir := contractDir(t)
	files, err := filepath.Glob(filepath.Join(dir, "cases", "*.json"))
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(files)
	for _, f := range files {
		if base := filepath.Base(f); base == "index.json" || base == "equality.json" {
			continue
		}
		var d domainFile
		readJSON(t, f, &d)
		functions = append(functions, d.Functions...)
	}
	skips = map[string]string{}
	readJSON(t, filepath.Join(dir, "skip.json"), &skips)
	return functions, skips
}

// ---- calling and comparing ----

// call runs a registry entry and returns the result in its JSON form. A panic in the
// library counts as a failed call; a panic from an argument helper is reported as badArgs.
func call(fn impl, args []any) (result any, badArgs string, callErr error) {
	defer func() {
		if r := recover(); r != nil {
			if ae, ok := r.(argError); ok {
				badArgs = string(ae)
				return
			}
			callErr = fmt.Errorf("panic: %v", r)
		}
	}()
	v, err := fn(args)
	if err != nil {
		return nil, "", err
	}
	return jsonForm(v), "", nil
}

// jsonForm turns a Go value into what encoding/json would decode from its JSON encoding
// (nil, bool, float64, string, []any, map[string]any).
func jsonForm(v any) any {
	data, err := json.Marshal(v)
	if err != nil {
		panic(fmt.Sprintf("result %#v is not JSON-serializable: %v", v, err))
	}
	var out any
	if err := json.Unmarshal(data, &out); err != nil {
		panic(err)
	}
	return out
}

var nonAlnum = regexp.MustCompile(`[^a-z0-9]`)

func normKey(k string) string { return nonAlnum.ReplaceAllString(strings.ToLower(k), "") }

// equal implements the suite's comparison rules (cases/index.json -> comparison) on JSON forms.
func equal(expected, actual any) bool {
	switch e := expected.(type) {
	case nil:
		return actual == nil
	case bool:
		a, ok := actual.(bool)
		return ok && a == e
	case float64:
		a, ok := actual.(float64)
		return ok && math.Abs(a-e) <= 1e-9*math.Max(1, math.Abs(e))
	case string:
		a, ok := actual.(string)
		return ok && a == e
	case []any:
		a, ok := actual.([]any)
		if !ok || len(a) != len(e) {
			return false
		}
		for i := range e {
			if !equal(e[i], a[i]) {
				return false
			}
		}
		return true
	case map[string]any:
		a, ok := actual.(map[string]any)
		if !ok {
			return false
		}
		en, an := map[string]any{}, map[string]any{}
		for k, v := range e {
			en[normKey(k)] = v
		}
		for k, v := range a {
			an[normKey(k)] = v
		}
		for k := range an {
			if _, seen := en[k]; !seen {
				en[k] = nil // absent == null
			}
		}
		for k, v := range en {
			if !equal(v, an[k]) { // a missing key reads as nil
				return false
			}
		}
		return true
	}
	return false
}

func show(v any) string {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%#v", v)
	}
	return string(data)
}

// check runs one case once and returns why it failed ("" when it passed).
func check(t *testing.T, fn impl, c testCase) string {
	result, badArgs, callErr := call(fn, c.Args)
	if badArgs != "" {
		return "registry cannot pass these args: " + badArgs
	}
	ex := c.Expect
	switch {
	case ex.Throws:
		if callErr == nil {
			return "expected an error, got " + show(result)
		}
	case callErr != nil:
		return "unexpected error: " + callErr.Error()
	case ex.Returns != nil:
		var want any
		if err := json.Unmarshal(ex.Returns, &want); err != nil {
			t.Fatal(err)
		}
		if !equal(want, result) {
			return fmt.Sprintf("expected %s, got %s", show(want), show(result))
		}
	case ex.Matches != nil:
		s, ok := result.(string)
		if !ok || !regexp.MustCompile(*ex.Matches).MatchString(s) {
			return fmt.Sprintf("expected a string matching /%s/, got %s", *ex.Matches, show(result))
		}
	case ex.Satisfies != nil:
		ok, bad, err := call(registry[*ex.Satisfies], []any{result})
		if bad != "" || err != nil || ok != true {
			return fmt.Sprintf("%s(%s) is not true", *ex.Satisfies, show(result))
		}
	default:
		t.Fatalf("case %s has no expectation", c.ID)
	}
	return ""
}

// ---- tests ----

func TestContract(t *testing.T) {
	functions, skips := loadSuite(t)
	network := os.Getenv("API_CONTRACT_NETWORK") == "1"
	noSkip := os.Getenv("API_CONTRACT_NO_SKIP") == "1"
	for _, f := range functions {
		fn, implemented := registry[f.ID]
		for _, c := range f.Cases {
			t.Run(c.ID, func(t *testing.T) {
				switch {
				case !implemented:
					t.Skip("not implemented")
				case f.Network && !network:
					t.Skip("network (set API_CONTRACT_NETWORK=1)")
				case skips[c.ID] != "" && !noSkip:
					t.Skip(skips[c.ID])
				case c.Expect.Satisfies != nil && registry[*c.Expect.Satisfies] == nil:
					t.Skip(*c.Expect.Satisfies + " not implemented")
				}
				for i := 0; i < max(c.Repeat, 1); i++ {
					if why := check(t, fn, c); why != "" {
						t.Fatalf("run %d: %s", i+1, why)
					}
				}
			})
		}
	}
}

// TestRegistryIDsExist fails on registry entries the suite does not know (typo or rename).
func TestRegistryIDsExist(t *testing.T) {
	functions, _ := loadSuite(t)
	known := map[string]bool{}
	for _, f := range functions {
		known[f.ID] = true
	}
	for id := range registry {
		if !known[id] {
			t.Errorf("registry entry %q is not a contract function", id)
		}
	}
}

// TestEquality proves equal() compares like every other lib's harness.
func TestEquality(t *testing.T) {
	var pairs []struct {
		Expected any    `json:"expected"`
		Actual   any    `json:"actual"`
		Equal    bool   `json:"equal"`
		Why      string `json:"why"`
	}
	readJSON(t, filepath.Join(contractDir(t), "cases", "equality.json"), &pairs)
	if len(pairs) == 0 {
		t.Fatal("equality.json has no pairs")
	}
	for _, p := range pairs {
		if got := equal(p.Expected, p.Actual); got != p.Equal {
			t.Errorf("%s: equal(%s, %s) = %v, want %v", p.Why, show(p.Expected), show(p.Actual), got, p.Equal)
		}
	}
}
