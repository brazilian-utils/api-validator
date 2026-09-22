// Public API of a Go module, type-checked with golang.org/x/tools/go/packages and go/types
// (the same foundation as golang.org/x/exp/apidiff). Packages are loaded with the default
// build context, so build constraints are honoured.
//
// usage: go run . <repo_root>     (from this directory)
// Prints "\x00JSON\x00" followed by {"symbols": [...], "warnings": [...]}.
package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/types"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"golang.org/x/tools/go/packages"
)

type param struct {
	Name     string `json:"name"`
	Type     string `json:"type,omitempty"`
	TypeNode tnode  `json:"typeNode,omitempty"`
	Optional bool   `json:"optional,omitempty"`
	Rest     bool   `json:"rest,omitempty"`
}

// tnode is the structured type tree shared by every adapter (src/core/model.ts TypeNode).
type tnode map[string]any

// typeNode converts a go/types type into the shared tree.
func typeNode(t types.Type, self *types.Package) tnode {
	switch t := t.(type) {
	case *types.Alias:
		return typeNode(types.Unalias(t), self)
	case *types.Basic:
		return tnode{"kind": "name", "name": t.Name()}
	case *types.Pointer:
		return tnode{"kind": "ref", "op": "*", "of": typeNode(t.Elem(), self)}
	case *types.Slice:
		return tnode{"kind": "list", "of": typeNode(t.Elem(), self)}
	case *types.Array:
		return tnode{"kind": "list", "of": typeNode(t.Elem(), self)}
	case *types.Map:
		return tnode{"kind": "name", "name": "map", "args": []tnode{typeNode(t.Key(), self), typeNode(t.Elem(), self)}}
	case *types.Named:
		obj := t.Obj()
		n := tnode{"kind": "name", "name": obj.Name()}
		if obj.Pkg() != nil {
			n["pkg"] = obj.Pkg().Path()
			if obj.Pkg() != self {
				n["name"] = obj.Pkg().Name() + "." + obj.Name()
			}
		}
		if args := t.TypeArgs(); args != nil && args.Len() > 0 {
			list := []tnode{}
			for i := 0; i < args.Len(); i++ {
				list = append(list, typeNode(args.At(i), self))
			}
			n["args"] = list
		}
		return n
	case *types.Interface:
		if t.Empty() {
			return tnode{"kind": "name", "name": "any"}
		}
		return tnode{"kind": "unknown", "text": t.String()}
	case *types.Signature:
		return tnode{"kind": "function"}
	case *types.Struct:
		return tnode{"kind": "object"}
	default:
		return tnode{"kind": "unknown", "text": t.String()}
	}
}

type location struct {
	File string `json:"file"`
	Line int    `json:"line"`
}

type symbol struct {
	Name        string         `json:"name"`
	Params      []param        `json:"params"`
	Returns     string         `json:"returns,omitempty"`
	ReturnsNode tnode          `json:"returnsNode,omitempty"`
	Deprecated  bool           `json:"deprecated,omitempty"`
	Location    location       `json:"location"`
	Meta        map[string]any `json:"meta"`
}

func main() {
	root, _ := filepath.Abs(os.Args[1])
	cfg := &packages.Config{
		Mode: packages.NeedName | packages.NeedTypes | packages.NeedSyntax | packages.NeedFiles | packages.NeedModule,
		Dir:  root,
	}
	pkgs, err := packages.Load(cfg, "./...")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	symbols := []symbol{}
	warnings := []string{}
	for _, pkg := range pkgs {
		for _, e := range pkg.Errors {
			warnings = append(warnings, e.Error())
		}
		if pkg.Types == nil || pkg.Name == "main" || isInternal(pkg.PkgPath) {
			continue
		}
		modPath := ""
		if pkg.Module != nil {
			modPath = pkg.Module.Path
		}
		rel := strings.TrimPrefix(strings.TrimPrefix(pkg.PkgPath, modPath), "/")
		prefix := ""
		if rel != "" {
			prefix = strings.ReplaceAll(rel, "/", ".") + "."
		}
		docs := funcDocs(pkg.Syntax)
		// Types from other packages are written with their package name (time.Time); types of
		// this package unqualified (Address), as a Go user of the package would read them.
		qualifier := func(p *types.Package) string {
			if p == pkg.Types {
				return ""
			}
			return p.Name()
		}
		scope := pkg.Types.Scope()
		for _, name := range scope.Names() {
			fn, ok := scope.Lookup(name).(*types.Func)
			if !ok || !fn.Exported() {
				continue
			}
			sig := fn.Type().(*types.Signature)
			var params []param
			for i := 0; i < sig.Params().Len(); i++ {
				v := sig.Params().At(i)
				vt := v.Type()
				rest := sig.Variadic() && i == sig.Params().Len()-1
				if rest {
					vt = vt.(*types.Slice).Elem() // ...T: each argument is a T
				}
				pname := v.Name()
				if pname == "" || pname == "_" {
					pname = fmt.Sprintf("arg%d", i)
				}
				params = append(params, param{Name: pname, Type: types.TypeString(vt, qualifier), TypeNode: typeNode(vt, pkg.Types), Optional: rest, Rest: rest})
			}
			if params == nil {
				params = []param{}
			}
			results := []string{}
			resultNodes := []tnode{}
			for i := 0; i < sig.Results().Len(); i++ {
				results = append(results, types.TypeString(sig.Results().At(i).Type(), qualifier))
				resultNodes = append(resultNodes, typeNode(sig.Results().At(i).Type(), pkg.Types))
			}
			returns := strings.Join(results, ", ")
			var returnsNode tnode
			if len(results) > 1 {
				returns = "(" + returns + ")"
				returnsNode = tnode{"kind": "tuple", "of": resultNodes}
			} else if len(results) == 1 {
				returnsNode = resultNodes[0]
			}
			pos := pkg.Fset.Position(fn.Pos())
			file, _ := filepath.Rel(root, pos.Filename)
			symbols = append(symbols, symbol{
				Name:        prefix + name,
				Params:      params,
				Returns:     returns,
				ReturnsNode: returnsNode,
				Deprecated:  isDeprecated(docs[name]),
				Location:    location{File: filepath.ToSlash(file), Line: pos.Line},
				Meta: map[string]any{
					"importPath": pkg.PkgPath,
					"package":    pkg.Name,
					"func":       name,
				},
			})
		}
	}
	sort.Slice(symbols, func(i, j int) bool { return symbols[i].Name < symbols[j].Name })
	out, _ := json.Marshal(map[string]any{"symbols": symbols, "warnings": warnings})
	os.Stdout.WriteString("\x00JSON\x00")
	os.Stdout.Write(out)
}

func isInternal(path string) bool {
	for _, part := range strings.Split(path, "/") {
		if part == "internal" {
			return true
		}
	}
	return false
}

// funcDocs maps top-level function names to their doc comments.
func funcDocs(files []*ast.File) map[string]*ast.CommentGroup {
	docs := map[string]*ast.CommentGroup{}
	for _, f := range files {
		for _, d := range f.Decls {
			if fd, ok := d.(*ast.FuncDecl); ok && fd.Recv == nil {
				docs[fd.Name.Name] = fd.Doc
			}
		}
	}
	return docs
}

// isDeprecated follows the Go convention: a paragraph starting with "Deprecated: ".
func isDeprecated(doc *ast.CommentGroup) bool {
	if doc == nil {
		return false
	}
	for _, para := range strings.Split(doc.Text(), "\n\n") {
		if strings.HasPrefix(strings.TrimSpace(para), "Deprecated: ") {
			return true
		}
	}
	return false
}
