import { Sparkles } from 'lucide-react';
import { AppHeader } from '@/shared/ui/AppHeader';
import { EmptyState } from '@/shared/ui/EmptyState';

export interface ComingSoonPageProps {
  title: string;
}

export function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <div className="flex flex-col min-h-dvh">
      <AppHeader title={title} />
      <div className="flex-1 flex items-center justify-center">
        <EmptyState icon={Sparkles} title="Próximamente" description="Esta sección estará disponible en una futura actualización." />
      </div>
    </div>
  );
}
