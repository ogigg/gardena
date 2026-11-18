# Gardena pilot architecture

**Decision record · 18 November 2026.** This plan covers the Polish mobile pilot described in the [PRD](prd.md). The [implementation plan](pilot-implementation-plan.md) gives estimates and milestone handoffs. Technology choices below are implementation proposals. Physical-device evidence will settle the notification integration.

## 1. System boundary and runtime

The existing Expo SDK 58 / React Native 0.88 / TypeScript app owns the garden profile, plant groups and care history on the phone. The pilot requires no user account. A bundled, reviewed catalog supplies Polish care rules and explanatory content. External requests resolve locality and refresh forecasts. When connectivity is unavailable after setup, the stored locality, care rules, events and scheduled summaries still support ordinary care.

| Boundary | Implementation responsibility | Contract |
|---|---|---|
| src/navigation and src/features | Extend AppRouter, HomeScreen and the existing map route. Add plant setup, group editor, guide, history and summary task list. | Render a care view from the same query used by reminders. Submit commands with stable group and occurrence IDs. |
| src/domain | Date arithmetic, rule applicability, occurrence identity, state transitions, summary selection and ordering. | Pure functions take explicit local date, catalog, profile and state. Unit tests inject dates and forecast samples. |
| src/services/storage | expo-sqlite database for native care data. Keep GardenRepository and its AsyncStorage v1 keys for map documents. | Transactions for all care mutations. The web map loads without initializing native-only services. |
| src/services/geocoding and forecast service | Reuse availableGeocoders/searchAddress. Select a locality, derive its IANA zone and obtain regional inputs. | Normalize external responses, handle missing data and retain timestamps and source. Care rules consume normalized values. |
| Notification service and platform integration | Build one payload per eligible day, register controls, reconcile OS requests and consume callbacks. | expo-notifications is the starting adapter. Use native extensions or platform controls only after measuring the interaction on devices. |
| EAS builds and distribution | Existing development and preview profiles. Install SDK-compatible libraries via Expo's installer. | Verify the native app with each extension/config change and cold-launch on both platforms. |

Dependency direction runs from features through services to pure domain types. Keep provider responses, OS payloads and storage rows at their boundaries. Extend current map and time helpers using their normal entry points. [SDK 58 notifications](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) · [SDK 58 SQLite](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/)

## 2. Data contracts and persistence

Use versioned forward migrations in a single native care database. Proposed records below establish ownership and invariants. Dates of work are garden-local calendar dates. UTC timestamps record when an edit was made. Preserve both for backdated work.

| Record | Key and fields | Invariant |
|---|---|---|
| Care profile | Profile ID, locality display name, coarse center, regional calendar ID, IANA zone, desired summary minute | Can exist before any mapped garden. A delivery time change increments the scheduling revision. |
| Plant group | Group ID, profile, species ID, optional type, nickname, planned/growing, ground/container, open/covered, planting precision, year and month or quarter, archive date, feeding interval | Validate the precision discriminator. Unknown has no invented year or day. Units for the feeding interval are positive whole days. |
| Catalog | Stable plant and rule IDs, applicability predicates, locale, source, revision, review date, eligible season/window, rationale, checklist and optional illustration | Bundle only reviewed combinations. A content revision alone cannot create a second occurrence. |
| Occurrence | ID, group, rule, cycle key, window or due date, terminal status, next reminder day, repeat position, revision | Unique group/rule/cycle. A seasonal cycle uses a reviewer-defined season identifier; a feeding cycle uses the preceding feeding event. |
| Event and command receipt | Event ID, group, occurrence, kind, effective date or season, recorded instant, command ID, outcome | Unique command ID and effect per selected occurrence. Terminal state transitions cannot apply twice, including under two different action IDs. |
| Daily summary and membership | Profile plus local date, due instant, revision, occurrence IDs and expected revisions, request ID, dispatch state | Unique profile/day. Preserve a consumed day through setting edits. Keep summary issuance separate from any evidence of receipt or opening. |
| Schedule reconciliation | Profile revision, pending reconciliation marker, last successfully reconciled revision | Written alongside each schedule-changing command. Recovery retries against current desired state. |
| Spot observations and placement | Optional garden/object IDs, exposure and its provenance, optional measured pH and observation date, group ID | Resolve the external map key on read. Missing geometry detaches placement without cascading into care history. |
| Forecast sample | Coarse locality, source, issue instant, covered dates, validity limit, normalized inputs | Suggestions apply only to the affected outdoor group and date within validity. |

