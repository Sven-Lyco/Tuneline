# Spotify Web API Access Tiers (Development Mode vs. Extended Quota Mode) for a Small Indie Web Game — as of October 2026

_Researched 2026-10-21. Official Spotify sources: developer.spotify.com docs, blog and changelog. Community sources: community.spotify.com (the forum blocked direct fetching with HTTP 403, so forum content below comes from search-result snippets and is marked as community-reported), GitHub, and tech press. Context: Tuneline is a Hitster-like party game in which only the host logs in via PKCE to read their own playlists and track metadata. Audio comes from iTunes, not Spotify._

## How many users can authenticate in Development Mode today, and what happens to non-allowlisted users?

### Takeaway

As of October 2026, a Development Mode app can have **at most 5 authenticated Spotify users**, each of whom must be allowlisted first. The app owner must also have an **active Spotify Premium subscription**. The earlier limit was **25 users**. It applied from Development Mode's introduction in 2021 until the change of **11 Feb 2026** (new Client IDs) and **9 Mar 2026** (existing apps). A user who is not allowlisted can often still complete the OAuth login, but their Web API calls fail with **HTTP 403**. Community reports give the error message as "User not registered in the Developer Dashboard".

### Cited Findings

- **Official, current:** "Up to 5 authenticated Spotify users can use a development mode app. Each user must be added to the app's allowlist first." — [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Official, current:** "The app owner must have a Spotify Premium account for apps in development mode to function." — [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Official:** If the owner's Premium subscription lapses, the app stops working, and it resumes when the owner resubscribes. — [Spotify: February 2026 Dev Mode Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Official, non-allowlisted behavior:** Users who aren't allowlisted may be able to log in, but their API requests receive a 403 error. — [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Community-reported, exact error:** Many forum threads describe a `403` with the message "User not registered in the Developer Dashboard" (e.g. on `/me`). The usual cause is a missing allowlist entry or an email that doesn't match the user's Spotify account email, for example a Facebook-login email. Other reports include delays of 30+ minutes before a newly added user works, and a user-management bug that Spotify staff said had been fixed. — [Community: "User not registered in the Developer Dashboard" 403 on /me](https://community.spotify.com/t5/Spotify-for-Developers/User-not-registered-in-the-Developer-Dashboard-403-on-me/td-p/5284011); [Community: "Spotify 403 User not registered…"](https://community.spotify.com/t5/Spotify-for-Developers/Spotify-403-User-not-registered-in-the-Developer-Dashboard/td-p/5395902); [Community: error after …](https://community.spotify.com/t5/Spotify-for-Developers/403-User-not-registered-in-the-Developer-Dashboard-error-after/td-p/6057982)
- **Press (not a Spotify statement), previous limit:** Development Mode launched in 2021 with up to 25 test users, and the cap dropped from 25 to 5 per app in 2026. — [TechCrunch, Ivan Mehta, 6 Feb 2026](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/)
- **Official, effective dates:** New Development Mode Client IDs fell under the new rules (Premium, 5 users, smaller endpoint set) from **11 Feb 2026**. Existing integrations got the Premium requirement and the user cap on **9 Mar 2026**. — [Spotify Blog: Update on Developer Access and Platform Security (6 Feb 2026)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- **Official, grandfathering:** Existing apps keep any extra users or Client IDs they already had. The new limits apply only to new creations and additions. — [Spotify: February 2026 Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Official, quotas besides users:** Development Mode apps also have quota limits. Endpoints are grouped into buckets that share a limit, and going over returns HTTP 429 with reason `QUOTA_EXCEEDED`. This is separate from the general rate limit. Spotify says it may change the bucket groupings and limits. — [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Conflicting community claim:** One forum post says end users "must have Spotify Premium". The official docs only require the _app owner_ to have Premium. — [Community: Why only 5 users?](https://community.spotify.com/t5/Spotify-for-Developers/Why-only-5-users/td-p/7487947) vs. [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)

### Inferences

- In Tuneline only the host authenticates with Spotify. Guests join by room code and never touch the Spotify API. So "5 users" means **at most 5 distinct Spotify accounts that can act as host**, not 5 players. Party size is not limited by Spotify.
- Tuneline's Spotify app keeps working only while the developer's own Premium subscription is active. That makes it a single point of failure.
- If the Tuneline Client ID was created **before 11 Feb 2026** and already had more than 5 allowlisted users, the grandfathering clause means it keeps those users. It cannot add new ones beyond 5.
- The server should treat a 403 from `/me` or `/me/playlists` as "this host is not allowlisted" and show a clear message instead of a generic error. Telling 429 `QUOTA_EXCEEDED` apart from an ordinary rate-limit 429 is also worth doing.

### Gaps

- No official source says whether the **app owner counts toward the 5 users**. I found no authoritative statement either way.
- The official docs give no exact 403 error body. "User not registered in the Developer Dashboard" comes from community reports, mostly before 2026, and may have changed.
- Spotify does not publish the Development Mode quota bucket sizes.

## How does the user allowlist in the Developer Dashboard work?

### Takeaway

The app owner adds users manually in the Developer Dashboard under **app → Settings → Users Management → Add new user**, entering the person's **name and the email address of their Spotify account**. Spotify documents no approval step on its side. The owner then invites the user to use the app. The cap is 5 users per app for apps and users added since Feb/Mar 2026.

### Cited Findings

- **Official:** To add a user, go to the Developer Dashboard, open the app, then Settings > Users Management > Add new user, enter the person's name and Spotify email address, then invite them to install the app. — [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Official:** The allowlist no longer applies once an app is in Extended Quota Mode. — [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Official:** The general app-settings page only says Development Mode "limits the number of users who can install it". It has no allowlist details. — [Spotify: Apps](https://developer.spotify.com/documentation/web-api/concepts/apps)
- **Community-reported:** The email must match exactly the email on the user's Spotify account, including old or linked-login (Facebook) addresses. Some users report a delay after adding someone, and some had to remove and re-add a user. Some threads call the dashboard section "Users and Access" (older UI label). — [Community: "User not registered…" error](https://community.spotify.com/t5/Spotify-for-Developers/quot-User-not-registered-in-the-Developer-Dashboard-quot-error/td-p/5392801); [Community: User not registered in Developer Dashboard](https://community.spotify.com/t5/Spotify-for-Developers/User-not-registered-in-Developer-Dashboard/td-p/5717303)

### Inferences

- The allowlist suits a known circle of hosts, such as the developer and a few friends. It does not work as self-service onboarding for strangers: each new host has to send their Spotify email to the developer, who adds them by hand.
- Since each host's Spotify email has to be collected and stored in the dashboard, the privacy notice should mention it if Tuneline is ever shared beyond friends.

### Gaps

- No official source says whether removing a user frees a slot for someone new. That seems likely but is undocumented.
- I found no official statement on whether the invited user receives any notification. The docs only say to "invite them" yourself.

## What changed in Development Mode between 2024 and 2026?

### Takeaway

Four official waves of restrictions: **27 Nov 2024** (endpoint cut-offs for new and dev-mode apps), **15 Apr / 15 May 2025** (Extended Quota restricted to large organizations, new Developer Terms and Policy), **6 Feb 2026** announcement with **11 Feb / 9 Mar 2026** enforcement (Premium owner, 5 users, 1 Client ID, reduced endpoints), and **23 Jul 2026** (Client ID limit raised to 25, quota counted per developer account). A platform-wide freeze on new app creation ran from about late December 2025 into 2026, per community reports. I found no further official changes for Aug–Oct 2026.

### Cited Findings

- **27 Nov 2024 (official):** New Web API use cases lost access to Related Artists, Recommendations, Audio Features, Audio Analysis, Get Featured Playlists, Get Category's Playlists, **30-second preview URLs in multi-get responses**, and **algorithmic and Spotify-owned editorial playlists**. This applied to new apps registered on or after 27 Nov 2024 and to existing Development Mode apps without a pending extension request. Apps that already had extended access were unaffected. — [Spotify Blog: Introducing some changes to our Web API (27 Nov 2024)](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- **15 Apr 2025 announcement, effective 15 May 2025 (official):** From 15 May 2025, extended access is reserved for apps with "established, scalable, and impactful use cases". The Developer Terms were updated on the same date, and Development Mode stays available for experimentation and personal use. Spotify said over 95% of extended-access applications fell short of basic security, privacy and licensing standards, and that fewer than 1% of developers would be affected. — [Spotify Blog: Updating the Criteria for Web API Extended Access (15 Apr 2025)](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- **Date conflict:** TechCrunch dates the stricter Extended Quota criteria to "March 2025". Spotify's own blog is dated 15 Apr 2025, effective 15 May 2025, so the official dates should be used. — [TechCrunch (6 Feb 2026)](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/) vs. [Spotify Blog (15 Apr 2025)](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- **Late Dec 2025 to around spring 2026 (official staff statement plus community reports):** The Dashboard's "Create App" button was disabled with the tooltip "New integrations are currently on hold while we make updates to improve reliability and performance." Spotify staff confirmed the hold on the forum but gave no timeline. — [Community: Unable to create app](https://community.spotify.com/t5/Spotify-for-Developers/Unable-to-create-app/td-p/7283365); [Home Assistant forum: Spotify restricting new apps](https://community.home-assistant.io/t/spotify-restricting-new-apps/979399)
- **End of the freeze (community-reported, no official end date found):** Reports say a first app could be created by about 12 Apr 2026. A Hitster-like open-source project (Flutster) removed its "Spotify paused new developer app signups" warning on 15–16 Oct 2026. — [GitHub: Nicsilver/flutster issue #1](https://github.com/Nicsilver/flutster/issues/1)
- **6 Feb 2026 announcement (official):** Spotify cited automation and AI-aided usage risks. Development Mode is a sandbox for "learning, experimentation, and personal non-commercial projects by individuals" and should not be the basis for a business. From **11 Feb 2026**, new Development Mode Client IDs require a Premium owner, allow 1 Client ID per developer and up to 5 authorized users, and get a smaller set of endpoints. — [Spotify Blog: Update on Developer Access and Platform Security (6 Feb 2026)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- **9 Mar 2026 (official):** The Premium requirement, 5-user cap and 1-Client-ID limit took effect for existing Development Mode integrations. After community feedback, Spotify **postponed the endpoint access changes for existing integrations** and said it would share revised timelines later. — [Spotify Blog (update appended 9 Mar 2026)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- **Endpoint and field changes for Development Mode, Feb 2026 (official; relevant to Tuneline):**
  - `GET /playlists/{id}/tracks` was renamed to `GET /playlists/{id}/items`, and the response fields were renamed (`tracks` → `items`, `track` → `item`).
  - Playlist contents are returned **only for playlists the user owns or collaborates on**. For other playlists, only metadata comes back and `items` is absent.
  - Batch `GET /tracks`, `/albums` and `/artists` were removed (single-ID endpoints remain). Artist top tracks, new releases and browse categories were removed. `GET /users/{id}` and `/users/{id}/playlists` were removed with no replacement.
  - Search `limit` maximum dropped from 50 to 10.
  - Track fields `popularity`, `available_markets` and `linked_from` were removed. `GET /me` lost `country`, `email`, `product` and others.
  - Extended Quota apps are unaffected.
  — [Spotify: February 2026 Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **March 2026 (official):** The removal of `external_ids` on Track and Album was reverted, so the field remains available. — [Spotify: Web API Changelog March 2026](https://developer.spotify.com/documentation/web-api/references/changes/march-2026)
- **May 2026 (official):** `GET /me` now returns `account_id`, a public, immutable, pseudonymous identifier recommended over `id` for account linking. — [Spotify: Web API Changelog May 2026](https://developer.spotify.com/documentation/web-api/references/changes/may-2026)
- **23 Jul 2026 (official):** The Client ID limit rose from 1 to 25 per developer account. Development Mode quota is now counted **per developer account**, so all of a developer's Client IDs share one quota pool. Quota-exceeded 429s now carry `"reason": "QUOTA_EXCEEDED"`. The 5-user and Premium rules were not mentioned, so they remain in place. — [Spotify Blog: Web API quota updates for Development Mode (23 Jul 2026)](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates); [Spotify: Web API Changelog July 2026](https://developer.spotify.com/documentation/web-api/references/changes/july-2026); [Spotify: Apps ("up to 25 apps per developer account")](https://developer.spotify.com/documentation/web-api/concepts/apps)
- **Developer Policy, effective 15 May 2025 (official):** This version is the one currently published. — [Spotify Developer Policy](https://developer.spotify.com/policy)

### Inferences

- **Tuneline-specific (from a grep of `server/src/spotify.ts`):** The server calls `/me/playlists?limit=50` and `/playlists/{id}/tracks?...&limit=100`. What happens next depends on when the Client ID was created:
  - **Created on or after 11 Feb 2026:** the new endpoint rules apply. `/tracks` is the old path (now `/items`), and contents of playlists the host only _follows_ (not owns or collaborates on) will be absent.
  - **Created before 11 Feb 2026:** the endpoint changes are postponed. The old behavior likely still works, but Spotify said it will announce revised timelines, so this could change at any time.
- Under the 27 Nov 2024 rules, Spotify-owned editorial and algorithmic playlists (e.g. "Today's Top Hits", "Release Radar") are not readable by Development Mode apps anyway. Tuneline's playlist picker should expect those to fail.
- Spotify preview URLs no longer appear in multi-get responses. Tuneline's choice of iTunes previews avoids that dependency.
- I found no official policy change dated Aug–Oct 2026. The 9 Mar 2026 postponement of endpoint changes for existing apps is still open as far as I can tell.

### Gaps

- I found no official statement, as of Oct 2026, on when or whether the postponed endpoint changes will reach pre-11-Feb-2026 apps.
- I found no official announcement that the late-2025 app-creation freeze ended, or when. The July 2026 Client ID increase implies app creation works again.
- I found no official statement on rate-limit numbers. Spotify only describes a rolling 30-second window and does not publish figures.
- A third-party summary (vorplabs.com) mentions a "six-month refresh-token lifetime" in 2026. I could not confirm it in the Spotify changelogs I read (Feb, Mar, May, Jul 2026), so treat it as unverified.

## What does Extended Quota Mode require today, and when did that change?

### Takeaway

Since **15 May 2025**, Spotify **accepts Extended Quota applications only from organizations, not individuals**. Applicants need an established legal business entity, an active launched service, **at least 250,000 monthly active users**, availability in key Spotify markets, commercial viability, and compliance with the Terms. Applications go through a Partner Application from a company email, followed by an in-dashboard Quota Extension Request. Review takes **up to 6 weeks**.

### Cited Findings

- **Official:** "Spotify only accepts applications from organizations (not individuals)." This took effect 15 May 2025, and applications must come from a company email via the linked form. — [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Official requirements:** Spotify lists six requirements:
  1. An established legal business entity
  2. An active, launched service
  3. A minimum of 250k monthly active users
  4. Availability in key Spotify markets
  5. Commercial viability
  6. Adherence to the Terms
  — [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Official process:** The Partner Application must be approved first. Then the owner submits the "Quota extension Request" tab in app Settings, a four-step questionnaire, and the app shows "Sent" in blue. Spotify reviews for Developer Policy compliance and emails feedback, which can take up to six weeks. — [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Official:** Extended Quota Mode has no limit on installing users, no allowlist and a higher rate limit. — [Spotify: Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- **Official:** Apps that already had extended access before 15 May 2025 and use the Web API in compliance are unaffected by the new criteria. — [Spotify Blog (15 Apr 2025)](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- **Before 15 May 2025:** Individuals could apply via the in-dashboard extension request without these thresholds. This is the "existing framework" the blog says stayed open until 15 May 2025. Those older criteria are **outdated**. — [Spotify Blog (15 Apr 2025)](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access)
- **Official commercial-use rules (Developer Policy, effective 15 May 2025):**
  - IV.2: "Except for the limited commercial uses for Non-Streaming SDAs … commercial uses are not permitted for SDAs."
  - IV.3: Non-Streaming SDAs may sell advertising, sponsorships or access.
  - VII.3.5: Extra quota may only be used "for the use case that Spotify reviewed".
  — [Spotify Developer Policy](https://developer.spotify.com/policy)
- **Community-reported:** Developers say the Partner Application form is effectively limited to established businesses, leaving individuals no channel to request a quota extension. Others point out that an app capped at 5 users cannot realistically reach 250k MAU. — [Community: Request Production OAuth Access (Not Extended Quota)](https://community.spotify.com/t5/Spotify-for-Developers/Request-Production-OAuth-Access-Not-Extended-Quota/td-p/7354560); [Community: Why only 5 users?](https://community.spotify.com/t5/Spotify-for-Developers/Why-only-5-users/td-p/7487947); [Community: Inquiry regarding Quota Extension – Local Initiative](https://community.spotify.com/t5/Spotify-for-Developers/Inquiry-regarding-Quota-Extension-Local-Initiative-with-Global/td-p/7336798)

### Inferences

- Tuneline, as a hobby project by an individual with no legal entity and nowhere near 250k MAU, **fails at least three of the six hard requirements**. An application would almost certainly be rejected or never get past the Partner Application form.
- Tuneline would most likely also fail the policy-compliance review on content grounds, independent of the size thresholds (see next section, Developer Policy III.2).

### Gaps

- Spotify publishes no definition of "key Spotify markets" or "commercial viability".
- I found no official data on approval rates or on whether any individual or small project has been approved since 15 May 2025.

## Is there a realistic path for a small non-commercial game beyond the Development Mode limit? Alternatives?

### Takeaway

**No officially sanctioned path exists.** Extended Quota is closed to individuals and small projects. Spotify positions Development Mode as a sandbox for personal non-commercial projects. The Developer Policy also explicitly says **"Do not create a game, including trivia quizzes" (III.2)**, which puts a Hitster-like game in conflict with the policy no matter which tier it is on. Community workarounds, such as spreading users across many Client IDs or asking each host to register their own Client ID, are unofficial and partly conflict with the policy.

### Cited Findings

- **Official:** Development Mode is reduced in scope but still supports "learning, experimentation, and personal non-commercial projects by individuals". It is a sandbox and shouldn't be the basis for a business. — [Spotify Blog (6 Feb 2026)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security)
- **Official, Developer Policy III ("Some prohibited applications"), effective 15 May 2025:**
  - III.2: "Do not create a game, including trivia quizzes."
  - The section is not limited to streaming apps.
  - III.10: Spotify is for personal, non-commercial use and "can't be broadcast or played publicly from a business".
  - III.8: Products must not target children.
  — [Spotify Developer Policy](https://developer.spotify.com/policy)
- **Official, Developer Policy VII.2:** "You must use a separate Security Code for each SDA. You may not use more than one Security Code for each SDA." Security Code here means the client credentials. — [Spotify Developer Policy](https://developer.spotify.com/policy)
- **Official, Developer Policy VII.3.1:** "Spotify may use quotas and restrictions to ensure that the Spotify Platform is accessed and used as intended." — [Spotify Developer Policy](https://developer.spotify.com/policy)
- **Community-reported workaround 1, multiple Client IDs:** After the July 2026 increase to 25 Client IDs, some developers plan to run up to 25 instances with 5 users each. This is user-reported and not approved. — [Community: Web API quota updates for Development Mode](https://community.spotify.com/t5/Spotify-for-Developers/Web-API-quota-updates-for-Development-Mode/td-p/7508852)
- **Official, constraint on workaround 1:** Since 23 Jul 2026 all of a developer's Development Mode Client IDs **share one quota pool**. Splitting across Client IDs therefore does not multiply API quota. — [Spotify Blog (23 Jul 2026)](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates)
- **Community-reported workaround 2, bring-your-own Client ID:** Open-source tools such as Home Assistant and the Hitster-like Flutster have each user create their own Spotify developer app and enter its Client ID. This broke during the late-2025/early-2026 app-creation freeze, and Flutster removed its warnings in Oct 2026. — [GitHub: Nicsilver/flutster issue #1](https://github.com/Nicsilver/flutster/issues/1); [Home Assistant forum: Spotify restricting new apps](https://community.home-assistant.io/t/spotify-restricting-new-apps/979399)
- **Official, constraint on workaround 2:** Since 11 Feb 2026, each such host-owned app requires its owner to have Premium. New apps also fall under the reduced endpoint set, including the rule that playlist items are readable only for owned or collaborative playlists. — [Spotify Blog (6 Feb 2026)](https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security); [Spotify: February 2026 Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- **Press:** TechCrunch frames the 2026 situation as: apps that need a wider audience than 5 users must apply for Extended Quota. It names no alternative path for small developers. — [TechCrunch (6 Feb 2026)](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/)

### Inferences

- **Realistic options for Tuneline, ordered from most to least policy-safe:**
  - **(a)** Keep Spotify as an optional, private feature for the developer and up to 4 friends, all allowlisted. This fits "personal non-commercial project", though III.2 still technically applies.
  - **(b)** Decouple song sourcing from Spotify login entirely. For example, build curated decks from iTunes Search / Apple-side metadata (which Tuneline already uses for previews), or let hosts paste or import song lists. Spotify's tier rules then no longer matter.
  - **(c)** Bring-your-own Client ID, where each host registers a Spotify app. This is technically possible but needs Premium for each host, is clumsy for party guests and is fragile if Spotify freezes app creation again.
  - **(d)** Many Client IDs under one developer account. This is not recommended: it appears to conflict with VII.2 (one Security Code per SDA), quota is pooled anyway, and it is the kind of circumvention VII.3 warns about.
- The policy's game prohibition (III.2) means that **even a large, incorporated Tuneline would likely be refused Extended Quota**, so growing the project is not a path to Spotify access.
- Since a ban on a hobby app most likely takes the form of revoking its Client ID (VII.3.4: access "may be revoked"), public promotion of Tuneline's Spotify login is the main exposure.

### Gaps

- I found no official Spotify staff reply (2025–2026) recommending a specific alternative for indie games. The forum threads could not be read in full because of an HTTP 403 block.
- I found no evidence of Spotify enforcing III.2 against small hobby music-quiz apps in Development Mode, nor any official statement that it does not. Enforcement practice is unknown.
- Whether the bring-your-own-Client-ID pattern is acceptable under the Developer Terms, where each end user becomes a "developer", is not addressed in any source I found.
- The Developer Terms (as distinct from the Developer Policy) were not read in full for this note, so definitions of "Streaming SDA" and "Non-Streaming SDA" remain unverified.
