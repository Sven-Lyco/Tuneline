import { useState } from 'react';

export function useRoomCodeCopy(roomCode: string) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    const url = `${window.location.origin}/?room=${roomCode}`;
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
