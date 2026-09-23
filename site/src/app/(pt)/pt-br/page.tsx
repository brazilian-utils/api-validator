import { HomePage } from '@/components/pages/home';
import { pageMetadata } from '@/lib/meta';

export const metadata = pageMetadata(
  'pt-BR',
  '/',
  'Brazilian Utils',
  'Valide, formate e gere documentos brasileiros (CPF, CNPJ, CEP, placas) em JavaScript, Python, Go, Ruby, Rust, .NET e Erlang, com um contrato compartilhado.',
);

export default function Page() {
  return <HomePage locale="pt-BR" />;
}
