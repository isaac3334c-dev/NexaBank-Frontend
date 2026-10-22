import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { PhonePage } from '@/features/auth/PhonePage';
import { OtpPage } from '@/features/auth/OtpPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { CreatePinPage } from '@/features/auth/CreatePinPage';
import { PinPage } from '@/features/auth/PinPage';
import { HomePage } from '@/features/home/HomePage';
import { ComingSoonPage } from '@/features/home/ComingSoonPage';
import { TransferPage } from '@/features/transfer/TransferPage';
import { DevUiPage } from '@/features/dev-ui/DevUiPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/auth/phone" replace /> },
  { path: '/dev/ui', element: <DevUiPage /> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/auth/phone', element: <PhonePage /> },
      { path: '/auth/otp', element: <OtpPage /> },
      { path: '/auth/register', element: <RegisterPage /> },
      { path: '/auth/create-pin', element: <CreatePinPage /> },
      { path: '/auth/pin', element: <PinPage /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/app/home', element: <HomePage /> },
      { path: '/app/activity', element: <ComingSoonPage title="Actividad" /> },
      { path: '/app/cards', element: <ComingSoonPage title="Tarjetas" /> },
      { path: '/app/profile', element: <ComingSoonPage title="Perfil" /> },
      { path: '/app/scan', element: <ComingSoonPage title="Escanear QR" /> },
      { path: '/app/receive', element: <ComingSoonPage title="Recibir" /> },
      { path: '/app/topup', element: <ComingSoonPage title="Recargar" /> },
      { path: '/app/withdraw', element: <ComingSoonPage title="Retirar" /> },
    ],
  },
  { path: '/transfer', element: <TransferPage /> },
  { path: '*', element: <Navigate to="/auth/phone" replace /> },
]);
