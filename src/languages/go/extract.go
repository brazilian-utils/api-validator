// Extract the public API of a Go module with go/parser (stdlib only).
// usage: go run extract.go <repo_root>
// Prints "\x00JSON\x00" followed by {"symbols": [...], "warnings": [...]}.
package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type param struct {
	Name     string `json:"name"`
	Type     string `json:"type,omitempty"`
	Optional bool   `json:"optional,omitempty"`
	Rest     bool   `json:"rest,omitempty"`
}

type location struct {
	File string `json:"file"`
	Line int    `json:"line"`
}

type symbol struct {
	Name       string         `json:"name"`
	Params     []param        `json:"params"`
	Returns    string         `json:"returns,omitempty"`
	Deprecated bool           `json:"deprecated,omitempty"`
	Location   location       `json:"location"`
	Meta       map[string]any `json:"meta"`
}

func exprString(fset *token.FileSet, src []byte, e ast.Expr) string {
	return string(src[fset.Position(e.Pos()).Offset:fset.Position(e.End()).Offset])
}

func modulePath(root string) string {
	f, err := os.Open(filepath.Join(root, "go.mod"))
	if err != nil {
		return ""
	}
	defer f.Close()
	s := bufio.NewScanner(f)
	for s.Scan() {
		line := strings.TrimSpace(s.Text())
		if strings.HasPrefix(line, "module ") {
			return strings.Trim(strings.TrimSpace(strings.TrimPrefix(line, "module ")), `"`)
		}
	}
	return ""
}

func main() {
	root, _ := filepath.Abs(os.Args[1])
	mod := modulePath(root)
	var symbols []symbol
	var warnings []string
	if mod == "" {
		warnings = append(warnings, "go.mod not found: import paths will be wrong")
	}

	filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		name := d.Name()
		if d.IsDir() {
			if path != root && (strings.HasPrefix(name, ".") || strings.HasPrefix(name, "_") || name == "testdata" || name == "vendor" || name == "internal" || name == "examples" || name == "example") {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			return nil
		}
		src, err := os.ReadFile(path)
		if err != nil {
			return nil
		}
		fset := token.NewFileSet()
		file, err := parser.ParseFile(fset, path, src, parser.ParseComments)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("%s: %v", path, err))
			return nil
		}
		if file.Name.Name == "main" {
			return nil
		}
		relDir, _ := filepath.Rel(root, filepath.Dir(path))
		relFile, _ := filepath.Rel(root, path)
		importPath := mod
		prefix := ""
		if relDir != "." {
			importPath = mod + "/" + filepath.ToSlash(relDir)
			prefix = strings.ReplaceAll(filepath.ToSlash(relDir), "/", ".") + "."
		}
		for _, decl := range file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Recv != nil || !fn.Name.IsExported() {
				continue
			}
			params := []param{}
			paramTypes := []string{}
			for i, f := range fn.Type.Params.List {
				typ := exprString(fset, src, f.Type)
				rest := false
				if el, ok := f.Type.(*ast.Ellipsis); ok {
					rest = true
					typ = "..." + exprString(fset, src, el.Elt)
				}
				names := f.Names
				if len(names) == 0 {
					names = []*ast.Ident{{Name: fmt.Sprintf("arg%d", i)}}
				}
				for _, n := range names {
					params = append(params, param{Name: n.Name, Type: strings.TrimPrefix(typ, "..."), Optional: rest, Rest: rest})
					paramTypes = append(paramTypes, typ)
				}
			}
			results := []string{}
			if fn.Type.Results != nil {
				for _, f := range fn.Type.Results.List {
					typ := exprString(fset, src, f.Type)
					n := len(f.Names)
					if n == 0 {
						n = 1
					}
					for i := 0; i < n; i++ {
						results = append(results, typ)
					}
				}
			}
			returns := strings.Join(results, ", ")
			if len(results) > 1 {
				returns = "(" + returns + ")"
			}
			deprecated := fn.Doc != nil && strings.Contains(fn.Doc.Text(), "Deprecated:")
			symbols = append(symbols, symbol{
				Name:       prefix + fn.Name.Name,
				Params:     params,
				Returns:    returns,
				Deprecated: deprecated,
				Location:   location{File: filepath.ToSlash(relFile), Line: fset.Position(fn.Pos()).Line},
				Meta: map[string]any{
					"importPath": importPath,
					"package":    file.Name.Name,
					"func":       fn.Name.Name,
					"paramTypes": paramTypes,
					"results":    results,
				},
			})
		}
		return nil
	})
	sort.Slice(symbols, func(i, j int) bool { return symbols[i].Name < symbols[j].Name })
	if symbols == nil {
		symbols = []symbol{}
	}
	if warnings == nil {
		warnings = []string{}
	}
	out, _ := json.Marshal(map[string]any{"symbols": symbols, "warnings": warnings})
	os.Stdout.WriteString("\x00JSON\x00")
	os.Stdout.Write(out)
}
