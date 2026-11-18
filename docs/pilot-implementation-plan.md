# Gardena pilot implementation plan

**Target outcome** · A hobby gardener in Poland adds a real plant, sees the next useful job and later acts on a timely reminder. The optional map pilot tests a separate decision about where to plant. Product scope and catalog are defined in the [pilot PRD](prd.md).

**Build the first demonstration around tomatoes.** Add a group of patio tomatoes, log a past feeding, enter the label interval, see the calculated date, receive a summary and mark the feeding done. This exercises onboarding, storage, scheduling and history with one understandable example. In parallel, use three seeded tasks to test the hardest interaction on a physical iPhone and Android phone before committing to delivery architecture.

## Recommended stack

| Area | Pilot choice | Reason and boundary |
|---|---|---|
| Mobile app | Existing Expo SDK 58, React Native 0.88, React 19, TypeScript and state-based router | Extend the home screen and routes for plant setup, Today, guides and history. Keep the current map-to-3D transition reachable from an optional Garden map entry. |
| Care logic and content | Pure TypeScript under src/domain, bundled versioned catalog, Polish names and copy | A rule takes plant context, reviewed local calendar, recorded events and a garden-local date. It produces an eligible job, its window and a reason, or names the missing input. One implementation drives Today and summaries. |
| Care persistence | Proposed expo-sqlite for native care records. Existing AsyncStorage for saved garden geometry | Completion, history and rescheduling must agree after interrupted or concurrent notification actions. A transaction and unique action key give a testable guarantee. Link care groups to mapped objects optionally. Keep native care integrations behind platform boundaries so the current web map still runs. [Expo SQLite for SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/sqlite/) |
| Delivery | Start with one-off local notifications via expo-notifications. Test native expanded controls where standard actions fall short. | Local scheduling uses the same data as Today and works offline. Server-composed push adds fresh inputs during long absences, plus token registration, state synchronization and delivery operations. Adopt it only if the device trial shows a freshness or scheduling gap the pilot cannot tolerate. Push alone does not resolve platform interaction limits. [Expo Notifications for SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/) |
| Local conditions | Existing geocoder service and garden time-zone helpers. One forecast adapter with a cached issue time and validity period | Verify Polish town and postcode results on pilot locations. Store the selected locality and its time zone. Compare forecast coverage, update cadence and terms before selecting a provider. Base care windows continue to work offline. |
| Optional placement prototype | Existing MapLibre, Three.js and SunCalc scene | Reuse beds, trees and modeled shadows. Add observed light, measured pH and optional plant placement. Show which observations support a suggestion and what is unknown. |
| Build and verification | npm, Vitest, ESLint, TypeScript, existing web E2E and EAS development/preview profiles | Use SDK-compatible packages via npx expo install. Build native integrations into development clients, then use internal preview builds for the community pilot. |

## Milestones and handoffs

Effort below is a **planning estimate for one mobile engineer** with access to both phones and a Polish horticultural reviewer. The estimates cover engineering time. Content review, recruitment and observing real care opportunities have their own lead times. Re-estimate after milestone 1.

| Milestone | Work and dependencies | Acceptance check |
|---|---|---|
| **1 · Feasibility and content sample** · 3–5 engineering days | Build a mixed summary on both phones. Try selecting two feedings, completing them, and snoozing one pruning job to a chosen day from the same notification. Test with the app closed, offline and after relaunch. In parallel, have a reviewer approve one guide for each task family and verify several pilot postcodes. | Record the interaction and resulting history on each OS. Establish how actions reach durable storage and refresh pending notifications. Document observed limits, including scheduling after prolonged inactivity. If a platform requires opening the app, bring the observed behavior and closest workable interaction to the product owner for decision before treating it as delivered. |
| **2 · Tomato feeding end to end** · 4–6 days | Implement the first native care repository, rule and guide. Add plants from home, ask for locality once, show the first useful job, then offer summary time and permissions. Wire the proven delivery path. | Feeding logged on 7 June with actual date 4 June and interval 14 days yields 18 June. Unknown last feeding or interval shows guidance. Permission denial leaves Today usable. Data survives relaunch. |
| **3 · Catalog, seasons and home** · 5–8 days plus reviewer availability | Extend the slice to sowing and pruning. Publish the reviewed catalog for all 11 plants listed in the PRD, including berry search aliases. Add planned/existing plants, separate groups, archive/restore and history. Show Today, Coming up and illustrated guides with reasons and sources. | A beginner can act on a guide. An experienced gardener can finish without opening it. Month/year, quarter/year and unknown planting dates retain their precision. Sowing and planting out are separate. Unknown varieties suppress type-sensitive advice. “Already done this season” closes only that pruning occurrence. |
| **4 · Reminder reliability and forecasts** · 4–7 days | Finish grouping, repeats, snooze, skip, expiry, ordering and forecast suggestions. Reconcile pending notifications on state changes. Exercise the full sequence with simulated dates and live device actions. | The scenarios below pass on both platforms. A forecast suggestion appears in the regular summary, explains the reason and changes the task date only when accepted. |
| **5 · Optional placement trial** · 2–4 days | Extend the existing map prototype after rule/content formats stabilize. Record observed sun or shade and optional measured pH per spot. Compare spots for a selected plant and save placement. | A participant can explain a hydrangea placement using available evidence. The prototype labels modeled light and unknown pH. Existing saved gardens open; unmapped groups still receive care. |
| **6 · Internal release and community pilot** · 2–4 days to prepare, then seasonal observation | Run regression checks, distribute preview builds, recruit beginners and experienced gardeners from one Polish community, and collect the evidence below. | Observe first use on both platforms and follow participants through at least two eligible task occurrences where season allows. Review real missed-work examples and alert burden before proposing wider release. |

