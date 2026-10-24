import { useCallback, useState, type ReactNode } from 'react';
import { PixelNetworkIntro } from './PixelNetworkIntro';
import { useNavigate } from 'react-router-dom';

const SESSION_KEY = 'aicte_iicmd_intro_seen';

/**
 * Flip to false to skip the branded opening intro during local development.
 * You can also set VITE_DISABLE_INTRO=true in a .env.local file.
 */
export const INTRO_ENABLED = true;

function shouldPlayIntro(): boolean {
  if (!INTRO_ENABLED) return false;
  if (import.meta.env.VITE_DISABLE_INTRO === 'true') return false;
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return sessionStorage.getItem(SESSION_KEY) !== '1';
  } catch {
    return true;
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    // Ignore private-mode / blocked storage.
  }
}

interface AppIntroGateProps {
  children: ReactNode;
}

export function AppIntroGate({ children }: AppIntroGateProps) {
  const [showIntro, setShowIntro] = useState(shouldPlayIntro);
  const navigate = useNavigate();

  const handleComplete = useCallback(() => {
    markIntroSeen();
    setShowIntro(false);
    navigate('/welcome', { replace: true });
  }, [navigate]);

  return (
    <>
      {children}
      {showIntro && <PixelNetworkIntro onComplete={handleComplete} />}
    </>
  );
}
