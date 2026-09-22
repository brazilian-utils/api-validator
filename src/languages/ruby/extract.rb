# Extract the public API of a Ruby lib by loading it and reflecting on its modules.
# usage: ruby extract.rb <repo_root> <entry> [namespace]
require_relative "loader"

root, entry, namespace = ARGV
roots, warnings = ApiValidatorLoader.load(root, entry, namespace)
strip_root = roots.size == 1

def yard_for(file, line)
  return [{}, nil, false] unless file && File.exist?(file)
  lines = File.readlines(file)
  i = line - 2
  comment = []
  while i >= 0 && lines[i] =~ /^\s*#/
    comment.unshift(lines[i].sub(/^\s*#\s?/, ""))
    i -= 1
  end
  text = comment.join
  params = {}
  text.scan(/@param\s+\[?(\w+)\]?\s+\[([^\]]+)\]/) { |n, t| params[n] = t }
  text.scan(/@param\s+\[([^\]]+)\]\s+(\w+)/) { |t, n| params[n] ||= t }
  ret = text[/@return\s+\[([^\]]+)\]/, 1]
  deprecated = text.include?("@deprecated") || text =~ /@note.*(backward compatibility|should not be used)/m ? true : false
  [params, ret, deprecated]
end

def yard_type(t)
  t&.split(/\s*,\s*/)&.join(" | ")
end

MODULE_NAME = Module.instance_method(:name)
def mod_name(m) = MODULE_NAME.bind_call(m)

symbols = []
seen = {}
walk = lambda do |mod, prefix|
  return if seen[mod]
  seen[mod] = true
  return if mod.is_a?(Class) && mod <= Exception

  names = mod.singleton_methods(false)
  names += mod.public_instance_methods(false) if !mod.is_a?(Class) && mod.singleton_class.include?(mod) # extend self
  names.uniq.sort.each do |m|
    meth = mod.method(m)
    file, line = meth.source_location
    next unless file # C methods
    params, ret, deprecated = yard_for(file, line)
    symbols << {
      name: [prefix, m.to_s].reject(&:empty?).join("."),
      params: meth.parameters.reject { |kind, _| kind == :block }.each_with_index.map { |(kind, name), i|
        n = (name || "arg#{i}").to_s
        {
          name: n,
          type: yard_type(params[n]),
          optional: %i[opt rest key keyrest].include?(kind) || nil,
          rest: %i[rest keyrest].include?(kind) || nil,
          keyword: %i[key keyreq keyrest].include?(kind) || nil
        }.compact
      },
      returns: yard_type(ret),
      deprecated: deprecated || nil,
      location: { file: file.sub(%r{^#{Regexp.escape(File.expand_path(root))}/}, ""), line: line }
    }.compact
  end

  mod.constants(false).sort.each do |c|
    child = begin
      mod.const_get(c, false)
    rescue StandardError, LoadError
      nil
    end
    next unless child.is_a?(Module) && mod_name(child)&.start_with?("#{mod_name(mod)}::")
    walk.call(child, [prefix, c.to_s].reject(&:empty?).join("."))
  end
end

roots.each { |r| walk.call(r, strip_root ? "" : mod_name(r)) }
$stdout.write(ApiValidatorLoader::MARK + JSON.generate({ symbols: symbols, warnings: warnings }))
