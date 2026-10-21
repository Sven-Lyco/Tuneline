# Spotify-Regeln halten Tuneline im Freundeskreis fest

Stand Oktober 2026 kann Tuneline Spotify nur als privates Hobbyprojekt nutzen. Eine App im Development Mode erlaubt **höchstens fünf von Hand freigeschaltete Spotify-Konten**, für Tuneline also fünf mögliche Hosts. Sie funktioniert nur, solange der App-Besitzer **Spotify Premium** bezahlt. Der Ausweg Extended Quota steht seit dem 15. Mai 2025 **nur Organisationen mit mindestens 250.000 monatlich aktiven Nutzern** offen. Schwerer als die Kontingente wiegt der Regeltext: Die Spotify Developer Policy verbietet wörtlich „a game, including trivia quizzes“. Sie verbietet außerdem Produkte, die mit Inhalten eines anderen Dienstes verknüpft sind. Tuneline trifft beides, denn es zeigt Spotify-Metadaten zu iTunes-Audio. Technisch droht ein konkreter Bruch. Neue Client-IDs (ab 11. Februar 2026) lesen Songs nur noch aus eigenen oder kollaborativen Playlists, über `/playlists/{id}/items` mit höchstens 50 Einträgen pro Seite. Der Server ruft aber noch `/tracks` mit `limit=100` auf. Für ältere Client-IDs ist diese Umstellung nur aufgeschoben, nicht aufgehoben. Spotify-eigene Redaktions- und Algorithmus-Playlists sind für neue Apps schon seit November 2024 gesperrt. Bei Apple nennt die offizielle Doku **rund 20 Anfragen pro Minute**. Previews sind dort nur „to promote store content and not for entertainment purposes“ erlaubt, mit der Pflicht zum Hinweis „provided courtesy of iTunes“ und zu einem verlinkten Store-Badge. Ein Spiel liegt damit bestenfalls in einer Grauzone, die Apple bisher duldet. Für das Projekt folgt daraus:

- Im README Premium-Pflicht, Allowlist und Playlist-Grenzen dokumentieren.
- In der Oberfläche Spotify-Logo, Rücklinks, unbeschnittene Cover und den iTunes-Hinweis nachrüsten.
- Den Playlist-Abruf jetzt migrieren.
- Vor jeder Einladung über den Freundeskreis hinaus akzeptieren, dass Spotify die Client-ID jederzeit sperren kann.

*Hinweis: Dieser Bericht ist keine Rechtsberatung. Belege von developer.spotify.com, apple.com und den dort verlinkten Apple-Seiten gelten als „offiziell“. Forenbeiträge, GitHub-Issues, Blogs und Presse sind als Community- bzw. Drittquelle gekennzeichnet. Das Spotify-Forum blockierte automatisierte Abrufe (HTTP 403), dortige Zitate stammen daher aus Ausschnitten in Suchergebnissen und konnten nicht am vollständigen Thread geprüft werden. Eigene Tests (curl am 21.10.2026) und Befunde aus dem Tuneline-Repository sind als solche benannt.*

## Fünf Hosts und ein Premium-Abo bilden die harte Obergrenze

Die aktuelle Quota-Modes-Seite ist eindeutig: **„Up to 5 authenticated Spotify users can use a development mode app“**, und jeder muss vorher auf der Allowlist stehen ([Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)). Dazu kommt eine Bedingung, die das README bisher nicht erwähnt. **Der App-Besitzer braucht ein aktives Premium-Abo.** Läuft es aus, funktioniert die App nicht mehr, bis er es erneuert ([Spotify: February 2026 Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)). Bis Anfang 2026 lag die Grenze bei 25 Testnutzern. Das ist eine Presseangabe ([TechCrunch, 06.02.2026](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/)), keine Spotify-Aussage. Die neuen Regeln gelten für neu angelegte Client-IDs seit dem **11. Februar 2026** und für bestehende seit dem **9. März 2026** ([Spotify Blog, 06.02.2026](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)). Wer vorher schon mehr als fünf Nutzer freigeschaltet hatte, behält sie. Neue Freischaltungen über fünf hinaus sind gesperrt ([Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)).

