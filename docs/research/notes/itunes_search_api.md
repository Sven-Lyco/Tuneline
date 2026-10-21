# iTunes Search API: Limits and Terms for 30-Second Previews (as of October 2026)

Research date: 2026-10-21. Not legal advice. Official Apple text is marked "Official"; forum/blog material is marked "Community". The two official Search API documents found carry no recent revision dates (archive page "Updated: 2017-09-19"; Performance Partners page footer "Copyright 2022"), so the wording may be stale, but it is still the text Apple publishes in October 2026.

Context of the use case: Tuneline is a free **web** party game. The server searches iTunes by artist + title, keeps results in memory, and the browser plays `previewUrl` (on `audio-ssl.itunes.apple.com`) directly. During a turn, title/artist/cover stay hidden (anti-cheat) and are revealed after placement.

## Rate limits and caching

### Takeaway

Apple's only official rate figure is "approximately 20 calls per minute (subject to change)", on the Search API page of the Apple Services Performance Partners site. Apple points heavier users to the Enterprise Partner Feed (EPF) and tells large sites to cache search and lookup requests. Community reports, mostly from 2016, say that going over the limit returns HTTP 403 Forbidden per IP, sometimes well below 20/min. No one reported how long a block lasts, and Apple sends no rate-limit headers.

### Cited Findings