Seed catalog resources separately from user records. In a migration, preserve group IDs, occurrence history and effective dates; verify row counts and referential constraints before committing. On a migration error, roll back and surface a recoverable storage error. An upgrade fixture must include an existing mapped garden and a group with completed work.

## 3. Care evaluation and commands

1. Resolve active groups and reviewed rules. Evaluate status, locality, type and growing conditions. Return a guide and missing input when advice is underspecified. Ordinary onboarding may finish with an unknown variety or planting date.
2. Generate eligible occurrences. Pruning and sowing use reviewed local windows. “Already done this season” closes that season without fabricating a day. Feeding requires a product-label interval and actual feeding date. Use the most recent effective feeding for scheduling, even if an older event was entered later.
3. Build Today, Coming up and a guide reason from the same evaluation result. Re-evaluation on a rule revision updates open guidance and preserves terminal history. Sowing and planting out are different events.
4. Apply complete, skip, snooze, archive or restore in a database transaction. Validate occurrence ownership and current eligibility per selection. Store each outcome and mark the schedule dirty. Close and timestamp a completed job as applicable. Supersede any pending feed cycle whose anchor changed.
5. Commit before touching the OS queue. A callback returning after an app restart consults its receipt. Mixed actions return per-item results so a stale pruning selection can coexist with two valid feeding completions.

| Current condition | Command | Result |
|---|---|---|
| Active and within its window | Snooze to an eligible future day | Set the chosen appearance day, preserving repeat progression. Snooze changes visibility in reminders, not the underlying agronomic window. |
| Already closed or archived | Stale notification action | Return current state. No new event or OS request for that occurrence. |
| Open window has elapsed | Reconcile or open Today | Record expiry once, remove future reminders and retain history. |
| Archived group restored | Re-evaluate current rules | Offer current applicable work. Historical terminal jobs stay closed. |
| A group has multiple plants | Complete group feeding | One feeding event updates that group's schedule. Other groups of the same species keep their own anchors. |

## 4. Summary algorithm, concurrency and time

Calculate calendar days with the existing gardenTime helpers. Convert the user's local date and chosen minute to an instant only at the platform boundary. Follow zonedToUtc's spring gap shift and earlier fall overlap choice. A phone traveling outside Poland keeps the garden's zone.

- Eligible appearances for an untouched job are day 0 followed by offsets 1, 3, 6, 11 and 19. Aggregate by garden-local day and order snoozed-to-today jobs first, then earlier closing windows. Use stable IDs as a final tie-breaker.
- A snooze substitutes for the next appearance. If it replaces the appearance following the 5-day gap, its next repeat is 8 days later. After the final appearance, keep the occurrence visible in Today until closure. Window expiry takes precedence over a pending snooze.
- Generate only nonempty summaries. Use one logical request key per profile/day. Map a changed future payload to a replacement for that same date. Keep the batch membership and revision so the user acts on the selected occurrences.
- Persist desired state before OS I/O. A single reconciliation worker reads the newest revision, enumerates pending requests, cancels obsolete ones and installs missing ones. Repeat if the revision changed during I/O. On a crash between OS success and database acknowledgement, inspect pending requests by logical key before retrying. Verify platform replacement semantics in the spike.
- Treat a past dispatch slot as consumed when delivery is uncertain. Avoid same-day catch-up after a time edit or restart. Report uncertainty separately from observed delivery. Choose a bounded forward horizon from measured platform capacity; test unattended replenishment and a season with no intervening app open.
- Trigger reconciliation after profile, plant, history, forecast or permission changes and on startup/resume. Permission denial suppresses delivery while Today continues evaluating current work.

## 5. Native feasibility and delivery decision

