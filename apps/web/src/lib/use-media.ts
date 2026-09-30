import { useEffect, useState } from 'react';
import { breakpoint } from '@polevka/design';

export function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= breakpoint);
  useEffect(() => {
    const on = () => setDesktop(window.innerWidth >= breakpoint);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return desktop;
}
