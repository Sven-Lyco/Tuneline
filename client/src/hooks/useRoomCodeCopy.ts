import { useState } from 'react';

export function useRoomCodeCopy(roomCode: string) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    const url = `${window.location.origin}/?room=${roomCode}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return { copied, copyCode };
}
