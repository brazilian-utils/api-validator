# Extract the public API of a Ruby lib by loading it and reflecting on its modules.
# usage: ruby extract.rb <repo_root> <entry> [namespace]
require_relative "loader"

root, entry, namespace = ARGV
roots, warnings = ApiValidatorLoader.load(root, entry, namespace)
strip_root = roots.size == 1

# Types and deprecations come from YARD (https://yardoc.org), parsed by YARD itself.
yard_lib = Dir[File.join(ENV.fetch("API_VALIDATOR_YARD", ""), "gems", "yard-*", "lib")].first
$LOAD_PATH.unshift(yard_lib) if yard_lib
require "yard"
YARD::Registry.clear
lib_dir = File.expand_path(entry, root)
YARD.parse(File.directory?(lib_dir) ? Dir[File.join(lib_dir, "**", "*.rb")] : [lib_dir], [], YARD::Logger::ERROR)

def yard_for(owner_name, meth)
  obj = YARD::Registry.at("#{owner_name}.#{meth}") || YARD::Registry.at("#{owner_name}##{meth}")
  return [{}, nil, false] unless obj
  params = obj.tags(:param).to_h { |t| [t.name.to_s, t.types] }
  ret = obj.tag(:return)&.types
  [params, ret, obj.has_tag?(:deprecated)]
end

def yard_type(types)
  types && !types.empty? ? types.join(" | ") : nil
end

# YARD type -> the shared structured type tree (src/core/model.ts), via YARD's own parser.
def type_node(t)
  case t
  when YARD::Tags::TypesExplainer::HashCollectionType
    { kind: "name", name: t.name, args: [union_node(t.key_types), union_node(t.value_types)] }
  when YARD::Tags::TypesExplainer::CollectionType # includes FixedCollectionType
    { kind: "name", name: t.name, args: t.types.map { |x| type_node(x) } }
  else
    { kind: "name", name: t.name }
  end
end

def union_node(types)
  nodes = types.map { |t| type_node(t) }
  nodes.size == 1 ? nodes.first : { kind: "union", of: nodes }
end

def yard_node(types)
  return nil if types.nil? || types.empty?
  union_node(types.flat_map { |t| YARD::Tags::TypesExplainer::Parser.parse(t) })
rescue SyntaxError, StandardError
  { kind: "unknown", text: types.join(", ") }
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
    params, ret, deprecated = yard_for(mod_name(mod), m)
    symbols << {
      name: [prefix, m.to_s].reject(&:empty?).join("."),
      params: meth.parameters.reject { |kind, _| kind == :block }.each_with_index.map { |(kind, name), i|
        n = (name || "arg#{i}").to_s
        {
          name: n,
          type: yard_type(params[n]),
          typeNode: yard_node(params[n]),
          optional: %i[opt rest key keyrest].include?(kind) || nil,
          rest: %i[rest keyrest].include?(kind) || nil,
          keyword: %i[key keyreq keyrest].include?(kind) || nil
        }.compact
      },
      returns: yard_type(ret),
      returnsNode: yard_node(ret),
      deprecated: deprecated || nil,
      # `alias_method :valid?, :is_valid` (or `alias`): the same definition under another name.
      aliasOf: meth.original_name == m ? nil : [prefix, meth.original_name.to_s].reject(&:empty?).join("."),
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
