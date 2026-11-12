import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/shared/lib/firebase';
import { authApi } from '@/features/auth/authApi';
import { useAuthStore } from '@/shared/store/authStore';
import { SplashPage } from './SplashPage';

// Thin wrapper around the existing SplashPage animation (unchanged) that
// resolves the REAL landing route once instead of the old hardcoded default.
// Firebase's auth state resolves from local persistence almost immediately,
// well within SplashPage's own ~2.5s animation, so there's no visible delay.
export function RootSplash() {
  const setUser = useAuthStore((s) => s.setUser);
  const [redirectTo, setRedirectTo] = useState('/auth/phone');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setRedirectTo('/auth/phone');
        return;
      }
      try {
        // A persisted Firebase session proves this device already completed
        // phone+OTP before — but it must NOT skip straight to Home. PIN/Face
        // ID is the actual unlock gate on every app open, same as a real
        // banking app; OTP is only ever required the first time (new phone
        // or new device), never again here.
        const response = await authApi.getMe();
        setUser(response.user);
        setRedirectTo('/auth/pin');
      } catch {
        // Stale/expired Firebase session with no matching backend profile —
        // send back to the start of auth rather than a broken "home".
        setRedirectTo('/auth/phone');
      }
    });
    return unsubscribe;
  }, [setUser]);

  return <SplashPage redirectTo={redirectTo} />;
}
