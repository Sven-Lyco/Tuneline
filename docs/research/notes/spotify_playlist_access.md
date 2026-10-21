# Spotify Web API: Playlist and Track Access for New Apps (as of October 2026)

Research date: 2026-10-21. "Official" = developer.spotify.com (blog, reference, changelog, migration guide). "Community" = community.spotify.com threads, GitHub issues, third-party blogs. The community.spotify.com pages returned HTTP 403 to direct fetching, so quotes from there come from search-result snippets and could not be checked word for word against the full thread.

Short answer: a **new Development Mode app** (created on or after 2026-02-11) can list the logged-in user's playlists, but can read **tracks only from playlists the user owns or collaborates on**. It must use `GET /playlists/{id}/items`. The old `/tracks` path is gone for these apps, `limit` tops out at 50, and the track sits under `item`, not `track`. Spotify-owned editorial and algorithmic playlists have been blocked for new apps since 2024-11-27. **Extended Quota Mode** is unchanged by the 2026 changes, so followed playlists stay readable there, but since 2025-05-15 it is open only to organisations with about 250k MAU. The fields a timeline game needs (`name`, `artists`, `album.release_date`, `album.release_date_precision`, `album.album_type`, `album.images`) are still documented and were not removed. `preview_url` is deprecated.

## 1. What did the November 27, 2024 Web API changes restrict for new / development-mode apps?

### Takeaway

From 2024-11-27, new apps and dev-mode apps without a pending extension request lost access to eight features. These include Recommendations, Related Artists, Audio Features and Analysis, Featured and Category Playlists, 30-second previews in multi-get responses, and algorithmic and Spotify-owned editorial playlists. Existing extended-mode apps kept them. No source says this has been reversed, so it still applies in October 2026.

### Cited Findings

