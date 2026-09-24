import { HomePage } from '@/components/pages/home';
import { pageMetadata } from '@/lib/meta';

export const metadata = pageMetadata(
  'en',
  '/',
  'Brazilian Utils',
  'Validate, format, parse and generate Brazilian documents (CPF, CNPJ, CEP, license plates) in JavaScript, Python, Go, Ruby, Rust, .NET and Erlang, with one shared contract.',
);

export default function Page() {
  return <HomePage locale="en" />;
}
