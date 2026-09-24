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

# Split JSON args into positional and keyword arguments for `method`: when it takes keyword
# parameters and the last argument is an object with string keys, that object is the keywords.
# Returns nil when the method cannot take such a call (wrong arity, missing required keyword).
def fit_args(method, args)
  params = method.parameters
  kwargs = {}
  if params.any? { |kind, _| %i[key keyreq keyrest].include?(kind) } && args.last.is_a?(Hash) && args.last.keys.all?(String)
    kwargs = args.last.transform_keys(&:to_sym)
    args = args[0...-1]
  end
  req = params.count { |kind, _| kind == :req }
  opt = params.count { |kind, _| kind == :opt }
  rest = params.any? { |kind, _| kind == :rest }
  return nil if args.size < req || (!rest && args.size > req + opt)
  keyreq = params.select { |kind, _| kind == :keyreq }.map(&:last)
  return nil unless (keyreq - kwargs.keys).empty?
  unless params.any? { |kind, _| kind == :keyrest }
    known = params.select { |kind, _| %i[key keyreq].include?(kind) }.map(&:last)
    return nil unless (kwargs.keys - known).empty?
  end
  [args, kwargs]
end

results = input["calls"].map do |call|
  begin
    owner, meth = resolve(roots, call["symbol"])
    method = owner.method(meth)
  rescue StandardError => e
    next { id: call["id"], ok: false, error: "cannot load #{call['symbol']}: #{e.message}", unsupported: true }
  end
  # A call the signature cannot take is "unsupported" (like the typed runners), not a failure.
  fitted = fit_args(method, call["args"])
  unless fitted
    next { id: call["id"], ok: false, error: "cannot call #{call['symbol']} with #{call['args'].size} argument(s) (#{method.parameters.map { |k, n| "#{k} #{n}" }.join(', ')})", unsupported: true }
  end
  args, kwargs = fitted
  begin
    value = kwargs.empty? ? owner.public_send(meth, *args) : owner.public_send(meth, *args, **kwargs)
    { id: call["id"], ok: true, value: ApiValidatorLoader.to_json_value(value) }
  rescue StandardError => e
    { id: call["id"], ok: false, error: "#{e.class}: #{e.message}" }
  end
end
$stdout.write(ApiValidatorLoader::MARK + JSON.generate(results))
