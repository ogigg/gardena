# Gardena product requirements

## Metadata

Version 1.1 · 2026-11-18 · Poland pilot · iOS and Android
Status — agreed product direction, pilot implementation pending.

## 1. Overview

**Know what your garden needs and when to do it.** A gardener adds one real plant, gives their town or postcode, and sees the next useful job and its timing. Gardena works out the schedule. When something needs attention, one short daily summary brings the gardener back to act.

The secondary question is “What will grow well in this spot?” An optional map prototype will test whether sunlight and soil information help someone choose a planting location.

## 2. Context and audience

### 2.1 Background

The existing mobile prototype starts with aerial imagery and a traced garden boundary, then models a garden in 3D with beds, trees, buildings and shadows. The pilot starts with a plant. Gardeners can use reminders throughout a growing season without drawing their plot.

Recruit beginners and experienced hobby gardeners through one Polish allotment or gardening community. Both groups forget seasonal jobs. A beginner needs to recognize what to do and feel confident doing it. An experienced gardener may need only the timing and a quick way to record the work.

## 3. Assumptions

| Assumption | How the pilot will test it |
|---|---|
| A town or postcode and a few plant details support locally useful advice. | Ask gardeners whether the timing fit their plot. Compare reports for containers, beds and covered plants. |
| The same guide can serve both experience levels. | Observe a beginner following its checklist and an experienced gardener recording the same job. |
| Quiet days and progressively spaced repeats preserve trust. | Review snoozes, muted alerts and interview reports of unnecessary reminders alongside completed tasks. |
| Mapping changes a real placement decision. | Ask testers to choose a spot for a hydrangea, then use the prototype and explain whether the evidence changed their choice. |

## 4. Scope

### 4.1 In Scope

Pilot sowing, fertilizing and pruning, where applicable to each plant. Cover tomatoes, pears, apples, roses, cherries, strawberries and hydrangeas. Searching for berries also leads to raspberries, blueberries, currants and blackberries. Each guide identifies its plant, relevant conditions and reviewed source for Polish gardens.

Keep timely care reminders free. Test the map alongside the reminder pilot. Gardeners can mark sun and shade, enter measured soil pH, compare spots against a selected plant’s needs and save where they planted it. Label unknown pH explicitly and distinguish modeled light from gardener observations.

### 4.2 Out of Scope

Defer watering schedules, photo identification, expansion to other countries and paid features. Explore willingness to pay for deeper planning or multiple gardens after participants have used core care through part of a growing season.

## 5. User Stories and acceptance criteria

#### US-001 — Find the first useful task

As a gardener, I can search by name or tap a common plant, choose “Already growing” or “I want to plant this,” and enter my town or postcode once. An exact address and a mapped garden are optional.

- For an existing plant, ask when it was planted **in this garden**. Accept month and year, quarter and year, or “I’m not sure.” Keep the reported precision. Nursery stock may be older than its time on this plot.
- For a planned plant, capture planting time when it is planted. Record sowing and planting out as separate events. Completing sowing records its actual date.
- Ask about variety, outdoors or under cover, and bed or container only when the answer changes advice. Accept unknown types and offer identification help before recommending type-sensitive pruning.
- Show the next useful task or care window immediately, even if weeks away. If a necessary input is unknown, show the relevant guide and explain what would enable scheduling.
- Show the value first, then let the gardener choose a daily summary time and request notification permission. Today and Coming up remain usable with permission declined.

#### US-002 — Understand the job and its timing

As a gardener, I can see Today grouped by plant and Coming up beneath it. A quiet day shows the next expected job in the app. Put tasks snoozed to today first, followed by tasks with the earliest closing window.

- Start with one group per planting. A gardener can manage six bed tomatoes together and two patio tomatoes separately, without mapping either group.
- A guide opens with the reason for the timing, then a short checklist, an illustration where useful, expandable detail and its source. Display a care window where timing is flexible and the chosen date for a snooze.
- If a local forecast affects outdoor work, explain the reason and suggest another date. The gardener decides whether to move it. Include the suggestion in the normal summary.

#### US-003 — Keep a reliable care history

