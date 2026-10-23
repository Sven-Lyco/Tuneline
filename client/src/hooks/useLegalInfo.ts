import { useEffect, useState } from 'react';
import type { LegalInfo } from '@tuneline/shared';
import { getLegalInfo } from '../api/legal';

/** The operator as configured on the server, for the privacy policy; null while it loads. */
export function useLegalInfo(): LegalInfo | null {
  const [info, setInfo] = useState<LegalInfo | null>(null);
  useEffect(() => {
    let active = true;
    void getLegalInfo().then((loaded) => {
      if (active) setInfo(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return info;
}
