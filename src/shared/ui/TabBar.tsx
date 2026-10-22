import { Home, Receipt, CreditCard, User, ScanLine } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';

const TABS = [
  { to: '/app/home', label: 'Inicio', icon: Home },
  { to: '/app/activity', label: 'Actividad', icon: Receipt },
  { to: '/app/cards', label: 'Tarjetas', icon: CreditCard },
  { to: '/app/profile', label: 'Perfil', icon: User },
] as const;

export function TabBar() {
  return (
    // Floating tab bar: 12px margin from the screen edges (not edge-to-edge)
    // plus env(safe-area-inset-bottom) composed via calc() so the floating
    // margin and the home-indicator safe area both apply — the bar sits
    // 12px above the gesture area, not flush against it. Background is a
    // translucent surface + backdrop-blur in both themes; the light-mode
    // rgba is a derived equivalent of the brief's dark rgba(20,22,25,.8)
    // (see docs/DECISIONS.md for the exact value/rationale).
    <nav
      className="fixed left-3 right-3 z-10 mx-auto max-w-[456px] rounded-[var(--radius-pill)] border border-border backdrop-blur-xl [background-color:var(--tabbar-bg)]"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 12px)',
      }}
      aria-label="Navegación principal"
    >
      <div className="relative flex items-center justify-between px-3">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}

        <div className="flex-1 flex items-center justify-center">
          <NavLink
            to="/app/scan"
            aria-label="Escanear QR"
            className="flex items-center justify-center size-16 rounded-full bg-primary text-on-primary shadow-[var(--shadow-md)] -translate-y-5 min-h-[44px] min-w-[44px] transition-transform duration-150 active:scale-[0.97]"
          >
            <ScanLine className="size-7" strokeWidth={1.5} />
          </NavLink>
        </div>

        {TABS.slice(2).map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}
      </div>
    </nav>
  );
}

function TabLink({ to, label, icon: Icon }: (typeof TABS)[number]) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] py-2 px-3 text-caption',
          isActive ? 'text-primary' : 'text-text-muted',
        )
      }
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </NavLink>
  );
}