| Event | Expected result |
|---|---|
| Feeding history unknown | Accept “I’m not sure.” Show the guide. Begin reminders once the gardener logs an actual feeding and supplies the product-label interval for that group. Explain where to find an unknown interval. |
| Feeding logged late | Accept a past date. With a 14-day interval, a feeding on 4 June logged on 7 June yields 18 June as the next date. |
| Pruning completed | Close this occurrence. Derive the next one from the local care season. “Already done this season” accepts an unknown completion date. |
| Job deliberately skipped | “Skip this occurrence” in the task stops its reminders and records a skip separately from completion. |
| Window closes | Withdraw outstanding repeats and record “Window ended” in history. |
| Plant archived | Stop its reminders and retain history. Allow restoration. |

#### US-004 — Act from one short daily summary

As a gardener, I receive at most one summary per local day at my chosen time. “Three plants to feed, two to prune” is enough. Tapping opens the relevant list with a guide for each job. With no eligible tasks, the phone stays quiet.

- From the notification itself, select individual tasks to complete or snooze. For example, complete two feedings and move pruning to Saturday. Apply each action only to its selected occurrences. Replaying the same action must record a completion only once.
- Snooze selects a **day**. The task joins that day’s regular summary, including when several tasks were snoozed to the same date.
- For each unattended occurrence, wait **1, 2, 3, 5 and 8 days** between appearances. Starting on day 0 yields days **0, 1, 3, 6, 11 and 19** if the window remains open. After the final appearance, leave the task visible in the app until its window closes.
- A snooze replaces the next appearance and preserves progress through the sequence. If it replaces the appearance due after a 5-day gap, the following gap is 8 days. Completion, skipping, archiving or window expiry cancels pending alerts as applicable.

#### US-005 — Choose a planting spot

As a gardener deciding where to plant, I can open the map after onboarding, compare two candidate spots and save the chosen spot to a plant group. A beginner can see which condition informed a suggestion. An experienced gardener can replace an observation as conditions change.

- A spot can have user-observed exposure, a measured pH, both or neither. Show an unknown for each missing observation. The modeled shadow view identifies its date and time.
- Explain suitability per dimension using reviewed plant preferences. If the data supports a light comparison alone, describe only that comparison. With conflicting evidence, show the tradeoff and let the gardener choose.
- Removing a mapped bed or outline releases the placement association. The group, task schedule and recorded work remain available.
- The prototype passes its usability trial when a participant can compare, explain and save a choice. Record whether the extra information changed their original choice separately.

#### US-006 — Adjust reminders as circumstances change

As a gardener, I can change the daily time, change a group's growing conditions or archive a group. The next summary reflects the current garden even after the phone restarts.

- A time change after today's summary takes effect for future summaries. There is still one opportunity for an alert per garden-local day.
- A seasonal task snoozed beyond its closing date would be unusable. Show the last eligible day in the picker and explain the limit. If the window subsequently closes early, record the expired occurrence.
- When permissions are off, keep due work and its guide accessible on Today. On return, present current eligible work without replaying missed summaries.
- Tapping an older summary resolves its task IDs against current history. Show an already-completed, skipped or expired task in its current state. Reopening a notification must never create another feeding.

### Pilot experience by surface

| Surface | What the gardener sees | Empty, uncertain or interrupted state |
|---|---|---|
| First visit | Locality, searchable starter catalog, plant status and planting precision. Show why a follow-up question matters. | Offer another locality match when a postcode is ambiguous. Preserve plant choices during a lookup retry. |
| First useful result | A job, its plant group and a due date or season. Then offer daily time and notification permission. | If advice depends on an unknown feeding interval or variety, give the identification or feeding guide and the input needed. |
| Today and Coming up | Due jobs grouped by plant, earliest closing windows visible, snoozed-to-today items first. | Quiet day shows the next known job. A gardener can return to plant setup when there are no active groups. |
| Guide and history | Reason, checklist, optional illustration and details, source, and controls for completing, backdating, postponing or skipping as applicable. | Unknown dates keep their precision. An expired job remains readable with its final status. |
| Daily notification | Short count or job description. Tap to open the list. Expanded controls support selecting individual jobs and snoozing by day. | A stale selection reports its current state. Remaining valid selections can still be acted on. |
| Garden map | Observed light, dated modeled shadows, measured pH, plant preferences and saved placement. | Opening care screens never requires geometry, a precise address or a pH reading. |

### Catalog acceptance

