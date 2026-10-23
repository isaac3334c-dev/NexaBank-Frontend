import { Outlet, useLocation } from 'react-router-dom';

export function AuthLayout() {
  const location = useLocation();

  return (
    <div className="min-h-dvh bg-bg flex items-start justify-center">
      <div className="w-full max-w-[480px] min-h-dvh bg-bg px-5 safe-top safe-bottom overflow-x-hidden">
        {/* key={pathname} remounts this wrapper on every auth-flow route
            change (phone -> otp -> register -> create-pin -> pin), which
            restarts the short slide-in animation each time. */}
        <div key={location.pathname} className="animate-auth-view-enter">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
