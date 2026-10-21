/** The link that opens the join screen with the room code filled in (copy button and QR code). */
export function inviteUrl(roomCode: string): string {
  return `${window.location.origin}/?room=${roomCode}`;
}