- Official: "limited to approximately 20 calls per minute (subject to change)" — [Apple Performance Partners, iTunes Search API](https://performance-partners.apple.com/search-api) (fetched 2026-10-21; footer "Copyright 2022 Apple Inc.", no last-updated date)
- Official: "If you require heavier usage", consider the Enterprise Partner Feed (EPF) — [Apple Performance Partners, iTunes Search API](https://performance-partners.apple.com/search-api)
- Official: "Large websites should set up caching logic for the search and lookup requests". The page refers to a "Caching Architecture" section that was not in the fetched content — [Apple Performance Partners, iTunes Search API](https://performance-partners.apple.com/search-api)
- Official: Apple advises a suitable `limit` value to keep results small and responses fast. `country` is a two-letter store code and defaults to US — [Apple Performance Partners, iTunes Search API](https://performance-partners.apple.com/search-api)
- Official (older): the legacy developer.apple.com archive version ("Updated: 2017-09-19") states no rate limit at all — [Apple Developer Documentation Archive, iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html)
- Community (Oct-Nov 2016), thread "iTunes search rate limited? 403 Forbidden errors":
  - 403s started after about 25 requests from one IP.
  - A 3-second gap (about 20/min) worked; a 2-second gap (about 30/min) caused 403s.
  - The same query returned 200 from a PC and 403 from a production server, which points to per-IP limiting.
  - No one reported a block duration, and no Apple staff replied. A second-hand Apple contact called it an "upper limit on their Search endpoint".
  - Apple marked one bug report as a duplicate (29055870). No resolution was posted.
  - Source: [Apple Developer Forums thread 66399](https://developer.apple.com/forums/thread/66399)
- Community: further 403 reports — [Apple Developer Forums thread 90888](https://developer.apple.com/forums/thread/90888); [thread 120959](https://developer.apple.com/forums/thread/120959) (seen in search results only, not opened)
- Community: open-source wrappers treat 403 as the rate-limit signal. One retries once after a short delay; a Laravel package returns an empty result and does not cache it — [minim source](https://minim.readthedocs.io/en/dev/_modules/minim/api/apple/_core.html); [atomescrochus/laravel-itunes-search-api](https://packagist.org/packages/atomescrochus/laravel-itunes-search-api) (search snippets only)
- Community (unverified): a third-party guide claims an undocumented limit of about 300-350 requests/min and talks about 429 rather than 403. It conflicts with the forum reports, so treat it with caution — [rollout.com guide](https://rollout.com/integration-guides/itunes/api-essentials) (search snippet only)
- Own observation (curl, 2026-10-21): `GET https://itunes.apple.com/search?term=queen+bohemian+rhapsody&entity=song&limit=2&country=DE` returned:
  - HTTP 200, served through Akamai
  - `access-control-allow-origin: *`
  - `cache-control: max-age=76026` (about 21 h)
  - no rate-limit headers (no `X-RateLimit-*`, no `Retry-After`)
  - Source: [itunes.apple.com/search](https://itunes.apple.com/search?term=queen+bohemian+rhapsody&entity=song&limit=2&country=DE)

### Inferences

- Tuneline searches from its server, so all hosts and games share one server IP and one budget of about 20/min. Loading a 40-50 song deck without cache hits could take 2-3 minutes at a safe pace. The in-memory cache and request throttling (queue plus spacing, for example ≥3 s, or a small concurrency limit) are the main protection.
- Handle 403, and defensively 429, as "back off". Don't retry in tight loops, and don't cache a 403 as "no preview found", or songs will be wrongly filtered out.
- Apple's own response header allows about 21 h of HTTP caching for search JSON, and the official text recommends caching search and lookup requests. So caching metadata (search results including the preview URL string) fits Apple's guidance. This is separate from caching the audio files themselves, which Apple forbids (see the restrictions section).

### Gaps

- No official statement says which HTTP status signals throttling (403 or 429) or how long a block lasts. The evidence is community reports, mostly from 2016.
- The "Caching Architecture" section mentioned on the official page could not be retrieved.
- A Podchaser article (Aug 2026) on the rate limit and an observed cap of about 100 results returned HTTP 403 when fetched, so only its search snippet was seen — [Podchaser](https://www.podchaser.com/articles/api/itunes-search-api-rate-limit)

## Terms of use, promotional intent, game/quiz use, attribution/badges

### Takeaway

The Search API's "Promo Content" terms allow previews and album art "only to promote store content and not for entertainment purposes". They require three things: a store badge next to the preview that links to the purchase page, the attribution "provided courtesy of iTunes", and use on pages that promote that content. Apple's App Store Review Guidelines name "the soundtrack to a game" as forbidden entertainment use and require a link to iTunes or Apple Music wherever previews are offered. A quiz game whose core mechanic is playing previews is therefore not clearly permitted under Apple's published wording. I found no Apple ruling, approval or takedown specific to quiz games.

### Cited Findings

- Official: Promo Content means song and music video previews, album art and app icons. It may be used "only to promote store content and not for entertainment purposes" — [Apple Developer Archive, iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html); the same Legal section appears on [Performance Partners, iTunes Search API](https://performance-partners.apple.com/search-api)
- Official, the six conditions (paraphrased):
  1. Place promo content only on pages that promote the underlying content.
  2. Keep it proximate to an Apple-approved "Download on iTunes" or "Download on App Store" badge that links straight to the purchase page.
  3. Song and music video previews carry the attribution "provided courtesy of iTunes".
  4. Previews are "streamed only", not downloaded, saved, cached, or synchronized with video.
  5. "not used for independent entertainment value apart from its promotional purpose".
  6. Not used to promote any other goods or services.
  - Sources: [Apple Developer Archive](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html); [Performance Partners](https://performance-partners.apple.com/search-api)
- Official: "Use of sound samples and other assets from the API must be proximate to a store badge" — [Apple Developer Archive](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html)
- Official: Apple provides promo content "as is" and disclaims warranties, including non-infringement. Developers must forward third-party claims to Apple immediately and remove promo content immediately on Apple's request. California law governs — same two sources
- Official: the Search API page belongs to the Apple Services Performance Partners (affiliate) program. The program pays commission on qualifying store revenue from clicks on correctly encoded partner links — [Performance Partners](https://performance-partners.apple.com/search-api); [Apple Developer Archive](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html)
- Official (App Store Review Guidelines 5.2.5): previews "may not be used for their entertainment value (such as ... the soundtrack to a game)". Anyone who provides previews "must display a link to the corresponding music in iTunes or Apple Music" — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) (fetched 2026-10-21; no revision date seen in fetched text)
- Official (App Store Review Guidelines 4.5.2, MusicKit): cover art and metadata "may only be used in connection with music playback or playlists". MusicKit apps may not require payment or indirectly monetize Apple Music access (for example through advertising). Integrators must follow the Apple Music Identity Guidelines — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Official (Apple Music Identity Guidelines):
  - The current badge is "Listen on" Apple Music, with only one Apple Music badge per communication.
  - "You must provide a link to Apple Music wherever a badge or lockup is used online".
  - Digital minimum size is 30 px. Credit line: "Apple and Apple Music are trademarks of Apple Inc.".
  - Do not imply that Apple endorses you. Badges are downloaded as SVG from the guidelines page.
  - The page shows "© 2023 Apple Inc." and no revision date.
  - It does not mention previews or the old "Download on iTunes" badge.
  - Source: [Apple Music Identity Guidelines](https://marketing.services.apple/apple-music-identity-guidelines)
- Community (Nov 2021): a developer of a music quiz game asked about MusicKit conditions. Apple staff ("Frameworks Engineer") quoted guideline 4.5.2 and referred further questions to Developer Relations. They gave no ruling on quiz use — [Apple Developer Forums thread 695402](https://developer.apple.com/forums/thread/695402)
- Community (Jul 2026): a developer of a free web game that guesses release years asked whether preview-only playback is permitted:
  - Apple Music API catalog previews, a server-side developer token, an HTML `<audio>` element, and the attribution "Music previews via Apple Music".
  - The poster reads the Apple Music API terms as aimed at "facilitating access to end users' Apple Music subscriptions".
  - Zero replies, about 850 views.
  - Source: [Apple Developer Forums thread 836910](https://developer.apple.com/forums/thread/836910)

### Inferences

- Apple's wording on the "entertainment" point is not clear-cut for Tuneline. The game uses previews as the content being guessed, not as background music, but the clips still provide "independent entertainment value". The App Store guideline's example ("the soundtrack to a game") shows that Apple reads games as a typical non-promotional use. Using previews this way is a gray area at best and arguably outside the written terms.
- The App Store Review Guidelines govern App Store apps, not websites, so they don't bind a web app directly. They are still the best evidence of how Apple interprets preview use.
- The Search API needs no key and no click-through agreement. Its terms are posted as a "browsewrap" on the docs page, and whether they bind a developer who never joined the affiliate program is a legal question I could not resolve. In practice Apple can enforce through its own rules ("remove ... immediately upon request") or by blocking IPs.
- Practical risk reduction, which mitigates but does not make the use compliant:
  - Show "provided courtesy of iTunes" (or similar) next to the player.
  - After each reveal (`placement_result`), show a "Listen on Apple Music" badge that links to `trackViewUrl`. During a turn the link would reveal the song, so it can only come after placement.
  - Use the badge exactly as in Apple's guidelines and never imply endorsement.
  - Optionally put an Apple affiliate token on links, which strengthens the "promotion" character.
  - Keep a fast path for removing content if Apple asks.

### Gaps

- I found no official Apple statement, approval or takedown that addresses quiz or trivia games using Search API previews.
- I could not find whether the current Performance Partners program agreement (separate from the Search API docs) adds or changes preview terms. Its text was not reached.
- The full current Apple Music API / MusicKit license terms (in the Apple Developer Program License Agreement) were not fetched. Only the App Store guideline excerpts and a developer's paraphrase were seen.

## Restrictions: caching/storing, modifying audio, hotlinking from Apple CDN, commercial use

### Takeaway

Apple's text requires previews to be "streamed only" and forbids downloading, saving or caching them. Playing Apple's `previewUrl` directly in the browser fits that wording better than proxying or storing the audio, and Apple's CDN serves preview files with open CORS and Range support. Caching search metadata is officially recommended. I found no explicit clause on modifying or trimming audio, or on commercial use beyond "not used to promote any other goods or services".

### Cited Findings

- Official: song and music video previews are "streamed only, and not downloaded, saved, cached, or synchronized with video" — [Apple Developer Archive](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html); [Performance Partners](https://performance-partners.apple.com/search-api)
- Official: caching logic is recommended for "search and lookup requests" — [Performance Partners](https://performance-partners.apple.com/search-api)
- Official: promo content must not be used "to promote any other goods or services" — same sources
- Official (MusicKit context only): "Do not download, upload, or enable sharing of music files" from MusicKit. Playing "a specific song at a particular moment" may require synchronization or adaptation rights from rights holders — [App Review Guidelines 4.5.2](https://developer.apple.com/app-store/review/guidelines/)
- Own observation (curl HEAD, 2026-10-21) of a live `previewUrl` on `audio-ssl.itunes.apple.com`:
  - HTTP 200, content type `audio/x-m4p`, about 1 MB AAC
  - `access-control-allow-origin: *`, `access-control-allow-headers: range`
  - `cache-control: public, max-age=31536000`
  - Source: own test of `https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/.../mzaf_15408639854395137008.plus.aac.p.m4a`

### Inferences

- Tuneline's design is the closest fit to the "streamed only" condition: the server caches search results and URL strings in memory, and the client streams the preview from Apple's CDN. Downloading, re-hosting, proxying or transcoding previews on the Tuneline server, or saving them in IndexedDB or a service worker, would conflict with "not downloaded, saved, cached".
- Apple's CDN sets a 1-year public `Cache-Control`, so the browser's own HTTP cache will keep the file. That is ordinary browser behavior and probably not "caching" by the developer, but the terms don't address it.
- Starting playback at an offset or cutting a shorter snippet is not addressed in the Search API terms. Re-encoding, mixing or adding effects would move toward the "adaptation" rights mentioned in the MusicKit guideline and should be avoided.
- Ads, paid tiers or sponsorship would sit badly with "not used to promote any other goods or services" and with the promotional-only purpose. Keeping the game free and ad-free lowers the risk but does not remove the "entertainment use" problem.
- Separate legal layer, out of Apple's API terms: playing music to a group at a party can raise public-performance licensing questions (GEMA in Germany). This depends on the setting (private vs. public) and was not researched here.

### Gaps

- I found no official text on hotlinking or embedding preview URLs specifically, beyond "streamed only".
- I found no official text on modifying or trimming previews, or on commercial versus non-commercial use.
- I don't know how long a given `previewUrl` stays valid. The URLs contain versioned asset paths and may change when Apple re-encodes catalog items. The observed preview had `last-modified: 2026-08-05`, which hints that assets do get refreshed.

## API status 2025-2026: deprecation, Apple Music API/MusicKit, previewUrl host changes

### Takeaway

The iTunes Search API was operating normally on 2026-10-21, and I found no official deprecation notice. `previewUrl` still points to `audio-ssl.itunes.apple.com`, and `trackViewUrl` now points to `music.apple.com`. Since 2025 the community has reported quality regressions with no Apple response: explicit tracks missing (Sep 2025 to at least Apr 2026) and country plus `entity=song` gaps. Apple's maintained alternative is the Apple Music API, which needs a developer token from a paid Apple Developer Program membership. Its terms frame it around Apple Music subscribers, so it is not clearly a better legal fit for preview-only games.

### Cited Findings

- Own observation (curl, 2026-10-21):
  - The API returns 200.
  - `previewUrl` host is still `audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/...plus.aac.p.m4a`.
  - Artwork is on `is1-ssl.mzstatic.com`, which differs from Spotify's `i.scdn.co` that Tuneline uses for covers.
  - `trackViewUrl` is `https://music.apple.com/de/album/...?i=...&uo=4`.
  - Source: [itunes.apple.com/search](https://itunes.apple.com/search?term=queen+bohemian+rhapsody&entity=song&limit=2&country=DE)
- Official: the Performance Partners Search API page (fetched Oct 2026) still documents the API and contains no deprecation notice. Its footer copyright is 2022 — [Performance Partners](https://performance-partners.apple.com/search-api)
- Official: the developer.apple.com archive copy is in the "Documentation Archive", last updated 2017-09-19. It carries no retirement notice — [Apple Developer Archive](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html)
- Community (Sep 2025 to Apr 2026): the API stopped returning explicit tracks, even with `explicit=Yes`. The problem was still present in April 2026, and Apple did not reply — [Apple Developer Forums thread 802700](https://developer.apple.com/forums/thread/802700)
- Community (2026): a GitHub issue reports that `country` together with `entity=song` returned zero results for some popular artists, and that removing `country` fixed it — [Techeer-2026-2/backend issue #47](https://github.com/Techeer-2026-2/backend/issues/47) (search snippet only)
- Community (Aug 2026): a Podchaser article reportedly found fewer than 101 results despite a documented maximum of 200, with `offset` silently ignored — [Podchaser](https://www.podchaser.com/articles/api/itunes-search-api-rate-limit) (search snippet only; the page returned 403 when fetched)
- Community: a third-party status monitor listed the API as operational in April 2026 — [public-api.org](https://public-api.org/api/900/itunes-search) (search snippet only)
- Community (about 2020): a forum thread asked about plans to deprecate /search and /lookup after iTunes was retired. No answer was seen — [Apple Developer Forums thread 658658](https://developer.apple.com/forums/thread/658658)
- Official: Apple Music API requests need a signed developer token, and you must be a "member of the Apple Developer Program" (paid) — [Apple Music API, Generating Developer Tokens](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens); see also [forum thread 661313](https://developer.apple.com/forums/thread/661313)
- Community: membership costs about 99 USD/year, according to third-party guides — [musickit.js.org](https://musickit.js.org/getting-started/); [DEV Community guide](https://dev.to/areknawo/apple-music-javascript-integration-guide-518b)

### Inferences

- The Search API looks like legacy, lightly maintained infrastructure: the docs are dated 2017 and 2022, and 2025-2026 regressions went unanswered. It keeps working but could change or vanish without notice. Tuneline should fail gracefully, filtering songs out as `loadSongs()` already does, and should not rely on explicit tracks being findable.
- The explicit-content regression matters for Tuneline. Many popular songs exist mainly as explicit versions, so matching by artist plus title may fall back to a "clean" version or find nothing. This could explain unexpected filter losses.
- Moving to the Apple Music API would add cost (Developer Program), token management and different terms (subscriber-oriented, "no indirect monetization"). It would not obviously make game use any more permitted.

### Gaps

- I found no official Apple roadmap or statement on the Search API's future.
- I could not confirm whether the explicit-results regression is still present in October 2026. It was not tested.

## How other music quiz games/projects handle this

### Takeaway

Many hobby and indie music quiz projects use free preview sources (iTunes, Deezer, formerly Spotify) without a visible licensing agreement. Apps such as Intro King play preview tracks to non-subscribers and are listed on the App Store, which shows Apple tolerates this in practice but proves nothing about compliance. I found no public report of Apple taking down a quiz game over iTunes previews. Developers who asked Apple directly (2021, July 2026) got no definitive answer.

### Cited Findings

- Community: Intro King, a free intro-quiz app with in-app purchases on the App Store, reportedly uses preview tracks for non-subscribers. Being listed does not prove compliance — [App Store: Intro King](https://apps.apple.com/app/id6449006748) (search-result summary; the listing was not opened)
- Community: ChronoHits, a song-guessing app, is on the App Store; its audio source was not verified — [App Store: ChronoHits](https://apps.apple.com/app/id6738845680)
- Community: the SongQuiz open-source repo uses Deezer, which needs no credentials, plus an optional Apple Music token — [patrickrosenfelder-tech/songquiz](https://github.com/patrickrosenfelder-tech/songquiz) (search snippet only)
- Community: blindtest (C#/WPF) is a music quiz built on the iTunes API, a small hobby project last updated Jan 2023 — [davidsan/blindtest](https://github.com/davidsan/blindtest)
- Community: open-source Hitster-like alternatives avoid preview APIs. HitStar uses local files and calls itself "independent from online platforms". Subster plays from a Subsonic library and gets metadata from Deezer/MusicBrainz — [Born2Root/HitStar](https://github.com/Born2Root/HitStar); [Subster on F-Droid](https://f-droid.org/pt/packages/app.subster/)
- Community: pinster, a Hitster CLI clone, needs a Spotify Developer App — [pinster on PyPI](https://pypi.org/project/pinster)
- Community: Heardle originally used SoundCloud audio. Commentators doubted it held any licence, Spotify bought it in July 2022 and shut it down in April 2023 — [Wikipedia: Heardle](https://wikipedia.com/wiki/Heardle); [CMU](https://archive.completemusicupdate.com/article/music-based-wordle-clone-heardle-asks-you-to-name-that-tune/)
- Community (Aug 2026): the GuessSong guide says preview API terms "typically permit" promotional use with attribution and store links, and that this question is separate from public-performance rights. It cites no official sources. It also claims Spotify stopped giving new apps 30-second preview URLs in late 2024 — [GuessSong guide](https://www.guessong.app/guides/music-quiz-licensing-and-previews)
- Community: an Apple forum poster said Apple let their app, which plays preview URLs, onto the App Store, but that this "doesn't necessarily legally cover me" — [Apple Developer Forums thread 681105](https://developer.apple.com/forums/thread/681105) (search snippet only)

### Inferences

- The community norm is "use previews, attribute, link back, stay free, and hope". Any tolerance comes from Apple not enforcing, not from Apple's permission. Being small and free with no ads keeps the risk low but not zero. The realistic worst cases are an IP block or a removal request (the terms require removal "immediately upon request"), not damages. That is an assumption, not a sourced fact.
- Deezer's public API is the common fallback for preview-based quiz games. Its terms were not researched here.

### Gaps

- I found no documented case of Apple sending a takedown or cease-and-desist, or giving explicit approval, to a music quiz or game over iTunes Search API previews.
- I could not verify which preview source most popular web quiz games (for example Songless, SongTrivia, Bandle) use in 2026.
