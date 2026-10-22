# Architektur: Räume, Züge und Sitzplätze

Diese Diagramme zeigen die Abläufe, die über mehrere Dateien verteilt sind und beim Umbauen am leichtesten kaputtgehen. Sie beschreiben den Stand des Codes. Wer die Logik ändert, passt bitte auch das Diagramm an.

Wichtigste Quellen:

- **Server:** `server/src/rooms.ts` (RoomManager, Timer), `server/src/game.ts` (Spielregeln), `server/src/app.ts` (Socket-Handler)
- **Client:** `client/src/hooks/useSocketEvents.ts`, `client/src/App.tsx`, `client/src/utils/roomStorage.ts`, `client/src/utils/tabPresence.ts`
- **Gemeinsam:** Event-Typen in `shared/src/index.ts`

## 1. Datenfluss: Songs und was wer wann sieht

Der Spotify-Token bleibt auf dem Server. Der Host-Client bekommt fertige Songs und reicht sie an den Spiel-Server weiter, der sie prüft (`isValidSong`). Während eines Zugs gehen nur die Preview-URLs an die Clients. Titel, Interpret, Cover und Jahr kommen erst mit der Auflösung, damit niemand vorsagen kann.

```mermaid
flowchart LR
  subgraph Browser
    H[Host-Client]
    C[Alle Clients]
  end
  subgraph Server
    API["/api/songs"]
    RM[RoomManager]
  end
  SP[(Spotify Web API)]
  IT[(iTunes Search API)]
  CDN[(audio-ssl.itunes.apple.com)]

  H -- "Playlist-IDs, excludeIds" --> API
  API -- "Token aus der Session" --> SP
  API -- "Interpret, Titel, Länge" --> IT
  API -- "SongFull[]: nur Originalversionen mit Preview, Jahr ggf. von iTunes, ohne Doppelte" --> H
  H -- "start_game mit den Songs" --> RM
  RM -- "während des Zugs: nur die Preview-URL" --> C
  RM -- "placement_result und game_over: kompletter Song" --> C
  C -. "spielt die Preview direkt" .-> CDN
```

## 2. Raum-Zustände

Der Server kennt drei Status: `lobby`, `playing` und `finished`. „Songs laden“ und „pausiert“ sind keine eigenen Status. Das Laden ist nur ein Client-Screen, während der Raum in der `lobby` bleibt. Die Pause wird aus der Verbindung der Spieler abgeleitet (`pausedPlayerId`, siehe Abschnitt 5).

```mermaid
stateDiagram-v2
  state "Songs laden (nur Client-Screen)" as laden
  state "pausiert (abgeleitet)" as pausiert

  [*] --> lobby: create_room
  lobby --> lobby: join, leave, kick, update_settings → room_updated
  lobby --> laden: start_loading → game_loading an die Gäste
  laden --> lobby: cancel_loading, start_game abgelehnt oder Host offline → game_loading_cancelled
  laden --> playing: start_game → game_started
  playing --> pausiert: Host oder Spieler am Zug offline → game_paused
  pausiert --> playing: Rückkehr oder skip_player → game_resumed
  pausiert --> finished: Host länger als 2 min weg, oder Überspringen beendet das Spiel → game_over
  playing --> finished: letzter Zug an einer Rundengrenze → game_over
  finished --> finished: Gast verlässt → room_updated, Neuankömmling bekommt nur game_over
  finished --> lobby: return_to_lobby (Host) → room_updated
  lobby --> [*]: Host verlässt → room_closed
  finished --> [*]: Host verlässt → room_closed
```

Weitere Regeln:

- **Verlassen und Kick:** `leave_room` geht in der Lobby und auf dem Ergebnis-Screen, nicht mitten im Spiel. Kicken kann nur der Host, und nur in der Lobby.
- **Spät Beitretende und Rückkehrer:** Wer während eines Spiels beitritt oder zurückkommt, wird per `seatPlayer` in die Reihenfolge aufgenommen. Wer noch keine Karte hat, bekommt eine Startkarte vom Stapel, wenn der reicht. Sonst schaut man bis zur nächsten Partie zu.
- **Aufräumen:** Ein Raum lebt 2 h; jede Aktion verlängert das. Ist niemand mehr verbunden, wird er nach 10 min gelöscht.
- **Rundenzahl:** `startGame` setzt `gameRounds` auf das, was der Stapel für alle hergibt. `rounds` bleibt die Einstellung des Hosts.

## 3. Ablauf eines Zugs

