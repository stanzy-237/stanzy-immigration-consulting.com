# Consultation — motion

How every Consultation screen moves: the public page, booking, checkout, payment, Mon espace and the dashboard. Read with `docs/design/consultation.md`, which lists the screens.

Motion follows the project's animation skills (`.claude/skills/`, after Emil Kowalski's *Animations on the Web*). Before writing any motion, load `animate`, then the one for the tool: `motion-react` (`motion/react`, already installed), `css-animations` (Tailwind / CSS), `gesture-ui` (sheets, swipes) or `scroll-animations` (public page). When it's built, run `review-animations` on the diff.

## Rules for every screen here

- **Frequency decides.** Anything seen dozens of times a day (dashboard lists, tabs, the sidebar, keyboard shortcuts) gets no motion or the least possible. Delight is kept for the rare moments: payment confirmed, recap published.
- **Only `transform` and `opacity` move.** Never animate `width`, `height`, `top` or `margin`. The one exception is an auto-height change, done with `motion`'s `height: "auto"`.
- **Enter with ease-out, never ease-in.** Exits are shorter than entries. UI motion stays under 300 ms.
- **Nothing appears from `scale(0)`.** Start from `scale(0.95)` with `opacity: 0`.
- **Buttons give press feedback:** `scale(0.97)` on `:active`, 150 ms. Hover is gated behind `(hover: hover)`.
- **Interruptible.** Anything that can be re-triggered uses a transition or a spring, never `@keyframes`.
- **Reduced motion means gentler, not none.** Keep opacity and colour changes; drop movement. Wrap each Consultation view that uses `motion` in `<MotionConfig reducedMotion="user">`, as `accompagnement-view.tsx` does, and use `motion-reduce:` in CSS.
- **Use the tokens.** Ease and duration come from `globals.css` (`--ease-out-expo`, `--ease-standard`, `--duration-fast` 120 ms, `--duration-base` 200 ms, `--duration-slow` 320 ms) and `EASE_OUT` (`src/components/ui/reveal.tsx`). A missing curve is added there as a token with a one-line comment, never inline.

## By interaction

| Where | Interaction | Motion | Reduced motion |
|---|---|---|---|
| Public page | Sections reaching the viewport | `Reveal` once (fade + 16 px lift, `EASE_OUT`, 500 ms), 60 ms stagger inside a section; the hero is static | appears |
| Public page · Ce qu'on aborde | Active topic | The rouge underline (desktop) and the navy pill (mobile) slide to the chosen topic with `layoutId`, spring `{ duration: 0.25, bounce: 0 }`; the mobile dots follow with `layout` | instant |
| Public page · Ce qu'on aborde | Topics advance on their own | Every 6 s, shown by a progress line under the active topic (`scaleX`, `linear`). Paused on hover, on focus and off screen; stops for good once the visitor picks a topic | off: no advance, no line |
| Public page · Ce qu'on aborde | Preview changes | Crossfade with an 8 px shift in the direction of travel and `blur(2px)`, 200 ms ease-out; the bars then fill from the left (`scaleX`, 400 ms `--ease-out-expo`, 40 ms stagger) | crossfade, bars appear |
| Public page · FAQ | Answer opens / closes | `height: "auto"` with the text fading, 250 ms `--ease-out-expo`; closing 150 ms. The « + » turns 45° and fills rouge, 200 ms `--ease-standard` | fade |
| Booking · mobile | Next / back step | Forward: new step slides in from the right by 16 px with fade, 250 ms ease-out; back from the left. The progress segment fills with `scaleX`, 300 ms | crossfade |
| Booking · desktop | A step folds and the next opens | Height via `height: "auto"`, 250 ms `--ease-out-expo`; content fades, with no slide inside | instant height, fade |
| Booking | Topic chips | Press `scale(0.97)`; the check fades in from `scale(0.9)`, 150 ms | fade |
| Booking | Slot-hold timer | **No motion per second.** `tabular-nums`. Under 2 min the colour turns rouge (200 ms ease) | same |
| Checkout | Promo applied / removed | The success row enters at auto height, 200 ms; the strike-through total crossfades with an 8 px shift and `blur(2px)`, 200 ms | fade |
| Checkout | Promo error | The message fades in with a 4 px lift, 150 ms; the field gives one horizontal shake (±4 px, 300 ms), only when « Appliquer » is tapped | message fades, no shake |
| Checkout · mobile | Sheets (promo, card, Orange code, last place) | Base UI `Drawer` as it is (iOS curve, follows the finger, swipe to dismiss); see `gesture-ui` | fade |
| Payment | 1 Validez sur le téléphone · 3 Vérification | The illustration's `· anim` layers (Paper) breathe slowly, 2–3 s `ease-in-out`; the spinner turns `linear`, about 800 ms per turn | static illustration, spinner kept |
| Payment | 6 Confirmée | Rare, so it may delight: the check draws (`stroke-dashoffset`, 400 ms ease-out), then Stanzy waves, then the confetti `· anim` layers make one burst; about 700 ms in all, once | check and text fade in |
| Payment | 4 Refusé · 5 En attente | No celebration and no shake: the illustration fades in, 200 ms | same |
| Mon espace | Countdown before the meeting | Reuse the flip tiles of `ita-countdown` (`flip-tile.tsx`, reduced motion already handled) | already handled |
| Mon espace · dashboard | « Rejoindre » becomes active (T−15 min) | Once: grey to colour, 300 ms ease, plus a single soft ring. **No looping pulse** | colour only |
| Mon espace · Après | Timestamp tapped | The video seeks **instantly**; the current note's background changes, 150 ms ease | same |
| Mon espace · Après | Next step ticked | Press `scale(0.97)`; the check draws in 200 ms; the strike-through appears 150 ms later | fade |
| Dashboard | Tabs (À venir / Passées / Échoués) | Used daily: the active pill moves with `layoutId`, spring `{ duration: 0.25, bounce: 0 }`; the list **does not** animate | instant |
| Dashboard | Aperçu, lists, counts | **No entrance animation and no counting up.** Skeletons use `--animate-skeleton-in` (shows only after 150 ms) | same |
| Dashboard | Code deleted, row removed | Optimistic; the row exits with fade then height collapse, 200 ms (`AnimatePresence`) | fade |
| Consultation page | Private notes autosave | « Enregistré » fades in and out, 150 ms. Typing never animates | same |
| Consultation page | « Publier dans son espace » | Press, a loading spinner inside the button, then the « Dans son espace » rows tick green one after the other (40 ms stagger, 150 ms each), then the toast | ticks fade |
| Consultation page | « Annuler ce créneau » dialog | A modal from the centre: `scale(0.95)` + fade, 200 ms ease-out; exit 150 ms | fade |
| Everywhere | Toasts | The existing toast system, unchanged | already handled |

Anything not in this table does not animate. A new motion is added here first, with its row.

