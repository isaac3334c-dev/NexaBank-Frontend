import { useState } from 'react';
import { ArrowUpRight, Send, Download, CreditCard as CardIcon, Inbox, Search, Moon, Sun } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { IconButton } from '@/shared/ui/IconButton';
import { Input } from '@/shared/ui/Input';
import { Card } from '@/shared/ui/Card';
import { BalanceCard } from '@/shared/ui/BalanceCard';
import { QuickAction } from '@/shared/ui/QuickAction';
import { TransactionItem } from '@/shared/ui/TransactionItem';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { AppHeader } from '@/shared/ui/AppHeader';
import { Skeleton } from '@/shared/ui/Skeleton';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { EmptyState, ErrorState } from '@/shared/ui/EmptyState';
import { MoneyDisplay } from '@/shared/ui/MoneyDisplay';
import { useTheme } from '@/app/providers/ThemeProvider';
import { mockTransactions } from '@/shared/types/mockData';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 py-6 border-b border-border">
      <h2 className="overline text-text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-text-muted">{label}</p>
      {children}
    </div>
  );
}

// Dev-only theme toggle. There is no real Settings screen yet (ComingSoonPage
// stub) — this lets light mode stay testable/reviewable without building
// Settings now. See docs/DECISIONS.md.
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
      className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-surface-2 px-3 py-1.5 text-caption font-medium text-text"
      aria-label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
    >
      {isLight ? <Moon className="size-4" /> : <Sun className="size-4" />}
      {isLight ? 'Oscuro' : 'Claro'}
    </button>
  );
}

export function DevUiPage() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="max-w-[480px] mx-auto px-5 pb-16">
      <AppHeader title="/dev/ui — Design system" rightAction={<ThemeToggle />} />

      <Section title="Button">
        <Row label="Variants">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </Row>
        <Row label="Sizes">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </Row>
        <Row label="States">
          <div className="flex flex-wrap gap-2">
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
            <Button leftIcon={<Send className="size-4" />}>Con ícono</Button>
            <Button fullWidth>Full width</Button>
          </div>
        </Row>
      </Section>

      <Section title="IconButton">
        <div className="flex gap-2">
          <IconButton variant="primary" icon={<Send className="size-5" />} aria-label="Enviar" />
          <IconButton variant="secondary" icon={<Download className="size-5" />} aria-label="Descargar" />
          <IconButton variant="ghost" icon={<Search className="size-5" />} aria-label="Buscar" />
          <div className="bg-surface p-2 rounded-full">
            <IconButton variant="on-surface" icon={<CardIcon className="size-5" />} aria-label="Tarjeta" />
          </div>
        </div>
      </Section>

      <Section title="Input">
        <Input label="Normal" placeholder="Escribe algo" />
        <Input label="Con ayuda" placeholder="Escribe algo" helperText="Texto de ayuda" />
        <Input label="Con error" placeholder="Escribe algo" error="Este campo es obligatorio" />
        <Input label="Con prefijo" placeholder="0.00" prefix={<span>S/</span>} />
      </Section>

      <Section title="Card">
        <div className="flex flex-col gap-3">
          <Card variant="surface">Surface</Card>
          <Card variant="elevated">Elevated</Card>
          <Card variant="outlined">Outlined</Card>
        </div>
      </Section>

      <Section title="BalanceCard">
        <BalanceCard balance={{ amount: '4280.50', currency: 'PEN' }} />
      </Section>

      <Section title="QuickAction">
        <div className="grid grid-cols-4 gap-1">
          <QuickAction icon={<ArrowUpRight className="size-6" />} label="Enviar" />
          <QuickAction icon={<Download className="size-6" />} label="Recibir" />
          <QuickAction icon={<CardIcon className="size-6" />} label="Recargar" />
          <QuickAction icon={<Send className="size-6" />} label="Pagar" />
        </div>
      </Section>

      <Section title="TransactionItem">
        <div className="flex flex-col divide-y divide-border">
          {mockTransactions.slice(0, 4).map((tx) => (
            <TransactionItem key={tx.id} transaction={tx} />
          ))}
        </div>
      </Section>

      <Section title="Avatar">
        <div className="flex gap-2 items-center">
          <Avatar name="Daniela Flores" size="sm" />
          <Avatar name="Rodrigo Salazar" size="md" />
          <Avatar name="Camila Vargas" size="lg" />
        </div>
      </Section>

      <Section title="Badge / StatusPill">
        <div className="flex flex-wrap gap-2">
          <Badge variant="success">Completado</Badge>
          <Badge variant="warning">Pendiente</Badge>
          <Badge variant="danger">Fallida</Badge>
          <Badge variant="info">Revertida</Badge>
          <Badge variant="neutral">Neutral</Badge>
        </div>
      </Section>

      <Section title="Skeleton">
        <Row label="text">
          <Skeleton variant="text" className="w-1/2" />
        </Row>
        <Row label="card">
          <Skeleton variant="card" />
        </Row>
        <Row label="list">
          <Skeleton variant="list" rows={3} />
        </Row>
      </Section>

      <Section title="BottomSheet">
        <Button onClick={() => setSheetOpen(true)}>Abrir sheet</Button>
        <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Título del sheet">
          <p className="text-body text-text-muted pb-4">Contenido del bottom sheet con drag handle visual.</p>
          <Button fullWidth onClick={() => setSheetOpen(false)}>
            Cerrar
          </Button>
        </BottomSheet>
      </Section>

      <Section title="EmptyState / ErrorState">
        <EmptyState icon={Inbox} title="Sin datos" description="No hay nada que mostrar todavía." action={{ label: 'Acción', onClick: () => {} }} />
        <ErrorState action={{ label: 'Reintentar', onClick: () => {} }} />
      </Section>

      <Section title="Typography scale">
        <p className="text-display font-tabular">Display 36/44</p>
        <p className="text-h1">Heading 1 28/36</p>
        <p className="text-h2">Heading 2 22/30</p>
        <p className="text-h3">Heading 3 18/26</p>
        <p className="text-body">Body 16/24 regular</p>
        <p className="text-body-strong">Body 16/24 strong</p>
        <p className="text-caption">Caption 13/18</p>
        <p className="overline text-caption">Overline 12/16</p>
        {/* 44px hero amount treatment is scoped to BalanceCard/AmountStep
            only (not a global text-display override) — see docs/DECISIONS.md. */}
        <Row label="Hero amount (BalanceCard/AmountStep only, not text-display)">
          <MoneyDisplay
            formatted="S/ 4,280.50"
            className="inline-flex items-baseline"
            wholeClassName="font-tabular text-text text-[44px] font-semibold tracking-[-0.02em]"
            decimalClassName="font-tabular text-text-muted text-[26.4px] font-semibold tracking-[-0.02em]"
          />
        </Row>
        <Row label="Monospace (--font-mono) — for reference codes, last-4 digits">
          <p className="font-mono text-body text-text">TXN-28A91C-0047</p>
        </Row>
      </Section>

      <Section title="Radii">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="size-16 bg-surface-2 rounded-[var(--radius-card)]" />
            <span className="text-caption text-text-muted">card 20px</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-16 h-10 bg-surface-2 rounded-t-[var(--radius-sheet)]" />
            <span className="text-caption text-text-muted">sheet 28px (top)</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="h-10 px-4 flex items-center bg-primary text-on-primary rounded-[var(--radius-pill)] text-caption font-medium">
              pill 999px
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