```mermaid
sequenceDiagram
  participant P as Spieler am Zug
  participant S as Server
  participant C as Alle Clients

  S->>C: game_started oder placement_result mit nextSong (nur Preview)
  Note over S: Zeitlimit läuft (syncTurnTimer), nach einer Platzierung erst nach den 3 s Reveal, nie während einer Pause
  alt Spieler platziert
    P->>S: place_song mit Position
    S->>S: richtig → Karte bleibt in der Timeline, +1 Punkt
  else Zeit abgelaufen
    S->>S: timeoutTurn → zählt als falsch
  end
  S->>S: endTurn → nächster Spieler, an der Rundengrenze round+1, dann isGameOver
  alt Spiel vorbei
    S->>C: game_over (Rangliste, letzter Zug, letzte richtige Karte des Siegers)
  else es geht weiter
    S->>C: placement_result (song komplett, gameState, nextSong)
    Note over C: 3 s Auflösung (REVEAL_DURATION_MS), danach nächster Zug und Audio
    opt nächster Spieler ist offline
      S->>C: game_paused, der Client wendet es erst nach der Auflösung an
    end
  end
```

`isGameOver` beendet das Spiel nur an einer Rundengrenze, damit alle gleich viele Züge haben. Das passiert, wenn die Runden durch sind oder der Stapel keine volle Runde mehr hergibt. Mitten in einer Runde endet es nur, wenn gar kein Song mehr da ist.

## 4. Sitzplatz: Reload, geschlossener Tab, Duplikate

Ein Sitzplatz ist ein Token mit 48 Zeichen. Jeder Tab legt ihn in seinem `sessionStorage` ab; zusätzlich steht der zuletzt gespielte Raum als `lastRoom` im `localStorage` (max. 2 h).

```mermaid
flowchart TD
  J[create_room oder join_room] --> ST["sessionStorage: Raum und Token (dieser Tab)<br/>localStorage: lastRoom (max. 2 h)"]

  RL[Seite neu geladen] --> Q{"Hält ein anderer Tab<br/>diesen Platz?<br/>(BroadcastChannel)"}
  Q -- "nein" --> RJ[rejoin_room]
  Q -- "ja, Duplikat" --> FR[sessionStorage leeren, frischer Start]
  RC[Socket verbindet sich neu, gleicher Tab] --> RJ

  CL[Tab geschlossen, neuer Tab] --> B{"lastRoom gültig und<br/>kein Tab hält ihn?"}
  B -- "ja" --> RB[ResumeBanner: Zurück ins Spiel]
  RB -- "Klick" --> RJ
  B -- "nein" --> NS[normaler Start]

  RJ -- "Platz gefunden" --> OK[room_joined und aktueller Spielstand]
  RJ -- "Raum oder Token weg" --> RF[rejoin_failed: beide Einträge löschen, Start-Screen]
  OK -. "Platz lief noch auf einem anderen Socket" .-> SR[session_replaced an den alten Socket, Server trennt ihn]
  SR --> OT["alter Tab: Hinweis, sessionStorage leeren<br/>(lastRoom gehört jetzt dem neuen Tab)"]

  LV[leave_room, Kick oder room_closed] --> DEL[beide Einträge löschen]
```

`rejoin_room` legt nie einen neuen Spieler an. Ein Join mit Namen geht nur über `join_room`.

## 5. Pause-Regel

Nur zwei Ausfälle halten das Spiel an: der Host und der Spieler, der gerade dran ist. Einen fehlenden Spieler kann nur der Host überspringen („Ohne X weiterspielen“). Fehlt der Host selbst, kann niemand weitermachen. Deshalb endet das Spiel, wenn er länger als 2 Minuten weg ist (`HOST_RECONNECT_GRACE_MS`).

```mermaid
flowchart TD
  D[Spieler verliert die Verbindung] --> PL{Läuft ein Spiel?}
  PL -- "nein" --> RU[room_updated: offline-Markierung in Lobby oder Ergebnis]
  PL -- "ja" --> PR{"Host offline oder<br/>Spieler am Zug offline?<br/>(pausedPlayerId)"}
  PR -- "nein" --> GSU[game_state_updated: nur offline-Markierung]
  GSU -. "wird später dran" .-> GP
  PR -- "ja" --> GP[game_paused an alle, Zeitlimit stoppt]
  GP --> W{Wie geht es weiter?}
  W -- "Spieler kommt zurück" --> GR[game_resumed]
  W -- "Host überspringt ihn (skip_player)" --> GR
  W -- "Host länger als 2 min weg" --> GO[game_over]
```

Ein übersprungener Spieler verliert seinen Platz in der Reihenfolge, seine Karten bleiben aber in der Rangliste. Kommt er zurück, setzt ihn `seatPlayer` wieder ein.
