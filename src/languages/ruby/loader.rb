# Shared by extract.rb and runner.rb: loads a Ruby lib and finds its root namespaces.
require "json"
Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

module ApiValidatorLoader
  MARK = "\0JSON\0"

  # Loads `entry` (a file, or every .rb under a dir) and returns the new top-level modules.
  def self.load(root, entry, namespace = nil)
    before = Object.constants
    path = File.expand_path(entry, root)
    lib_dir = File.directory?(path) ? path : File.dirname(path)
    $LOAD_PATH.unshift(lib_dir)
    $LOAD_PATH.unshift(File.join(root, "lib")) if File.directory?(File.join(root, "lib"))
    files = File.directory?(path) ? Dir[File.join(path, "**", "*.rb")].sort : [path]
    pending = files
    errors = {}
    # Files may depend on each other without requiring each other: retry until no progress.
    loop do
      failed = []
      pending.each do |f|
        begin
          require f
        rescue ScriptError, StandardError => e
          failed << f
          errors[f] = "#{e.class}: #{e.message}"
        end
      end
      break if failed.empty? || failed.size == pending.size
      pending = failed
    end
    warnings = pending.size == files.size && !files.empty? ? errors.values : errors.select { |f, _| pending.include?(f) }.map { |f, m| "#{f}: #{m}" }
    warnings = [] if pending.empty?
    roots =
      if namespace
        [Object.const_get(namespace)]
      else
        repo = File.expand_path(root)
        (Object.constants - before)
          .select { |c| (Object.const_source_location(c)&.first || "").start_with?(repo) }
          .map { |c| Object.const_get(c) }
          .select { |c| c.is_a?(Module) }
      end
    [roots, warnings]
  end

  def self.to_json_value(v)
    case v
    when nil, true, false, Integer, String then v
    when Float then v
    when Symbol then v.to_s
    when Array then v.map { |x| to_json_value(x) }
    when Hash then v.to_h { |k, x| [k.to_s, to_json_value(x)] }
    when Struct then to_json_value(v.to_h)
    else
      if defined?(BigDecimal) && v.is_a?(BigDecimal) then v.to_f
      elsif v.respond_to?(:iso8601) then v.iso8601
      elsif v.respond_to?(:to_h) then to_json_value(v.to_h)
      elsif !v.instance_variables.empty?
        v.instance_variables.to_h { |iv| [iv.to_s.delete("@"), to_json_value(v.instance_variable_get(iv))] }
      else v.to_s
      end
    end
  end
end
