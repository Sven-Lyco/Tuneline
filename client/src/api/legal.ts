import type { LegalInfo } from '@tuneline/shared';

const UNKNOWN: LegalInfo = { operatorName: null, operatorContact: null };

/** Who runs this instance, for the privacy policy; unknown if the server can't say. */
export async function getLegalInfo(): Promise<LegalInfo> {
  try {
    const res = await fetch('/api/legal');
    if (!res.ok) return UNKNOWN;
    return (await res.json()) as LegalInfo;
  } catch {
    return UNKNOWN;
  }
}
