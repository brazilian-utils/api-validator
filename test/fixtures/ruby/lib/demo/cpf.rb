module Demo
  module CPFUtils
    # @param cpf [String] the CPF
    # @return [Boolean]
    def self.valid?(cpf)
      cpf.to_s.size == 11
    end

    # @param cpf [String]
    # @return [String, nil]
    def self.format_cpf(cpf, pad: false)
      cpf
    end

    # @deprecated use valid?
    def self.validate(cpf) = valid?(cpf)

    def self.helper(x) = x
    private_class_method :helper

    class << self
      def generate(count = 1, *rest)
        "00000000000"
      end
    end
  end

  class InvalidCPF < StandardError
    def self.build = new
  end
end
