import { HomePage } from '@/components/pages/home';
import { libNames } from '@/lib/data';
import { pageMetadata } from '@/lib/meta';

export const metadata = pageMetadata(
  'pt-BR',
  '/',
  'Brazilian Utils',
  `Valide, formate, interprete e gere documentos brasileiros (CPF, CNPJ, CEP, placas) em ${libNames('pt-BR')}, com um contrato compartilhado.`,
);

export default function Page() {
  return <HomePage locale="pt-BR" />;
}