- **Effective date:** 2024-11-27, the date of the post. "new Web API use cases will no longer be able to access or use the following endpoints and functionality in their third-party applications." — [Spotify blog, 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- **The exact eight items** (official):
  1. Related Artists
  2. Recommendations
  3. Audio Features
  4. Audio Analysis
  5. Get Featured Playlists
  6. Get Category's Playlists
  7. 30-second preview URLs in multi-get responses (the SimpleTrack object)
  8. Algorithmic and Spotify-owned editorial playlists

  — [Spotify blog, 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- **Affected apps** (official): existing apps still in development mode with no pending extension request, and new apps registered on or after 2024-11-27. — [Spotify blog, 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- **Unaffected apps** (official): "Applications with existing extended mode Web API access that were relying on these endpoints remain unaffected by this change." — [Spotify blog, 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- **Community restatement of the cut-off:** apps that did not have an approved or pending quota extension before 2024-11-27 "no longer have access to retrieve playlist information for playlists where Spotify is the user (e.g., Discover Weekly)". From a community answer; the poster's staff status is unclear. — [community thread](https://community.spotify.com/t5/Spotify-for-Developers/An-issue-that-I-couldn-t-find-my-playlist-that-I-m-looking-for/td-p/6779423)
- **Follow-on change:** in 2026 the official track object reference marks `preview_url` as deprecated and nullable for all responses, not only multi-get. It notes that "Spotify policy prohibits offering preview clips as a standalone service". — [Get Playlist Items reference](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)
- **Place in Spotify's timeline:** Spotify's 2026 post lists the 2024-11-27 change as "Refined access for Web API endpoints". Its other earlier milestones are 2021-05-27 (developer modes introduced), 2025-02-12 (outdated OAuth flows deprecated) and 2025-04-15 (new extended-quota criteria). — [Spotify blog, 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)

### Inferences

- **Effect on Tuneline:** the game gets audio from iTunes, so losing Spotify `preview_url` does not matter. What matters is item 8 (Spotify-owned editorial and algorithmic playlists), which is permanently out of reach for a new app in either mode, unless Spotify reverses it. See section 2.
- **"New use cases":** the blog ties the restriction to new use cases, not only to dev mode. So an app that gets Extended Quota after 2024-11-27 probably does not regain these features either. No official statement confirms this; see section 2.

### Gaps

- I found no official statement after 2024 that revisits or reverses any of the eight items.
- The blog does not say what HTTP status the blocked endpoints return. Community reports for playlists say 404 (section 2).

## 2. Can a new app read tracks of Spotify-owned editorial / algorithmic playlists? What error? Does Extended Quota change it?

### Takeaway

No. For a new app in Development Mode, `GET /playlists/{id}` and `GET /playlists/{id}/items` return **404 "Resource not found"** for Spotify-owned playlists such as All Out 80s, Discover Weekly, Daily Mix and Release Radar. A Spotify moderator called this "expected behavior for the non-extended quota mode clients". Apps that had extended access before 2024-11-27 keep access. For apps that get Extended Quota later, the documentation is ambiguous. Since February 2026 a second block applies to new Dev Mode apps: playlist items come back only for owned or collaborative playlists, and Spotify is the owner of these.

### Cited Findings

- **Official basis:** "Algorithmic and Spotify-owned editorial playlists" are on the list of items blocked for new use cases. — [Spotify blog, 2024-11-27](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- **Error code (community):** a 404 on a Spotify-owned playlist from Get Playlist or Get Playlist Items "is the expected behavior for the non-extended quota mode clients". This is attributed to a community moderator; the wording comes from a search snippet. — [community thread "playlists API Endpoint Issue Fixed"](https://community.spotify.com/t5/Spotify-for-Developers/playlists-API-Endpoint-Issue-Fixed/m-p/6589015/highlight/true)
- **Staff reply (community):** "due to the changes of November 27, 2024, it is no longer possible to get playlist data from Spotify that have Spotify as its owner". This covers editorial playlists (IDs starting with `37i9dQZF1`) and algorithmic ones such as Daily Mix. The wording comes from a search snippet. — [community thread "404 Resource not found for Playlists by Spotify"](https://community.spotify.com/t5/Spotify-for-Developers/404-Resource-not-found-for-Playlists-by-Spotify/td-p/6552598); [community thread "API /playlists/{id} returns 404s"](https://community.spotify.com/t5/Spotify-for-Developers/API-playlists-id-returns-404s/td-p/6550685)
- **Observed behaviour (community):** Discover Weekly was missing from the playlists list, and fetching it by ID returned "resource not found". — [community thread](https://community.spotify.com/t5/Spotify-for-Developers/An-issue-that-I-couldn-t-find-my-playlist-that-I-m-looking-for/td-p/6779423)
- **`/me/playlists` side effect and fix:** right after the change, Spotify-owned playlists showed up as `null` entries in `/me/playlists`. Spotify said it "fixed the behaviour in the `/me/playlists` and `/users/{user_id}/playlists` endpoints". It added that "extended quota mode clients were not affected by this issue". — [community thread "playlists API Endpoint Issue Fixed"](https://community.spotify.com/t5/Spotify-for-Developers/playlists-API-Endpoint-Issue-Fixed/m-p/6589015/highlight/true); [community thread "Discover Weekly playlist appears as null"](https://community.spotify.com/t5/Spotify-for-Developers/Discover-Weekly-playlist-appears-as-null-when-using-Get-User/m-p/6551114)
- **Spotify-owned playlists left out of the list (community):** a thread is titled "Current User's Playlist doesn't list Spotify-owned playlists". This suggests the fix removes these playlists from `/me/playlists` for non-extended apps instead of returning `null`. — [community thread](https://community.spotify.com/t5/Spotify-for-Developers/Current-User-s-Playlist-doesn-t-list-Spotify-owned-playlists-e-g/m-p/6821283/highlight/true). The thread body could not be fetched.
- **Second block from February 2026 (official):** "Playlist items are returned only for playlists the user owns or collaborates on. For other playlists, only metadata comes back, and `items` is absent." This took effect for new Dev Mode apps on 2026-02-11. — [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Extended Quota and the 2026 changes (official):** Extended Quota apps need no migration; "existing endpoints, fields, and behaviors are unchanged". — [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Getting Extended Quota (official):** since 2025-05-15 it is available only to organisations. The criteria are an established legal business entity, an active launched service, at least about 250k MAU, availability in key Spotify markets, commercial viability, and adherence to the terms. Review can take up to six weeks. — [Quota modes documentation](https://developer.spotify.com/documentation/web-api/concepts/quota-modes); [Spotify blog, 2025-04-15](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access). The blog itself names no MAU figure; the 250k figure appears on the quota-modes page.

### Inferences

- **New Dev Mode app:** Spotify-owned playlists are blocked twice over. The 2024 rule gives a 404, and the 2026 owner/collaborator rule would give a 403 on items or metadata only. A Spotify-owned playlist can never be "owned" by the user.
- **New Extended Quota app:** the 2026 owner/collaborator rule does not apply. Whether Spotify-owned playlists become readable depends on how Spotify reads "new use cases", and the sources conflict:
  - The 2024 blog points to no access for any use case created after 2024-11-27.
  - The moderator's wording, "expected for non-extended quota mode clients", points to access for Extended Quota clients.
  - Either way, a hobby or party-game project cannot realistically meet the organisation and 250k MAU bar.
- **Practical workaround:** the user copies a Spotify playlist into their own playlist in the Spotify client (for example "Add to other playlist"). That copy is owned by the user and readable in Dev Mode. This is my inference from the ownership rule; I found no Spotify statement endorsing it.

### Gaps

- I have no verbatim official doc text naming the HTTP status for Spotify-owned playlists. The 404 comes only from community threads, which could not be fetched in full.
- I found no confirmed report from an app granted Extended Quota after 2024-11-27 saying whether Spotify-owned or algorithmic playlists are readable.
- I could not confirm whether a new Dev Mode app's `/me/playlists` leaves out followed Spotify-owned playlists entirely or still returns them as metadata. Community thread titles point to "left out", but this is not verified.

## 3. Further 2025–2026 changes affecting /me/playlists, playlist items, track/album fields, renames, pagination

### Takeaway

The big change came in February 2026, for new Dev Mode apps from 2026-02-11:

- `/playlists/{id}/tracks` became `/playlists/{id}/items`.
- In responses, `tracks` became `items` and `track` became `item`. `track` is now a boolean.
- `limit` on items is at most 50.
- Batch GETs (`/tracks?ids=`, `/albums?ids=`, …) are gone.
- `popularity`, `available_markets` and `linked_from` were removed. `external_ids` was removed and then restored in March 2026.

For existing Dev Mode apps the endpoint changes were postponed on 2026-03-09, and I found no new date. The fields a timeline game needs are still documented. Later 2026 changelogs (March, May, July) change nothing about playlists.

### Cited Findings

#### Dated timeline (official unless marked)

- **2025-02-12:** Spotify blog on deprecating outdated OAuth flows and raising security requirements, linked from the 2026 post. — [Spotify blog, 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security). I did not fetch the 2025-02-12 post itself; see Gaps.
- **2025-05-15:** new Extended Quota criteria take effect. Requests filed before that date were reviewed under the old framework. Apps that already had extended access "will remain unaffected". — [Spotify blog, 2025-04-15](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- **2026-02-06:** announcement. Development Mode is narrowed to "learning, experimentation, and non-commercial personal projects". The new rules are a Premium requirement for the app owner, one Dev Mode Client ID per developer, at most five authorised users per Client ID, and "a smaller set of supported endpoints". — [Spotify blog, 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- **2026-02-11:** all **newly created** Dev Mode Client IDs get the new rules. — [Spotify blog, 2026-02-06](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security); [migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **2026-03-09:** blog update. "we have decided to postpone endpoint access changes for existing integrations". The Premium requirement, user cap and one-Client-ID limit still took effect for existing Dev Mode apps, and "further details on updated timelines" were promised. — [Spotify blog, 2026-02-06 (with update)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
  - The migration guide still lists 2026-03-09 as the migration date for existing apps, so official pages are inconsistent. — [migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
  - A third-party tracker reviewed on 2026-10-07 found no revised date. — [vorplabs](https://vorplabs.com/agent-tools/spotify-api-changes) (third-party; it states no hands-on API verification)
- **March 2026 changelog:** `external_ids` on Album and Track [REVERTED]. It "was previously marked as removed in the February 2026 changelog but will continue to be available." — [Changelog March 2026](https://developer.spotify.com/documentation/web-api/references/changes/march-2026)
- **May 2026 changelog:** only addition is `account_id` on the User object (`GET /me`). No playlist changes. — [Changelog May 2026](https://developer.spotify.com/documentation/web-api/references/changes/may-2026)
- **2026-06-18 / 2026-07-20 (third-party only):** refresh tokens reportedly expire six months after the original authorisation, starting 2026-06-18 for new apps and 2026-07-20 for existing apps. Refreshing reportedly does not reset the clock, and an expired token returns 400 `invalid_grant`. — [vorplabs](https://vorplabs.com/agent-tools/spotify-api-changes). Not verified against an official page; see Gaps.
- **2026-07-23:** Client IDs per developer raised from 1 to 25. Dev-mode quotas are now counted per developer account, so all Client IDs share the same buckets. A quota-exceeded 429 carries the reason `QUOTA_EXCEEDED`. — [Spotify blog, 2026-07-23](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates); [Changelog July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)
  - The five-user cap per app was not changed. — [vorplabs](https://vorplabs.com/agent-tools/spotify-api-changes) (third-party)
- **Changelog index:** the July 2026 page's sidebar lists only February, March, May and July 2026. No August–October 2026 entries were found. — [Changelog July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026)

#### Endpoint renames and removals (Feb 2026; official; Dev Mode only)

- **Playlist item endpoints renamed:** `GET`, `POST`, `PUT` and `DELETE /playlists/{id}/tracks` move to `/playlists/{id}/items`. For `DELETE`, the parameter `tracks` becomes `items`. — [migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Changelog Feb 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)
- **Playlist response fields renamed:** `tracks` → `items`, `tracks.tracks` → `items.items`, `tracks.tracks.track` → `items.items.item`. — [migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Removed endpoints:**
  - Batch `GET /tracks`, `/albums`, `/artists`, `/episodes`, `/shows`, `/audiobooks` and `/chapters`
  - `GET /browse/new-releases`, `/browse/categories` and `/browse/categories/{id}`
  - `GET /artists/{id}/top-tracks`
  - `GET /users/{id}` and `GET /users/{id}/playlists`
  - `POST /users/{user_id}/playlists` (use `POST /me/playlists` instead)
  - `GET /markets`

  — [migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Search:** `limit` maximum drops from 50 to 10, and the default from 20 to 5. — [migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Still available:** Get Playlist, Get Current User's Playlists, Get Track (single), Get Album, Get Album Tracks, Search and Get Current User's Profile. — [Changelog Feb 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)

#### Fields

- **Removed (Feb 2026, Dev Mode):**
  - Track: `available_markets`, `linked_from`, `popularity`
  - Album: `album_group`, `available_markets`, `label`, `popularity`
  - Artist: `followers`, `popularity`
  - User: `country`, `email`, `explicit_content`, `followers`, `product`

  `external_ids` on track and album was restored in March 2026. — [migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide); [Changelog March 2026](https://developer.spotify.com/documentation/web-api/references/changes/march-2026)
- **Not removed:** the migration guide does not list `name`, `artists`, `album.release_date`, `album.release_date_precision`, `album.album_type` or `album.images` as removed or renamed. — [migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Current track object reference:** documents `album.release_date` (for example `"1981-12"`), `album.release_date_precision` (`year`/`month`/`day`), `album.album_type` (`album`/`single`/`compilation`), `album.images` (widest first, with `url`, `height`, `width`), `artists` (simplified, with `name`), `name`, and `external_ids` (`isrc`/`ean`/`upc`). `preview_url` and `popularity` are marked deprecated. — [Get Playlist Items reference](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)

#### Get Playlist Items

- `GET /v1/playlists/{id}/items` takes scope `playlist-read-private` and parameters `market`, `fields`, `limit` (default 20, range **1–50**), `offset` and `additional_types` (`track`, `episode`). — [Get Playlist Items reference](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)
- Each entry has `added_at`, `added_by`, `is_local` and `item`. `track` is marked deprecated. — [Get Playlist Items reference](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)
- **`track` is now a boolean (community):** in live responses `items[].track` still exists, but as a **boolean**, while the real object is in `item`. Code that reads `row["track"]` keeps running but gets nothing usable. — [dev.to, self-published, based on live testing](https://dev.to/iam-tech/your-spotify-playlist-reader-isnt-broken-its-reading-a-boolean-2lml)

#### Get Playlist and Get Current User's Playlists

- **Get Playlist:** `GET /playlists/{id}`. "The `items` field is only returned for playlists the current user owns or collaborates on." `tracks` is deprecated in favour of `items`. — [Get Playlist reference](https://developer.spotify.com/documentation/web-api/reference/get-playlist)
- **Playlist cover images:** the playlist object docs say playlist `images` URLs "are temporary and expire in under a day". This is about playlist covers, not album covers. — [Get Playlist reference](https://developer.spotify.com/documentation/web-api/reference/get-playlist); [Get Current User's Playlists reference](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists)
- **Get Current User's Playlists:** `GET /v1/me/playlists` returns "playlists owned or followed by the current user". Scope `playlist-read-private`; `limit` default 20, max 50; `offset` max 100,000. Each simplified playlist has `items` {`href`, `total`}, with `tracks` deprecated. — [Get Current User's Playlists reference](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists)

#### Observed in Dev Mode (community)

- **`/tracks` versus `/items`:** `GET /playlists/{id}/tracks` returns **403 Forbidden** in Dev Mode, while `GET /playlists/{id}/items` returns 200 for the same playlist and token. Reported 2026-03-06; the app's creation date is not stated. — [GitHub bjarneo/cliamp #54](https://github.com/bjarneo/cliamp/issues/54)
- **Batch endpoints:** removed batch endpoints such as `GET /artists?ids=` return 403, not 404, in Dev Mode. — [dev.to](https://dev.to/iam-tech/your-spotify-playlist-reader-isnt-broken-its-reading-a-boolean-2lml)

#### Dev Mode limits (official)

- The app owner needs an active Premium subscription; if it lapses, the app stops working. New apps get five users per app. — [migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- Each user must be on the app's allowlist (Dashboard → Settings → Users Management). "Users who aren't allowlisted can log in, but their API requests get a 403." — [Quota modes documentation](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

### Inferences

#### Effect on the current Tuneline code

`server/src/spotify.ts` (lines 232–234) calls `/playlists/${id}/tracks?fields=items(track(id,name,artists(name),album(name,album_type,release_date,images))),next&limit=100`. For a **new** Dev Mode app (Client ID created on or after 2026-02-11), this would probably fail or return nothing usable:

- **Path:** `/tracks` is removed, and a 403 has been observed.
- **Limit:** `limit=100` is above the documented maximum of 50 for `/items`.
- **Field filter:** `items(track(...))` selects the field that is now a boolean. It would have to be `items(item(...))`. Reading the track as `item ?? track` with an object check would cover both response shapes.

An **older** Dev Mode Client ID (created before 2026-02-11) may still work while the endpoint changes stay postponed, but Spotify can enforce them later without a fixed date. `/me/playlists?limit=50` stays valid.

#### Fields the game needs

The data the game relies on is still delivered: title, artist name, album type to filter compilations, release date with its precision, and cover images. The cover URLs on `i.scdn.co` are not covered by the "expires in under a day" note, which applies to playlist covers. Dropping `popularity` and `available_markets` does not affect Tuneline.

#### Dev Mode user cap

In Dev Mode every Spotify-logged-in **host** counts as one of the five allowlisted users. Guests without a Spotify login do not touch the Spotify API. So a public Tuneline deployment in Dev Mode is limited to five hosts, each added by hand, and the app owner must keep Premium.

### Gaps

- **Album cover URLs:** I found no official statement on whether `album.images` URLs on `i.scdn.co` are permanent. The "temporary" note was found only for playlist images.
- **Limit above 50:** I could not verify whether `limit=100` on `/items` returns 400 or is silently clamped to 50.
- **Refresh-token expiry:** the six-month expiry (2026-06-18 and 2026-07-20) is confirmed only by a third-party page. I did not locate the official announcement.
- **OAuth tightening:** I did not fetch the 2025-02-12 blog post. Details such as loopback or HTTPS redirect-URI rules and implicit-grant removal, which affect the `http://[::1]:5174` redirect, are unverified here.
- **Postponement scope:** official pages conflict on whether the endpoint changes reached existing Dev Mode apps. The blog says postponed; the migration guide still lists 2026-03-09. One community report shows `/tracks` 403 on 2026-03-06, but the app's creation date is unknown.

## 4. Are followed (not owned) user-created playlists readable? Collaborative playlists?

### Takeaway

The answer depends on the mode:

- **New Dev Mode app (since 2026-02-11):** followed playlists the user neither owns nor collaborates on show up in `/me/playlists` and return metadata from `GET /playlists/{id}`, but **no items**. `GET /playlists/{id}/items` returns **403**, and Spotify staff say there is no workaround for individual developers. Owned playlists and playlists the user collaborates on are readable.
- **Extended Quota:** followed playlists remain readable, since the 2026 rules do not apply there.

### Cited Findings

- **Rule (official):** "Playlist items are returned only for playlists the user owns or collaborates on. For other playlists, only metadata comes back, and `items` is absent." — [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Changelog wording (official):** "Will only return an items object for the user's playlist, other playlists will only provide metadata (not the contents of the playlist)." — [Changelog Feb 2026](https://developer.spotify.com/documentation/web-api/references/changes/february-2026)
- **Error code (official):** Get Playlist Items "works only for playlists the current user owns or collaborates on. Other requests return `403 Forbidden`." — [Get Playlist Items reference](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)
- **Staff reply (community):** "since Wednesday, 11 February, the Get Playlist Items endpoint only returns full track details for playlists that the current user owns or where the user is a collaborator. A 403 Forbidden status code will be returned if the user is neither the owner nor a collaborator of the playlist". The reply adds that there isn't a workaround available for individual developers. — [community thread "Persistent HTTP 403 on /v1/playlists/{id}/items"](https://community.spotify.com/t5/Spotify-for-Developers/Persistent-HTTP-403-on-v1-playlists-playlist-id-items-same-token/td-p/7410582) (search snippet; thread not fetchable)
- **Developer report (community):** "you need to own them or create them. If its a public playlist or you don't own it it will fail." — [GitHub bjarneo/cliamp #54](https://github.com/bjarneo/cliamp/issues/54)
- **Followed playlists are still listed (official):** `/me/playlists` returns playlists "owned or followed by the current user". — [Get Current User's Playlists reference](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists)
- **Extended Quota (official):** "No migration needed. Existing endpoints, fields, and behaviors are unchanged." — [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Other users' playlist lists (official):** `GET /users/{id}/playlists` is removed for Dev Mode, so another user's playlist list can no longer be read at all. — [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Existing Dev Mode apps (official):** for apps created before 2026-02-11, the endpoint access changes were postponed on 2026-03-09. — [Spotify blog, 2026-02-06 (update)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)

### Inferences

- **Tuneline host UI:** for a new Dev Mode app, the playlist screen should show only owned or collaborative playlists. Filter `/me/playlists` on `owner.id === me.id || collaborative`. Otherwise mark the others as "not loadable" and handle 403 on `/items` cleanly. Hosts who want a friend's or a Spotify playlist must copy it into their own playlist first.
- **Collaborator status:** "collaborates on" most likely means the user has actually joined a collaborative playlist as a collaborator. Merely following a playlist that has `collaborative: true` is probably not enough. This is not verified.

### Gaps

- I found no official clarification of "collaborates on". The open question is whether following a collaborative playlist is enough, or whether the user must have joined via invite.
- I found no official statement on whether `/me/playlists` in a new Dev Mode app still lists followed playlists from other users with full metadata. The reference says owned or followed; I saw no contrary report.
- The official sources do not say whether the owner/collaborator check applies to the playlist **owner's** own private playlists accessed by another allowlisted user. Presumably that is a 403 unless the user collaborates.

## 5. Current rate-limit behaviour and guidance for fetching many playlist items

### Takeaway

Spotify counts calls over a **rolling 30-second window**. Going over returns **HTTP 429 with `Retry-After` (seconds)**. Dev Mode also has separate per-endpoint-bucket **quotas**, shared across all of a developer account's Client IDs since 2026-07-23, which return 429 with `reason: "QUOTA_EXCEEDED"`. Spotify publishes no numbers. Its guidance is to back off, cache by `snapshot_id`, lazy-load, and use batch endpoints, though batch endpoints are no longer available in Dev Mode.

### Cited Findings

- **Window and 429 (official):** the rate limit is computed over a "rolling 30 second window". Going over gives 429; the client should read `Retry-After` (seconds) and back off. The limit depends on the app's mode, and no numbers are given. — [Rate limits documentation](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- **Spotify's advice (official):** request extended quota, use batch endpoints (for example Get Multiple Albums), store each playlist's `snapshot_id` so only changed playlists are re-downloaded, lazy-load, and watch request volume in the Dashboard. — [Rate limits documentation](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- **Dev Mode quota (official):** dev-mode apps under one developer account share per-endpoint-bucket limits. These are separate from rate limits and may change. Going over returns 429 with reason `QUOTA_EXCEEDED`. — [Quota modes documentation](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **2026-07-23 change (official):** quotas are counted per developer account, not per Client ID. The 429 body is `{status: 429, message: "Too many requests", reason: "QUOTA_EXCEEDED"}`. — [Changelog July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026); [Spotify blog, 2026-07-23](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)
- **Extended Quota (official):** has "higher rate limits than development mode". — [Quota modes documentation](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Batch endpoints gone for Dev Mode (official):** the batch GET endpoints are removed for Dev Mode, which contradicts the generic rate-limit advice. — [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Very long `Retry-After` (community):** after a quota was exceeded, a 429 carried `Retry-After: 82510` seconds, about 23 hours. Retrying in a loop "re-arms" the quota window. — [dev.to, live testing](https://dev.to/iam-tech/your-spotify-playlist-reader-isnt-broken-its-reading-a-boolean-2lml)
- **Page sizes (official):** at most 50 per page on `/playlists/{id}/items` and on `/me/playlists`. — [Get Playlist Items reference](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items); [Get Current User's Playlists reference](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists)

### Inferences

- **Request count:** with 50 items per page, a 500-track playlist takes 10 sequential requests. Several large playlists per game, across several hosts on the same developer account, draw from one shared Dev Mode quota.
- **What Tuneline should do:**
  - Cache playlist contents server-side, keyed by `snapshot_id`.
  - Use `fields` to shrink payloads. This does not reduce the request count.
  - Respect `Retry-After` exactly and never retry in a tight loop.
  - Treat `QUOTA_EXCEEDED` as a long block and show it to the host, not as a short wait.
- **No usable numbers:** with no published limits, capacity planning has to rely on real measurements in the Dashboard.

### Gaps

- I found no published numbers for the rate limit or the Dev Mode quota buckets, for any mode.
- I found no official statement on how long a `QUOTA_EXCEEDED` block lasts. The figure of about 23 hours comes from a single community measurement.
