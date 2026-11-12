import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { SplashPage } from '@/features/splash/SplashPage';
import { RootSplash } from '@/features/splash/RootSplash';
import { PhonePage } from '@/features/auth/PhonePage';
import { OtpPage } from '@/features/auth/OtpPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { CreatePinPage } from '@/features/auth/CreatePinPage';
import { PinPage } from '@/features/auth/PinPage';
import { HomePage } from '@/features/home/HomePage';
import { ComingSoonPage } from '@/features/home/ComingSoonPage';
import { TransferPage } from '@/features/transfer/TransferPage';
import { DevUiPage } from '@/features/dev-ui/DevUiPage';
import { ActivityPage } from '@/features/activity/ActivityPage';
import { CardsPage } from '@/features/cards/CardsPage';
import { TopupPage } from '@/features/topup/TopupPage';
import { WithdrawPage } from '@/features/withdraw/WithdrawPage';
import { ReceivePage } from '@/features/receive/ReceivePage';
import { ScanPage } from '@/features/scan/ScanPage';

export const router = createBrowserRouter([
  { path: '/', element: <RootSplash /> },
  { path: '/dev/ui', element: <DevUiPage /> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/auth/phone', element: <PhonePage /> },
      { path: '/auth/otp', element: <OtpPage /> },
      { path: '/auth/register', element: <RegisterPage /> },
      { path: '/auth/loading', element: <SplashPage redirectTo="/app/home" /> },
      { path: '/auth/create-pin', element: <CreatePinPage /> },
      { path: '/auth/pin', element: <PinPage /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/app/home', element: <HomePage /> },
      { path: '/app/activity', element: <ActivityPage /> },
      { path: '/app/cards', element: <CardsPage /> },
      { path: '/app/profile', element: <ComingSoonPage title="Perfil" /> },
      { path: '/app/scan', element: <ScanPage /> },
      { path: '/app/receive', element: <ReceivePage /> },
      { path: '/app/topup', element: <TopupPage /> },
      { path: '/app/withdraw', element: <WithdrawPage /> },
    ],
  },
  { path: '/transfer', element: <TransferPage /> },
  // Routes through RootSplash (not directly to /auth/phone) so a session
  // that's still valid lands on PIN, not a redundant phone+OTP prompt.
  { path: '*', element: <Navigate to="/" replace /> },
]);