Für Tuneline zählt dabei nur, wer sich mit Spotify einloggt. Gäste treten per Raum-Code bei und berühren die Spotify-API nie. Spotify begrenzt also nicht die Partygröße, sondern die Zahl der Konten, die als Host Playlists laden können. Das ist eine naheliegende Auslegung von „authenticated Spotify users“, keine ausdrückliche Spotify-Aussage. Offen bleibt, ob das Konto des Besitzers selbst zu den fünf zählt; keine offizielle Quelle beantwortet das. Ein Forenbeitrag behauptet, auch Endnutzer bräuchten Premium ([Community: Why only 5 users?](https://community.spotify.com/t5/Spotify-for-Developers/Why-only-5-users/td-p/7487947)). Die offizielle Doku verlangt Premium aber nur vom Besitzer.

Die Freischaltung läuft vollständig manuell. Im Developer Dashboard trägt der Besitzer unter App → Settings → **Users Management → Add new user** den Namen und **die E-Mail-Adresse des Spotify-Kontos** ein und lädt die Person selbst ein. Eine Prüfung durch Spotify ist nicht dokumentiert ([Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)). Nicht freigeschaltete Nutzer können sich oft trotzdem einloggen, ihre API-Aufrufe scheitern aber mit **HTTP 403** (ebd.). Community-Berichte nennen als Fehlermeldung „User not registered in the Developer Dashboard“. Häufigste Ursache ist eine E-Mail, die nicht exakt zur Kontoadresse passt, etwa bei Facebook-Login. Neue Einträge greifen teils erst nach über 30 Minuten ([Community-Thread](https://community.spotify.com/t5/Spotify-for-Developers/User-not-registered-in-the-Developer-Dashboard-403-on-me/td-p/5284011)). Tuneline kann diesen Fall heute nicht erklären. `spotifyFetch` in `server/src/spotify.ts` gibt bei jedem Fehlerstatus `null` zurück, ein nicht freigeschalteter Host sieht also einfach eine leere Playlist-Liste.

Neben der Zahl der Nutzer begrenzt Spotify auch das Volumen. Das allgemeine Rate-Limit misst Spotify über ein **gleitendes 30-Sekunden-Fenster**. Wer es überschreitet, bekommt 429 mit `Retry-After`; Zahlen veröffentlicht Spotify nicht ([Spotify: Rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)). Zusätzlich hat der Development Mode Kontingente pro Gruppe von Endpunkten. Seit dem **23. Juli 2026** teilen sich alle Client-IDs eines Entwicklerkontos einen Topf, und Überschreitungen kommen als 429 mit `"reason": "QUOTA_EXCEEDED"`. Am selben Tag stieg die Grenze von einer auf 25 Client-IDs pro Konto ([Spotify Blog, 23.07.2026](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)). Ein einzelner Community-Test maß nach überschrittenem Kontingent ein `Retry-After` von 82.510 Sekunden, knapp 23 Stunden ([dev.to](https://dev.to/iam-tech/your-spotify-playlist-reader-isnt-broken-its-reading-a-boolean-2lml)). Das ist eine Einzelmessung, keine Spotify-Angabe. Sie zeigt aber, dass ein einziger Kontingentfehler einen ganzen Spieleabend kosten kann. Eine weitere Änderung belegt nur ein Drittanbieter: Refresh-Tokens sollen seit Juni/Juli 2026 nach sechs Monaten verfallen ([vorplabs](https://vorplabs.com/agent-tools/spotify-api-changes)). Für Tuneline wäre das folgenlos, weil Sessions ohnehin nach sieben Tagen enden.

| Datum | Änderung | Quelle |
|---|---|---|
| 27.11.2024 | Neue Apps und Dev-Mode-Apps ohne laufenden Antrag verlieren u. a. Recommendations, Audio Features, Preview-URLs in Antworten mit mehreren Tracks sowie Spotify-eigene Redaktions- und Algorithmus-Playlists | offiziell ([Blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)) |
| 15.05.2025 | Developer Terms v10 und Developer Policy in Kraft; Extended Quota nur noch für Organisationen | offiziell ([Blog](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)) |
| Ende Dez. 2025 bis ca. Apr. 2026 | „Create App“ im Dashboard gesperrt | Community, Sperre von Staff bestätigt, kein offizielles Enddatum ([Forum](https://community.spotify.com/t5/Spotify-for-Developers/Unable-to-create-app/td-p/7283365)) |
| 11.02.2026 | Neue Client-IDs: Premium-Pflicht, 5 Nutzer, 1 Client-ID, weniger Endpunkte, Playlist-Inhalte nur aus eigenen oder kollaborativen Playlists | offiziell ([Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)) |
| 09.03.2026 | Premium, Nutzergrenze und Client-ID-Limit auch für bestehende Apps; Endpunkt-Änderungen für Bestands-Apps verschoben | offiziell ([Blog-Update](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)) |
| März 2026 | Streichung von `external_ids` zurückgenommen | offiziell ([Changelog](https://developer.spotify.com/documentation/web-api/references/changes/march-2026)) |
| 23.07.2026 | 25 Client-IDs pro Konto, Kontingent pro Konto gemeinsam, `QUOTA_EXCEEDED` | offiziell ([Changelog](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)) |
| Aug. bis Okt. 2026 | keine weiteren offiziellen Änderungen gefunden; der Changelog nennt nur Februar, März, Mai und Juli 2026 | Recherche-Lücke, kein Beleg für Stillstand |

### Extended Quota verlangt eine Firma und 250.000 Nutzer

Seit dem **15. Mai 2025** nimmt Spotify Anträge auf Extended Quota **„only … from organizations (not individuals)“** an ([Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)). Verlangt werden:

- eine eingetragene Rechtsform,
- ein laufender, veröffentlichter Dienst,
- **mindestens 250.000 monatlich aktive Nutzer**,
- Verfügbarkeit in wichtigen Spotify-Märkten,
- kommerzielle Tragfähigkeit,
- die Einhaltung der Bedingungen.

Zuerst muss ein Partner-Antrag genehmigt werden, gestellt von einer Firmen-E-Mail-Adresse. Danach folgt der Quota-Extension-Request im Dashboard, dessen Prüfung bis zu sechs Wochen dauert (ebd.). TechCrunch datiert die Verschärfung auf März 2025. Maßgeblich ist aber Spotifys eigener Blog vom 15. April 2025, wonach die Regeln ab 15. Mai 2025 gelten ([Spotify Blog, 15.04.2025](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)).

Tuneline scheitert an mindestens drei der sechs Kriterien. Selbst eine Firma mit genug Nutzern bekäme vermutlich keine Freigabe. Ein Community-Volunteer, kein Spotify-Mitarbeiter, beschied einer Musik-Trivia-App, sie sei wegen des Spielverbots nicht antragsberechtigt ([Community: TrackLine](https://community.spotify.com/t5/Spotify-for-Developers/Extended-Quota-Mode-Request-Independent-Developer-TrackLine/m-p/7384615)). Entwickler weisen außerdem auf den Zirkelschluss hin, dass eine auf fünf Nutzer begrenzte App die 250.000 nie erreichen kann ([Community](https://community.spotify.com/t5/Spotify-for-Developers/Request-Production-OAuth-Access-Not-Extended-Quota/td-p/7354560)). Wie oft Einzelpersonen oder kleine Projekte seit Mai 2025 genehmigt wurden, veröffentlicht Spotify nicht.

Zwei inoffizielle Auswege kursieren, beide mit Haken. Seit Juli 2026 rechnen manche mit bis zu 25 Client-IDs zu je fünf Nutzern ([Community](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-quota-updates-for-Development-Mode/td-p/7508852)). Das Kontingent ist aber inzwischen pro Konto gemeinsam, und die Policy schreibt vor: „You must use a separate Security Code for each SDA. You may not use more than one Security Code for each SDA“ ([Developer Policy](https://developer.spotify.com/policy)). Das ist genau die Art Umgehung, vor der Abschnitt VII warnt. Beim zweiten Weg legt jeder Host eine eigene Developer-App an, so wie bei Home Assistant und beim Hitster-ähnlichen Flutster. Seit Februar 2026 braucht dafür jeder Host Premium, und jede dieser Apps unterliegt den strengeren Regeln für neue Apps. Während der App-Sperre ab Ende 2025 funktionierte dieser Weg gar nicht. Flutster entfernte seinen Warnhinweis erst am 15./16. Oktober 2026 ([GitHub: flutster #1](https://github.com/Nicsilver/flutster/issues/1); [Home Assistant Forum](https://community.home-assistant.io/t/spotify-restricting-new-apps/979399)). Ein offiziell vorgesehener Weg über fünf Hosts hinaus existiert für ein Hobbyprojekt nicht.

## Seit Februar 2026 liest eine neue App nur noch eigene Playlists

### Spotify-eigene Playlists sind seit November 2024 gesperrt

Die erste Sperre beim Datenzugriff stammt vom **27. November 2024**. Seitdem bekommen neue Apps und Dev-Mode-Apps ohne laufenden Erweiterungsantrag keinen Zugriff mehr auf „algorithmic and Spotify-owned editorial playlists“ ([Spotify Blog, 27.11.2024](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)). In der Praxis liefern `GET /playlists/{id}` und `/items` für Playlists wie „All Out 80s“, Discover Weekly, Daily Mix oder Release Radar **404 „Resource not found“**. Ein Community-Moderator nannte das „the expected behavior for the non-extended quota mode clients“ ([Community](https://community.spotify.com/t5/Spotify-for-Developers/playlists-API-Endpoint-Issue-Fixed/m-p/6589015/highlight/true)). Eine weitere Antwort stellt klar, dass es seit der Änderung nicht mehr möglich sei, Daten von Playlists mit Spotify als Eigentümer abzurufen ([Community](https://community.spotify.com/t5/Spotify-for-Developers/404-Resource-not-found-for-Playlists-by-Spotify/td-p/6552598)). Kurz nach der Umstellung tauchten solche Playlists als `null` in `/me/playlists` auf, was Spotify behob. Threadtitel deuten darauf hin, dass sie seither ganz aus der Liste fallen ([Community](https://community.spotify.com/t5/Spotify-for-Developers/Current-User-s-Playlist-doesn-t-list-Spotify-owned-playlists-e-g/m-p/6821283/highlight/true)). Belegt ist das nicht. Ob eine App, die nach November 2024 Extended Quota erhält, wieder Zugriff hätte, ist widersprüchlich dokumentiert. Für Tuneline ist die Frage ohnehin rein theoretisch.

### Gefolgte Playlists liefern seit Februar 2026 keine Songs mehr

Die zweite Sperre trifft den Kern des Spiels. Für Client-IDs ab dem **11. Februar 2026** gilt: **„Playlist items are returned only for playlists the user owns or collaborates on.“** Für andere Playlists kommen nur Metadaten, und `GET /playlists/{id}/items` antwortet laut Referenz mit **403 Forbidden** ([Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Spotify: Get Playlist Items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)). Playlists, denen der Host nur folgt, erscheinen weiterhin in `/me/playlists`, das „owned or followed“ Playlists liefert ([Spotify: Get Current User's Playlists](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists)). Laden lassen sie sich aber nicht. Ein Spotify-Mitarbeiter bestätigte das im Forum und schrieb, für einzelne Entwickler gebe es keinen Workaround ([Community](https://community.spotify.com/t5/Spotify-for-Developers/Persistent-HTTP-403-on-v1-playlists-playlist-id-items-same-token/td-p/7410582)). Der naheliegende Umweg ist, die Songs einer fremden Playlist in eine eigene zu kopieren. Das folgt aus der Eigentumsregel, Spotify hat es aber nirgends bestätigt. Was „collaborates on“ genau heißt, ist offiziell nicht geklärt: Reicht es, einer kollaborativen Playlist zu folgen, oder muss man per Einladung beigetreten sein?

### Endpunkte und Felder wurden umbenannt oder gestrichen

Mit derselben Umstellung hat Spotify Endpunkte umbenannt und gestrichen:

- `/playlists/{id}/tracks` heißt jetzt `/playlists/{id}/items`.
- In der Antwort wurde `track` zu `item`.
- `limit` reicht nur noch von 1 bis 50 ([Get Playlist Items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)).
- Live-Tests zeigen, dass `items[].track` noch existiert, aber als **Boolean**. Code, der es liest, läuft weiter und bekommt nichts Brauchbares ([dev.to](https://dev.to/iam-tech/your-spotify-playlist-reader-isnt-broken-its-reading-a-boolean-2lml)).
- In einem Bericht vom 6. März 2026 lieferte `/tracks` 403, `/items` mit demselben Token 200. Wann jene App angelegt wurde, ist unbekannt ([GitHub: cliamp #54](https://github.com/bjarneo/cliamp/issues/54)).
- Gestrichen sind die Sammel-Endpunkte für Tracks, Alben und Künstler, die Top-Tracks eines Künstlers, die Browse-Endpunkte und `GET /users/{id}/playlists`. Die Suche liefert höchstens 10 Treffer.
- Bei Tracks entfielen `popularity`, `available_markets` und `linked_from`. Die Streichung von `external_ids` (ISRC) nahm Spotify im März 2026 zurück ([Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Changelog März 2026](https://developer.spotify.com/documentation/web-api/references/changes/march-2026)).

**Die Felder, die Tuneline braucht, sind weiterhin dokumentiert:** `name`, `artists`, `album.release_date` samt `release_date_precision`, `album.album_type` und `album.images` ([Get Playlist Items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)). `preview_url` ist als deprecated markiert, mit dem Hinweis „Spotify policy prohibits offering preview clips as a standalone service“ (ebd.). Playlist-Cover sind laut Referenz temporär und „expire in under a day“ ([Spotify: Get Playlist](https://developer.spotify.com/documentation/web-api/reference/get-playlist)). Das betrifft Playlist-Bilder; zu Album-Covern auf `i.scdn.co` gibt es keine solche Aussage.

### Ob der heutige Code läuft, hängt am Anlagedatum der Client-ID

Für Client-IDs, die vor dem 11. Februar 2026 angelegt wurden, hat Spotify die Endpunkt-Änderungen am 9. März 2026 **verschoben, ohne ein neues Datum zu nennen** ([Blog-Update](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)). Der Migration Guide nennt den 9. März weiterhin als Umstellungsdatum, die offiziellen Seiten widersprechen sich also. Ein Drittanbieter-Tracker fand am 7. Oktober 2026 kein neues Datum ([vorplabs](https://vorplabs.com/agent-tools/spotify-api-changes)). Ob der aktuelle Code funktioniert, hängt damit am Anlagedatum der Client-ID, und jeder Aufschub für Bestands-Apps kann ohne Vorlauf enden. Die Tabelle stellt den heutigen Code (Repository-Befund) der Erwartung für eine neue Client-ID gegenüber.

| Stelle in `server/src/spotify.ts` | Heute im Code | Neue Client-ID (ab 11.02.2026) |
|---|---|---|
| Pfad in `getPlaylistTracks` | `/playlists/{id}/tracks` | `/playlists/{id}/items`; `/tracks` lieferte laut Community-Bericht 403 |
| Seitengröße | `limit=100` | höchstens 50; ob 100 einen Fehler 400 auslöst oder auf 50 gekürzt wird, ist ungeklärt |
| Feldauswahl | `items(track(id,name,artists(name),album(…)))` | `items(item(…)),next`; `track` ist nur noch ein Boolean |
| `getUserPlaylists` | `trackCount: p.tracks.total` | `tracks` gilt als deprecated und wurde zu `items` umbenannt; fehlt das Feld, löst der direkte Zugriff einen TypeError aus |
| Gefolgte Playlists anderer Nutzer | werden angeboten und geladen | erscheinen in der Liste, Laden der Songs liefert 403 |
| Spotify-eigene Playlists | seit 11/2024 gesperrt | 404, eventuell gar nicht gelistet |
| Fehlerbehandlung `spotifyFetch` | jeder Fehler wird zu `null` | 403, 404 und 429 `QUOTA_EXCEEDED` sind für den Host nicht unterscheidbar |

Robust für beide Fälle ist folgende Kombination: `/items` mit `limit=50` aufrufen, den Track als `item ?? track` lesen (nur wenn es ein Objekt ist) und `p.items?.total ?? p.tracks?.total` verwenden. Außerdem sollte der Playlist-Screen nur Playlists anbieten, die dem Host gehören oder kollaborativ sind. Diese Empfehlungen sind aus den Referenzseiten abgeleitet, nicht gegen eine echte neue Client-ID getestet. Halbiert sich die Seitengröße, verdoppelt sich die Zahl der Aufrufe: Bis zur Grenze von 300 Tracks pro Playlist sind es sechs statt drei Seiten, und `loadSongs()` lädt alle gewählten Playlists parallel aus demselben Kontingent. Spotify empfiehlt selbst, Playlist-Inhalte anhand der `snapshot_id` zu cachen und nur geänderte Playlists neu zu laden ([Rate limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)).

## Die Developer Policy verbietet Spiele und fremdes Audio wörtlich

### Das Spielverbot gilt ohne Ausnahme

Maßgeblich sind die Developer Policy und die Developer Terms (Version 10), beide in Kraft seit dem **15. Mai 2025**. Neuere Fassungen fanden sich nicht ([Developer Policy](https://developer.spotify.com/policy); [Developer Terms](https://developer.spotify.com/terms)). Abschnitt III der Policy listet „Some prohibited applications“. Der zweite Punkt lautet ohne Einschränkung: **„Do not create a game, including trivia quizzes.“** Der Abschnitt verbietet auch, andere zum Bau solcher Apps zu befähigen oder zu ermutigen. Eine Ausnahme für nicht-kommerzielle, private oder kleine Projekte enthält er nicht (Policy). Ein als gelöst markierter Forenthread zu genau dieser Frage, „Game development similar to Hitster“, kommt zum selben Schluss. Ein Nutzer schreibt dort, das physische Hitster umgehe das Problem, weil seine QR-Codes nur Songs in der Spotify-App öffnen und gar nicht die API nutzen ([Community: Hitster-Thread](https://community.spotify.com/t5/Spotify-for-Developers/Game-development-similar-to-Hitster/td-p/6554648)). Seit wann das Verbot besteht, ließ sich nicht klären; ältere Forenthreads deuten auf die Zeit vor 2025 hin. Ebenso fand sich kein Fall, in dem Spotify es gegen eine kleine Hobby-App im Development Mode durchgesetzt hätte. Wie Spotify das Verbot durchsetzt, ist unbekannt, eine lockere Praxis also nicht belegt.

### iTunes-Audio zu Spotify-Metadaten ist der zweite Konflikt

Das zweite Problem ist die Audioquelle. Abschnitt III verbietet auch „any product or service which is integrated with streams or content from another service“. Er verbietet außerdem Systeme, die Spotify-Inhalte mit anderem Audio „segue, mix, re-mix, or overlap“. Die Design Guidelines ergänzen: **„Spotify content should never be seated next to content from similar services“** (Policy; [Spotify Design Guidelines](https://developer.spotify.com/documentation/design)). Tuneline zeigt Titel, Interpret und Cover von Spotify zu einem Clip von Apple, einem plausiblen „ähnlichen Dienst“. Ob die Klausel auch Audio erfasst, das nur passend zu Spotify-Metadaten gesucht wird, hat Spotify nie klargestellt. Der Wortlaut ist aber weit genug, um es zu erfassen. Auch die Forderung, eine App müsse „independent value or functionality that improves users' interactions with Spotify“ bieten, lässt sich schwer erfüllen, wenn kein Ton über Spotify läuft (Policy).

Das Verbergen der Metadaten während des Zugs ist dagegen vermutlich kein eigener Verstoß. Die Pflicht, beim Abspielen Cover und Metadaten zu zeigen, gilt für Streaming-Apps. Die Terms nehmen Audio Preview Clips ausdrücklich aus der Streaming-Definition heraus (Terms), und Tuneline spielt ohnehin kein Spotify-Audio. Das ist eine Auslegung, keine Bestätigung von Spotify.

### Kommerzielle Nutzung, Speicherung und Datenschutz

Kommerzielle Fragen treten dahinter zurück. Die Terms lizenzieren Apps nur „for private personal use“ (Terms, Abschnitt III). Die Policy verbietet kommerzielle Nutzung grundsätzlich. Apps ohne Spotify-Wiedergabe, also formal auch Tuneline, dürfen aber Werbung, Sponsoring oder Zugang verkaufen (Policy, Abschnitt IV). Spenden-Links erwähnt keines der Dokumente. Werbung oder eine Bezahlschranke verbessern die Lage nicht. Sie passen schlecht zur Lizenz für private Nutzung und machen das Projekt sichtbarer.

Datenschutz- und Speicherpflichten gelten auch im Development Mode:

- Spotify-Inhalte dürfen nur gespeichert werden, soweit „strictly necessary to operate your SDA“, nur als temporärer Cache von Metadaten und Covern und nie „indefinitely“ (Terms, Abschnitt IV).
- Die Weitergabe an Dritte ist verboten, außer an Auftragsverarbeiter wie den Hoster (ebd.).
- Nutzer brauchen einen einfachen Weg, ihr Spotify-Konto zu trennen. Danach sind ihre personenbezogenen Spotify-Daten **binnen fünf Tagen** zu löschen (Abschnitt V und Datenschutz-Anhang der Terms).
- Eine **Datenschutzerklärung muss vor dem Login** sichtbar sein.
- Nutzer müssen einer Endnutzervereinbarung mit Mindestinhalten zustimmen, die Spotify als begünstigten Dritten nennt (ebd.).

Tuneline hält Raumdaten nur im Speicher, mit zwei Stunden Lebensdauer; das passt zu „temporär“. Der Logout-Handler in `server/src/app.ts` löscht die Session sofort und erfüllt damit die Löschfrist für das Token. Datenschutzerklärung und Nutzungsbedingungen fehlen in der Oberfläche bisher (Repository-Befund). Ob es eine Anzeige an eigene Nutzer oder eine Weitergabe ist, wenn Gäste ohne Spotify-Login `SongFull` sehen, regelt keine Quelle. Ein kurzer Hinweis auf Bedingungen und Datenschutz im `JoinScreen` senkt dieses Risiko. Schließlich verbieten Terms und Policy seit Mai 2025, Spotify-Inhalte zum Training von KI-Modellen zu nutzen oder in solche Modelle einzuspeisen. Eine spätere Funktion „Fun Facts per LLM“ auf Basis von Spotify-Metadaten wäre damit ausgeschlossen (Terms; Policy).

## iTunes erlaubt rund 20 Anfragen pro Minute und offiziell nur Werbung

### Rate-Limit: offiziell rund 20 pro Minute, Drosselung per IP

Apples einzige offizielle Zahl steht auf der Search-API-Seite des Performance-Partners-Programms: **„approximately 20 calls per minute (subject to change)“**. Wer mehr braucht, soll den Enterprise Partner Feed nutzen, und große Websites sollen Such- und Lookup-Anfragen cachen ([Apple Performance Partners: Search API](https://performance-partners.apple.com/search-api)). Die Seite trägt im Footer „Copyright 2022“. Die ältere Archivfassung („Updated: 2017-09-19“) nennt gar kein Limit ([Apple Developer Archive: iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html)). Der Text kann also veraltet sein, ist aber das, was Apple im Oktober 2026 veröffentlicht.

Wie Apple drosselt, ist nur aus Community-Berichten bekannt, überwiegend von 2016. Nach etwa 25 Anfragen von einer IP kamen **403 Forbidden**. Drei Sekunden Abstand (rund 20 pro Minute) funktionierten, zwei Sekunden nicht. Dieselbe Anfrage ging vom eigenen PC durch und scheiterte vom Produktionsserver, was auf Limits pro IP hindeutet ([Apple Developer Forums #66399](https://developer.apple.com/forums/thread/66399)). Ein Drittanbieter-Guide nennt 300 bis 350 Anfragen pro Minute und 429 statt 403. Er widerspricht damit den Forenberichten und belegt nichts ([rollout.com](https://rollout.com/integration-guides/itunes/api-essentials)). Ein eigener Test am 21. Oktober 2026 ergab HTTP 200 über Akamai, `access-control-allow-origin: *` und `cache-control: max-age=76026`, also rund 21 Stunden. Rate-Limit-Header gab es keine ([iTunes Search, Testanfrage](https://itunes.apple.com/search?term=queen+bohemian+rhapsody&entity=song&limit=2&country=DE)).

Für Tuneline ist das die dringendste technische Grenze. Alle Hosts teilen die IP des Servers. `loadSongs()` startet Preview-Suchen in Blöcken zu zehn parallel (`BATCH = 10` mit `Promise.all`), ohne Pause zwischen den Blöcken (Repository-Befund). Schon ein einzelnes Deck mit einigen Dutzend Songs überschreitet 20 Anfragen pro Minute deutlich, zwei gleichzeitig ladende Hosts erst recht. Gut ist, dass `findPreview` Fehlerantworten nicht als „keine Preview“ cacht. Ein gedrosselter Song fällt aber trotzdem aus dem Deck, und `startGame()` setzt dann weniger Runden an. Umgesetzt heißt Apples Empfehlung: eine Warteschlange mit etwa drei Sekunden Abstand oder sehr geringer Parallelität, zusammen mit dem vorhandenen Cache. `findPreview` sendet keinen `country`-Parameter und fragt damit den US-Store ab, den Apple als Standard nennt (Performance Partners). Laut einem GitHub-Issue lieferte `country` zusammen mit `entity=song` bei manchen populären Künstlern null Treffer ([GitHub: Techeer #47](https://github.com/Techeer-2026-2/backend/issues/47)). Am fehlenden `country` muss man also nicht zwingend etwas ändern.

### Die Nutzungsbedingungen erlauben Previews nur zur Werbung

Die Nutzungsbedingungen sind strenger als das Rate-Limit. Previews, Albumcover und App-Icons gelten als „Promo Content“. Er darf **„only to promote store content and not for entertainment purposes“** genutzt werden ([Archive](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html); [Performance Partners](https://performance-partners.apple.com/search-api)). Konkret verlangt Apple Folgendes (ebd.):

- Promo Content nur auf Seiten zeigen, die den Inhalt bewerben.
- **In der Nähe eines Store-Badges mit Direktlink zur Kaufseite** platzieren.
- Previews mit dem Hinweis **„provided courtesy of iTunes“** versehen.
- Nur streamen, also „not downloaded, saved, cached, or synchronized with video“.
- Nicht „for independent entertainment value apart from its promotional purpose“ nutzen.
- Nicht für andere Waren oder Dienste werben.

Apple liefert die Inhalte „as is“ und verlangt, sie auf Anfrage sofort zu entfernen. Wie Apple „entertainment“ versteht, zeigen die App Store Review Guidelines: Previews dürfen nicht wegen ihres Unterhaltungswerts genutzt werden, „such as … the soundtrack to a game“. Wer Previews anbietet, muss auf iTunes oder Apple Music verlinken ([App Store Review Guidelines, 5.2.5](https://developer.apple.com/app-store/review/guidelines/)). Diese Regeln binden Apps im App Store, nicht Websites. Sie sind aber der beste Beleg dafür, wie Apple seine Begriffe auslegt.

Tuneline nutzt die Clips nicht als Hintergrundmusik, sondern als Rätselgegenstand. Trotzdem tragen sie den Unterhaltungswert des Spiels, das ist bestenfalls eine Grauzone. Hinzu kommt eine offene Rechtsfrage. Die Search API verlangt weder Schlüssel noch Zustimmung. Ob die Bedingungen auf der Doku-Seite jemanden binden, der dem Partnerprogramm nie beigetreten ist, ließ sich nicht klären. Praktisch kann Apple über die Pflicht zur sofortigen Entfernung oder über IP-Sperren durchgreifen. Auf direkte Anfragen von Quiz-Entwicklern gab Apple 2021 keine klare Antwort ([Apple Developer Forums #695402](https://developer.apple.com/forums/thread/695402)). Eine Frage vom Juli 2026 zu einem Web-Spiel, bei dem man Erscheinungsjahre rät, blieb sogar ganz ohne Antwort ([Apple Developer Forums #836910](https://developer.apple.com/forums/thread/836910)).

### Suchergebnisse cachen ja, Audio speichern nein

Beim Caching passt Tunelines Architektur gut zu Apples Regeln. Apple empfiehlt ausdrücklich, Such- und Lookup-Antworten zu cachen, und der eigene Header erlaubt rund 21 Stunden. Der In-Memory-Cache für Suchergebnisse und Preview-URLs entspricht dem. Das Audio dagegen darf nur gestreamt werden. Der Browser spielt `previewUrl` direkt vom Apple-CDN ab. Laut eigenem Test liefert das CDN `audio/x-m4p` mit `access-control-allow-origin: *`, Range-Support und `max-age=31536000`. Proxying, Herunterladen, Umkodieren oder Speichern in IndexedDB oder einem Service Worker würden gegen „not downloaded, saved, cached“ verstoßen. Dass der Browser die Datei wegen Apples eigenem Header ein Jahr cacht, ist normales Browserverhalten, das die Bedingungen nicht regeln. Zum Kürzen von Clips oder zum Abspielen ab einem Offset schweigen die Search-API-Bedingungen.

### Status 2026: die API läuft, die Qualität schwankt

Die API lief am 21. Oktober 2026 normal, eine Abkündigung fand sich nicht. `previewUrl` liegt weiter auf `audio-ssl.itunes.apple.com`, die Whitelist in `isValidSong` passt also. `trackViewUrl` zeigt inzwischen auf `music.apple.com` (eigener Test). Community-Berichte belegen aber Qualitätsprobleme, auf die Apple nicht reagierte. Explizite Titel fehlten von September 2025 bis mindestens April 2026, selbst mit `explicit=Yes` ([Apple Developer Forums #802700](https://developer.apple.com/forums/thread/802700)). Das kann erklären, warum manche populären Songs aus dem Deck fallen; ob es im Oktober 2026 noch zutrifft, wurde nicht geprüft.

Die gepflegte Alternative, die Apple Music API, verlangt ein Developer Token. Dafür ist eine kostenpflichtige Mitgliedschaft im Apple Developer Program nötig ([Apple: Generating Developer Tokens](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens)), laut Drittquellen rund 99 USD pro Jahr ([musickit.js.org](https://musickit.js.org/getting-started/)). Ihre Bedingungen richten sich an Apple-Music-Abonnenten, sie passt rechtlich also nicht erkennbar besser. In der Praxis duldet Apple Quiz-Apps mit Previews, etwa die Intro-Quiz-App Intro King im App Store ([App Store: Intro King](https://apps.apple.com/app/id6449006748)). Einen öffentlich bekannten Takedown wegen iTunes-Previews fand die Recherche nicht. Duldung ist allerdings keine Erlaubnis.

## Spotify- und Apple-Attribution kollidieren auf der Aufdeck-Karte

### Spotify verlangt Logo, Rücklink und unveränderte Cover

Spotify verlangt für jede Anzeige seiner Inhalte drei Dinge:

- **Logo.** Die Policy verlangt, Inhalte „clearly attribute … as being supplied and made available by Spotify“, und zwar mit den Spotify-Marken. Laut Design Guidelines darf das volle Logo digital nie kleiner als **70 px** sein. Das Icon allein (mindestens **21 px**) ist nur erlaubt, wenn der Platz knapp ist oder die Marke schon etabliert ist. Das grüne Logo gehört nur auf Schwarz oder Weiß, sonst ist es einfarbig zu verwenden ([Developer Policy](https://developer.spotify.com/policy); [Design Guidelines](https://developer.spotify.com/documentation/design)).
- **Rücklink.** „Metadata, cover art and Audio Preview Clips must be accompanied by a link back“ zum jeweiligen Album, Inhalt oder zur Playlist. Beschriftungen sind „OPEN SPOTIFY“, „PLAY ON SPOTIFY“ oder „LISTEN ON SPOTIFY“, ohne installierte App „GET SPOTIFY FREE“ (ebd.).
- **Unveränderte Cover.** „Don't crop the artwork in any way“ und „Don't animate or distort it in any way“. Overlays und Bedienelemente auf dem Cover sind tabu. Die Ecken werden mit 4 px (kleine und mittlere Geräte) bzw. 8 px (große Geräte) abgerundet. Cover wegzulassen ist bei Platzmangel ausdrücklich erlaubt, Skalieren laut Terms ebenfalls ([Design Guidelines](https://developer.spotify.com/documentation/design); [Developer Terms](https://developer.spotify.com/terms)).

Metadaten müssen so erscheinen, wie Spotify sie liefert. Kürzen ist erlaubt, wenn der volle Text erreichbar bleibt (Design Guidelines).

### Tuneline erfüllt diese Pflichten heute nicht

Laut Repository-Befund zeigt Tuneline kein Spotify-Logo und verlinkt nie auf `open.spotify.com`. `Vinyl.tsx` rendert das Cover als Kreis (`border-radius: 50%`), der sich während der Wiedergabe dreht. Das Cover wird damit zugleich beschnitten, animiert und in eine Grafik eingebettet. Die geringe Größe von rund 31 px ist dagegen unproblematisch.

Spotify-Grün (`#1db954`/`#1ed760`) steht auf dem Login-Button, aber auch an weiteren Stellen: am Auswahlrahmen und am Bereit-Button im `PlaylistScreen`, im `PlaylistBadge` und bei den Schrittnummern im `HelpScreen`. Die Guidelines verbieten, dass das eigene Logo oder Branding Spotify-Elementen wie dem Spotify-Grün ähnelt ([Design Guidelines](https://developer.spotify.com/documentation/design)). Ob das auch für Akzentfarben in der Oberfläche gilt, ist offen. Der Login-Button ist aber die einzige Stelle, an der das Grün eindeutig „Spotify“ bedeutet. Eigene Vorgaben für Login-Buttons enthält die Guidelines-Seite nicht. Der Name „Tuneline“ ist unproblematisch: Er beginnt nicht mit „Spot“, enthält nicht „Spotify“ und suggeriert keine Billigung. Zu sagen, die App sei „for Spotify“, ist ausdrücklich erlaubt (Policy, Abschnitt VI; Design Guidelines).

### Apple verlangt Hinweis und Badge, beides beißt sich mit Spotify

Apple verlangt parallel den Hinweis „provided courtesy of iTunes“ und ein verlinktes Badge nahe der Preview. Das aktuelle Badge heißt laut Apple Music Identity Guidelines „Listen on Apple Music“ und unterliegt folgenden Regeln:

- digital mindestens **30 px**,
- nur ein Badge pro Kommunikation,
- überall mit Link zu Apple Music,
- Credit-Zeile „Apple and Apple Music are trademarks of Apple Inc.“.

Das alte „Download on iTunes“-Badge, auf das die Search-API-Bedingungen verweisen, erwähnt die Seite nicht mehr ([Apple Music Identity Guidelines](https://marketing.services.apple/apple-music-identity-guidelines)).

Hier entsteht der Konflikt. Spotify verbietet, seine Inhalte neben „similar services“ zu platzieren, Apple verlangt sein Badge in der Nähe des Clips. Nach dem Aufdecken stehen Spotify-Cover, Spotify-Titel und der Apple-Clip auf derselben Karte. **Kein Layout erfüllt beide Regelwerke vollständig.** Das zeigt deutlich, dass keine der beiden Seiten diese Mischung vorgesehen hat. Am wenigsten widersprüchlich ist eine zeitliche Trennung, die Tunelines Anti-Cheat-Logik ohnehin vorgibt. Während des Zugs ist kein Spotify-Inhalt sichtbar, dort gehört der iTunes-Hinweis hin. Ein Apple-Link würde den Song verraten und kann erst nach der Platzierung erscheinen. Die Tabelle zeigt eine pragmatische Umsetzung. Sie ist eine Auslegung der Regeln, keine geprüfte Konformität.

| Ort | Sichtbarer Spotify-Inhalt | Vorschlag |
|---|---|---|
| `LoginScreen` | keiner, nur die Marke | grüner Button „Mit Spotify einloggen“ mit offiziellem Spotify-Icon ≥ 21 px; Links zu Datenschutzerklärung und Nutzungsbedingungen vor dem Login |
| `PlaylistScreen`, `PlaylistBadge`, `PlaylistBadgeRow` | Playlist-Namen und -Cover | Spotify-Logo im Bereich (≥ 70 px, sonst Icon ≥ 21 px), Link „OPEN SPOTIFY“ auf `open.spotify.com/playlist/{id}`, Cover quadratisch mit 4 px Ecken, eigene Akzentfarbe statt Grün |
| `SongCard` während des Zugs | keiner (nur `preview`) | Textzeile „Vorschau provided courtesy of iTunes“ neben dem Player; Vinyl dreht sich ohne Cover |
| `SongCard` nach dem Aufdecken | Titel, Interpret, Jahr, Cover | quadratisches Cover mit 4 px Ecken neben dem Vinyl statt darin; Spotify-Icon und Link „PLAY ON SPOTIFY“ auf `open.spotify.com/track/{id}`; Apple-Badge deutlich abgesetzt; der Konflikt bleibt bestehen |
| `MyTimeline`, `OtherPlayers`, `ResultScreen` | Titel, Interpret, Jahr | ein gut sichtbares Spotify-Logo pro Bereich, keine Cover (erlaubt), auf dem Ergebnis-Screen Rücklinks pro Song |
| `JoinScreen` | noch keiner | kurzer Hinweis auf Datenschutz und Bedingungen für Gäste, da sie später Spotify-Metadaten sehen |

## README, Oberfläche und Risikoliste vor der nächsten Einladung

### Was ins README gehört

Das README beschreibt die Einrichtung so, als genüge irgendeine Spotify-App, und verspricht „no auth, no Premium required“. Für Mitspieler stimmt das, für den Betreiber nicht mehr. Der Setup-Abschnitt sollte sechs Fakten festhalten:

1. Der App-Besitzer braucht Premium.
2. Höchstens fünf Hosts können freigeschaltet werden, über Users Management mit der exakten E-Mail des Spotify-Kontos.
3. Nicht freigeschaltete Hosts bekommen 403 bzw. sehen eine leere Liste; Gäste brauchen nichts.
4. Neue Client-IDs laden nur eigene oder kollaborative Playlists. Spotify-eigene Playlists funktionieren nie, deshalb kopiert man ihre Songs in eine eigene Playlist.
5. Das iTunes-Limit gilt pro Server-IP.
6. Ein ehrlicher Rechtshinweis gehört dazu.

Die README-Regel „`[::1]` statt `localhost`“ für die Redirect-URI konnte nicht gegen Spotifys Beitrag vom 12. Februar 2025 zur Verschärfung der OAuth-Regeln geprüft werden, weil die Recherche diesen Beitrag nicht ausgewertet hat. Da das README englisch ist, folgt ein englischer Entwurf für Abschnitt 1:

```markdown
### 1. Create a Spotify Developer App

> **Spotify requirements (since Feb/Mar 2026):** The account that owns the app needs an
> active Spotify Premium subscription — if it lapses, login and playlist loading stop working.
> A Development Mode app allows at most **5 Spotify users**. Players who join via room code
> never log in to Spotify and need no account.

Create an app at developer.spotify.com, add the redirect URI below, then add every person who
should be able to host under **Settings → Users Management → Add new user** (name + the exact
e-mail address of their Spotify account). Hosts who are not on this list can log in, but the
API answers with HTTP 403 and no playlists appear.

**Playlist limits:** Apps created on or after 11 Feb 2026 can only load playlists the host owns
or collaborates on. Spotify-owned playlists (editorial lists, Discover Weekly, Daily Mix …)
cannot be loaded by any Development Mode app. Workaround: copy the songs into your own playlist.

**Audio previews** come from the iTunes Search API (about 20 requests/min per server IP
according to Apple). Songs without a matching preview are skipped.

**Legal note:** Tuneline is a private, non-commercial hobby project. It is not affiliated with,
endorsed or sponsored by Spotify or Apple. Spotify's Developer Policy prohibits games including
trivia quizzes, and Apple permits previews for promotional purposes only. Running a public
instance is at your own risk. This is not legal advice.
```

### Vier Risiken vor der nächsten Einladung

Bevor Tuneline über den Freundeskreis hinaus geteilt wird, stehen vier Risiken an, hier nach Schwere geordnet:

1. **Regeln.** Das Spielverbot und die Klausel gegen Inhalte anderer Dienste treffen die Kernidee. Abschnitt VII der Policy erlaubt Spotify, Kontingente zu setzen und den Zugriff zu entziehen ([Developer Policy](https://developer.spotify.com/policy)). Das realistische Szenario ist eine gesperrte Client-ID, nach der kein Host mehr Playlists laden kann. Je sichtbarer der öffentliche Spotify-Login beworben wird, desto größer ist die Angriffsfläche.
2. **Struktur.** Fünf Hosts, manuelle Freischaltung und das Premium-Abo des Betreibers als einzelner Ausfallpunkt.
3. **Latenter Codebruch.** Wird die Client-ID neu angelegt oder endet der Aufschub für Bestands-Apps, liefert `/tracks` keine Songs mehr. Deshalb sollten jetzt umgesetzt werden:
   - die Migration auf `/items` mit `limit=50` und `item ?? track`,
   - die Beschränkung auf eigene oder kollaborative Playlists,
   - klare Meldungen statt des stillen `null`: bei 403 (Host nicht freigeschaltet oder fremde Playlist), bei 404 (Spotify-eigene Playlist) und bei 429 `QUOTA_EXCEEDED` (Kontingent möglicherweise für Stunden erschöpft).
4. **Kapazität.** Gleichzeitig ladende Hosts teilen ein Spotify-Kontingent und eine iTunes-IP. Vor jeder größeren Einladung gehören deshalb folgende Punkte in den Code:
   - eine iTunes-Warteschlange mit Drosselung,
   - ein Cache der Playlist-Inhalte nach `snapshot_id`,
   - das exakte Befolgen von `Retry-After`.

Für jeden Cache gilt Spotifys Vorgabe „temporär“. Suchergebnisse, deren Schlüssel aus Spotify-Titeln und -Interpreten bestehen, dürfen nicht unbegrenzt liegen bleiben. Eine Lebensdauer in der Größenordnung der von Apple gesetzten 21 Stunden passt zu beiden Seiten.

Nicht untersucht wurden deutsche Rechtsfragen, die bei einer öffentlichen Website unabhängig von den API-Regeln auftreten. Dazu zählen Impressums- und DSGVO-Pflichten und GEMA-Fragen, wenn die Musik bei öffentlichen Veranstaltungen läuft. Ob eine Party privat oder öffentlich ist, hängt vom Einzelfall ab.

## Fazit

Wachstum verschafft Tuneline keinen Zugang. Selbst eine eingetragene Firma mit 250.000 Nutzern bekäme für ein Spiel nach dem Wortlaut der Policy keine Extended Quota. Spotifys Kurs spricht ebenfalls gegen eine Wende: drei Verschärfungswellen zwischen November 2024 und Februar 2026, dazu die Juli-Anpassung 2026, die mehr Client-IDs erlaubt, das Kontingent aber zusammenlegt. Der Spotify-Login ist damit kein Weg zu mehr Nutzern. Er ist eine geduldete Privatfunktion, und niemand weiß, wie lange die Duldung hält. Die denkbaren Varianten lassen sich nach der Zahl ihrer Regelkonflikte ordnen:

| Variante | Spotify-Konflikte | Apple-Konflikte | Preis |
|---|---|---|---|
| Heutige Mischung aus Spotify-Metadaten und Apple-Audio | zwei ausdrückliche Verbote (Spiel, fremde Inhalte) | Grauzone „not for entertainment purposes“; dazu widersprüchliche Attributionspflichten | Fünf-Host-Grenze |
| Reine Apple-Lösung, Decks kuratiert oder als Songliste importiert | keine; die Fünf-Host-Grenze entfällt | Grauzone bleibt, sie umfasst auch Albumcover | eigene Playlists der Hosts entfallen |
| Ohne Preview-APIs: eigene Dateien wie bei [HitStar](https://github.com/Born2Root/HitStar) oder QR-Links in die Spotify-App wie beim physischen Hitster | keine | keine | der Kern des Online-Spiels |

Daraus ergibt sich eine klare Reihenfolge. Zuerst kommen die rein technischen Maßnahmen, die sofort wirken: die Migration auf `/items`, die Fehlermeldungen und die iTunes-Drosselung. Danach folgt die Attribution, die das Risiko senkt, ohne es zu beseitigen. Erst dann steht die strategische Frage an, ob Spotify zur optionalen Quelle neben importierten Songlisten wird. Wer Tuneline mit höchstens fünf freigeschalteten Hosts privat betreibt, bleibt in dem Rahmen, den Spotify ausdrücklich für „personal non-commercial projects by individuals“ offenhält ([Spotify Blog, 06.02.2026](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)). Das Spielverbot bleibt dabei ein bekanntes Restrisiko, das Spotify nach allem, was öffentlich bekannt ist, bisher nicht durchgesetzt hat.
