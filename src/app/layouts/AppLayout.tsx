import { Outlet } from 'react-router-dom';
import { TabBar } from '@/shared/ui/TabBar';

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-bg">
      {/* pb-28 (up from pb-24): the tab bar is now a floating pill raised
          12px above the safe-area-inset-bottom line, with a QR FAB
          overshooting its top edge — a bit more bottom clearance keeps
          scrollable content from sitting under it. */}
      <div className="mx-auto max-w-[480px] min-h-dvh bg-bg pb-28">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}
