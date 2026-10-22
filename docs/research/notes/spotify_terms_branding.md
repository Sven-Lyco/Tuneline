# Spotify Developer Terms, Developer Policy and Design/Branding Guidelines for a music timeline party game (as of October 2026)

Scope: Tuneline (Hitster-like web game). The host logs in with Spotify. The server reads the host's playlists and track metadata (title, artist, album release year, cover art). Players place songs on a timeline. Audio comes from the iTunes Search API, not from Spotify.

Status: complete (researched 2026-10-21). Official text was checked word for word by downloading the live pages (developer.spotify.com/policy, /terms, /documentation/design, the quota-modes page and the February 2026 migration guide). This is **not legal advice**. Section numbers: the Developer Policy uses Roman-numeral sections with unnumbered bullets, so these notes cite "Section III, 2nd bullet" and similar. The Developer Terms are cited by section and sub-heading names as they appear on the page.

Key documents and effective dates:

- Spotify Developer Policy, "Effective as of 15 May, 2025" — [Developer Policy](https://developer.spotify.com/policy)
- Spotify Developer Terms, Version 10, effective 15 May 2025 — [Developer Terms](https://developer.spotify.com/terms)
- Design & Branding Guidelines (no revision date shown, only © 2026 Spotify AB) — [Design Guidelines](https://developer.spotify.com/documentation/design)

Code facts from the Tuneline repo, used below for the inferences (checked locally, not external sources):

- `client/src/components/Vinyl.tsx` shows the cover in a circle (`border-radius: 50%`, `background-size: cover`) inside a vinyl that spins while audio plays (`animation: spin 2.5s linear infinite`). At the default size of 85, the cover is about 31 px across.
- The client never shows a Spotify logo or icon, and it never links to open.spotify.com (no `external_urls` in the requested fields).
- Spotify Green (`#1db954` / `#1ed760`) is used on the login button, the playlist selection, `PlaylistBadge` and the help screen.
- `server/src/spotify.ts` calls `/me/playlists?limit=50` and `/playlists/{id}/tracks`. It requests the fields `track(id,name,artists(name),album(name,album_type,release_date,images))`.

---

## Attribution: what do the Spotify Design Guidelines require when showing Spotify metadata and cover art?

### Takeaway

Any Spotify metadata or cover art shown must carry the Spotify logo (the full logo, at least 70 px; the icon alone, at least 21 px, only when space is short). It must also link back to the matching Spotify item, with labels like "PLAY ON SPOTIFY" or "OPEN SPOTIFY". Cover art must stay unmodified: no cropping, no animation, no overlays, only small rounded corners (4/8 px). Tuneline currently has no Spotify logo and no link back, and its spinning circular vinyl cover breaks the artwork rules.

### Cited Findings

- **Developer Policy, Section II, "Attribution":** you must "clearly attribute the content as being supplied and made available by Spotify". This is done "by using the Spotify Marks". — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Policy, Section II, "Attribution":** "Metadata, cover art and Audio Preview Clips must be accompanied by a link back". The link goes to "the applicable album, content or playlist on the Spotify Service". — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Policy, Section II:** you must not offer metadata or cover art "as a standalone service or product". — [Developer Policy](https://developer.spotify.com/policy)
- **Design Guidelines, "Attribution":** "you must always attribute content from Spotify with the logo". Partner integrations should use the full logo (icon + wordmark). The icon alone is allowed as a device app icon, or when there is not enough room for the full logo. — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Design Guidelines, "Using the icon":** the icon may stand alone when space is short or "the Spotify brand has already been established". The wordmark must never appear without the icon. — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Design Guidelines, logo sizes:** "never be smaller than 70px in digital" (full logo; 20 mm in print). The icon must "never be smaller than 21px in digital" (6 mm in print). The exclusion zone around the logo equals half the icon's height. Keep the logo off busy image areas, low-contrast areas and text. — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Design Guidelines, logo colours:** use the green logo only on black or white backgrounds (or non-duotoned photos). On other backgrounds use the black or white monochrome logo. Do not rotate, stretch or recolour the logo. — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Design Guidelines, "Linking back":** "it must always link back to the Spotify Service". This covers any Spotify metadata: artist, album and track names, artwork and playback. When the Spotify app is installed, use "OPEN SPOTIFY, PLAY ON SPOTIFY or LISTEN ON SPOTIFY". When it is not installed, use "GET SPOTIFY FREE". — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Design Guidelines, "Artwork":** "Don't crop the artwork in any way." "Don't animate or distort it in any way" (this includes overlays and blurring). No images or text on top of the artwork, and no playback controls over it. Corners must be rounded: 4 px on small and medium devices, 8 px on large ones. Use only artwork provided by Spotify. Leaving the artwork out is acceptable when screen space is limited. — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Developer Terms, Section IV "Restrictions", "Misuse of the Spotify Platform":** no modifying or creating derivative works of Spotify Content, but "You may adjust the size of metadata or cover art as necessary". — [Developer Terms](https://developer.spotify.com/terms)
- **Design Guidelines, "Metadata":** show track, artist, album and playlist names exactly as Spotify provides them. "Don't manipulate any content or metadata." Truncation is allowed when the full text stays reachable. Recommended minimum character counts: playlist/album 25, artist 18, track 23. — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Design Guidelines:** "Spotify content should never be seated next to content from similar services." — [Design Guidelines](https://developer.spotify.com/documentation/design)

### Inferences

- **What Tuneline would need (interpretation):**
  - A Spotify logo near every surface that shows Spotify metadata or covers: the playlist screen, PlaylistBadge, the reveal in SongCard, the timeline cards and the result screen. Full logo at 70 px or more where space allows; otherwise the icon at 21 px or more.
  - A per-track link back on revealed songs, for example a "PLAY ON SPOTIFY" link to `open.spotify.com/track/{id}`. Tuneline already stores the track ID. Playlists also need a link to `open.spotify.com/playlist/{id}`.
- **Vinyl.tsx breaks the artwork rules in its current form.** The square cover is cropped to a circle (no-crop rule), it rotates (no-animation rule), and it sits on a vinyl graphic (arguably an overlay or modification). A compliant option: show the square cover with 4 px rounded corners next to the vinyl, or spin only a generic vinyl without the cover. The ~31 px cover size is fine, because resizing is allowed.
- **Small timeline cards:** if their covers are small or hard to fit, leaving the artwork out is explicitly acceptable. That is easier than meeting the artwork rules at tiny sizes.
- **The "similar services" sentence points against Tuneline's audio set-up.** Spotify content (metadata, cover) is shown next to and synced with Apple/iTunes audio, and Apple Music is plausibly a "similar service". See the next sections.

### Gaps

- The Design Guidelines describe a "companion app" link-back pattern, but they do not say how to attribute on screens where metadata is shown to people who are not logged in (Tuneline's guest players). No official example for multiplayer or shared screens was found.
- No revision date or changelog exists for the Design Guidelines, so it cannot be shown which rules changed between 2024 and 2026.

---

## Do the Developer Policy rules restrict games, quizzes, trivia or "guess the song/year" apps, or hiding metadata? Any rule about "replicating Spotify" or competitive use?

### Takeaway

Yes, explicitly. Developer Policy Section III lists, among prohibited applications, "Do not create a game, including trivia quizzes." A Hitster-like timeline game that uses Spotify playlists and metadata falls squarely under this text. Forum answers about Hitster-like projects read it the same way. No exception for non-commercial, private or small apps was found. Hiding metadata is not banned as such for non-streaming apps, but the game ban makes that question secondary.

### Cited Findings

- **Developer Policy, Section III "Some prohibited applications", 2nd bullet:** "Do not create a game, including trivia quizzes." The section says you must not build such apps, "nor enable or encourage others to build" them. — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Policy, Section III:** "Do not build products or services that mimic, or replicate or attempt to replace a core user experience of Spotify". Also: "must add independent value or functionality that improves users' interactions with Spotify." — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Policy, Section III, 4th bullet:** no "non-interactive internet webcasting service". The example given: an app that "plays content from a single source to several simultaneous listeners". — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Policy, Section II, "Display metadata and cover art when streaming":** for a Streaming SDA there shall be "no playback of Spotify Content without showing relevant cover art and metadata". — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Terms, definitions:** "Streaming" means using the Spotify Platform to play back sound recordings available through the Spotify Service. Widgets and Audio Preview Clips are excluded from that definition. — [Developer Terms](https://developer.spotify.com/terms)
- **Developer Policy, Section II "Misleading use":** don't confuse or mislead anyone about the artist or creator of Spotify Content. **Design Guidelines:** "Don't manipulate any content or metadata." — [Developer Policy](https://developer.spotify.com/policy); [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Forum thread "Game development similar to Hitster" (marked solved):** the reply quotes the game ban and says Spotify is for personal, non-commercial use. It concludes the asker would not have permission to build such a game. Seen only through search snippets; the forum returned HTTP 403 to automated fetches. — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Game-development-similar-to-Hitster/td-p/6554648)
- **Forum report on a music trivia app:** a community volunteer (not a Spotify employee) said the app is not eligible for a quota extension because of the game ban, with no workaround or exception. Seen through search snippets only. — [Spotify Community thread "Extended Quota Mode Request Independent Developer TrackLine"](https://community.spotify.com/t5/Spotify-for-Developers/Extended-Quota-Mode-Request-Independent-Developer-TrackLine/m-p/7384615)
- **Other forum threads show the ban has been raised many times:**
  - [What is the reason for not allowing games and quizzes](https://community.spotify.com/t5/Spotify-for-Developers/What-is-the-reason-for-not-allowing-games-and-quizzes/td-p/6219736)
  - [Not allowed to use Spotify API for games. What is considered a game](https://community.spotify.com/t5/Spotify-for-Developers/Not-allowed-to-use-Spotify-API-for-games-What-is-considered-a/td-p/5954562)
  - [The quiz game, maybe it's time to answer?](https://community.spotify.com/t5/Spotify-for-Developers/The-quiz-game-maybe-it-s-time-to-answer/td-p/5606832)
  - [Usage of API for Song Quiz Game](https://community.spotify.com/t5/Spotify-for-Developers/Usage-of-API-for-Song-Quiz-Game/td-p/5888152)
  - [use of the API for a board game](https://community.spotify.com/t5/Spotify-for-Developers/use-of-the-API-for-a-board-game/td-p/6731152)
- **How the physical Hitster game avoids the problem (forum claim):** one poster says Hitster does not use the API at all. Its cards carry QR codes that just open songs in the Spotify app. This is a user claim, not an official statement. — [Spotify Community thread](https://community.spotify.com/t5/Spotify-for-Developers/Game-development-similar-to-Hitster/td-p/6554648)
- **Competitive use:** the Developer Terms contain no ban on building a product that competes with other developers. They say Spotify itself may build products similar to or competing with your app. The relevant "replicate" rule is the Policy's ban on replacing a core Spotify experience. — [Developer Terms](https://developer.spotify.com/terms)

### Inferences

- **The game ban is the main blocker.** Tuneline's whole purpose is a game ("place the song on the timeline, get a point"). On the plain wording, using the Spotify Web API for Tuneline is not allowed, whether or not it is commercial, whether or not it is public, and whatever the audio source. Any public launch that relies on Spotify carries the risk that Spotify revokes the Client ID. Under the Terms, the licence also ends automatically when you break the rules (see the Terms section on termination).
- **Hiding title, artist and cover until the reveal** is, on its own, probably not a separate breach:
  - The "no playback without metadata" rule applies to Streaming SDAs, which play Spotify audio. Tuneline plays iTunes audio, so it is not a Streaming SDA.
  - Hiding is still the core quiz mechanic, which the game ban covers anyway.
  - The rule "Don't manipulate any content or metadata" is about altering, not withholding. This is interpretation; Spotify has not confirmed it.
- **"Replicating Spotify" is low risk.** A timeline game does not replace a core Spotify experience. But the "must add independent value… that improves users' interactions with Spotify" requirement is hard to meet when no audio goes through Spotify.
- **The webcasting ban is probably not triggered by the audio itself,** because the audio comes from iTunes. It could become relevant in "host-only" audio mode if the audio ever came from Spotify.
- **Compliant alternative patterns (interpretation, needs Spotify confirmation):**
  - Drop the Spotify Web API entirely. Use only iTunes or Apple metadata, or open/QR links like the physical Hitster.
  - Or use Spotify only for a non-game feature, for example exporting played songs as a playlist.

### Gaps

- **No official Spotify statement defining "game" was found.** It is unclear whether a "music timeline party game" with no Spotify playback is in scope. Literally it is a game, so it is very likely in scope. Only Spotify can confirm.
- **Staff vs volunteer answers could not be verified** for most threads, because the forum blocks automated fetches (HTTP 403). The "solved" Hitster thread was seen only through search snippets.
- **The date the game ban was introduced could not be confirmed.** Forum thread IDs (56xxxxx-59xxxxx) suggest it was discussed before May 2025, but the thread dates were not verified.

---

## Combining Spotify metadata with audio from other services (iTunes previews), caching/storing metadata, and passing Spotify data to other users

### Takeaway

The Developer Policy bans products "integrated with streams or content from another service". It also bans mixing or overlapping Spotify Content with other audio, and the Design Guidelines ban placing Spotify content next to "similar services". Tuneline pairs Spotify metadata and covers with Apple iTunes preview audio, which conflicts with this text. Storage may only be temporary, "strictly necessary" and never indefinite. Handing Spotify Content to third parties is banned except to data processors. Showing it to the app's own end users is normal display, but that has not been confirmed for players who are not logged in.

### Cited Findings

- **Developer Policy, Section III, 5th bullet:** "Do not create any product or service which is integrated with streams or content from another service." — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Policy, Section III, 7th bullet:** do not let any system "segue, mix, re-mix, or overlap any Spotify Content with any other audio content". — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Policy, Section II "Display metadata and cover art when streaming":** "metadata and cover art may only be used in connection with the underlying content". Strictly, this sentence is part of the rule for Streaming SDAs. — [Developer Policy](https://developer.spotify.com/policy)
- **Design Guidelines:** "Spotify content should never be seated next to content from similar services." — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Developer Policy, Section III:** "Do not build an SDA that enables the transfer of data to another service". The only exception is a user moving their own personal data or their playlists' metadata. — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Terms, Section IV, "Storing and displaying content":**
  - Do not store, aggregate or build databases of Spotify Content beyond what is "strictly necessary to operate your SDA".
  - Use reasonable efforts to show the most up-to-date data and delete older data.
  - "Do not store Spotify Content indefinitely."

  — [Developer Terms](https://developer.spotify.com/terms)
- **Developer Terms, Section IV, "Local caching":** do not locally cache Spotify Content except as "strictly necessary" for performance. Even then it is "limited to the temporary caching of" metadata and cover art (or Conditional Downloads for Premium users). — [Developer Terms](https://developer.spotify.com/terms)
- **Developer Terms, Section IV, transfer rule:** "do not transfer Spotify Content to third parties". This includes aggregate, anonymous or derived data, and it applies especially to ad networks and data brokers, "even if a user consents". Transfer to data processors such as server providers is allowed, and you are responsible for them. — [Developer Terms](https://developer.spotify.com/terms)
- **Developer Policy, Section III:** do not analyse Spotify Content or the Service for any purpose, for example derived metrics, usage statistics or user profiles. — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Terms, Section V and the Data Protection Appendix:**
  - Provide an easy way to disconnect the Spotify account. On disconnect, stop processing and delete the user's Spotify Personal Data "within five (5) days" (Appendix, §5c).
  - Show a privacy policy "before they install or signup".
  - Require end users to accept an end-user agreement that includes minimum terms, including that Spotify is a third-party beneficiary.

  — [Developer Terms](https://developer.spotify.com/terms)
- **Developer Policy, Section I:** "Only request and process the data that is needed to operate your SDA." Personal data may be kept only "as long as is necessary". — [Developer Policy](https://developer.spotify.com/policy)

### Inferences

- **iTunes audio with Spotify metadata is the second clear conflict after the game ban.** The audio is shown and played as belonging to the Spotify track, which reads as "integrated with … content from another service". Apple is plausibly a "similar service".
  - This holds even though it is a technical workaround. Spotify removed `preview_url` for new apps in November 2024 (see the rule-changes section), which is likely why Tuneline uses iTunes.
  - The iTunes rules (covered elsewhere) may also need checking for the reverse problem.
- **Tuneline's in-memory, short-lived storage fits the storage rules.** Room state lasts at most 2 hours and is never written to disk, which matches "temporary" and "strictly necessary".
  - The `excludeIds` list (played track IDs kept on the client for "Play again") is small and short-lived, so probably fine.
  - Session cookies with a 7-day TTL hold tokens, not Spotify Content. That is a Personal Data question: disconnecting must delete the data within 5 days. Tuneline's "Abmelden" (log out) button may need to delete server-side tokens and any user data straight away, and the disconnect path needs to be documented.
- **Sending SongFull (title, artist, year, cover) to guest players is probably "display to end users", not "transfer to third parties",** because the guests use the same app. But the guests are not Spotify-authenticated users and have not agreed to Tuneline's end-user agreement, unless the join flow shows it. Showing a short terms and privacy notice on the join screen would reduce this risk. This is interpretation and needs a lawyer or Spotify to confirm.
- **The server-side iTunes preview cache** stores Apple data, not Spotify data, so the Spotify caching rules do not apply to it. If the cache keys or values include Spotify titles or artists, that is still temporary metadata caching and fine as long as it is not kept indefinitely.

### Gaps

- No official clarification was found of whether "integrated with … content from another service" covers audio from a different provider that is matched to Spotify metadata. The wording is broad; this needs Spotify confirmation.
- There is no numeric retention limit (in hours or days) for metadata. Only "temporary", "strictly necessary" and "not indefinitely" are given.
- No official guidance was found on showing Spotify Content to people who are not authenticated, in shared or multiplayer sessions.

---

## Commercial vs non-commercial use: what is allowed for a free hobby project; ads, donations, monetization?

### Takeaway

The Terms license apps only "for private personal use". The Developer Policy bans commercial use, with a limited exception for **Non-Streaming SDAs**, which may sell ads, sponsorships or access. Tuneline plays no Spotify audio, so it would formally count as a Non-Streaming SDA. Commercial wording is not the real constraint, though: the game ban and the platform limits are. Since May 2025, a public multi-user launch needs Extended Quota, which is only open to registered organisations with at least 250k monthly active users. Development Mode allows at most 5 allowlisted Spotify users per app.

### Cited Findings

- **Developer Terms, Section III, licence:** apps may be developed and distributed "(i) for private personal use; and (ii) on Approved Devices". They must also follow the Developer Policy. — [Developer Terms](https://developer.spotify.com/terms)
- **Developer Policy, Section IV "Commercial use restrictions":** apart from the Non-Streaming exceptions, "commercial uses are not permitted for SDAs". For Streaming SDAs, the examples include:
  - selling the app, the Platform or Spotify Content, or selling access to them;
  - "any e-commerce (e.g., in-app payment or monetization)";
  - selling ads or sponsorships.

  — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Policy, Section IV "Limited commercial use permitted for Non-Streaming SDAs":** the only permitted commercial uses are:
  - selling advertising, sponsorships or promotions on the Non-Streaming SDA;
  - selling the Non-Streaming SDA, or access to it (including e-commerce started from it).

  — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Policy, Section III:** no products for businesses. "Spotify is for personal, non-commercial use". It "can't be broadcast or played publicly from a business" (bars, restaurants, stores and so on). — [Developer Policy](https://developer.spotify.com/policy)
- **Developer Terms, Section V:** "You will not sell any Spotify Content or other data obtained from Spotify." — [Developer Terms](https://developer.spotify.com/terms)
- **Quota modes page:**
  - Development Mode allows "Up to 5 authenticated Spotify users", and each must be added to the app's allowlist.
  - The app owner must have Spotify Premium.
  - Extended Quota: "as of May 15th 2025, Spotify only accepts applications from organizations (not individuals)".
  - Extended Quota requirements: a legally registered business, a launched service, "at least 250k MAUs", availability in key markets, commercial viability, and adherence to the terms.

  — [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Blog, 15 April 2025:** the new extended-access criteria take effect 15 May 2025, and "development mode will remain accessible for experimentation and personal use". — [Spotify for Developers blog, 2025-04-15](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- **Developer Policy, Section VII:** extra quota may be used "only for the use case that Spotify reviewed". Access may be revoked if a review finds breaches. — [Developer Policy](https://developer.spotify.com/policy)

### Inferences

- **A free hobby deployment for friends** is the only scenario the documents openly allow ("experimentation and personal use"):
  - Development Mode;
  - up to 5 allowlisted Spotify hosts;
  - an app owner with Premium.

  Even then, the game ban applies on its own wording.
- **Guest players without Spotify accounts probably do not count against the 5-user cap.** The cap counts authenticated Spotify users. This is interpretation.
- **Every host needs to be allowlisted manually.** So a public "anyone can host" launch is not possible without Extended Quota. An individual cannot get Extended Quota, and a game would be refused under the policy anyway.
- **Ads or a paywall** would formally fall under the Non-Streaming exception. But they conflict with the "private personal use" licence and would make enforcement more likely. Advice: avoid them while relying on Spotify.
- **Donations** (for example a "buy me a coffee" link) are not addressed. They are arguably "monetization" or "e-commerce initiated via" the app. That is low risk for a Non-Streaming SDA under the exception, but uncertain under "private personal use". This needs a lawyer.

### Gaps

- Donations and tip jars are not mentioned anywhere in the Terms or the Policy.
- No definition of "private personal use" was found, for example whether a public website open to strangers is still "private personal use".

---

## Naming and branding: can the app mention Spotify in its name or UI text? "Login with Spotify" button rules, Spotify Green, trademarks

### Takeaway

The name "Tuneline" is fine. App names must not contain "Spotify", must not start with "Spot" and must not sound or look like Spotify, though saying the app works "for Spotify" is acceptable. Naming Spotify in UI text, such as "Mit Spotify einloggen" (log in with Spotify), is not banned, but it must not suggest endorsement. The Design Guidelines found here have no rules specific to a login button. Your own branding must not resemble Spotify brand elements, Spotify Green included, and Tuneline uses Spotify Green as an accent in several places.

### Cited Findings

- **Developer Policy, Section VI "Naming and Branding":** the name "should not begin with 'Spot' or be confusing in sound or spelling to Spotify". Do not imply endorsement, tie-in, co-branding or promotion by Spotify without permission. — [Developer Policy](https://developer.spotify.com/policy)
- **Design Guidelines, "Naming your application":** the app name "should not include 'Spotify' or be similar to 'Spotify'". It shouldn't imply endorsement, "but suggesting to users that it is 'for Spotify' is acceptable." — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Design Guidelines, "Logos and naming restrictions":**
  - Your logo must not resemble the Spotify logo or brand elements such as Spotify Green, the circle or the sound waves.
  - Do not put Spotify trademarks into company, product or app names.
  - Do not pair the Spotify brand with other brands in co-branded communication.

  (Summarised from the page.) — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Developer Terms:**
  - Spotify Marks may be used only "to promote your use" of the Platform.
  - No registering trademarks or domain names that include "Spotify" or something confusingly similar.
  - No Spotify Marks in your company or service name.
  - No implying partnership, sponsorship or endorsement without written approval.

  — [Developer Terms](https://developer.spotify.com/terms)
- **Design Guidelines, colours:** Spotify Green is described as the colour used when Spotify's voice needs to be recognisable. Don't introduce colours outside the Spotify palette (this is about rendering Spotify brand assets). — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Login button:** the main Design Guidelines page has no rules for a "Login/Connect with Spotify" button. It was checked by fetching the full text. — [Design Guidelines](https://developer.spotify.com/documentation/design)
- **Developer Policy, Section II:** your app must not "have a specific artist or artists as the sole subject" without permission. — [Developer Policy](https://developer.spotify.com/policy)

### Inferences

- "Tuneline" meets the naming rules. Avoid domains or subtitles such as "Spotify Timeline" or "Spotify-Quiz".
- **Login button:** a green button with "Mit Spotify einloggen" plus the official Spotify icon (21 px or more) is the usual, low-risk pattern. It is nominative use, and the green background acts as the Spotify element of the button rather than as Tuneline's own branding.
- **Spotify Green as Tuneline's own UI accent is the bigger risk.** Examples: the selected border on playlist cards in PlaylistScreen, the "ready" button, the PlaylistBadge text and the help-screen step numbers. These could read as resembling Spotify brand elements or as implied co-branding. Recommendation (interpretation): limit `#1db954` to elements that clearly mean Spotify (the login button, the Spotify attribution) and give Tuneline its own accent colour elsewhere.
- **Help screen and help text:** describing that the host needs a Spotify account is fine. Avoid wording like "official", "powered by Spotify" in a way that suggests partnership, or "Spotify game".

### Gaps

- No dedicated official page with button specifications for "Log in with Spotify" was found. There may be assets on Spotify's brand portal that were not reviewed.
- Rules on using Spotify Green outside the Spotify logo are phrased as rules for your own logo and brand elements. Whether they apply to UI accent colours is unclear.

---

## Rule changes 2024–2026 that matter here (with effective dates)

### Takeaway

Five changes matter:

- **27 Nov 2024:** new apps lost 30-second `preview_url`s in multi-get responses, recommendations, audio features, and access to Spotify-owned editorial and algorithmic playlists.
- **15 May 2025:** new Developer Terms (v10) and Developer Policy took effect, including the explicit ban on AI/ML training and ingestion. On the same date, Extended Quota became organisations-only with at least 250k MAU.
- **11 Feb 2026 (new apps) / 9 Mar 2026 (existing apps):** Development Mode was cut down: the owner needs Premium, 1 Client ID per developer (raised to 25 in July 2026), 5 users per app, a smaller set of endpoints, and playlist items only for playlists the user owns or collaborates on.
- **February 2026 (implementation):** this playlist-items restriction directly affects Tuneline. Tuneline's server still calls the deprecated `/playlists/{id}/tracks` endpoint.

### Cited Findings

- **Blog, 27 Nov 2024, "Introducing some changes to our Web API":** apps registered on or after that date, and existing Development Mode apps without a pending extension, lose access to:
  - Related Artists, Recommendations, Audio Features, Audio Analysis;
  - 30-second preview URLs in multi-get responses;
  - algorithmic and Spotify-owned editorial playlists.

  Existing extended-mode apps were not affected. (Seen through the search summary; the article itself was not fetched.) — [Spotify for Developers blog, 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- **Developer Terms, Version 10, effective 15 May 2025:** Section IV "Misuse" bans using the Platform or Content "to train a machine learning or AI model". It also bans ingesting Spotify Content into such a model. — [Developer Terms](https://developer.spotify.com/terms)
- **Developer Policy, effective 15 May 2025, Section III, last bullet:** "Do not use the Spotify Platform or any Spotify Content to train a machine learning or AI model". — [Developer Policy](https://developer.spotify.com/policy)
- **Extended Quota changes, effective 15 May 2025:** organisations only, legally registered business, at least 250k MAU, key markets, commercial viability. — [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes); [Blog 2025-04-15](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- **Blog, 6 Feb 2026, "Update on Developer Access and Platform Security":**
  - "Development Mode use will require a Spotify Premium account."
  - One Development Mode Client ID per developer.
  - "Each Client ID will be limited to up to five authorized users."
  - A smaller set of endpoints.
  - New Client IDs follow the new rules from 11 Feb 2026; existing ones from 9 Mar 2026.
  - A later update postponed the endpoint changes for existing Development Mode integrations, while the Premium, user-cap and Client ID rules stayed in force (seen through the fetch summary and community-thread snippets).

  — [Spotify for Developers blog, 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security); [February 2026 update thread](https://community.spotify.com/t5/Spotify-for-Developers/February-2026-Spotify-for-Developers-update-thread/td-p/7330564)
- **February 2026 migration guide:**
  - "All Development Mode apps require the app owner to have an active Spotify Premium subscription." If the owner's Premium lapses, the app stops working.
  - New apps: 1 Client ID per developer and 5 users per app; existing apps are grandfathered.
  - "As of July 2026, the Client IDs per developer limit has been increased" to 25.

  — [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **February 2026 migration guide, endpoint changes:**
  - `GET /playlists/{id}/tracks` is replaced by `GET /playlists/{id}/items`, "Only available for playlists the user owns or collaborates on". For other playlists, only metadata is returned and `items` is absent.
  - Get Several Tracks, Albums and Artists are removed.
  - Track `popularity` and `available_markets` are removed; album `label` and `popularity` are removed.
  - `release_date` is not listed as removed.
  - Search `limit` maximum is cut to 10.

  — [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)

### Inferences

- **Tuneline technical risk (outside branding, but decision-relevant):** in Development Mode under the 2026 rules, hosts can only use their own or collaborative playlists. Followed or editorial playlists such as "80s Hits" would come back without tracks.
  - Tuneline calls the deprecated `/playlists/{id}/tracks` endpoint. This works only while the endpoint postponement for existing integrations holds, and only if Tuneline's Client ID was created before 11 Feb 2026.
  - A new Client ID would already be on the new rules.
  - Migrate to `/items`, and expect followed playlists to return no tracks.
- **The Premium requirement for the app owner** means the developer's own Premium subscription is a single point of failure for every game.
- **The 2024 removal of `preview_url`** explains the move to iTunes. But it does not make the policy's "content from another service" ban any less relevant.
- **AI/ML:** Tuneline does no ML. Any future feature that sends Spotify metadata to an LLM (for example "generate fun facts about this song") would breach Terms Section IV and Policy Section III. Note this as a constraint on future features.

### Gaps

- The exact wording of the 2024-11-27 blog and of the postponement notice for existing integrations was not fetched first-hand. It comes from search and fetch summaries plus forum snippets.
- Previous versions of the Terms and Policy (before v10) were not compared, so it is not confirmed which clauses are *new* as of May 2025. In particular, it is unclear whether the game ban or the AI clause existed earlier. Forum thread IDs suggest the game ban predates 2025.
- The contents of the July 2026 changelog (beyond the Client ID increase) were not reviewed in detail. No Spotify developer-terms changes after July 2026 (Aug–Oct 2026) were found. Absence of evidence is not confirmation.
- **Not legal advice.** Before any public or monetised launch, two questions need written confirmation from Spotify or a lawyer: (a) whether a non-streaming timeline game is covered by "Do not create a game", and (b) whether iTunes audio counts as "content from another service". Given the explicit wording, the realistic expectation is that both answers are "yes, prohibited".

## Playing Spotify audio instead of iTunes previews (checked 22 Oct 2026)

Question: could Tuneline play the playlist's own Spotify track (for example from second 30) instead of an iTunes preview, so the version always matches?

### Takeaway

Technically yes, through the Web Playback SDK in the host's browser or through the Player API controlling the host's Spotify app. Under the rules it is worse than today: as a Streaming SDA, Tuneline would have to show cover art and metadata during playback, which is exactly what the game hides. Every host would need Premium, and only the host's device would play. Short Spotify previews are no alternative, because new and Development Mode apps no longer get them.

### Cited Findings

- **Developer Policy, Section II, item 5 (fetched first-hand 22 Oct 2026):** "there shall be no playback of Spotify Content without showing relevant cover art and metadata in your SDA." Section III, item 2 still reads "Do not create a game, including trivia quizzes." Items 6 and 7 add "Do not synchronize any sound recordings with any visual media" and "Do not permit any device or system to segue, mix, re-mix, or overlap any Spotify Content with any other audio content". The page still says "Effective as of 15 May, 2025". — [Developer Policy](https://developer.spotify.com/policy)
- **Web Playback SDK:** "The Web Playback SDK requires a Spotify Premium subscription"; "mobile only types of premium subscriptions are excluded". It is "supported by most web browsers (Chrome, Firefox, Safari and Microsoft Edge)" "in both mobile (Android and iOS) and Desktop". Troubleshooting: "iOS support has some limitations", "The playback does not start automatically after transfering playback", "The user must interact with the SDK events to play audio." — [Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk)
- **Player API, Start/Resume Playback:** "This API only works for users who have Spotify Premium." Scope `user-modify-playback-state`; body accepts `position_ms`; "The order of execution is not guaranteed when you use this API with other Player API endpoints." Without `device_id`, "the user's currently active device is the target." — [Start/Resume Playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback)
- **February 2026 migration guide:** does not mention `/me/player`, playback transfer, the Web Playback SDK or the `streaming` scope; its removals cover library, playlist, batch, browse, other-user, search and field changes. "All Development Mode apps require the app owner to have an active Spotify Premium subscription." — [Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Spotify blog, 27 Nov 2024 (fetched first-hand):** lists "30-second preview URLs" "in multi-get responses (`SimpleTrack` object)" among what new use cases can no longer access. Affected are new apps and existing apps in development mode without a pending extension request; apps with existing extended access "remain unaffected". — [Changes to the Web API](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- **Community, 2025–2026:** developers still report `preview_url` as null for most tracks. — [Community: Previews not working](https://community.spotify.com/t5/Spotify-for-Developers/Previews-not-working/td-p/7274270)

### Inferences

- Hiding title and cover while a Spotify track plays would breach the metadata rule directly, on top of the game ban. Today the rule does not apply, because the audio comes from iTunes and Tuneline is not a Streaming SDA.
- Guests never log in with Spotify, so with Spotify audio only the host's device could play; the "Alle hören" mode would go.
- Controlling the host's Spotify app via the Player API shows title and cover on the host's phone, interrupts their own listening and adds every game song to their history and recommendations.
- Mobile browsers are not a blocker (an earlier assumption in the chat was wrong), but iOS needs a tap to start playback.

### Gaps

- Not tested against a real Development Mode app: whether the SDK works for allowlisted non-owner users with Premium, and how the playback quota behaves.
- No statement from Spotify on whether a game that shows title and cover only after the guess would satisfy "showing relevant cover art and metadata".
