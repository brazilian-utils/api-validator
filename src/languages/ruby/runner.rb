# Conformance runner for Ruby libs. Protocol: src/languages/shared/process-runner.ts
# usage: ruby runner.rb <repo_root> <entry> [namespace]   (calls JSON on stdin)
require_relative "loader"

root, entry, namespace = ARGV
input = JSON.parse($stdin.read)
roots, _warnings = ApiValidatorLoader.load(root, entry, namespace)

def resolve(roots, symbol)
  *path, meth = symbol.split(".")
  base = roots.size == 1 ? roots.first : Object
  owner = path.reduce(base) { |m, c| m.const_get(c, false) }
  [owner, meth]
end

results = input["calls"].map do |call|
  begin
    owner, meth = resolve(roots, call["symbol"])
  rescue StandardError => e
    next { id: call["id"], ok: false, error: "cannot load #{call['symbol']}: #{e.message}", unsupported: true }
  end
  begin
    { id: call["id"], ok: true, value: ApiValidatorLoader.to_json_value(owner.public_send(meth, *call["args"])) }
  rescue StandardError => e
    { id: call["id"], ok: false, error: "#{e.class}: #{e.message}" }
  end
end
$stdout.write(ApiValidatorLoader::MARK + JSON.generate(results))
