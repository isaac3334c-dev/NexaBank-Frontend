import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-dvh bg-bg flex items-start justify-center">
      <div className="w-full max-w-[480px] min-h-dvh bg-bg px-5 safe-top safe-bottom">
        <Outlet />
      </div>
    </div>
  );
}