Create an internal build with two tomato feedings and one pruning task. On a physical iPhone and Android phone expand the summary, select just the feedings, complete them, select pruning and choose Saturday. Confirm the notification interaction, resulting history and next OS requests. Repeat offline, after process termination, with a stale summary and with accessibility controls. Record build, OS, taps requiring unlock or foregrounding, callback behavior, schedule horizon and observed timing.

Standard notification buttons have limited space. Prototype iOS expanded content and Android supported notification layouts/actions. Verify whether actions can update the remaining selections and how any extension safely shares durable data with the app. If the native process cannot open the care store, prototype a durable idempotent command handoff and measure when it is consumed. Require evidence that stale scheduled reminders are withdrawn in time. [Apple notification content extensions](https://developer.apple.com/documentation/usernotificationsui/unnotificationcontentextension) · [Android notification actions](https://developer.android.com/develop/ui/compose/notifications/create-notification)

**Decision gate.** Continue local delivery when both platforms meet the interaction and unattended scheduling requirements. If a platform fails on selection, present the actual interaction and a specific scope decision. If only freshness or replenishment fails, compare local and server-composed push with the same device scenarios. A remote option requires a durable installation token, permission revocation handling, minimal synchronized care state, a per-installation/day dispatch ledger and conflict handling for offline edits. Select exactly one delivery owner per installation/day before enabling either path for a cohort.

## 6. Content, locality and forecast

The content reviewer owns the plant/task matrix, source and revision. Validate intervals, valid regional windows, missing-type behavior and Polish labels on every catalog change. Add one positive and one ineligible fixture per rule family. Keep tutorial examples distinct from released advice. First acceptance case is a tomato group fed on 4 June with a 14-day interval, recorded on 7 June and next due on 18 June.

Test town names, ambiguous postcodes and failed lookups against actual pilot locations. Use the selected town center for zone and forecast requests. Define freshness and applicability thresholds with the reviewer when evaluating providers. Cache the provider's issue time, expire suggestions at their validity boundary and keep base guidance when offline. The user accepts or declines moving a task. Acceptance records a user action and updates the one daily summary.

## 7. Optional map and privacy

The existing map store owns the outline, local coordinates, objects and shadow scene. A care group may link to an object after onboarding. Compare reviewed plant preferences to observed or modeled light and measured pH separately. Never infer a pH reading from location. Exercise deletion of an object, deletion of a garden, restoration of an archived group and a user who always skips mapping.

Use coarse locality for care and weather. Keep exact plot geometry and personal plant history on the device for the local-first pilot. A participant chooses whether to share a minimal export during a check-in. Exclude coordinates, free-text labels and device tokens. Record eligibility, first useful job, action, effective date relative to its window and permission state. Count distinct occurrences for repeat-action measurement; distinguish scheduled, observed and interacted-with summaries.

## 8. Verification and rollout

| Layer | Required evidence |
|---|---|
| Pure domain | Calendar fixtures for all five gaps, expiration, unknown type and feeding interval, backdating, spring/fall clock changes, phone travel and snooze replacing a repeat. |
| Storage/integration | Concurrent callbacks, duplicate delivery, partial stale batch, app termination between commit and queue write, reconciliation after interruption, schema upgrade from an existing install and archive/restore. |
| User flows | Polish plant search, first job before permission, no permission, locally useful offline home, grouped actions, empty day, seasonal completion, map comparison and save. |
| Devices | Physical iOS and Android feasibility evidence and release-build rerun. Test a preferred time moved before and after today's slot, reboot and an extended inactivity interval. |
| Regression | Run npm run check and the existing web E2E suite, covering map entry, saved gardens and map-to-3D transition. Update old entry-point assertions to navigate via the optional map entry. |
| Community pilot | Internal preview distribution through EAS. Observe onboarding, two eligible occurrences where possible and gardener-reported missed or unwanted alerts. Record counts and denominators by experience level. |

Release once the reviewer signs off the catalog, device evidence satisfies the notification decision and regression checks pass. For a faulty guide, disable the affected rule in a versioned catalog update and reconcile queued work on adoption. Keep a record of installed build/catalog versions during check-ins. Already installed offline builds may retain earlier schedules until updated. Verify recovery on both phones before widening distribution.
