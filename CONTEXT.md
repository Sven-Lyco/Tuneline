# Tuneline

Digitales Musik-Timeline-Partyspiel (wie Hitster).

- React 19 + TypeScript, Emotion CSS-in-JS, Vite — npm Workspaces Monorepo (client/server/shared)
- Spotify PKCE OAuth für Login + Playlist-Auswahl durch den Host
- Song-Metadaten (Titel, Interpret, Jahr, Cover) aus der Spotify Web API
- Audio: iTunes Search API (30s Previews, kein Auth, kein Premium nötig, multiplayer-fähig)
- Online-Multiplayer via Socket.io — 2–10 Spieler, konfigurierbare Rundenzahl, Punktesystem
- Host erstellt Raum, Spieler joinen per 6-stelligem Raum-Code oder Einladungslink (`?room=CODE`)
- Design: Dunkles Neon-Theme, Space Mono + Outfit Fonts
