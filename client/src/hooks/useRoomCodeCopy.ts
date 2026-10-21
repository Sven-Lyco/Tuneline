import { useState } from 'react';
import { inviteUrl } from '../utils/invite';

export function useRoomCodeCopy(roomCode: string) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    const url = inviteUrl(roomCode);
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(url);
    } else {
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return { copied, copyCode };
}