## Implementation details that determine correctness

**Storage and actions.** Persist garden settings, plant groups, guide/rule versions, task occurrences, care events and planned summaries. Keep planting-date precision separate from event dates. Give each occurrence a stable identity across app opens and catalog refreshes. A notification action carries occurrence IDs, the summary revision and an action ID. In one transaction, recheck current state, apply the selected changes, record history and mark the schedule for reconciliation. A retry after a crash must converge on the same result. Verify shared-container access if the iOS prototype uses an extension.

**Scheduling.** Derive the next eligible appearances in garden-local calendar days. Aggregate eligible tasks by date, persist one summary ID per day and reconcile it with the OS queue. Schedule only nonempty dates. Persist the date already issued so changing the preferred time after delivery cannot send a second summary that day. Check the pending queue horizon on each platform and test a gardener who never opens the app between seasonal jobs. If the queue cannot cover the pilot interval, settle the replenishment or server-delivery design at milestone 1.

**Rule review.** For each supported plant and task, record the applicable Polish region, season, variety or growing conditions, source, review date, explanation and instructions. Only prompt for conditions that affect the result. A reviewer signs off the plant-by-task coverage table, including inapplicable combinations. For forecasts, set a freshness limit with the reviewer, expire pending suggestions when their forecast expires, and keep the base schedule when an update is unavailable.

### Release checks

| Scenario | Passing result |
|---|---|
| An unattended task stays relevant through day 20 | Appearances on days 0, 1, 3, 6, 11 and 19. Afterward it remains in Today through window close. No summary on intervening days unless another job qualifies. |
| Snooze replaces the appearance after a 5-day gap | Return on the chosen day in the single summary. If missed, wait 8 more days. Order snoozed jobs first, then earliest closing window. |
| Two feedings completed and one pruning job snoozed | Only selected tasks change. A duplicate callback or stale notification creates no second feeding record and cannot revive an expired job. |
| Skip, expiry, archive and restore | Cancel affected pending alerts, preserve distinct history outcomes, and recompute currently eligible work on restore. |
| Clock or environment changes | Test daylight-saving transitions in Europe/Warsaw, summary-time edits, reboot, revoked permission, offline use and stale forecasts. Record OS delays separately from duplicate or mistimed schedules produced by Gardena. |
| Existing user upgrades | Their saved maps and objects remain accessible. A new user reaches a care task without mapping. Run npm run check and npm run e2e:web plus physical-device notification checks. |

## Pilot evidence and release decision

Record minimal pilot events for first plant added, first task shown, occurrence eligible, completion date, snooze, skip and observed permission status. For a small pilot, use participant-approved local exports at check-ins. Exclude precise garden coordinates and keep a count of participants who contributed data. Distinguish scheduled alerts, observed delivery and actions so the delivery review can identify what was actually measured.

Report first-visit value as gardeners shown a relevant job divided by gardeners starting setup. For repeat timely action, use gardeners with two distinct eligible occurrences as the denominator. Inspect every duplicate or quiet-day alert against the one-summary rule. Ask beginners and experienced gardeners which job they would have missed, which alert they would mute and whether the map changed a planting decision. Use these results to decide separately on broader reminder rollout and further map investment.

**First work item:** produce the three-task device demonstration and its two-platform results alongside the reviewed tomato feeding example. Those deliverables determine the notification integration effort and give the team a real care rule to build against.
