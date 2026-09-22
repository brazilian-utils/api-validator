package cpf

import "errors"

// IsValid reports whether cpf is valid.
func IsValid(cpf string) bool { return len(cpf) == 11 }

// Format formats a CPF.
func Format(cpf string) (string, error) {
	if len(cpf) != 11 {
		return "", errors.New("invalid")
	}
	return cpf, nil
}

// Validate is the old name.
//
// Deprecated: use IsValid.
func Validate(cpf string) bool { return IsValid(cpf) }

func Join(sep string, parts ...string) string { return sep }

func Lookup(code int) (*string, bool) { return nil, false }

func private() {}

type T struct{}

func (T) Method() {}