Review applicability separately for **tomato, pear, apple, rose, cherry, strawberry, hydrangea, raspberry, blueberry, currant and blackberry**. “Berries” is a search entry point. Each supported task needs Polish user-facing text, relevant locality and growing conditions, source, review date, explanation, guide and supported timing precision. A blank applicability cell means editorial work is pending. Explicitly record where a task does not apply or a variety must be identified. Avoid generating seasonal windows from an incomplete entry.

### Pilot release priorities and sign-off

| Scope | Evidence needed |
|---|---|
| Core care pilot | Real-device tomato journey, reviewed catalog, functioning seasonal rules and history, reliable single-summary behavior and weather suggestions. Test permission denial and offline use. |
| Notification feasibility decision | Demonstrate mixed selections on iOS and Android. Any proposed interaction requiring the app to open needs an explicit product decision. |
| Optional placement trial | Run the placement exercise with the prototype alongside the core pilot. Measure its contribution independently. |
| Wider rollout | Review actions and interviews from both experience groups across at least two distinct eligible care opportunities, with alert burden reported alongside usage. |

## 6. Technical Stack and feasibility

Build on the existing Expo SDK 58, React Native and TypeScript app. Its local persistence, garden time zone and MapLibre/3D prototype provide a starting point. Keep the care calendar independent of the map so a plant group can receive reminders without geometry.

Compare device-scheduled summaries with server-composed push during implementation planning. Device scheduling fits the existing local records. Server composition could refresh forecasts closer to delivery, but introduces a delivery service and synchronization. Choose after testing stale schedules, time changes and forecast freshness.

Prove per-task selection and mixed actions on both platforms before committing to the notification design. Apple’s standard banner shows only its first two actions, and Android’s standard notification offers up to three action buttons. A pair of global Done/Snooze buttons alone cannot express which plants the gardener selected. If the prototype falls short, bring the observed limitation back for a product decision. [Apple notification actions](https://developer.apple.com/documentation/usernotifications/unnotificationcategory/actions) · [Android notification actions](https://developer.android.com/develop/ui/compose/notifications/create-notification)

## 7. Success Metrics

| Measure | Definition and use |
|---|---|
| First-visit value | Share of first-time gardeners who add a plant and see a relevant upcoming job in that visit. Observe where those who stop encounter friction. |
| Repeat timely action | Among gardeners with at least two distinct eligible care occurrences, measure the share completing one within its care window and later completing another within its window. Count repeat alerts for one occurrence only once. |
| Remembered work | Ask “Which reminder helped you do something you would otherwise have missed?” Capture specific examples from both experience groups. |
| Notification burden | Track muted reminders and reported mistimed or unnecessary prompts. Delivery acceptance requires zero summaries on quiet days and 100% of days within the one-summary cap. |
| Map usefulness | Record whether the gardener can choose and explain a planting spot using light or known pH, and which information changed the choice. |

Review measured rates with their denominators and interview evidence. A broader launch requires evidence of repeat useful action and an understanding of what caused unwanted alerts. Pilot data will establish the baseline for adoption targets.

## 8. Dependencies and open decisions

Secure reviewed local calendars and guidance for the initial catalog, a town/postcode lookup and suitable forecast coverage. Validate horticultural rules across relevant plant types and conditions. Verify notification interactions on physical iOS and Android devices. Decide delivery architecture and pilot dates after that feasibility work.

## 9. Timeline

| Milestone | Exit condition |
|---|---|
| Content and feasibility | Review sample Polish care guides and demonstrate selecting, completing and snoozing tasks in a mixed summary on both platforms. |
| Pilot build | A participant can add a real plant, understand its next task, receive a summary and record or postpone work. Verify quiet days, expiry and the full repeat schedule using simulated dates. |
| Community pilot | Observe real care opportunities through part of a growing season. Run the planting-location prototype alongside the reminder pilot. |
| Launch review | Examine repeat timely actions, concrete examples of work remembered, unwanted alerts and map placement decisions. Decide what earns a wider release. |

## 10. Next steps

Use the [architecture plan](pilot-architecture.md) for contracts and verification and the [implementation plan](pilot-implementation-plan.md) for milestone estimates. Recruit the pilot community, identify a reviewer for Polish growing guidance, and use this PRD as the input for sprint-context-generator during implementation planning. Start with one end-to-end care task and the mixed-task notification feasibility test before expanding the catalog.
