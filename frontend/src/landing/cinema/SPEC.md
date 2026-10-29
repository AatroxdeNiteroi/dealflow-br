# Genesis Radar landing: cinema rewrite, final execution spec

**Direction:** "Plano-sequência: um objeto, uma câmera" (Proposal A), with grafts from B and C and every judge veto applied.
**Scope:** the Gateway through the handoff into Chapter 5. Chapter 5 (`.ch5-*`) and everything after it stay untouched.
**Audience:** engineers who did not see the design discussion. This document is self-contained.
**Language:** English. UI copy stays pt-BR, quoted verbatim.

---

## 0. Read me first

### 0.1 Units and words used everywhere
- **vh (master time).** The whole cinematic, from the first scroll to the start of Chapter 5, is ONE GSAP timeline whose time unit is 1 vh of scroll. The total is 1900 vh. A position like `@465` means master time 465, which is 4.65 viewport heights of scroll after the radar starts. ScrollTrigger maps scroll proportionally onto the master, so these positions do not depend on viewport size.
- **b (beat progress).** For a beat with `start` and `len`, `b = (vh − start) / len`, from 0 to 1. The choreography tables give both `b` and absolute `vh`. Authoring always uses absolute vh, because the BEATS table in `cinema/beats.ts` is the single source of truth.
- **Rest (R0–R7).** A composed state where a beat is complete. Rests R1–R7 each have a 16 vh **plateau** (`[R−8, R+8]`) in which no scroll-driven foreground property changes. R0 (the hero) has no plateau, so the first wheel notch moves the camera.
- **Act.** A short time-based animation (an overshoot, stamp or lock) that must not be flattened by scrub. It is a paused timeline that plays forward when the master crosses its label and reverses when the master goes back below it. Hysteresis is ±0.5 vh. Acts never use fire-once `.call()`.
- **SP ("sua empresa").** The chosen company in world space, `SP = (0.9, −0.5, 1.2)`. It is already a constant in `PointField.ts`.
- **Single writer.** Every animated property of every element has exactly one owner, either a tween chain or a per-frame writer. The package tables in §12 name each owner.

### 0.2 What changes and what must not
- **Changes:** all execution from the portal click to the end of Chapter 4: motion, camera, WebGL, guidance, pacing (32 → 19 viewports), the DOM of chapters 1–4, and the gateway exit.
- **Must not change:** the proposal (narrative, chapter order, copy, design decisions); Ch5 and everything after it; the flows `goToPlans`, `teleportToPlans`, `voltarAoPortal`, the pending queue, deep links, the point-of-no-return floor, App phases, and chrome visibility (§11).

### 0.3 Dev rules
- Work on a branch, e.g. `feature/landing-cinema-v2`.
- Verify with `npx tsc --noEmit` only. Never run `npm run build` during dev: it emits stale `.js` files into `src/`, which Vite then serves instead of the `.tsx`.
- Before trusting the dev server, run `find src -name '*.js'`. It must return nothing.
- The dev server is at `http://localhost:5173/landing.html`.

---

## 1. Concept and calibration

### 1.1 Concept: one shot, one object, one clock
From the click on "Quero conhecer o produto" until the first plan card starts to fall, the camera never cuts and no scene dissolves into another. Every chapter change is either a camera move through the same WebGL field or a physical change to an object already on screen.

The protagonist is one object, the chosen company ("sua empresa"). It goes through these states:

1. **Gateway.** The portal emblem *is* the radar: it glides onto the field hub, its spiral becomes the first GL ring, and a shockwave wakes the instrument.
2. **Target.** A dark point that the instrument's own four registration brackets lock onto. A redacted tag names it anonymously.
3. **Sphere.** The camera really dollies through its surface. This is a depth-correct opaque sphere, not a scale cheat, and points stream past the lens.
4. **Interior.** A warm-black interior where the respiro sentence is written in light. A radial dawn then lights it, which makes the Gateway promise "O radar ilumina cada um" literal.
5. **Dossier.** The words "dados que ninguém publicou" are redacted into ink bars that fuse into the dossier's tarja. The registration brackets draw the paper card around it.
6. **Convergence.** Anonymous redacted chips fly in from the field and charge the tarja tick by tick. The last ones orbit it, staging "o cercam" literally.
7. **Estimate.** The SAME card grows into the estimate card. The 26 ticks fuse into one gold instrument line, which sweeps the tarja off the number that was always underneath. The line then turns 90° into the ±15% ruler, the needle settles, and only after that does the seal stamp.
8. **Universe.** The camera recoils through the membrane. The card collapses into the same sphere, now lit (a paper body with a saturated gold rim). "R$ 24,3 mi" stays pinned beside it, the brackets lock around it, the instrument powers back on, and a dust wave fills the field to 46.255 points. "Você esteve dentro de uma delas" now points at a visible referent.
9. **Handoff.** Everything lifts away and the camera settles into exactly today's plans backdrop. Ch5 then takes over, untouched.

**One clock.** Lenis is the only smoother. One master ScrollTrigger uses `scrub: true`. The field state is a pure function of master time, evaluated in the same frame as the DOM, so WebGL and DOM always show the same moment and reversal is exact.

**Guidance.** A stateful instrument dock at the bottom always says one of two things: what is happening now (a gerund, with a progress ring filling) or what to do to continue (an imperative, with the chevron breathing). It also shows where you are on a five-station chapter rail.

### 1.2 Calibration (taste dials, applied only from the Gateway to the handoff)
- **DESIGN_VARIANCE 4.** The brand identity is a radial precision instrument. The camera always looks at one object, so the centred composition carries meaning; it is not a template default. Asymmetry lives only in instrument chrome: the HUD, the tag and the pinned label.
- **MOTION_INTENSITY 9.** This is a rare, first-visit, user-driven story, which is the delight tier. It is bounded by four rules:
  - every motion has a named purpose (spatial continuity, state indication or explanation);
  - every motion is either a pure function of scroll or a reversible act;
  - bounce is allowed only for instrument mechanics (the reticle lock, the needle drop, the odometer settle);
  - reduced motion is fully honoured.
- **VISUAL_DENSITY 3.** One hero object and one sentence or card per frame. The only dense marks are small instrument marks: the ticks, the ruler and the odometer.
- **Brand preserved.** Paper `#fbf9f4`, ink `#1f1812`, brown-deep `--brown-deep`, gold `#b8860b`, sweep gold `#cf9b1e` / `#d99f1c`, and gold-editorial `#9a6f0c`. Type stays Playfair (display), Inter (body) and IBM Plex Mono (instrument). The generic cream + brass + serif warning is overridden because this is the brand. No glass, no neon, no new colours.
- **Gold-on-paper rule.** Over paper, gold is allowed only as a saturated line, tick, nib, small mark or box-shadow halo, or as light on a dark surface. A low-alpha gold wash over paper is never allowed.

---

## 2. The proposal preserved (unchanged per chapter)

Every narrative string below is verbatim. Only the execution changes.

| Chapter / beat | What the transition communicates (unchanged) | Copy (verbatim) |
|---|---|---|
| Gateway | The product is a precision instrument that assembles itself over the same live field. One action. Entering never changes the screen: you fall through the spiral into the same field. | "Toda empresa fechada esconde um número." "O radar ilumina cada um." CTA "Quero conhecer o produto". Caption "mova o cursor — o campo responde" |
| Ch1 hero (radar) | A live instrument. The sweep charges points gold, the field beats lub-dub, and the cursor resolves fictitious companies (6 names in full, 6 half-redacted, values only above strength 0.62, labels only inside the radar). There is no headline. | HUD "AZ ###°" "varredura ativa". Names list `COMPANY_NAMES` (12), `NAME_REDACTED` "██████ █████", `REDACTED` "R$ ███" |
| Ch1 Mergulho | From the overview into depth: we are among the companies (points become 3D spheres). | — |
| Ch1 Mira | Focus narrows to ONE company and the instrument steps back. | — |
| Ch1 Travessia | We enter the company: its sphere swallows the frame. | — |
| Ch1 Interior + respiro | Inside the company, in the dark, the words emerge one by one, the dark holds, and only then does the interior clear to paper. The respiro has no box. "Ver planos" appears as the interior clears. | "São 46.255 pontos neste campo. Cada um é uma empresa real — e dados que ninguém publicou." (italic from "—") |
| Ch2 Convergência | The company dossier: CNPJ redacted, revenue under a black tarja. Anonymous, redacted public-data fragments converge from everywhere. The page shows THAT data gathers, never what it is or how it enters the calculation. The caption names only the nature of the data. The revenue stays hidden, as the hook into Ch3. | Eyebrow "Convergência"; caption "Fontes públicas oficiais"; dossier "Empresa em análise", "CNPJ ██.███.███/0001-██", "Fabricação de esquadrias de metal · São Paulo / SP", "Faturamento anual", note "valor que nenhuma base pública declara"; close "Nenhuma base pública declara esse faturamento." / "Mas dezenas de fontes públicas oficiais o cercam." |
| Ch3 A estimativa | The same tarja is swept by an instrument line. The number already underneath resolves, coming into focus, as an honest ±15% range: min, estimate, max, with the mark at the centre. The seal stamps provenance AFTER the number resolves. The formula is never shown. | Eyebrow "A estimativa"; "Faturamento anual estimado"; "R$ 24,3 mi"; "mínimo" "R$ 20,7 mi"; "máximo" "R$ 27,9 mi"; seal "Fonte pública oficial · auditável"; close "A precisão do mercado de elite — só com fonte pública oficial." / "Nenhum outro produto reconstrói esse número assim." |
| Ch4 O universo | The camera recoils from the interior to the overview, closing the Ch1 zoom arc. The blur lifts, the whole field is present, and the count rolls to 46.255. | Eyebrow "O universo"; "46.255"; "empresas de capital fechado no radar"; close "Você esteve dentro de uma delas." / "As outras 46.254 já estão no radar — cada uma com seu número." |
| Ch4 tail → Ch5 | The universe content recedes and the header and footer return. The journey hands the scroll to the plans, with the field parked in the universe view. The corner CTA "Ver planos" stays until Ch5 hides it. | CTA "Ver planos" |

**Design decisions kept:**
- The method or formula is never shown.
- Public data is always anonymous and redacted: no source names, no counts of sources, no values on chips.
- Redaction uses only the █ glyph language. There are no cycling digits and no scramble effects that suggest computation.
- The ±15% range is shown with the estimate at the centre.
- The seal appears only after the resolve.
- Every title or long text over the field sits in a paper container (paper background, border, shadow). The respiro is the one exception: it stays box-less.
- The CTA "Ver planos" appears when the interior clears (`@755`), not before.

**Copy folded, same content (needs sign-off, see §14).** The old separate Ch3 line ".ch3-company" ("Fabricação de esquadrias de metal · CNPJ ██.███.███/0001-██") is carried by the persistent dossier header, which already shows the activity and the CNPJ. The CNPJ never wraps an orphan "██".

---

## 3. Guidance system

### 3.1 Components (one locus for instructions)
1. **The dock.** It keeps the root class `.lp-scrollcue`, so the existing cue-off trigger, the teleport safety set and the return hide list keep working. It is a `<button>`, sits bottom-centre at z 68, and contains:
   - a 22 px SVG **progress ring** around a **chevron**;
   - the **verb line**: IBM Plex Mono 10 px, tracking .14em, uppercase, one line, at most 30 characters;
   - directly under it, the **chapter rail**.
2. **The chapter rail.** A 360 px hairline ruler inside the dock (300 px between 721 and 860 px wide) with five stations, all labelled in mono 8.5 px with .16em tracking: **Radar · Convergência · Estimativa · Universo · Planos**.
   - A 7 px gold diamond needle, the same shape as the range mark, rides the rail.
   - Passed ticks are gold. The active station label is ink; the others are `--tan` at .55.
   - Mapping is piecewise: each chapter takes a quarter of the rail whatever its length. The stations start at vh 0, 880, 1160, 1560 and 1900.
   - The needle moves by `transform: translateX` only.
3. **The onboarding card.** This is the expanded state of the dock (§3.5). It replaces the App-level `.lp-hint` toast and its 4 s timer, which are deleted.
4. **In-scene meters.** The scene itself explains what is happening (§3.7).
5. **The HUD.** Only in the hero: azimuth "AZ ###°" plus "varredura ativa". No telemetry, no percentages. An optional zoom readout exists behind `HUD_ZOOM_READOUT`, default false.
6. **Gateway signals.** The CTA is the only filled element, followed by a passive caption (§3.13).

There is never more than one instruction on screen.

### 3.2 Dock anatomy and colours
- **Pill.** Height 32 px, `min-width: 260px`, so a verb swap never changes the width. Padding 0 14px, with a 10 px gap between ring and verb.
- **Default colours.** Brown-deep background, paper text, 1 px brown-deep border, `--elev-2-warm` shadow. This matches today's cue.
- **Dark state (`is-on-dark`).** When the pill centre is over dark (`field.isDarkAt(x, y)`, §7.9), the pill inverts to a paper background with ink text and a 1 px `rgba(251,249,244,.28)` border. Rail labels and ticks invert to paper as well. The transition is 120 ms on colour and background-colour only.
- **Ring.** An SVG circle with `pathLength="1"`; `stroke-dashoffset = 1 − ringProgress`; stroke 1.25. In REST it is full. On ARRIVAL it flashes gold `#d99f1c` once (300 ms). This is gold on dark brown, so it is allowed.
- **Chevron.** In REST it breathes with the existing `@keyframes lp-scrollcue-breathe 2.6s`. That keyframe must be kept because `.ch5-more` uses it. In BACKWARD it rotates 180° in 200 ms `rk-settle`.

### 3.3 Dock state machine
The state machine is fed every frame by master `vh`, `lenis.velocity` (px/frame), `lenis.direction`, idle time, phase and `blocked()`. Text is written only when it changes.

| State | Entered when | Verb shown | Ring | Opacity | Chevron |
|---|---|---|---|---|---|
| `arrival` | First non-quiet entry, last beat of G3 | Onboarding card (§3.5) | — | 1 | Wheel or swipe glyph |
| `rest` | `|vh − R| ≤ 8` for a rest R1–R7, or vh < 8 at R0 | Imperative of that rest | Full; gold flash on arrival | 1 | Breathes |
| `transit` | Between rests while moving | Gerund of the current sub-segment | `(vh − Rprev)/(Rnext − Rprev)` | .78 while `|v| > .5`, otherwise 1 | Static |
| `idleRest` | `rest` and no input for 1.6 s | Unchanged; colour tan → ink | — | 1 | 2-bob nudge (6 px, 2×450 ms `rk-settle`), repeats every 6 s, at most 3 times per position |
| `idleMid` | `transit` and no input for 1.2 s | Crossfades to "continue rolando" (existing copy) | Pulses scale 1 → 1.12 → 1, twice | 1 | 2-bob nudge, repeats every 6 s, at most 3 times |
| `back` | `direction = −1` for > 150 ms and `|v| > .5` | "voltando · ⟨Estação⟩" (e.g. "voltando · Convergência") | Drains, tracking local progress | .78 | Rotated 180° |
| `fling` | `|v| > 30` px/frame | Unchanged | Unchanged | .45 | — |
| `lifted` | vh ≥ 1840 (chrome visible) | — | — | — | Root inner translateY −(footerHeight + 10 px), scrubbed over 1840–1880 |
| `hidden` | Gateway phase; a covered cut is running; reduced motion; and from Ch5 start (root hidden by the existing trigger) | — | — | 0 | — |

**Rules:**
- 400 ms after a backward motion stops, the verb returns to the forward imperative or gerund and the chevron flips back down.
- Verb swaps are time-based, never scrubbed: the outgoing text goes to opacity 0 with `blur(2px)` and y −4 over 140 ms; the incoming text goes from blur 2 px to 0, opacity 0 to 1 and y 4 to 0 over 200 ms `rk-settle`. Use `overwrite: "auto"` so swaps are interruptible. A 6 vh hysteresis prevents flicker at segment boundaries.

### 3.4 Exact pt-BR copy per beat (new microcopy, needs sign-off; all at most 30 characters)

| Segment (vh) | State | Verb |
|---|---|---|
| R0 (0) | rest | **role para mergulhar no campo** (fallback flag `HERO_VERB_LEGACY` restores "role para varrer o campo") |
| 8–220 (J1) | transit | mergulhando no campo |
| 220–352 (J2) | transit | travando a mira |
| R1 (360) | rest | **role para entrar na empresa** |
| 368–480 (J3) | transit | entrando na empresa |
| 480–657 (J4) | transit | dentro da empresa |
| R2 (665) | rest | **role para iluminar a empresa** |
| 673–770 (J5) | transit | iluminando a empresa |
| 770–872 (J6) | transit | abrindo o dossiê |
| R3 (880) | rest | **role para reunir as fontes** |
| 888–1110 (C2a) | transit | reunindo as fontes |
| 1110–1152 (C2b) | transit | cercando o número |
| R4 (1160) | rest | **role para revelar o número** |
| 1168–1230 (C3a) | transit | preparando a estimativa |
| 1230–1392 (C3b–C3c) | transit | revelando o número |
| R5 (1400) | rest | **role para ver a margem** |
| 1408–1552 (C3d–C3e) | transit | traçando a margem |
| R6 (1560) | rest | **role para recuar ao universo** |
| 1568–1650 (C4a) | transit | a empresa vira um ponto |
| 1650–1782 (C4b–C4c) | transit | recuando ao universo |
| R7 (1790) | rest | **role para ver os planos** |
| 1798–1900 (C4d) | rest style (full ring, breathing chevron) | a seguir: os planos |
| any transit, idle 1.2 s | idleMid | continue rolando |
| backward | back | voltando · Radar / Convergência / Estimativa / Universo |

- The dock `aria-label` is "Avançar para a próxima etapa".
- A visually hidden `aria-live="polite"` region announces only rest arrivals, throttled to one every 1.5 s. Format: "Etapa N de 8 · ⟨Estação⟩. ⟨Imperativo com inicial maiúscula⟩." Example: "Etapa 4 de 8 · Convergência. Role para reunir as fontes."
- The onboarding card keeps `role="status"`.

### 3.5 Onboarding: the first instruction
- **When it shows.** On a normal (non-quiet) entry only, as the LAST beat of the radar wake (G3). It lands about 0.5 s after the shockwave settles.
- **Layout.**
  - Desktop: centred horizontally, bottom edge 120 px above the viewport bottom.
  - Mobile: full width minus 32 px, `bottom: calc(96px + env(safe-area-inset-bottom))`.
- **Card.** Paper background, 1 px `--line-strong` border, four registration micro-corners, padding 18px 22px.
  - Left: a glyph. On a fine pointer, a 16×26 mouse outline whose wheel dot slides 0 → 6 px every 1.4 s (`rk-io`, infinite). On a coarse pointer, two chevrons rising.
  - Right: the title "**Role para baixo**" (Playfair 22 px, ink) and the sub "**A jornada segue pelo scroll — até o fim da página.**" (Inter 13 px, `--tan`). Both strings are verbatim from today's `.lp-hint`.
- **Dismissal.** Only by a real scroll: 4 px or more of cumulative scroll delta. Never by a timer. On dismissal, `Flip.from` collapses the card into the docked pill (450 ms `rk-glide`), the verb crossfades to "mergulhando no campo", and the rail draws in (`scaleX 0 → 1`, origin left, 400 ms `rk-expo`).
- **Quiet entry** (a queued "Ver planos", or `?auth=plans`) skips onboarding entirely.
- **Never again.** Once dismissed, it does not reappear until a return to the portal resets it.

### 3.6 Progress and "where am I"
- **Rail.** The needle shows global progress and the active station is lit. When a chapter boundary is crossed (880, 1160, 1560), the station label rolls (mask, 240 ms `rk-settle`) and the passed tick turns gold.
- **Eyebrow reel.** The chapter name in the scene (Convergência → A estimativa → O universo) is one masked reel in a fixed top slot. It rolls when the chapter changes (§5).
- **aria-live.** "Etapa N de 8" on each rest arrival.

### 3.7 In-scene meters (the scene explains itself; no new copy)
- **Target tag.** "Empresa em análise · CNPJ ██.███.███/0001-██" (existing strings joined by " · "). It names *which* company, anonymously. Inside the sphere it parks at top centre as a "you are inside it" marker.
- **Ch2 tick dial.** 26 ticks around the tarja. Each chip impact lights one tick, so the dial shows how much has gathered and how much is left.
- **Ch3 scan.** The gold instrument line's position across the tarja *is* the progress of the reveal. There is deliberately no percentage readout: a percentage would suggest computation.
- **Ch4 odometer.** It lifts out of redaction ("██.███" → "46.255") in step with the dust wave, so the count is literally these points.
- **Ch4 referent.** "R$ 24,3 mi" is pinned beside the lit company point, the brackets are locked around it, and a leader hairline runs from the close to it.
- **Rack focus.** At reading rests R2–R6 the field quiets: point opacity × (1 − .18·focus), size × (1 + .12·focus). It returns to normal in transits. The background itself signals reading versus moving.

### 3.8 Idle behaviour
See `idleRest` and `idleMid` in §3.3. Timers reset on any wheel, touch or keyboard scroll input and are counted per position. The idle state never changes scene content; it touches only the dock.

### 3.9 Mid-transition behaviour
- Every frame is a pure function of vh and there are no crossfades between scenes, so a frozen mid-transition is always legible.
- The ring shows how far the beat has gone.
- On desktop, the directional snap (§4.7) completes small overshoots.
- On touch (no snap), the 16 vh plateaus and the `idleMid` cue cover it.
- **The dock is a button.** Click, tap, Enter or Space calls `lenis.scrollTo(next rest ahead)` with duration `clamp(0.5, Δvh/100 × 0.8, 1.6)` s and easing `t => t<.5 ? 4t³ : 1−(−2t+2)³/2`. Any wheel input interrupts it.
  - At R7 or beyond, the target is `masterEnd + 0.30 × ch5ScrollLength` (where the first plan card is falling). This only writes a scroll target; Ch5 code is untouched.
  - The button is disabled while `blocked()` is true.

### 3.10 Scrolling back
- Everything replays in exact reverse.
- The camera re-enters the sphere on the way up and the dawn closes back to dark.
- The chips fly back to their sources, the tarja splits back into the six word bars and the sentence un-redacts, and the brackets return to the viewport corners.
- Acts reverse, with hysteresis.
- The dock shows "voltando · ⟨Estação⟩", then the forward instruction once motion stops.
- The chrome hides again when scrolling back above vh 1840, as today.
- The onboarding card never returns.

### 3.11 Layout and collision rules
- **Desktop (≥ 721 px).**
  - The dock container is centred at `bottom: calc(14px + env(safe-area-inset-bottom))`. Stack height ≈ 58 px: pill 32, gap 8, rail 18.
  - `.lp-cta` stays bottom-right. Its CSS is unchanged: `right: clamp(20px,4vw,44px)`, `bottom: clamp(20px,4vh,38px)`, height 50.
  - At 721 px the dock spans about 210–510 px and the CTA about 552–692 px, so they never touch. Acceptance re-checks this at 721, 860, 1024, 1366 and 1440.
  - When the chrome returns (≥ 1840), the dock inner lifts by `footerHeight + 10 px`.
- **Mobile (≤ 720 px).**
  - The rail collapses to the active station label plus 5 dots inside the dock under the verb. The verb is 9.5 px with .1em tracking.
  - Dock `max-width: calc(100vw − 32px)`.
  - Before the CTA appears (vh < 755): `bottom: calc(16px + env(safe-area-inset-bottom))`.
  - Once the CTA is visible: the dock sits ABOVE the CTA row, never in it, at `bottom: calc(clamp(20px, 4vh, 38px) + 44px + 10px + env(safe-area-inset-bottom))`.
  - When the footer is visible: `bottom = max(that, footerHeight + 10px)`.
  - The mobile CTA itself is unchanged and stays visible over the static plans as today.
- **Stages reserve space.** Every cinema stage reserves bottom padding at least equal to the dock stack top (desktop ≥ 84 px; mobile ≥ 150 px after vh 755), so the dock never covers scene text.

### 3.12 Gateway signals
- **CTA.** "Quero conhecer o produto →" is the only filled object.
- **Idle armed pulse.** On `(hover: hover)` and `no-preference`, starting 2.6 s after the boot ends, the CTA's `::after` armed ring pulses once (scale 1 → 1.14, opacity .55 → 0, 900 ms `--ease-settle`). It repeats every 7 s, at most 3 times.
- **Caption.** "mova o cursor — o campo responde" becomes a passive caption: no fill, no border, no shadow; mono 10.5 px, .14em, `--tan`.
  - It is preceded by a 10 px ring glyph that drifts up to 3 px toward the pointer.
  - Hidden on `(hover: none)`, as today.
  - It fades out (400 ms) after 240 px of cumulative pointer travel and stays hidden until the Gateway remounts.
- **Press feedback.** `.gx-cta:active` uses `scale: .97` with a 140 ms transition (today it is 0.5 s).

---

## 4. Scroll architecture

### 4.1 Geometry: no pins, same pattern
- Keep the sound base pattern: `position: fixed` stages, a fixed canvas, and empty normal-flow spacer tracks. No ScrollTrigger pins, no pin spacers, no ScrollSmoother.
- DOM order, unchanged in sequence: `.lp-scroll` → `.ch2-track` → `.ch3-track` → `.ch4-track` → `.ch5-stage` → `.ch5-track` → `.ch6`.
- New heights:

| Spacer | Old | New |
|---|---|---|
| `.lp-scroll` | 900vh | **880vh** |
| `.ch2-track` | 780vh | **280vh** |
| `.ch3-track` | 720vh | **400vh** |
| `.ch4-track` | 900vh | **440vh** |
| sum | 3300vh | **2000vh** |

- The master end is `.ch4-track` bottom-bottom = 2000 − 100 = **1900 vh**. That is exactly `.ch5-track` "top bottom", so Ch5 chains unchanged.
- Chapter spans in master time: Ch1 0–880, Ch2 880–1160, Ch3 1160–1560, Ch4 1560–1900.
- Total scroll before the plans: **19 viewports**, down from 32.
- On mobile, `.ch5-stage` is static and `.ch5-track` is `display: none`. The master end is then `.ch5-stage` top at the viewport bottom, which is what the existing cue-off trigger already uses.

### 4.2 The master timeline
```ts
const master = gsap.timeline({
  defaults: { ease: "none" },             // local; global gsap.defaults stays rk-settle for Ch5
  scrollTrigger: {
    trigger: ".lp-scroll", start: "top top",
    endTrigger: ".ch4-track", end: "bottom bottom",
    scrub: true, invalidateOnRefresh: true,
    onUpdate: director.onUpdate,          // acts + guide bookkeeping only
  },
});
master.to({}, { duration: 1900 }, 0);    // fixes duration: 1 timeline second = 1 vh
// labels: R0..R7, and beat starts (J1..C4d) from BEATS
```
- It is created inside the same `gsap.context` as everything else, **before** the Ch5 block. Teleport's creation-order `progress(1)` loop depends on that order.
- `scrub: true` means there is no catch-up tween: `ScrollTrigger.update()` alone sets the exact progress. As a result, `getTween()` returns `undefined` for this trigger, and the existing teleport loop safely skips it.

### 4.3 BEATS table (single source of truth, in `cinema/beats.ts`)

| id | start | end | len | rest after | chapter / station |
|---|---|---|---|---|---|
| G1 boot | time | — | 0 | — | Gateway |
| G2 exit | time | — | 0 | — | Gateway |
| G3 wake | time | — | 0 | R0 @0 (no plateau) | Radar |
| J1 Mergulho | 0 | 220 | 220 | — | Radar |
| J2 Mira | 220 | 352 | 132 | R1 @360 (352–368) | Radar |
| J3 Travessia | 368 | 480 | 112 | — | Radar |
| J4 Interior | 480 | 657 | 177 | R2 @665 (657–673) | Radar |
| J5 Alvorada | 673 | 770 | 97 | — | Radar |
| J6 Dossiê nasce | 770 | 872 | 102 | R3 @880 (872–888) | Radar → Convergência @880 |
| C2a Convergência | 888 | 1110 | 222 | — | Convergência |
| C2b Cerco | 1110 | 1152 | 42 | R4 @1160 (1152–1168) | Convergência → Estimativa @1160 |
| C3a Metamorfose | 1168 | 1230 | 62 | — | Estimativa |
| C3b Fusão | 1230 | 1270 | 40 | — | Estimativa |
| C3c Varredura | 1270 | 1392 | 122 | R5 @1400 (1392–1408) | Estimativa |
| C3d Faixa + selo | 1408 | 1490 | 82 | — | Estimativa |
| C3e Desfecho | 1490 | 1552 | 62 | R6 @1560 (1552–1568) | Estimativa → Universo @1560 |
| C4a Recuo | 1568 | 1650 | 82 | — | Universo |
| C4b Universo | 1650 | 1755 | 105 | — | Universo |
| C4c Referente | 1755 | 1782 | 27 | R7 @1790 (1782–1798) | Universo |
| C4d Entrega | 1798 | 1900 | 102 | — (Ch5 at 1900) | Universo → Planos @1900 |

`beats.ts` also exports:
- the camera keyframe tables (§7.2);
- the field score ramps (§7.3);
- the verb copy table (§3.4);
- `PACE = 1.0`, a global scale factor that retunes every beat and rest together. Track heights stay in CSS: if `PACE` changes, multiply them in `landing.css` too.

**Pacing rule (acceptance).** Outside plateaus, every 50 vh window must show a visible foreground change. Captures at `stepVh 0.5` must never show two consecutive identical foreground frames outside a plateau.

### 4.4 Rests and plateaus
- Rests R1–R7 have zero scroll-driven change of foreground properties inside `[R−8, R+8]`.
- Time-based ambience continues: sweep rotation, heartbeat, embers, camera breath.
- Guide elements (ring, needle) are not foreground and may move.
- Rack-focus ramps run just outside plateaus, over `[R−16, R−8]` and `[R+8, R+16]`.
- Acts sit outside plateaus.

### 4.5 Acts (reversible, time-based)

| id | label (vh) | owner | timeline |
|---|---|---|---|
| `lock` | 345 | RIG | brackets scale .92 → 1, `back.out(1.6)`, 220 ms; bracket colour ink → `#d99f1c` → ink, 300 ms; tag `clip-path: inset(0 100% 0 0)` → `inset(0)`, 240 ms `rk-settle` |
| `needle` | 1450 | DOSSIER | `.cx-range__mark` y −36 → 0, scale .7 → 1, autoAlpha 0 → 1, `back.out(1.6)`, 600 ms (x is static: `left: 50%; xPercent: −50`) |
| `seal` | 1475 | DOSSIER | seal autoAlpha 0 → 1, scale 1.12 → 1, 220 ms `rk-settle`; then the check path DrawSVG 0 → 100%, 300 ms, delay 80 ms |
| `ringLock` | 1645 | RIG | brackets scale 1.12 → 1, `back.out(1.6)`, 220 ms; gold flash 300 ms |
| `countSettle` | 1752 | CH4 | the last reel overshoots yPercent 2% → 0, 300 ms `back.out(1.15)`; panel hairline scaleX 0 → 1, 300 ms `rk-settle` |

- **Runner** (`cinema/acts.ts`, WP0): on each master update, if `vh ≥ at + 0.5` and the act is not forward, call `tl.play()`; if `vh < at − 0.5` and the act is forward, call `tl.reverse()`. Reverse plays at 1.6× timeScale (exits are faster than entrances).
- `settleActs("end" | "start")` sets `progress(1)` or `progress(0)` directly.

### 4.6 Clock: one smoother, one playhead, one frame order
- **Lenis config stays** `{ duration: 1.15, smoothWheel: true }`. The same instance drives Ch5–Ch8, so its feel must not change.
  - The flag `LENIS_CINEMA_LERP` (default **false**, needs sign-off) would switch to `lerp: 0.09`, `duration: undefined` below the master end, and restore the saved options at or after ch5 start. Lenis reads its options on every wheel event, so this works, but it changes the feel at the boundary.
- **One gsap.ticker callback** (`cinema/clock.ts`), added once with `gsap.ticker.lagSmoothing(0)`. It replaces Landing's current `tick`. Order inside the callback:
  1. `lenis.raf(time*1000)`. This emits `scroll`, which calls `ScrollTrigger.update`, which renders the scrub:true master synchronously, so DOM tweens are written.
  2. `dt = min(deltaRatio/60, 0.05)`. Velocity: `vPxS = |lenis.velocity| / dt`, `vNorm = clamp01(vPxS / 2400)`, then `vel = damp(vel, vNorm, 6, dt)`. This is the only velocity smoothing.
  3. `field.update(vh, t, dt)`: camera, sphere and uniforms from the score plus the time layer, then `camera.updateMatrixWorld()`.
  4. Frame functions, by order: `Anchors = 20` (RIG), `Dossier = 25` (live morph writers), `Labels = 30` (CH1 labels, HUD, `--sweep-bearing` sink), `Guide = 40` (dock machine), `Reducer = 50` (globals).
  5. `field.render()`.
- The GSAP root render (Ch5's scrub:1 tween, acts, swaps) happens before this callback in the same tick. That is why the reducer, which runs last among DOM writers, wins over any late Ch5 catch-up write while vh < ch5 start.
- **Damping.** Every damping step is `damp(a, b, λ, dt) = a + (b − a)(1 − e^(−λdt))`. Mouse uses λ = 7. No per-frame constant lerps remain anywhere.

### 4.7 Snapping (custom, directional, desktop only)
- Enabled only when `matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)")` matches and `FLAGS.SNAP` is true (kill switch).
- **Trigger.** 220 ms after the last wheel event AND `|lenis.velocity| < 0.2` AND `!blocked()`.
- **Candidates.** R1–R7 only. Never R0. Never any target with vh ≥ 1800 (the handoff and Ch5 are never snapped). Rest pixel positions are `master.start + (R/1900)·(master.end − master.start)`, recomputed on ScrollTrigger `refresh`.
- **Rule.**
  - If already inside a plateau, do nothing.
  - Else, if the nearest rest **ahead in the last direction of travel** is within `SNAP_AHEAD_VH = 30`, snap to it.
  - Else, if any rest is within `SNAP_ANY_VH = 6` in either direction (less than one wheel notch), snap to it.
  - Else, do nothing.
- **Motion.** `lenis.scrollTo(px, { duration: clamp(0.35, |Δvh|/100 × 1.2, 0.7), easing: t => 1 − (1 − t)**3 })`. Any wheel input interrupts it. The dock shows `transit` during the snap and `rest` when it completes.
- **Stopped** (`snap.stop()`) during teleport, return-home, the auth overlay, Historia/Boletim, while the floor clamp is armed, and while Lenis is stopped.
- **Rejected:** ScrollTrigger `snap` (it double-eases against Lenis); `lenis/snap` "proximity" (non-directional, pulls users back to R0); any auto-complete of a half-done transition.

### 4.8 Reverse behaviour
Every DOM tween and every field channel is a pure function of vh. Acts reverse with hysteresis. Ambient time-based effects (sweep, beat, embers, sweep-flash labels, breath) are direction-agnostic. There is no `once: true` and no fire-once `.call()` anywhere in the cinema.

### 4.9 Refresh and measurement
- All rects are measured on ScrollTrigger `refresh`, after `document.fonts.ready` on the first one, through `ctx.rects.register(key, measureFn)`. Movers use untransformed slot wrappers. Function-based tween values plus `invalidateOnRefresh` pick up the new numbers.
- **Nothing reads layout per frame.** GL anchors come from camera math.
- `ScrollTrigger.config({ ignoreMobileResize: true })`.
- Remove the manual `ScrollTrigger.refresh()` from `onResize`; ScrollTrigger auto-refreshes, debounced.
- `field.resize()` is debounced to 150 ms and also runs on ScrollTrigger `refreshInit`.
- The ch6 offsets (`armY`, `floor`) are cached on `refresh` (§11.6).

---

## 5. Beat-by-beat choreography

Notation:
- `[vh a–b | b x–y]` is a window: absolute vh, then beat progress.
- Unless stated, scrubbed tweens use `ease: "none"`. Positional settles use `sine.inOut`.
- **Field** lines name score channels (§7.3); **DOM** lines name owner packages.
- "MaskWords rise" means a word inside an `overflow:hidden` mask going yPercent 105 → 0 with opacity 0 → 1, staggered as stated.

### G1 · Gateway boot (time-based, about 1.9 s; owner GW)
- **Field.** `time.entryZ = 3.5`, so the camera is at (0, 0, 19.5) looking at the origin. The outer ring and the dial ticks show at the left and right edges. Rings and dial are drawn, as today. The sweep runs and the cursor is reactive. Value labels are off (`revealedRef` gate).
- **Timeline** (default ease `rk-expo`):

| t (s) | Target | Change |
|---|---|---|
| 0 | `.gx-gate__veil` | The veil is now a pre-rendered radial-gradient layer drawn at the rest radius (64%), `inset: -50%`. Animate `scale: 1.84 → 1` over 1.2 s. Remove all `--veil-r` tweening. |
| 0.15 | `.grl__bloom` | opacity → .32, 1.0 s |
| 0.2 | `.grl__spiral` | DrawSVG `0% → 100%`, 1.2 s `power2.inOut` (replaces the manual dasharray) |
| 0.55 | `.grl__sweep` | `--boot-swing −120 → 0`, 1.1 s `rk-glide` |
| 0.95 | `.grl__spark` | scale .6 → 1 (never from 0) and opacity, `back.out(2.4)`, stagger 60 ms random |
| 1.05 | `.grl__word-i` | yPercent 115 → 0, 0.7 s, stagger .1 |
| 1.2 / 1.32 | rule segments / diamond | as today |
| 1.35 | phrase | y 18 → 0, autoAlpha, 0.7 s |
| 1.5 | `.gx-cta` | y 16 → 0, autoAlpha, 0.6 s |
| 1.72 | `.gx-cue` | opacity only, 0.4 s |

- **Chrome.** Header and footer are visible (reducer, phase `gateway`).
- **Cue.** As in §3.12.

### G2 · Gateway exit: "a logo é o radar" (time-based, 1.1 s; owner GW)
- **Communicates.** You fall through the spiral into the same field; the emblem and the instrument are one object.
- **Fix first.** `onClick={() => onEnter()}`. The prop type becomes `onEnter: (quiet?: boolean) => void`.

| t (s) | Target | Change |
|---|---|---|
| 0 | `.gx-cta` | scale .97, 120 ms |
| 0.04 | caption, CTA, phrase, wordmark, rule | y 0 → −12, `filter blur(0 → 4px)` (each element ≤ 480 px wide), autoAlpha → 0, 260 ms `rk-settle`, stagger 35 ms from bottom to top. Everything leaves upward, never downward. |
| 0 | `.lp-nav`, `.lp-footer` | yPercent −100 / +100 with autoAlpha 0, 320 ms `rk-settle`. Written by the **reducer** on phase `entering`. |
| 0.06–0.81 | `.grl__emblem` | x/y so the emblem hub (SVG (100,100) = `transformOrigin "50% 50.7%"`) lands on `field.projectToScreen(0,0,−1)` at the hero pose. Scale = `field.ringRadiusPx(2.4, heroPose)` ÷ the spiral's outer radius in px (r = 46 SVG units × the emblem's px-per-unit). Ease `rk-expo`, no rotation, so the needle stays true. |
| 0.10–0.70 | `.grl__spiral` | MorphSVG to the precomputed circle `r = 46` centred at (100,100), `rk-io` |
| 0–0.9 | `field.time.entryZ` | 3.5 → 0, `rk-expo` |
| 0.6 | `field.time.fovGate` | 0 → −3° in 90 ms `rk-expo`, then back to 0 over 550 ms `rk-settle` |
| 0.72 (contact) | field | `field.flare()` (sweep boost 3.2 plus a charge pulse); `time.ringBoost[0] = 1.5`, decaying 0.9 s `rk-settle`. The emblem goes to autoAlpha 0 over 120 ms: the geometry is identical, so the eye reads one object. |
| 0.72–1.62 | `field.time.shockR` | 2.4 → 14 world units, `rk-expo`. Points within ±0.6 of the front get +0.8 resolved and a 0.25 radial push. When the front passes ring i, `time.ringBoost[i] = 1` decays over 0.6 s, so the rings light up in sequence ("o radar acorda"). Reset to −1 afterwards. |
| 0.05–0.75 | veil layer | scale 1 → 2.5, autoAlpha → 0, `rk-settle` |
| 0.85 | `rootRef.current` | autoAlpha 0, 250 ms. This fixes the old `.gx-gate` selector that never matched inside its own context. |
| 1.1 | — | `onLeft()`: phase becomes `radar` and `lenis.start()` runs in the reveal effect |

- **Quiet variant** (`quiet` prop true, for a queued "Ver planos" or `?auth=plans`): the same text exit and glide. At 0.30 s, call `runtime.veil.cover(0.3)`: `.lp-return-veil` autoAlpha 0 → 1 over 300 ms `power2.inOut` ("mergulho no papel"). Call `onLeft()` at 0.65 s. The pending flush then calls `teleportToPlans({ alreadyCovered: true })` (§11.3), so the user sees one transition, not three.
- **Cue.** None. This is the 1.1 s response to the click, and scroll is locked.

### G3 · Radar wake → R0 (time-based, ≤ 0.9 s after phase `radar`; owners CH1, RIG, GUIDE)

| t (s) | Target | Change |
|---|---|---|
| 0 | `.lp-stage` | autoAlpha 1, 0.7 s `power2.out` (the existing reveal effect, kept) |
| 0 | `.cx-rig__bracket` ×4 | `--draw 0 → 1`, 300 ms `rk-settle`, stagger 50 ms, at the viewport corners (inset 26 px desktop / 18 px mobile) |
| 0.15 | HUD readout | counts 000 → live bearing over 220 ms, then goes live and is written only when the integer changes |
| 0.35 | dock root `.lp-scrollcue` | autoAlpha 1 (the root is owned by the reveal hook) |
| 0.5 | onboarding card | y 16 → 0, autoAlpha, 300 ms `rk-settle` |

- **Quiet entry:** set all of these to their final state instantly. There is no onboarding and the dock shows `rest` R0.
- **Scene at R0.** The sweep turns and deposits charge, the points beat, and the cursor resolves companies. The FOV throb is allowed only while vh < 3 and no label is visible.
- **Cue.** Onboarding card, then dock R0 "role para mergulhar no campo".

### J1 · Mergulho [0–220 | len 220]
- **Communicates.** From the overview into depth.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Camera IN path | 0–220 | 0–1 | GL: `aIn` 0 → .42 by the monotone profile. Start slope equals the mean secant, so the first notch moves the camera visibly. |
| Imposter shading | 0–300 | 0–1+ | GL: `dive` 0 → 1 (smooth) |
| Sphere radius | 0–360 | — | GL: `sphereR` 0.06 → 0.42, log interpolation |
| Sweep reacts to scroll | ambient | — | GL: sweep angular speed × (1 + 1.6·vel); boost = flare + vel·0.8 |
| HUD leaves | 30–70 | .14–.32 | CH1: `.cx-hud` y 0 → −8, autoAlpha 1 → 0 |
| Cursor labels | live | — | CH1: as today (radar mode only) |
| Brackets hold | — | — | RIG: frame mode (viewport corners) |

- **Cue.** transit "mergulhando no campo", ring filling over 0 → 360.

### J2 · Mira + trava [220–352 | len 132] → R1 @360 (plateau 352–368)
- **Communicates.** ONE company is chosen, anonymously.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Brackets travel and contract | 240–340 | .15–.91 | RIG: box = `lerpRect(viewportInset(24), bbox(anchor) ⊕ 14px (min 44px square), sine.inOut(b'))` |
| Instrument powers down | 260–350 | .30–.98 | GL: `sweepGain`, `chargeGain` 1 → 0 (charge is gated, so no beamless wedge) |
| Rings undraw, outer first | 280–350 | .45–.98 | GL: ring3 280–310, ring2 295–325, ring1 310–340, ring0 320–350; dial ticks 280–320; crosshair 300–330 (draw fraction 1 → 0) |
| Field dims | 240–350 | .15–.98 | GL: `fieldOp` 1 → .6 |
| Labels yield | 220 → 300 | 0–.61 | CH1: suppressed within 120 px of the projected target from 220; strength × (1 − ramp 260–300); off at ≥ 300 |
| **Act `lock`** | 345 | .95 | RIG: bracket snap and gold flash; tag "Empresa em análise · CNPJ ██.███.███/0001-██" reveals pinned 18 px above the TL bracket (mono 10.5 px, `--brown-deep` on paper, or paper on dark) |
| Ripple | 345 | — | GL: ink ripple centred on the anchor (§7.8) |
| Camera decelerates | → 352 | 1 | GL: profile slope 0 at 352 (plateau) |

- **Cue.** transit "travando a mira" → R1 "role para entrar na empresa" (ring closes, gold flash).
- **Target size.** At R1 the target is a dark disc of about 100 px radius at 900 px height (camera z ≈ 5.6).

### J3 · Travessia [368–480 | len 112]
- **Communicates.** We enter the company. This is a real dolly, not a black disc growing over a still image.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Dolly to contact | 368–465 | 0–.87 | GL: `aIn` .70 → `a(P3)`, accelerating; contact is when `|cam − SP| = R = 0.42` |
| Points stream past | 400–480 | .29–1 | GL: near-fade `smoothstep(.35, 1.2, depth)`; sprite cap 64 px × DPR; local bokeh `max(uSoft, 1 − smoothstep(.6, 2.5, depth))`; radial speed-stretch `uWarp = clamp(|camVel|·.35, 0, 1.5)` (desktop, tier ≤ 1, at most 2.5×) |
| Softness, imposters off | 400–520 | .29–1+ | GL: `soft` 0 → 1 (smooth); `dive` 1 → 0 over 440–520 |
| Warm rim on dark | derived | — | GL: `gateDark = smoothstep(.35, .8, rPx/halfDiag)` drives the exterior fresnel rim and the atmosphere |
| FOV thud | centred 465 | .87 | GL: `fovThud = −4·exp(−((vh−465)/18)²)` (deterministic, reverses) |
| Interior takes over | 465 | .87 | GL: interior BackSide mesh renders while `|cam − SP| < R`; `rimIn` 1 → 0 over 465–520 |
| Brackets pushed out | 368–440 | 0–.64 | RIG: box = silhouette bbox ⊕ 14 px, clamped to a 16 px viewport inset (they end at the corners) |
| Tag parks | 400–480 | .29–1 | RIG: tag moves from the TL bracket to top centre (y = 64 px desktop, 56 px mobile) |
| On-dark inversion | derived | — | GUIDE, RIG: `is-on-dark` when `field.isDarkAt(center)` |
| Embers | 470–500 | .91–(J4) | GL: `embers` 0 → 1 |

- **Cue.** transit "entrando na empresa". The dock inverts to a paper pill when the dark disc covers it.

### J4 · Interior: respiro em luz [480–657 | len 177] → R2 @665 (plateau 657–673)
- **Communicates.** The thesis, read inside the company. The dark is never empty.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Camera settles at centre | 480–520 | 0–.23 | GL: `aIn` → 1 (end slope 0) |
| Creep (ember parallax) | 480–657 | 0–1 | GL: `creep` 0 → 0.04 world units along the look direction |
| Dome breathes | ambient | — | GL: interior radial `#1d140b` (centre) → `#0c0a07`, brightness × (1 + .08·beat) |
| Embers drift | ambient | — | GL: 240 additive gold points (`#cf9b1e`, `#f3c560` cores, 1.5–4 px) inside 0.9R, curl drift, twinkle on the "lub" |
| Words in LIGHT | word i: 490+6.5i → 514+6.5i | .06+.037i → .19+.037i | CH1: each `.cx-respiro__w` (light copy) does MaskWords rise (yPercent 110 → 0 `sine.out`), opacity 0 → 1, blur 6 px → 0 (desktop only, each word ≤ 220 px), colour `#e6b54a → #fbf9f4` for normal words (a filament cooling). Em words are `#cf9b1e` with `text-shadow: 0 0 18px rgba(207,155,30,.35)` (gold-as-light on dark). The last word ends at 618. |
| Hold, fully legible | 618–657 | .78–1 | contrast ≥ 14:1 |
| Rack focus up | 649–657 | .95–1 | GL: `focus` 0 → 1 |

- The ink twin (`.cx-respiro--ink`: `--brown-deep`, em in `--gold-editorial`) waits, clipped to `circle(0px at 50% 50%)`.
- **Cue.** transit "dentro da empresa" (inverted) → R2 "role para iluminar a empresa".

### J5 · Alvorada [673–770 | len 97]
- **Communicates.** "O radar ilumina cada um" made literal. This is a directional exit from the dark, not a dip to white.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Rack focus down | 681–689 | .08–.16 | GL: `focus` 1 → 0 |
| Dawn front | 680–765 | .07–.95 | GL: `dawn` 0 → 1. `frontR(px) = dawn × 0.56 × hypot(W, H)`, centred. Interior: `darkAlpha = smoothstep(frontR − 12, frontR + 12, d)`; gold rim `exp(−((d − frontR)/5)²)` × `#cf9b1e` on the dark side only; embers × `step(frontR, d)`. |
| Field shows through | 680–765 | — | GL: inside the front the interior discards, so points (`soft` 1, `fieldOp` .5) are visible |
| Text inverts exactly at the front | 680–765 | — | CH1: ink twin `clip-path: circle(frontR px at 50% 50%)`, same formula, same frame (reads `field.score.dawn`). Light word i goes to opacity 0 as soon as `frontR > dist(centre, farthest corner of word i) + 12px`, with word rects measured on refresh. This prevents a gold glow on paper. |
| Interior off | 765 | .95 | GL: interior `visible = false` at `dawn ≥ 1` |
| Chrome inversion | derived | — | GUIDE, RIG flip back to ink as the front passes them |
| CTA rises | 755–775 | .85–1.05 | REDUCER: `.lp-cta` y 16 → 0, autoAlpha 0 → 1 (`sine.out`) |

- **Cue.** transit "iluminando a empresa"; "Ver planos →" appears bottom right.

### J6 · O dossiê nasce [770–872 | len 102] → R3 @880 (plateau 872–888)
- **Communicates.** The company we are inside is shown as a dossier, and the hidden revenue IS the "data no one published": the tarja is that phrase.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Creep | 770–872 | 0–1 | GL: `creep` .04 → .10 |
| White words fly past the lens | 770–830 | 0–.59 | CH1: non-em words only, per-word dolly about the screen centre. `c = 0.15 → 0.40`, `s = (0.5 − 0.15)/(0.5 − c)`; transform `translate((wx−cx)(s−1), (wy−cy)(s−1)) scale(s)`; blur 0 → 6 px (desktop); opacity → 0 once `s > 1.6` |
| Em words redacted | 775–813 | .05–.42 | CH1: in each of the 6 em words ("—", "e", "dados", "que", "ninguém", "publicou."), a `.cx-respiro__bar` (flat ink `#1f1812`) goes scaleX 0 → 1, origin left, 8 vh each, stagger 5 vh. A 2px × 1em `#cf9b1e` nib rides the bar's leading edge. When its bar completes, the word's text goes to opacity 0. |
| Bars fuse into ONE tarja | bar i: 815+2i → 840+2i | .44–.78 | CH1: each bar moves to slice i/6 of the rect `rects.get("dos.tarja@ch2")` (x `sine.inOut`, y `power2.out`, so the path arcs; scaleX/scaleY to the slice; flat ink, so no stripes stretch) |
| **Swap** | 850 | .78 | CH1 hides the bars and DOSSIER shows `.cx-dos__tarja` (flat ink) in the same frame, pixel-identical. The tarja hatch layer fades in over 850–860. |
| Brackets draw the card | 800–850 | .29–.78 | RIG: box = `cardBuildBox(vh)` from `geometry.ts` (viewport inset 16 → card@ch2 rect − 8 px, `sine.inOut`) |
| Paper follows the brackets | 800–850 | .29–.78 | DOSSIER: card paper layer `clip-path: inset(...)` = the same `cardBuildBox(vh)` (shared function, so the two agree exactly) |
| Tag splits into slots | 830–860 | .59–.88 | RIG: tag halves translate and scale to `rects.get("dos.slot.eyebrow")` and `("dos.slot.cnpj")` (same font and size). At 860, DOSSIER slot text goes to opacity 1 and the RIG tag to 0 in the same frame. |
| Description | 840–862 | .69–.90 | DOSSIER: MaskWords rise, stagger 1 vh |
| Rule | 848–860 | .76–.88 | DOSSIER: scaleX 0 → 1 from the centre |
| "Faturamento anual" | 852–866 | .80–.94 | DOSSIER: MaskWords rise. The label group sits at `translateX(+w_est/2)` while "estimado" is clipped (§C3a). |
| Eyebrow "Convergência" | 852–866 | .80–.94 | DOSSIER: the reel window (fixed top slot) rises; reel at cell 0 |
| Caption "Fontes públicas oficiais" | 856–870 | .84–.98 | DOSSIER: text mask-rise; hairlines scaleX from the centre |

- Field during J6: `soft` 1, `fieldOp` .5.
- **Cue.** transit "abrindo o dossiê" → R3 "role para reunir as fontes"; the rail crosses to **Convergência** at 880.

### C2a · Convergência [888–1110 | len 222]
- **Communicates.** Public data gathers from everywhere. It is anonymous and redacted; the page shows THAT it gathers, not what it is.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Tick dial draws | 888–905 | 0–.08 | DOSSIER: 26 ticks (1.5 × 7 px, `--tan`, perpendicular to a rounded-rect path 10 px outside the Ch2 tarja), opacity 0 → .3, scaleY 0 → 1, stagger .6 vh |
| Wave 1 (9 chips) | 905–985 | .08–.44 | DOSSIER: chip j flies over `[905+5j, 945+5j]` |
| Wave 2 (9 chips) | 965–1045 | .35–.71 | as above, offset |
| Wave 3 (8 orbiters) | 1025–1105 | .62–.98 | as above; the target is an orbit slot, not a tick |
| Creep | 888–1552 | — | GL: `creep` .10 → .16 (bokeh parallax stays alive) |

**Chip anatomy and path (transform only, via `gsap.quickSetter`).**
- **Look.** An ink `#1f1812` slug with a 2 px gold leading tick. The trail is a `::before` linear-gradient (ink → transparent) whose scaleX is `1 + 2·|speed|` (normalised, capped at 3), transform only. No labels, ever.
- **Depth layers** (`i % 3`): 40×8 px at opacity .9; 26×6 at .7; 14×4 at .5 with a 1 px blur (small elements).
- **Source P0.** `field.sampleScreenPoints(26, seed, atVh=1000, exclude=card rect ⊕ 40px)`, measured on refresh. A 3 px gold spark (`.cx-dos__spark`, 26 nodes) at P0 goes opacity 0 → 1 → 0 over the first 15% of the chip's window.
- **Path.** Quadratic Bézier from P0 through control C (midpoint + a perpendicular offset of ±0.25·|P2 − P0|, alternating sign) to P2, which is tick i's position (or orbit slot k for wave 3). Position at `t' = sine.inOut(t)`; rotation = tangent angle; scaleX = `1 + 0.8·sin(πt)`.
- **Impact** (the last 10% of the window): chip scale → .6 and opacity → 0. Tick i opacity .3 → 1, colour `--tan` → `#cf9b1e`, scaleY 1 → 1.6 → 1 over 4 vh.

**Per-frame derived values (DOSSIER live writer, pure functions of vh):**
- Tarja charge line: a separate element `.cx-dos__charge` (2 px `#cf9b1e` line), positioned on the top edge of the **Ch2 tarja rect**. It is not a pseudo-element of the final-size tarja, which would be clipped away. scaleX (origin left) = (number of impacts and orbiter landings with eventVh ≤ vh) / 26, so it reaches 18/26 in Ch2 and 26/26 as the orbiters land in C3a. It fades out with the halo over 1186–1196.
- Tarja thunk: translateY = Σ over impacts of a 1 px triangular bump 4 vh wide.
- Ripple events: one ink ripple per impact, centred on tick i (§7.8).

**Mobile.** 12 chips (8 absorbed, 4 orbiters) on vertical arcs from above and below the card; 12 ticks; no trails; no blur. Never `display: none`.
- **Cue.** transit "reunindo as fontes"; the lit ticks are the meter. `idleMid` nudges if the user stops mid-wave.

### C2b · Cerco e desfecho [1110–1152 | len 42] → R4 @1160 (plateau 1152–1168)
- **Communicates.** No public base declares the revenue, but dozens of official sources surround it. This is the hook into Ch3.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Orbit | 1105 → (C3a) | — | DOSSIER: the 8 wave-3 chips sit on the ellipse (Ch2 tarja rect ⊕ 26 px). Angle `= base_k + (vh − 1105)·(0.5π/47)`, scrubbed. |
| Halo | 1110–1125 | 0–.36 | DOSSIER: `.cx-dos__halo` is a separate element sized exactly to the Ch2 tarja rect, with a static `box-shadow: 0 0 0 1px #cf9b1e, 0 0 22px rgba(207,155,30,.35)`. Only its opacity animates (0 → 1). This is a gold halo on the dark tarja, so it is allowed. |
| Rev-note | 1118–1132 | .19–.52 | DOSSIER: "valor que nenhuma base pública declara", `clip-path: inset(0 100% 0 0)` → `inset(0)` |
| Close container | 1124–1134 | .33–.57 | DOSSIER: `.cx-dos__close--c2` (paper container) y 24 → 0, opacity 0 → 1 |
| Close lead | 1126–1142 | .38–.76 | MaskWords rise, stagger 1 vh: "Nenhuma base pública declara esse faturamento." |
| Close sub | 1138–1150 | .67–.95 | MaskWords rise: "Mas dezenas de fontes públicas oficiais o cercam." |
| Rack focus up | 1144–1152 | .81–1 | GL: `focus` 0 → 1 |

- **Cue.** transit "cercando o número" → R4 "role para revelar o número"; the rail crosses to **Estimativa** at 1160.

### C3a · Metamorfose [1168–1230 | len 62]
- **Communicates.** Same company, same tarja: the hidden number is about to resolve. Nothing teleports and no two cards ever overlap.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Rack focus down | 1176–1184 | .13–.26 | GL |
| Ch2 close drops out of frame | 1168–1200 | 0–.52 | DOSSIER: translateY 0 → +55vh, scale 1 → 1.1 (`sine.inOut`). This is camera parallax, not a fade. |
| Caption retracts | 1170–1182 | .03–.23 | DOSSIER: hairlines scaleX → 0; text mask-out (yPercent 0 → −105) |
| Eyebrow reel rolls | 1172–1188 | .06–.32 | DOSSIER: reel translateY −1.2em (cell 0 → 1, "A estimativa"). It is one masked reel, so only one word is readable at a time. |
| Rev-note leaves | 1172–1184 | .06–.26 | DOSSIER: mask-out. Its region becomes the range region later, so the out completes first (text-slot rule). |
| Orbiters land | chip k: 1172+2k → 1180+2k | .06–.45 | DOSSIER: the last 8 ticks light (19–26); the dial is complete |
| Halo leaves | 1186–1196 | .29–.45 | DOSSIER: opacity 1 → 0 |
| Card grows | 1186–1226 | .29–.94 | DOSSIER: paper layer `clip-path: inset(...)` from the Ch2 bounds to the full Ch3 bounds (`sine.inOut`). The card is laid out at its final Ch3 size; earlier states are clips only. |
| Tarja grows | 1190–1228 | .35–.97 | DOSSIER: `clip-path: inset(...)` on the final-size `.cx-dos__tarja` (sized to the amount box, ~400×92 at 1440) from the Ch2 sub-rect (~318×40, centred) to the full box (`sine.inOut`). There is no non-uniform scale, so the hatch never stretches. Tick positions interpolate between the two precomputed perimeters. |
| "estimado" | 1200–1216 | .52–.77 | DOSSIER: label group translateX `+w_est/2 → 0`; `.cx-dos__est` `clip-path: inset(0 100% 0 0)` → `inset(0)` |

- **Cue.** transit "preparando a estimativa".

### C3b · Fusão em linha [1230–1270 | len 40]
- **Communicates.** The data that surrounded the number becomes the instrument.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Ticks converge | 1230–1258 | 0–.70 | DOSSIER: the 26 ticks move x/y to the tarja's left edge (`sine.inOut`, stagger from the centre .6 vh); each goes to opacity 0 over its last 4 vh |
| The line is born | 1250–1268 | .50–.95 | DOSSIER: `.cx-dos__scan`, a pre-sized element (2 px × (tarjaH + 12 px), `#cf9b1e`, static glow `box-shadow: 0 0 12px rgba(207,155,30,.55)`), goes scaleY .07 → 1 from the centre at the left edge |

- **Cue.** transit "revelando o número".

### C3c · Varredura e resolução [1270–1392 | len 122] → R5 @1400 (plateau 1392–1408)
- **Communicates.** The same redaction is resolved by the instrument. The number is uncovered, not created; no formula, no cycling digits.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Line sweeps | 1272–1382 | .02–.92 | DOSSIER: scan translateX 0 → tarjaW |
| Tarja eaten | 1272–1382 | .02–.92 | DOSSIER: `clip-path: inset(0 0 0 X%)` with X tracking the line |
| Number focuses | 1290–1385 | .16–.94 | DOSSIER: a sharp copy `.cx-dos__value` (opacity 0 → 1) and a soft copy `.cx-dos__value--soft` (transparent fill, `text-shadow: 0 0 6px currentColor`, `aria-hidden`; opacity 1 → 0) crossfade on the same glyph positions. The group scales 1.03 → 1 and rests at exactly 1. There is no scrubbed `filter` on the large number. |
| Rack focus up | 1384–1392 | .93–1 | GL |

- At R5 the number reads "R$ 24,3 mi" and the line is parked at the tarja's right edge.
- **Cue.** transit "revelando o número" → R5 "role para ver a margem".

### C3d · Faixa honesta e selo [1408–1490 | len 82]
- **Communicates.** An honest ±15% range with the estimate at the centre. The seal records provenance only after the resolve.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Rack focus down | 1416–1424 | .10–.20 | GL |
| Line turns into the ruler | 1408–1430 | 0–.27 | DOSSIER: scan rotation 0 → 90° plus translate to the ruler centre under the number (`sine.inOut`); its glow opacity → 0 over 1424–1430 |
| Ruler opens | 1430–1452 | .27–.54 | DOSSIER: at 1430 the scan hides and `.cx-range__track` (1.5 px `#cf9b1e` line) takes over at `scaleX = scanLength/rulerW` (pixel-identical), growing to 1 from the centre (`sine.inOut`) |
| Ruler scale | 1440–1460 | .39–.63 | DOSSIER: static ink micro-ticks revealed by `clip-path` from the centre |
| Ends | 1440–1468 | .39–.73 | DOSSIER: "mínimo · R$ 20,7 mi" and "máximo · R$ 27,9 mi" translateX from the centre to their final positions, plus MaskWords rise |
| **Act `needle`** | 1450 | .51 | DOSSIER (§4.5) |
| **Act `seal`** | 1475 | .82 | DOSSIER (§4.5). Ripple event at the seal. |

- The seal is hidden by default in CSS (`opacity: 0; visibility: hidden`), except under reduced motion. It can never appear before the number.
- **Cue.** transit "traçando a margem".

### C3e · Desfecho do Cap. 3 [1490–1552 | len 62] → R6 @1560 (plateau 1552–1568)

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Close enters from below | 1490–1520 | 0–.48 | DOSSIER: `.cx-dos__close--c3` translateY +40vh → 0 (`sine.inOut`), inverse parallax |
| Lead | 1500–1530 | .16–.65 | MaskWords rise: "A precisão do mercado de elite — só com fonte pública oficial." |
| Sub | 1526–1546 | .58–.90 | MaskWords rise: "Nenhum outro produto reconstrói esse número assim." |
| Rack focus up | 1544–1552 | .87–1 | GL |

- **Cue.** transit "traçando a margem" → R6 "role para recuar ao universo"; the rail crosses to **Universo** at 1560.

### C4a · Recuo: o cartão vira o ponto [1568–1650 | len 82]
- **Communicates.** The camera recoils from inside the company. The company becomes a point again, now lit, with its number resolved. This closes the Ch1 zoom arc and gives "Você esteve dentro de uma delas" a referent.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Rack focus down | 1576–1584 | .10–.20 | GL |
| Ch3 close drops away | 1568–1590 | 0–.27 | DOSSIER: translateY 0 → +45vh (`sine.inOut`) |
| Eyebrow reel | 1572–1588 | .05–.24 | DOSSIER: reel cell 1 → 2 ("O universo") |
| Card content dims | 1575–1598 | .09–.37 | DOSSIER: opacity → 0 in order: seal 1575–1581, range 1579–1585, label 1583–1589, header 1587–1593. The amount stays. |
| Camera recoil | 1568–1650 | 0–1 | GL: OUT path from P4c, membrane crossing at 1605 (`|cam − SP| = R`) |
| Lit exterior | ≥ 1600 | — | GL: `lit = 1`, a step that is invisible from inside. Body `mix(#e9e1cf, #fbf9f4, lambert)`, saturated gold rim `pow(1 − |N·V|, 6)·#cf9b1e`, small gold core. |
| Membrane | 1605 | .45 | GL: `fovWiden = +5·exp(−((vh−1605)/18)²)`; ink ripple from the centre. No gold vignette, because we are over paper here. |
| Field returns crisp | 1600–1650 | .39–1 | GL: `soft` 1 → 0, `fieldOp` .5 → 1 |
| Card collapses into the disc | 1605–1640 | .45–.88 | DOSSIER: the card paper clip box converges to the projected disc bbox (`anchor ± r`), with corner radius → r (circle). While the disc is larger than the card, the card stays at scale 1; once `r < cardHalfDiag`, card scale = `r/cardHalfDiag`. A 1 px `#cf9b1e` DOM border fades in over 1615–1630 to match the GL rim. |
| DOM → GL handoff | 1640 | .88 | DOSSIER: the DOM disc hides in one frame when its box equals the disc bbox (r ≈ 84 px < 90 px LOD); the GL lit disc continues |
| Amount pins | 1605–1640 | .45–.88 | DOSSIER: the "R$ 24,3 mi" group translates toward `(anchor.x + r + 12, anchor.y − 8)` and scales down. At the frame where its rendered font size ≤ 15 px (no later than 1640) it swaps instantly to `.cx-dos__pinned` (Playfair 15 px, identical text), which then tracks the anchor every frame. |
| Brackets ride the box | 1568–1640 | — | RIG: card mode → follows `dossier.liveBox()` → disc bbox ⊕ 14 px |
| **Act `ringLock`** | 1645 | .94 | RIG (§4.5). Ripple event. |

- **Cue.** transit "a empresa vira um ponto".

### C4b · Universo e contagem [1650–1755 | len 105]
- **Communicates.** Scale: one point among 46.255, and the count is literally these points. The instrument that went dark in the dive wakes up again.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Recoil continues | 1650–1782 | 0–(C4c) | GL: OUT path P6 (z 8) → P7 (z 34), decelerating into the R7 plateau |
| Panel lands BEFORE the count | 1652–1668 | .02–.17 | CH4: `.cx-ch4__panel` (paper container, top third) y 24 → 0, opacity 0 → 1; label "empresas de capital fechado no radar" MaskWords rise over 1660–1672 |
| Rings redraw, inner → outer | 1660–1720 | .10–.67 | GL: ring0 1660–1684, ring1 1672–1696, ring2 1684–1708, ring3 1696–1720 (0 → 1) |
| Dial ticks | 1690–1740 | .38–.86 | GL |
| Instrument powers on | 1700–1740 | .48–.86 | GL: `sweepGain`, `chargeGain` 0 → 1 |
| Dust wave | 1665–1755 | .14–1 | GL: `dust` 0 → 1; dust is revealed where `|pos − SP| < dust·30`, with a 1.5-unit soft edge and a +0.6 resolved flash at the front (tier 0–1). On tier 2–3 (no dust) the same wave drives a resolve flash on the base points. |
| Odometer from redaction | reel k: 1680+8k → 1716+8k | .29–.93 | CH4: 5 reels whose strip is `[█,0,1,…,9]`. Reel k translateY moves from cell 0 (█) to cell (digit+1), most significant first. The pre-state reads "██.███". The separator "." is static. Blur ≤ 1.5 px only while a reel moves. |
| **Act `countSettle`** | 1752 | .97 | CH4 (§4.5) |
| FOV opens | 1650–1755 | 0–1 | GL: `fovUniverse` 0 → +4° |

- The anchor brackets and pinned label track the point every frame (RIG, DOSSIER).
- **Reel CSS.** `font-variant-numeric: lining-nums tabular-nums`; window and cell 1.14em with matching line-height; `mask-image: linear-gradient(transparent, #000 18%, #000 82%, transparent)`. "00.000" can never appear and neighbouring digits no longer bleed.
- **Cue.** transit "recuando ao universo"; the rising count doubles as the beat meter.

### C4c · Referente [1755–1782 | len 27] → R7 @1790 (plateau 1782–1798)

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Lead | 1756–1768 | .04–.48 | CH4: `.cx-ch4__close` (paper container, lower third) opacity in, plus MaskWords rise: "Você esteve dentro de uma delas." |
| Leader hairline | 1762–1774 | .26–.70 | RIG: a 1 px `--tan` div from the close's top-centre to the bracket box's bottom-centre. Angle and length are recomputed per frame (transform only); scaleX 0 → 1. |
| Ring pulse | 1768–1780 | .48–.93 | RIG: brackets scale 1 → 1.25 → 1 (scrubbed) |
| Sub | 1768–1780 | .48–.93 | CH4: MaskWords rise: "As outras 46.254 já estão no radar — cada uma com seu número." |
| Sweep-flash labels | 1720–1800 (ambient, time-based) | — | CH1 labels: every 400 ms, pick at most one base point within 0.08 rad behind the sweep's leading edge, on screen and outside the panel and close rects. Show "██████ █████ · R$ ███" (always `.is-redacted`) for 900 ms, fading in and out over 160 ms, using the existing 4-label pool. Full values are never shown. |

- **Cue.** transit "recuando ao universo" → R7 "role para ver os planos".

### C4d · Entrega aos planos [1798–1900 | len 102] (Ch5 untouched from 1900)
- **Communicates.** The journey hands the scroll to the plans, with the field parked in the universe view. There is no relay into Ch5.

| Sub-event | vh | b | Owner · change |
|---|---|---|---|
| Leader retracts | 1798–1808 | 0–.10 | RIG |
| Pinned label fades | 1800–1812 | .02–.14 | DOSSIER: opacity → 0 |
| Brackets release | 1800–1830 | .02–.31 | RIG: expand to the viewport corners, autoAlpha → 0 |
| Instrument powers down | 1800–1848 | .02–.49 | GL: ring3 1800–1824, ring2 1808–1832, ring1 1816–1840, ring0 1824–1848; dial ticks 1800–1840 |
| Close exits upward | 1820–1850 | .22–.51 | CH4: y 0 → −32, scale 1 → .98, autoAlpha → 0. No blur: the container is wider than 480 px. |
| Eyebrow exits | 1835–1850 | .36–.51 | DOSSIER: reel window y → −12, autoAlpha → 0 |
| Panel exits upward | 1830–1862 | .31–.63 | CH4: y 0 → −40, scale → .98, autoAlpha → 0. This lifts the eye toward where the Ch5 lead appears. |
| Sphere becomes an ordinary point | 1820–1880 | .22–.80 | GL: `sphereR` .42 → .06 (log); `visible = false` at ≥ 1885 |
| Chrome returns | 1840–1880 | .41–.80 | REDUCER: `.lp-nav` yPercent −100 → 0, `.lp-footer` 100 → 0, autoAlpha 0 → 1 (`sine.inOut`) |
| Dock lifts | 1840–1880 | .41–.80 | GUIDE: inner translateY −(footerH + 10) |
| Dust out | 1840–1890 | .41–.90 | GL: `dustGain` 1 → 0 |
| Sweep beam out | 1850–1900 | .51–1 | GL: `sweepGain` 1 → 0; `chargeGain` stays 1 when `PLANS_BACKDROP_PARITY` (today's backdrop), otherwise it follows `sweepGain` |
| Camera to park | 1798–1900 | 0–1 | GL: P7 → P8 (z 34 → 18, look (0,0,−2)), end slope 0; `fovUniverse` +4 → 0 by 1890; breath blends to the park amplitude |
| Layers off | ≤ 1880 | .80 | every ch1–4 layer is at autoAlpha 0: `.lp-stage` children, `.cx-dos-stage`, `.cx-ch4-stage`, `.cx-rig`, labels |

- **Cue.** "a seguir: os planos" (rest style), with the needle arriving at **Planos** at 1900.
- At 1900 the existing cue-off trigger fades the dock root out (0.35 s). The corner CTA stays visible until Ch5's own `.to(".lp-cta", 0)` at ch5 0.18. The duplicate header "Ver planos" during the ch4 tail is today's contract behaviour and is kept.

---

## 6. Chapter transitions: continuity devices, never a muddy crossfade

| Seam | Device | Shared object | Swap rule |
|---|---|---|---|
| Gateway → Ch1 | Match-cut: the emblem glides onto the hub and its spiral morphs into the GL ring; the camera pushes; a shockwave lights the rings | emblem = ring[0] | The DOM emblem hides at the contact frame (0.72 s), where the geometry is identical |
| Hero → Mira | The frame's brackets leave the corners and lock onto the target | 4 brackets | — |
| Mira → Interior | A dolly through the opaque, depth-correct sphere; the brackets ride its silhouette out to the corners; the tag parks at top centre | sphere, brackets, tag | depth-correct GL, no scale cheat |
| Interior → Alvorada | A radial dawn; each word inverts from light to ink as the front passes it | the respiro sentence | the ink twin clip = the GL front formula, same frame |
| Respiro → Ch2 | The em phrase is redacted into bars that fuse into the tarja; the brackets draw the card; the tag splits into the card's slots | em phrase → tarja; brackets → card corners; tag → header | swaps at 850 and 860, pixel-identical (flat ink; same font) |
| Ch2 → Ch3 | The same card grows; the same tarja grows (clip only); ticks → scan line → ruler | card, tarja, ticks | no element ever crossfades with another |
| Ch3 → Ch4 | The camera recoils through the membrane; the card collapses into the lit disc; the amount pins; the brackets become the ring | card → disc, amount → pinned label, brackets → ring | the DOM disc hides at 1640 with matched geometry; the amount swaps at a matched 15 px size |
| Ch4 → Ch5 | Directional upward exits, a camera push to the park pose, the instrument powering down, the chrome returning | the field | every ch1–4 layer is at 0 by 1880; nothing reads or writes Ch5 DOM |

**Rules.**
1. Two scenes never crossfade.
2. **Text-slot rule:** in any screen region, an out-mask completes before an in-mask begins. Two semi-transparent text containers never coexist.
3. Every swap happens in a frame where both layers are opaque and identical. Measure after `document.fonts.ready` and round positions to device pixels.
4. Reading text never moves at a rest. Rests land at scale exactly 1.
5. DOM layers ignore the time-based camera breath. Only anchors pinned to the point (brackets, pinned label, leader) follow it.

---

## 7. WebGL: PointField rewrite (`three/`)

### 7.1 Engine shape
- **No internal requestAnimationFrame.** The clock (§4.6) calls `field.update(vh, t, dt)` and then `field.render()`.
- **Two state layers.**
  - The **score**: a pure function of vh (`cinema/field/score.ts`) built from the ramps in §7.3.
  - The **time layer** `field.time = { entryZ, shockR, fovGate, ringBoost[4] }`, written only by Gateway tweens and by settle.
- **Ambient time effects stay:** sweep rotation, heartbeat, embers, breath, flare decay, sweep-flash picks.
- **Reduced motion:** render one static hero frame (`vh = 0`, `entryZ = 0`, motion scalar 0, frozen analytic charge wedge), and re-render on resize.
- **Construction is wrapped in try/catch.** On failure, return `NullField` (same API, `ok: false`), add `.landing.no-webgl`, and keep the timelines running (§9.3).

### 7.2 Camera
- **Paths.** Centripetal `CatmullRomCurve3`, sampled by arc length (`getPointAt`), so velocity is C1-continuous and the only zero-velocity moments are rests and the park pose.
  - **IN:** P0 (0, 0, 16) → P1 (0.42, −0.24, 9.4) → P2 (0.84, −0.47, 4.0) → P3 (0.9, −0.5, 1.62) [contact] → P4 (0.9, −0.5, 1.2) [SP centre].
  - **Look IN:** L0 (0, 0, 0) → L1 (0.55, −0.31, 0.7) → L2 SP → L3 (0.9, −0.5, 0.6) → L4 (0.9, −0.5, 0.2).
  - **OUT:** P4c (0.9, −0.5, 1.04) [crept pose] → P5 (0.9, −0.5, 1.62) [membrane] → P6 (0.7, −0.38, 8) → P7 (0.3, −0.2, 34) [universe] → P8 (0, 0, 18) [park].
  - **Look OUT:** (0.9, −0.5, 0.2) → (0.9, −0.5, 0.2) → (0.5, −0.3, −1) → (0, 0, −2) → (0, 0, −2).
  - The look target is sampled at the same *knot coordinate* as the camera: convert the camera's arc fraction to a knot index u ∈ [0, 4] using the camera curve's knot arc-fractions, then call `lookCurve.getPoint(u/4)`.
- **Speed profiles.** Fritsch–Carlson monotone cubic interpolation of `vh → arc fraction`, with key tables in `beats.ts`:
  - **IN:** (0, 0) with start slope = secant(0 → 220) · (220, .42) · (352, .70) · (368, .70) · (465, a(P3)) · (520, 1) with end slope 0.
  - **OUT:** (1568, 0) slope 0 · (1605, a(P5)) · (1650, a(P6)) · (1782, a(P7)) · (1798, a(P7)) · (1900, 1) with end slope 0.
  - `a(Pk)` = the knot's arc fraction, computed at build time.
  - The IN path is used while vh < 1568, the OUT path from 1568 on.
- **Creep.** While at the IN end (vh 520–1568), the position = P4 + lookDir · `creep` (score), with `creep` reaching 0.16 at 1552. That matches P4c.
- **Gateway entry.** `pos.z += time.entryZ` at vh 0.
- **Breath.** `pos += hero(t)·hA + uni(t)·uA`:
  - `hero(t) = (sin(.12t)·.34, cos(.10t)·.25)`, today's hero drift;
  - `uni(t) = (sin(.08t)·.5, cos(.07t)·.35)`, today's `applyUniverse` drift;
  - `hA`: 1 at 0 → 0 at 465;
  - `uA`: 0 until 1605, → .4 by 1650, .4 → 1 over 1798–1900;
  - both are multiplied by motionScalar. At park, `uA = 1` reproduces today's drift exactly.
- **FOV.** `applyFov` stays the single owner: `fov = 46 − throb + fovThud + fovGate + fovWiden + fovUniverse`. One `updateProjectionMatrix` per frame, only when the value changes. Throb is `beat·.18`, only while vh < 3 and no cursor label is visible.

### 7.3 Field score (ramps; `field/score.ts`, owner GL; keys in `beats.ts`)

| Channel | Keys (vh: value) | Interp |
|---|---|---|
| `sphereR` | 0: .06 → 360: .42; hold; 1820: .42 → 1880: .06; hidden ≥ 1885 | log |
| `dive` (uDive) | 0: 0 → 300: 1; 440: 1 → 520: 0; then 0 | smooth |
| `soft` (uSoft) | 0 until 400; 400 → 520: 0 → 1; hold 1; 1600 → 1650: 1 → 0 | smooth |
| `fieldOp` (uOpacity) | 1 until 240; 240 → 350: 1 → .6; .5 from 465 to 1600 (occluded until the dawn); 1600 → 1650: .5 → 1 | linear |
| `focus` | for R2–R6: up over [R−16, R−8], hold, down over [R+8, R+16] | linear |
| `sweepGain` | 1 until 260; 260 → 350: → 0; 1700 → 1740: → 1; 1850 → 1900: → 0 | linear |
| `chargeGain` | = `sweepGain`, except from 1850 on: hold 1 if `PLANS_BACKDROP_PARITY`, else = `sweepGain` | linear |
| `ring[0..3]` draw | 1 at 0; undraw per J2; redraw per C4b; undraw per C4d | linear |
| `ticks` (dial) | 1 → 0 over 280–320; 0 → 1 over 1690–1740; 1 → 0 over 1800–1840 | linear |
| `cross` (crosshair) | 1 → 0 over 300–330; stays 0 (park parity) | linear |
| `warp` gate | on (desktop, tier ≤ 1) over 400–480 only | step |
| `rimIn` | 465: 1 → 520: 0 | linear |
| `embers` | 470 → 500: 0 → 1; 0 at ≥ 765 | linear |
| `dawn` | 680 → 765: 0 → 1 | linear |
| `lit` | 0 → 1 step at 1600 | step |
| `creep` | 480 → 657: 0 → .04; 770 → 872: .04 → .10; 888 → 1552: .10 → .16 | linear |
| `fovThud` | −4·exp(−((vh−465)/18)²) | analytic |
| `fovWiden` | +5·exp(−((vh−1605)/18)²) | analytic |
| `fovUniverse` | 1650 → 1755: 0 → +4; 1798 → 1890: +4 → 0 | sine.inOut |
| `dust` (wave) | 1665 → 1755: 0 → 1 | linear |
| `dustGain` | 0 before 1665; 1 from 1665; 1840 → 1890: → 0 (unless `KEEP_DUST_IN_PLANS`) | linear |
| `labelsGate` | 1 until 260; 260 → 300: → 0 | linear |
| `sweepFlash` | on over 1720–1800 | step |

### 7.4 Company sphere: two meshes (fixes the banding)
- **Exterior.** `SphereGeometry(1, 96, 64)`, `FrontSide`, `transparent: false`, `depthTest/depthWrite: true`, renderOrder 0.
  - **Dark state** (`lit = 0`): today's `SPHERE_FRAG`. Body `#0c0a07` → `#4a3a22` lambert, ember core × uPulse, veins, fresnel rim × `uGateDark`. Alpha is always 1.
  - **Lit state** (`lit = 1`): body `mix(#e9e1cf, #fbf9f4, l²)`; saturated gold rim line `pow(1 − |N·V|, 6)` × `#cf9b1e`; a small gold core `pow(max(N·V, 0), 24)` × `#cf9b1e` × .8.
- **Interior.** The same geometry with `BackSide`, opaque, depth-writing. It renders only when `|cam − SP| < R` and `dawn < 1`. Its shader:
  - dome colour `mix(#1d140b, #0c0a07, smoothstep(0, 1, rUV))` × (1 + .08·beat);
  - an edge glow `rimIn` × `#cf9b1e` × `pow(1 − |N·V|, 3)`;
  - the screen-space dawn hole: `d = distance(gl_FragCoord.xy, uRes/2)`; discard when `d < frontR − 12`; alpha via smoothstep; a gold rim on the dark side (§J5).
- **Atmosphere.** The shell is kept (BackSide, additive, 1.07×), gated by `uGateDark` and lit only on dark, with `depthTest: true`.
- **Points near SP.** At build time, exclude base points within 1.4R (0.59) of SP, so nothing sits inside the company.

### 7.5 Points
- **Base points.** 2,772, same grid and seeds as today.
  - Material: `depthTest: true` (required now that the sphere is opaque), `depthWrite: false`. Rings, dial, crosshair and sweep also get `depthTest: true`.
  - **Analytic charge in the vertex shader** (new attribute `aAngle`): `behind = mod(uSweepAngle − aAngle, 2π)`; `charge = clamp(1 − (behind/SWEEP_SPEED)/CHARGE_LIFE, 0, 1)` × `uChargeGain`; `charge = max(charge, uPulse·clamp(1 − (uTime − uPulseT)/CHARGE_LIFE, 0, 1))`. This deletes the 2,772-iteration CPU loop and the per-frame attribute upload. `uSweepAngle` is the integrated angle on the CPU, with speed × (1 + 1.6·vel).
  - **Near-camera handling:** fade `smoothstep(.35, 1.2, depth)`; size clamp 64 px × DPR (40 on mobile); local bokeh (§J3); radial warp ellipse oriented away from the screen centre, length ≤ 2.5× (desktop, tier ≤ 1).
  - **Shock:** `|length(pos.xy) − uShockR| < .6` → +.8 resolved and a .25 radial push.
  - **Rack focus:** alpha × (1 − .18·focus), size × (1 + .12·focus).
- **Dust.** A second `Points` draw call: 43,483 points (tier 0), 15,000 (tier 1), 0 (tier 2–3 and mobile).
  - `aSize` .5–1.1, min 1 px × DPR; ink `#6e5630` at alpha .32, lifted to gold by charge.
  - Uniform positions in a disc of radius 16 on z ∈ [−4, 0].
  - Visible where `|pos − SP| < uDust·30` (soft edge 1.5), × `uDustGain`. The wavefront gets +.6 resolved.
  - `depthTest: true`, `depthWrite: false`.
- **Embers.** 240 points (160 on tier 1, 120 on tier 2, 80 on mobile/tier 3), additive, inside 0.9R of SP. Visible only while the camera is inside, × the inverse dawn mask.

### 7.6 Instrument
- Rings (4 × 97 vertices), dial ticks (120 vertices) and crosshair are drawn progressively with `setDrawRange` (the fraction from the score), × `ringBoost[i]` for an opacity boost.
- Sweep mesh opacity × `sweepGain`; boost = flare + vel·.8, with dt-decayed flare.

### 7.7 Labels
- `computeLabels` runs only when the mouse moved more than .5 px or the camera matrix changed, over the base layer only.
- A coarse 12×8 screen grid is rebuilt on camera change; arrays are reused.
- Gate: radar mode, `labelsGate > 0`, and outside 120 px of the target from vh 220.
- `frameData.sweepFlash` feeds the C4c pool mode.
- DOM writers (CH1) set `textContent` only when the picked index changes. Per-frame writes are transform and opacity only.

### 7.8 Deterministic ink ripples
- `uniform vec4 uRings[6]` = (screen x px, screen y px, radius px, amplitude), evaluated on the CPU each frame from the registered event table `{vh, at(), amp = .18}`. An event is active while `0 ≤ vh − vh_e ≤ 14`, with `radius = (vh − vh_e)/14 · 260 px` and `amp × (1 − (vh − vh_e)/14)`. The 6 most recent active events are used.
- Vertex shader, after projection: `w = exp(−((d − r)/18)²)·amp`. Offset the point by `6px·w` along (p − c)/d, converted to clip space, and size × (1 + w).
- Ink only: no colour change, never gold.
- Events: J2 lock, the 18 C2a impacts, the seal, the membrane, the ring-lock.
- Ripples are a pure function of vh, so they reverse with scroll. Flag `RIPPLES` (first to cut if perf is short).

### 7.9 Public API (`FieldAdapter`, implemented by `PointField` and `NullField`)
```ts
interface FieldAdapter {
  readonly ok: boolean; readonly tier: 0 | 1 | 2 | 3;
  time: { entryZ: number; shockR: number; fovGate: number; ringBoost: [number, number, number, number] };
  update(vh: number, t: number, dt: number): void;   // camera + uniforms; updateMatrixWorld
  render(): void;
  setVelocity(v01: number): void;                     // smoothed once by the clock
  flare(): void;                                      // former pulse(): sweep boost 3.2 + charge pulse
  setMouse(nx: number, ny: number): void; clearMouse(): void;
  resize(): void; dispose(): void;
  getAnchorScreen(): { x: number; y: number; r: number; visible: boolean; inside: boolean };
  projectToScreen(x: number, y: number, z: number): { x: number; y: number; visible: boolean };
  ringRadiusPx(worldR: number, heroPose?: boolean): number;
  sampleScreenPoints(n: number, seed: number, atVh: number, exclude?: Rect): Array<{ x: number; y: number }>;
  isDarkAt(x: number, y: number): boolean;           // inside & dawn<1 & d>frontR  ||  outside & !lit & |p−anchor|<r
  addRipple(e: { vh: number; at: () => { x: number; y: number }; amp?: number }): void;
  setPaused(reason: "hidden" | "page" | "covered", on: boolean): void;
  readonly score: Readonly<FieldScoreState>;          // read-only for DOM consumers (e.g. dawn)
  frameData: { cursorLabels: CursorLabel[]; sweepBearing: number; sweepFlash: CursorLabel | null };
}
```
`getAnchorScreen()` is valid after `update()` in the same frame. Positions are rounded to 0.5 px.

### 7.10 Quality and robustness
- **Governor.** Samples frame time over the first 90 frames of the gateway boot.
  - T0: DPR min(dpr, 2), dust 43,483, embers 240, warp on.
  - T1: DPR 1.5, dust 15k, embers 160.
  - T2: DPR 1.25, dust 0, embers 120, warp off.
  - T3: DPR 1, dust 0, embers 80.
  - Mobile (coarse pointer or width ≤ 720) starts at most at T2 with DPR ≤ 1.5.
  - 30 consecutive frames over 18 ms → drop one tier. Tiers never rise within a session.
  - `antialias` is decided at construction: on only if DPR < 1.5.
- **Pause** (no visible change):
  - when `document.hidden`;
  - while Historia or Boletim is open (`setPaused("page")` from Landing);
  - when `scrollY ≥ cachedCh6Top + innerHeight` (`PAUSE_UNDER_CH6`, default true; acceptance verifies that Ch6–Ch8 are pixel-identical with and without it).
- **No** post-processing pass, no textures, no `backdrop-filter` over the canvas. The auth overlay is not touched.

### 7.11 Park state (exact, at vh 1900 = ch5 start)
| Property | Value |
|---|---|
| Camera | (0, 0, 18) + today's universe drift (`sin(.08t)·.5`, `cos(.07t)·.35`), lookAt (0, 0, −2), FOV 46 |
| Uniforms | uSoft 0, uOpacity 1, uDive 0, focus 0 |
| Decor | rings, ticks and crosshair undrawn; sweep beam 0 |
| Charge | `chargeGain` 1 when parity (today's look) |
| Dust | gain 0 |
| Sphere | hidden |
| Embers | 0 |
| Ripples | none |
| Labels | off |

From 1900 on, nothing drives the field except time. That is today's Ch5 backdrop.

---

## 8. Motion language and tokens

### 8.1 Two grammars, never mixed
1. **Scroll-linked state** (all scene elements, the camera, the field). These are pure functions of master vh with `ease: "none"`. Lenis 1.15 is the feel.
   - Positional settles inside the scrub use `sine.inOut`.
   - Arcs use `power2.out` on y.
   - The camera uses data-defined monotone cubics, not named eases.
2. **Time-based acts and UI** (triggered and reversible): the house CustomEases, unchanged:
   - `rk-settle` (0.22, 1, 0.36, 1): UI enters, stamps, swaps;
   - `rk-glide` (0.32, 0.72, 0, 1): travel, Flip;
   - `rk-expo` (0.16, 1, 0.3, 1): reveals, draws, the gateway boot and push;
   - `rk-io` (0.65, 0, 0.35, 1): on-screen in-out moves, the morph.
   - Plus `back.out(1.6)` only for the reticle lock, needle and ring-lock; `back.out(1.15)` only for the odometer settle; `back.out(2.4)` only for the gateway sparks.
   - Never `expo.out`. No new ease-in curve: exits use `rk-settle` and are faster than entrances.

### 8.2 Durations (from the `--dur-*` ladder)
| Motion | Duration |
|---|---|
| Press | 120–140 ms |
| Verb swap | 140 ms out / 200 ms in |
| On-dark inversion | 120 ms |
| Lock, ring-lock | 220 ms |
| Seal | 220 ms + 300 ms check |
| Needle | 600 ms |
| Odometer settle | 300 ms |
| Onboarding Flip | 450 ms |
| Gateway exit | 1.1 s total (text exits 260 ms with 35 ms stagger) |
| Gateway boot | about 1.9 s |
| Snap | 0.35–0.7 s |
| Dock-button scroll | 0.5–1.6 s |
| Veil cuts | unchanged |
| Reverse of acts | 1.6× faster |

Scrubbed staggers are expressed in vh: 6.5 vh per respiro word, 5 vh per chip, 1 vh per MaskWords word.

### 8.3 Signature moves (one per verb)
- **Gateway, "o emblema vira o radar":** the match-cut plus the shockwave.
- **Mira, "lock-on":** brackets contract, snap and flash gold.
- **Travessia:** a real dolly through an opaque sphere, with streaming points, speed-stretch, the FOV thud and the warm rim.
- **Alvorada:** a radial dawn inverting light to ink in lockstep with the shader.
- **Tarja sweep:** ink bars with a gold nib redact the phrase and fuse into one tarja.
- **Absorção:** curved chip flights, each lighting a tick.
- **Cerco:** the orbit.
- **Varredura:** ticks fuse into the instrument line, which eats the tarja and then turns into the ruler.
- **Recuo:** the card collapses into the lit sphere, the dial redraws, and the odometer lifts out of redaction.

### 8.4 Tokens
- **CSS.** Reuse `--ease-settle/glide/expo/io` and `--dur-1..6` from `tokens.css`. Do not use `--ease-exit` for cinema exits (vetoed).
- **New CSS tokens**, scoped to `.landing`: `--cx-dock-h: 32px`, `--cx-gold-line: #cf9b1e`, `--cx-ink-chip: #1f1812`, `--cx-dark: #0c0a07`.
- **GSAP.** The global `gsap.defaults({ ease: "rk-settle", duration: 0.6 })` and the four `rk-*` registrations at `Landing.tsx` module scope stay unchanged. The master sets its own defaults.

### 8.5 Never
- Crossfade two scenes or stack two semi-transparent text containers.
- Use ease-in on any entrance; start from scale(0) (sparks start at .6); bounce outside the lock, needle, ring-lock and odometer.
- Animate `top`, `left`, `width`, `height` or `box-shadow` per frame, or tween a full-viewport gradient custom property.
- Apply `filter: blur` to elements wider than about 480 px; use `backdrop-filter` over the canvas.
- Put a low-alpha gold wash over paper.
- Cycle digits or scramble text (ScrambleText is banned in the cinema).
- Use fire-once `.call()` or `once: true`; run a CSS keyframe loop on a scrubbed element; give one property two writers.
- Move text that is being read.

---

## 9. Reduced motion, mobile, and no-WebGL

### 9.1 Reduced motion (`prefers-reduced-motion: reduce`)
- **No machinery.** No Lenis, no master, no acts, no snap, no rig, no guide machine, no reducer. The tracks are `display: none` (as today). Stages become static sections in normal flow, and every element's readable FINAL state is its CSS default, so no JS is needed.
- **Field.** One static hero frame.
- **Gateway.** No boot animation (as today). The click calls `onLeft()` immediately.
- **Chrome and reveal.** Landing's existing reduced branches stay verbatim: the phase effect, and the reveal effect setting `.lp-nav, .lp-footer, .lp-stage, .lp-cta` visible.
- **Sections in order:**
  1. **Hero:** a 100vh section with the HUD as a static line "AZ 247° · varredura ativa" and, at the bottom, the static text "Role para baixo" / "A jornada segue pelo scroll — até o fim da página.". No brackets.
  2. **Respiro:** the INK copy on paper (brown-deep, em in gold-editorial). The light copy, bars and nibs are hidden.
  3. **Ch2 (static variant):** `<DossierStatic variant="ch2"/>`, which is `display: none` unless reduced. It shows the eyebrow "Convergência", the caption, the dossier with a flat-ink tarja, the hatch, all 26 ticks lit, a static halo, the rev-note, and the Ch2 close. No chips.
  4. **Ch3:** the merged card in its final state: eyebrow "A estimativa", "Faturamento anual estimado", "R$ 24,3 mi" sharp, ruler and ends, needle centred (static transform), seal visible, Ch3 close. The scan, soft copy and tarja are hidden.
  5. **Ch4:** eyebrow, panel with a static lining "46.255" (reels at their final cells), and the close, plus a small inline SVG referent (a gold-ringed point with "R$ 24,3 mi" beside it). The rig, leader and labels are hidden.
- **Guidance.** The dock and rail are hidden. Each section ends with a static mono caption (`aria-hidden`) repeating that rest's imperative, e.g. "role para revelar o número". Opacity and colour transitions of 120–200 ms on press and focus are kept.
- **Flows.** Teleport uses `scrollIntoView(".ch5-stage")` (as today). **Fix:** the queued pending flush also uses `scrollIntoView` when there is no Lenis (A16). The ch6 clamp works through the native path. Ch5's reduced behaviour is unchanged.

### 9.2 Mobile (≤ 720 px; reference 390×844)
- **Same beats.** The same BEATS table and vh positions: 1900 vh ≈ 16,000 px. Lenis `syncTouch: false`, so touch momentum is native and `scrub: true` follows it 1:1. **No snapping on touch.** The dock tap advances to the next rest.
- **Field.** Tier ≤ T2: DPR ≤ 1.5, no MSAA, no dust (the wave drives a base-point resolve), 80 embers, no warp, sprite cap 40 px.
- **Text.** No blur filters anywhere. Word reveals use opacity + yPercent only. The number reveal is the sharp/soft crossfade plus scale.
- **Ch1.**
  - Brackets inset 18 px, size 20 px.
  - The tag fits one line at mono 9.5 px (about 230 px); fallback breaks before "CNPJ".
  - Respiro `font-size: clamp(1.75rem, 7.4vw, 2.2rem)`, `max-width: 18ch`, centred. The dawn uses vmax so it reaches the corners.
- **Dossier.**
  - Width `calc(100vw − 32px)`, max 420 px.
  - The header puts the CNPJ on its own line (`white-space: nowrap` per segment, no orphan "██").
  - 12 ticks, 12 chips on vertical arcs.
  - Number `clamp(2.6rem, 12vw, 3.4rem)`; the range fits 358 px.
- **Ch4.** Panel in the top third, referent near the centre, close in the lower third. Odometer `clamp(3rem, 15vw, 5rem)`.
- **Dock.** As in §3.11. It never shares the CTA's row and lifts above the footer. Every verb is at most 30 characters on one line.
- **End state.** At master end every ch1–4 fixed layer is at autoAlpha 0, so nothing paints over the static `.ch5-stage`. The mobile CTA behaviour in the Ch5 zone is unchanged.
- **Stage padding.** Bottom padding ≥ 150 px after vh 755, so the dock and CTA never cover scene text.

### 9.3 No-WebGL fallback
- `NullField`: every method is a no-op.
  - `getAnchorScreen` returns the viewport centre with `r` from the lookup `R_FALLBACK(vh)`: 4 px at 0 → 100 at 360 → full screen at 465 → 84 at 1640 → 14 at 1782.
  - `isDarkAt` uses the same lookup plus `dawn`.
- `.landing.no-webgl .lp-canvas` gets `background: radial-gradient(circle, rgba(110,86,48,.35) 1px, transparent 1.6px) 0 0 / 22px 22px`.
- A DOM `.cx-dome` (fixed, z 1, `#0c0a07`):
  - opacity follows the coverage (0 → 1 over 420–465);
  - the dawn is `mask-image: radial-gradient(circle var(--dawn-r) at 50% 50%, transparent 99%, #000 100%)`. This is the fallback path only; perf rules are relaxed there.
- Timelines, guidance and plans all work.
- Dev test: `?nowebgl` forces the fallback (`DEV_NO_WEBGL`, dev builds only).

---

## 10. Performance budget and rules

### 10.1 Targets
- **Reference laptop:** 60 fps on an integrated GPU (Iris Xe or M1) at 1440×900, DPR 2. p95 frame ≤ 16.7 ms.
- **Mid phone:** 60 fps, degrading gracefully to a stable 45.
- **High refresh:** behaviour is correct at 120 Hz because all damping is dt-based.

### 10.2 Main thread
**Desktop: ≤ 4.5 ms per frame.**

| Item | Budget |
|---|---|
| Director, acts and reducer | ≤ 0.8 ms |
| Field CPU (no per-point loop) | ≤ 1.0 ms |
| Label projection (only on mouse or camera change) | ≤ 0.6 ms |
| Anchors and quickSetters | ≤ 0.4 ms |
| Peak beat C2a (≈ 26 chips + 26 sparks + 26 ticks + tarja + brackets ≈ 85 transform writes) | ≤ 1.2 ms of DOM writes |

**Mobile:** ≤ 3 ms per frame.

### 10.3 Zero forced layouts per frame
- Rects are measured on `refresh`.
- The ch6 offsets are cached.
- HUD and label text is written only on change.
- Probe target: 0 layouts per frame at idle, ≤ 0.1 per frame while scrolling.
- The infinite `hud-pulse` box-shadow keyframe is replaced by a pseudo-element opacity and scale loop.

### 10.4 GPU: ≤ 8 ms per frame at the governed DPR
- Draw calls ≤ 12: base points, dust, embers, sphere exterior, sphere interior, atmosphere, sweep, 4 rings (or one merged line set), ticks, crosshair.
- About 46.5k point vertices and about 12k sphere triangles.
- Overdraw caps: sprites ≤ 64 px × DPR, warp ≤ 2.5× (desktop), dust ≤ 2 px.

### 10.5 DOM rules
- Animate only `transform`, `opacity`, `clip-path` and `stroke-dashoffset`.
- Colour transitions are allowed only on small nodes: words ≤ 220 px, ticks, the dock.
- `clip-path` is allowed on: the respiro ink twin, the card paper, the tarja, the "estimado" span, the rev-note, and the tag.
- `filter: blur` only on elements ≤ 480 px wide and only during transitions: respiro words, gateway text, far chips (1 px), reels (≤ 1.5 px).
- No `backdrop-filter`. No animated gradients or `box-shadow` (halos are static shadows with opacity only).
- `will-change` is added when a segment starts and removed at rest.
- At most 8 animated compositor layers at once, except C2a.

### 10.6 Loop ownership
There is one rAF owner: `gsap.ticker` (§4.6). The GL renders once per tick and pauses when the canvas is covered or hidden.

### 10.7 Bundle
- Register only `DrawSVGPlugin`, `MorphSVGPlugin` and `Flip` (in `cinema/index.ts`, module scope). All are already installed in gsap 3.15.
- No SplitText, ScrambleText or MotionPath: MaskWords is a small in-house splitter, and the chips use a closed-form Bézier.
- three stays statically imported, because the live field is part of first paint. `manualChunks` for three is a deferred, separate build-config task that needs consent.

---

## 11. Interface contract with Chapter 5+ and existing flows (exact)

### 11.1 Untouched zone
- **No edits to:**
  - `.ch5-*` markup;
  - Ch5 CSS (the landing.css Ch5 block, lines ~1685–2228 at commit 81e3dc1, including its responsive and reduced blocks);
  - the Ch5 timeline (`Landing.tsx` ~850–935), the CH-03 `.ch5-sweep` trigger at `"top -260%"`, the CH-09 price roll, the period toggle;
  - ch6, chsig, ch7, ch8; `revealOnEnter`; `Words`/`.rk-word`; the ch6 arrows;
  - AuthOverlay, modals, Historia/Boletim.
- **No new element matches** any `.ch5-*` selector, and there is no second `.lp-cta`, `.lp-nav`, `.lp-footer` or `.lp-scrollcue`. GSAP queries these globally.
- **Must be kept:** `@keyframes lp-scrollcue-breathe` (used by `.ch5-more`); `@property --mx/--my/--draw/--reveal/--rx/--ry`; the `.lp-cta` rules including the `translate` longhand and `::after`; the `.landing` tokens (`--halo-gold`, `--shadow-pop-warm`, `--gold-rgb`, `--sh`, `--elev-2-warm`, `--glow-gold-sm`, `--gold-sweep/hot/editorial`); `.rk-word*`; the RM-01 entries for `.grl`, `.rk-word__i`, `.ch5-sweep`, `.ch6/.ch7/.ax` corners.
- **The existing global cue-off trigger** (`Landing.tsx` 944–956) is unchanged: wide uses `.ch5-track`, narrow uses `.ch5-stage`, `"top bottom"` → `"max"`, `onToggle` autoAlpha. From ch5 start it is the sole owner of the dock root's "off" state.
- **Global GSAP config** unchanged: `gsap.defaults({ ease: "rk-settle", duration: 0.6 })` and the `rk-settle/glide/expo/io` CustomEases at module scope.

### 11.2 Geometry and state at ch5 start (vh 1900)
- **Chaining.** Track sum 2000vh; master end = `.ch5-track` "top bottom"; `.ch6` immediately follows `.ch5-track`; `plansScrollTarget() = ch6.offsetTop − innerHeight` = ch5 progress 1 (unchanged function).
- **Creation order.** All cinema triggers (the master only) are created in the same `gsap.context` BEFORE the Ch5 block.
- **Field:** the park state (§7.11).
- **Chrome and CTA.**
  - `.lp-nav` and `.lp-footer` at autoAlpha 1, yPercent 0.
  - `.lp-cta` visible and clickable. It is hidden only by Ch5's `.to(".lp-cta", 0)` at 0.18. Its recorded start value is 1.
  - The dock root is visible at 1900 and then turned off by the existing trigger.
- **Cinema layers.** Every ch1–4 layer is at autoAlpha 0 from 1880: `.lp-stage` children, `.cx-dos-stage`, `.cx-ch4-stage`, `.cx-rig`, `.lp-labels` content.
- **`.ch5-stage`** is still at its initial autoAlpha 0 (wide) or static (narrow).
- **Reducer.** It writes `.lp-nav`, `.lp-footer`, `.lp-cta` and the dock inner only while vh < 1900, and stops writing at or after 1900. From then on, Ch5's `.to` calls behave exactly as written.

### 11.3 `teleportToPlans` (new exact form; same shape)
```ts
const teleportToPlans = ({ alreadyCovered = false } = {}) => {
  const lenis = lenisRef.current;
  if (!lenis || teleportRef.current) return;
  teleportRef.current = true;
  cinema.snap.stop();
  const tl = gsap.timeline();
  if (!alreadyCovered) tl.to(".lp-return-veil", { autoAlpha: 1, duration: 0.45, ease: "power2.inOut" });
  tl.add(() => {
      lenis.scrollTo(plansScrollTarget(), { immediate: true, force: true });
      ScrollTrigger.update();
      ScrollTrigger.getAll().forEach((st) => {           // UNCHANGED loop: settles Ch5's scrub:1
        if (!st.vars.scrub) return;
        const tw = st.getTween();
        if (tw && typeof tw.progress === "function") tw.progress(1);
      });
      cinema.settle(1);                                  // master=1 state, acts end, rig/guide/labels hidden
    })
    .to({}, { duration: 0.3 })
    .add(() => gsap.set([".lp-cta", ".lp-scrollcue"], { autoAlpha: 0, overwrite: "auto" }))
    .to(".lp-return-veil", { autoAlpha: 0, duration: 0.6, ease: "power2.out",
         onComplete: () => { teleportRef.current = false; cinema.snap.start(); } });
};
```
`.respiro__copy` leaves the safety set because the class no longer exists; `cinema.settle(1)` covers every cinema layer.

### 11.4 `goToPlans` and the pending queue (semantics unchanged)
- **Callers unchanged:** header `.lp-nav__btn--primary`, `.lp-cta`, "Abrir o radar" (logged in without a plan), `.ch7-foot__cta`, `HistoriaPage onPlans`, `AuthOverlay onGoToPlans`, deep link `?auth=plans`.
- **Not revealed:** `pendingScrollRef.current = true; onEnter?.(true)`. This is a quiet entry: no onboarding, and the Gateway quiet exit covers with the veil.
- **Revealed with Lenis:** `teleportToPlans()`.
- **No Lenis:** `scrollIntoView(".ch5-stage", { block: "center" })` (unchanged).
- **Pending flush** (`[revealed]` effect, still 220 ms): `if (lenisRef.current) teleportToPlans({ alreadyCovered: veilIsCovered() }) else document.querySelector(".ch5-stage")?.scrollIntoView({ block: "center" })`. Here `veilIsCovered()` means `.lp-return-veil` opacity ≥ .99. The `else` branch is the reduced-motion fix.

### 11.5 `voltarAoPortal` (new exact form; same shape)
```ts
const voltarAoPortal = () => {
  if (returningHomeRef.current || teleportRef.current) return;
  setOverlay(null);
  returningHomeRef.current = true;
  lockArmedRef.current = false;
  cinema.snap.stop();
  const raise = () => {
    revealedRef.current = false;
    lenisRef.current?.stop();
    gsap.set([".lp-stage", ".lp-cta", ".lp-scrollcue"], { autoAlpha: 0, overwrite: "auto" });
    gsap.set([".cx-dos-stage", ".cx-ch4-stage", ".cx-rig", ".ch5-stage"], { autoAlpha: 0 });
    cinema.settle(0);                 // idempotent: acts start, field time.entryZ=3.5, guide/onboarding reset
    onReturnHome?.();                 // App: phase -> "gateway"; Gateway remounts and boots
  };
  const lenis = lenisRef.current;
  if (!lenis) { window.scrollTo(0, 0); raise(); returningHomeRef.current = false; return; }
  gsap.timeline()
    .to(".lp-return-veil", { autoAlpha: 1, duration: 0.55, ease: "power2.inOut" })
    .add(() => {
      lenis.scrollTo(0, { immediate: true, force: true });
      ScrollTrigger.update();
      cinema.settleScrubbed("start");  // getTween()?.progress(1) on EVERY scrub trigger, reverse creation order (settles Ch5 scrub:1)
      cinema.settle(0);
      gsap.killTweensOf([".lp-scrollcue", ".lp-cta", ".lp-nav", ".lp-footer"]);
    })
    .to({}, { duration: 0.3 })         // was 1.15 (tied to scrub:1 catch-up, now settled explicitly)
    .add(raise)
    .to(".lp-return-veil", { autoAlpha: 0, duration: 0.7, ease: "power2.out", delay: 0.15,
         onComplete: () => { returningHomeRef.current = false; } });
};
```
Two guards stop Ch5's late writes from showing `.lp-cta` over the Gateway: `settleScrubbed` (first) and the reducer re-asserting gateway-phase values every frame (second). `?auth` is never reopened.

### 11.6 Point-of-no-return floor (semantics unchanged)
- `armY = ch6.offsetTop` and `floor = max(0, ch6.offsetTop − innerHeight)` are now **cached on ScrollTrigger `refresh`** instead of queried on every scroll.
- It arms at `pos ≥ armY − 2` and clamps below `floor`, on both the Lenis path (`lenis.scrollTo(floor, { immediate, force })`) and the native path (`window.scrollTo`).
- Disabled while `returningHomeRef` is true. The `lockClamping` guards are kept.

### 11.7 Lenis
- One instance, created at mount, `{ duration: 1.15, smoothWheel: true }`.
- `lenis.stop()` until phase `radar` (the reveal effect calls `start()`).
- `lenis.on("scroll", ScrollTrigger.update)`; `lenis.raf` inside the single gsap.ticker callback; `lagSmoothing(0)`; exposed through `lenisRef`.
- `.lenis.lenis-stopped { overflow: hidden }` is kept. Historia/Boletim keep `data-lenis-prevent`. No `lenis.stop()` while the overlay is open (A15 stays out of scope).

### 11.8 App phases and props
- **App.** `phase: "gateway" | "entering" | "radar"`.
  - `enter(quiet?: boolean)` sets phase `entering`, `quiet` state = `!!quiet`, and `onboard = !quiet`.
  - `settled()` sets `radar`.
  - `returnHome()` sets `gateway` and `onboard = false`.
- **Gateway.** `Gateway({ leaving, quiet, onEnter, onLeft })`, with `onEnter: (quiet?: boolean) => void` and the button `onClick={() => onEnter()}`.
- **Landing.** `Landing({ phase, onEnter, onReturnHome, onboard })`. `onboard` is read through a ref by the guide at reveal.
- **Removed.** The `.lp-hint` element and its 4 s timer are deleted from App; the copy moves to the onboarding card.
- **Phase effects.** When not reduced, Landing's `[phase]` effect calls `cinema.onPhase(phase)`, and the reducer performs the chrome behaviour:
  - `gateway`: chrome autoAlpha 1 and yPercent 0, 0.8 s `power2.out`; CTA 0; dock hidden;
  - `entering`: chrome off, 320 ms `rk-settle`.
  `field.pulse()` on entering is replaced by `field.flare()` at the G2 contact.
- **Reduced motion.** The existing phase and reveal effect code is kept verbatim.
- **`.grl`** still consumes `--sweep-bearing`, written per frame and scoped to the element via `gateElRef`, never `:root`. The writer reads `field.frameData.sweepBearing` from the clock's Labels slot.

### 11.9 Chrome contract
Header and footer: visible in the Gateway; hidden from `entering` until vh 1840; returning over 1840–1880; visible through Ch5 and after. The brand click returns to the portal through the covered cut.

### 11.10 Cursor labels
Only in radar mode, only while `labelsGate > 0` (vh < 300). Names are the 6 full plus 6 half-redacted fictitious ones; values only above strength 0.62; `NAME_REDACTED` / `REDACTED` otherwise. Plus the redacted-only sweep-flash mode over 1720–1800.

### 11.11 Deep links
Parsed once at mount, unchanged: `?auth=login|signup|verify|reset|plans` with `token`, `plan`, `period`, and `?checkout=cancelado`, then `replaceState`. `?auth=plans` gives a quiet entry.

### 11.12 Z-index ladder
| Layer | z |
|---|---|
| canvas | 0 |
| `.cx-dome` (no-WebGL only) | 1 |
| `.lp-stage` (hero HUD, respiro) | 4 |
| `.lp-labels` | 5 |
| `.cx-dos-stage`, `.cx-ch4-stage` | 6 |
| `.cx-rig` (in DOM after them, before `.ch5-stage`) | 6 |
| `.ch5-stage` (later in DOM, paints over) | 6 |
| ch6+ | 20 |
| `.gx-gate` | 60 |
| `.lp-nav`, `.lp-footer` | 65 |
| `.lp-scrollcue` (dock, rail, onboarding) | 68 |
| `.lp-cta` | 70 |
| `.lp-return-veil` | 72 |
| Historia/Boletim | 90 |
| `.ax-toast` | 110 |
| `.ax-overlay` | 120 |
| legal modals | 200 |

All cinema layers stay below 20. `.lp-hint` (z 80) is retired.

### 11.13 Ch5-zone behaviours deliberately NOT changed (judge vetoes)
These stay as today and must not be built now:
- moving the cue cutoff into Ch5;
- handing `.lp-cta` to the header;
- hiding the mobile CTA over the static plans;
- any relay of "46.255" into the Ch5 lead or any reading of Ch5 DOM;
- dust or a missing gold wedge behind the plans (`PLANS_BACKDROP_PARITY = true`, `KEEP_DUST_IN_PLANS = false`);
- a Lenis mode swap (`LENIS_CINEMA_LERP = false`);
- stopping Lenis behind the auth overlay.

They are listed as sign-off options in §14.

---

## 12. Implementation architecture and work packages

### 12.1 File tree (new code lives in `src/landing/cinema/` and `src/landing/three/`)
```
src/landing/
  App.tsx                      WP0
  Landing.tsx                  WP0   (only WP0 edits it)
  landing.css                  WP0   (deletions + track heights only)
  Gateway.tsx, gateway.css, GenesisRadarLogo.tsx     WP-GW (after WP0's 2-line handoff edit)
  three/
    PointField.ts (rewrite), camera.ts, shaders/points.ts, shaders/sphere.ts,
    shaders/sweep.ts, dust.ts, embers.ts, ripples.ts, governor.ts,
    NullField.ts, createField.ts                     WP-GL
  cinema/
    index.ts        createCinema(), plugin registration          WP0
    runtime.ts      singleton: field, lenis getter, veil.cover(), blocked()   WP0
    flags.ts        FLAGS                                         WP0
    beats.ts        BEATS, RESTS, CHAPTERS, camera keys, score ramps, verbs   WP0
    copy.ts         every narrative string, verbatim (incl. RESPIRO_WORDS, COMPANY_NAMES)   WP0
    types.ts        FieldAdapter, CinemaCtx, Act, Rect, FrameOrder           WP0
    director.ts     master timeline + labels + onUpdate fan-out             WP0
    acts.ts         act runner (hysteresis, settleActs)                     WP0
    settle.ts       settle(0|1), settleScrubbed(dir), registry              WP0
    clock.ts        the single ticker callback (order §4.6)                 WP0
    rects.ts        refresh-time measurement registry + live getters        WP0
    geometry.ts     lerpRect, viewportInset, cardBuildBox, monotoneCubic, damp, bezierQ   WP0
    MaskWords.tsx   word splitter (cx-mw / cx-mw__i); Words/.rk-word untouched           WP0
    Cinema.tsx      composes package components in DOM order                 WP0
    base.css        z layers, cx tokens, shared reduced/no-webgl scaffolding WP0
    dev/assert.ts   single-writer + settle-coverage assertions (dev only)    WP0
    field/score.ts                                         WP-GL
    guide/GuideDock.tsx, machine.ts, reducer.ts, snap.ts, guide.css      WP-GUIDE
    ch1/Ch1Stage.tsx, ch1.timeline.ts, labels.ts, ch1.css                WP-CH1
    dossier/DossierStage.tsx, DossierStatic.tsx, dossier.timeline.ts, chips.ts, dossier.css   WP-DOSSIER
    ch4/Ch4Stage.tsx, ch4.timeline.ts, Reels.tsx, ch4.css                WP-CH4
    rig/Rig.tsx, rig.ts, rig.css                                         WP-RIG
```
Every package component imports its own CSS. Class prefixes: `cx-ch1-*`/`cx-respiro*`/`cx-hud*`, `cx-dos*`/`cx-range*`, `cx-ch4*`, `cx-rig*`, `cx-guide*` (inside the `.lp-scrollcue` root). Kept roots are `.lp-stage`, `.lp-scrollcue`, `.lp-scroll`, `.ch2-track`, `.ch3-track`, `.ch4-track`.

### 12.2 Shared contracts (pinned by WP0 in `types.ts` before any other package starts)
```ts
export type Phase = "gateway" | "entering" | "radar";
export interface Rect { x: number; y: number; w: number; h: number }      // viewport px
export const enum FrameOrder { Anchors = 20, Dossier = 25, Labels = 30, Guide = 40, Reducer = 50 }
export interface Act { id: string; at: number; tl: gsap.core.Timeline }   // tl paused, time-based
export interface CinemaCtx {
  tl: gsap.core.Timeline;           // master; time unit = vh; defaults { ease: "none" }
  vh(): number;                     // current master time (valid inside frame fns)
  field: FieldAdapter;              // §7.9
  acts: { register(a: Act): void };
  settle: { register(id: string, h: { start(): void; end(): void }): void };
  rects: { register(key: string, measure: () => Rect): void; get(key: string): Rect };
  live: { provide<T>(key: string, fn: T): void; use<T>(key: string): T };
  frame: { add(order: FrameOrder, fn: (vh: number, t: number, dt: number) => void): () => void };
  onReveal(fn: (o: { quiet: boolean }) => void): void;
  onPhase(fn: (p: Phase) => void): void;
  flags: typeof FLAGS; isMobile: boolean; reduced: boolean;
}
// every timeline module:  export function build(ctx: CinemaCtx): void
export interface CinemaHandle {
  settle(to: 0 | 1): void; settleScrubbed(dir: "start" | "end"): void;
  snap: { start(): void; stop(): void };
  onReveal(o: { quiet: boolean }): void; onPhase(p: Phase): void;
  setBlocked(reason: "overlay" | "historia" | "boletim" | "teleport" | "return", on: boolean): void;
  destroy(): void;
}
// createCinema({ lenis, field, labelLayer, reduced, onboardRef }): CinemaHandle
```
**Registry keys (exact strings):**

| Key | Kind | Provider |
|---|---|---|
| `dos.card@ch2`, `dos.card@ch3`, `dos.tarja@ch2`, `dos.tarja@ch3`, `dos.slot.eyebrow`, `dos.slot.cnpj`, `ch4.close`, `ch4.panel` | rects | DOSSIER, CH4 |
| `respiro.words` | rects (array) | CH1 |
| `dos.liveBox` | live getter `() => Rect` (current card clip box, C4a) | DOSSIER |
| `rig.box` | live getter `() => Rect` (current bracket box) | RIG |

### 12.3 Work packages
WP0 goes first and is short. After WP0 merges, the seven implementation packages run **in parallel** and each owns its files exclusively. WP-QA runs last.

**WP0 · Foundation and integration seam** (depends on nothing)
- **Owns:** `Landing.tsx`, `App.tsx`, `landing.css`, all `cinema/` root files listed for WP0, `cinema/dev/assert.ts`. It also creates compiling stub files for every other package (exporting `build()` no-ops and empty components) and `three/createField.ts` as a `LegacyFieldAdapter` that wraps today's `PointField`, so the app runs during parallel work. Stub ownership then passes to each package.
- **Gateway handoff.** WP0 makes exactly two edits in `Gateway.tsx`, then hands it to WP-GW: the props type (`quiet?: boolean`, `onEnter: (quiet?: boolean) => void`) and `onClick={() => onEnter()}`.
- **Does:**
  - Removes the old ch1–4 code from `Landing.tsx`: master/ch2/ch3/ch4 timelines, the odometer trigger, `CH2_MOTES`, the respiro/hero/ch2–ch4 markup, the label pool and `onFrame` handler, `readoutRef`, `tick`. `RESPIRO_WORDS`, `COMPANY_NAMES` and `Reels` move to `copy.ts` and the CH4 package.
  - Inserts `<Cinema/>` where the old markup was, and `<GuideDock/>` where `.lp-scrollcue` was, preserving DOM order (§11.12).
  - Creates the cinema inside the mount `gsap.context` before the Ch5 block.
  - Applies §11.3–§11.8: teleport, pending flush plus reduced fix, return, cached floor offsets, `ignoreMobileResize`, removal of the manual refresh, phase and reveal wiring, App props, hint removal.
  - Deletes dead CSS rule families from `landing.css`: `.lp-hint*`, `.hero__*`, `.respiro__*`, `.ch2-*`, `.ch3-*`, `.ch4-*`, old `.lp-scrollcue*` rules (keep `@keyframes lp-scrollcue-breathe`), `hud-pulse`, `cue-slide`, `ch3-scan`, and the ch2/ch3 "cabimento" block (~3311–3368). It also prunes `.hero__corner` and `.ch2-dossier__corner` from the BR-01 and RM-01 selector lists, and sets the new track heights.
  - Implements the director, acts, settle, clock, rects, geometry, MaskWords and the dev assertions.
- **Inputs:** this spec.
- **Outputs:** the `types.ts` contracts and the `beats.ts` tables (exact values from §4.3, §7.2, §7.3, §3.4).
- **Done when:** `tsc --noEmit` is clean; with stubs the page loads; Gateway → radar works; scrolling 1900 vh reaches Ch5 with the old field adapter; teleport, return and the floor all work; Ch5–Ch8 are pixel-identical to the before captures (ignoring field noise).

**WP-GL · WebGL engine and field score** (depends on WP0)
- **Owns:** `three/*` (rewrite of `PointField.ts`, plus `camera.ts`, `shaders/*`, `dust.ts`, `embers.ts`, `ripples.ts`, `governor.ts`, `NullField.ts`, `createField.ts`), `cinema/field/score.ts`.
- **Does:** all of §7. Score evaluation from `beats.ts`; the depth-correct two-mesh sphere and lit state; analytic charge; dust, embers, ripples; spline camera with monotone profiles; time layer (entryZ, shock, fovGate, ringBoost); the anchor and projection API; `isDarkAt`; governor; pause; NullField and CSS fallback hooks; the exact park state.
- **Inputs:** `beats.ts`, `types.ts`.
- **Outputs:** a `FieldAdapter` (§7.9).
- **Done when:** frame captures at stepVh 0.25 over 300–560 and 1560–1660 show no tearing or seams; park is pixel-equal to today's ch5 backdrop (ignoring noise and drift phase); a 4×-throttled trace of J3 and C4b stays ≤ 16.7 ms on the reference laptop.

**WP-GW · Gateway** (depends on WP0; uses the WP-GL API, stubbed until then)
- **Owns:** `Gateway.tsx`, `gateway.css`, `GenesisRadarLogo.tsx`.
- **Does:** G1 boot (transform-scaled veil layer, DrawSVG spiral), G2 match-cut exit (MorphSVG, `field.time` tweens, `flare()`, `rootRef` fade), the quiet exit through `runtime.veil.cover()`, the passive caption, the idle armed pulse, the press timing.
- **Inputs:** `runtime.field.projectToScreen`, `ringRadiusPx`, `time`, `flare`; `runtime.veil`.
- **Outputs:** `onLeft` timing; a settle hook (`start`: `time.entryZ = 3.5`, `shockR = −1`).
- **Done when:** the emblem lands on ring[0] within 2 px at 1440×900 and 390×844, no console warnings, and a quiet entry shows one transition.

**WP-GUIDE · Guidance and globals** (depends on WP0)
- **Owns:** `cinema/guide/*`.
- **Does:** the dock DOM (`.lp-scrollcue` root `<button>`), the onboarding card plus Flip, the rail, the state machine (§3.3), the copy table from `beats.ts`, on-dark inversion, the aria-live region, the dock-button scroll, the reducer for `.lp-nav`, `.lp-footer` and `.lp-cta` (phase plus vh, stopping at ≥ 1900), the directional snap controller (§4.7), the mobile layout and collision rules (§3.11).
- **Inputs:** `ctx.vh`, lenis (from runtime), `field.isDarkAt`, `blocked()`, `onboardRef`.
- **Outputs:** `snap.start/stop`; settle hooks.
- **Done when:** there is no dock/CTA/footer overlap at 390, 721, 860, 1024 and 1440 widths; all states can be reproduced; the snap never targets R0 or vh ≥ 1800.

**WP-CH1 · Hero HUD, respiro and labels** (depends on WP0)
- **Owns:** `cinema/ch1/*`.
- **Does:** the `.lp-stage` children: HUD (write-on-change, exit), the respiro light copy, ink twin, em bars and nibs, the J4–J6 DOM tweens (words in light, the dawn clip from `field.score.dawn`, per-word light hide, the white-word dolly, bar sweep and fusion into `dos.tarja@ch2` slices), and `labels.ts` (cursor pool, target suppression, sweep-flash mode, the `--sweep-bearing` sink hook).
- **Inputs:** `rects dos.tarja@ch2`, `field.score`, `field.frameData`, `labelLayer`.
- **Outputs:** `respiro.words` rects; settle hooks.
- **Done when:** respiro contrast is ≥ 14:1 during 618–657; the swap at 850 is pixel-identical; no gold haze appears on paper during the dawn.

**WP-DOSSIER · Ch2 and Ch3 merged stage plus the C4a collapse** (depends on WP0)
- **Owns:** `cinema/dossier/*`.
- **Does:** `.cx-dos-stage` (eyebrow reel, caption, card laid out at its final Ch3 size, header slots, label and "estimado", amount with sharp and soft copies, tarja with hatch, halo, scan, 26 ticks, chips and sparks, orbit, rev-note, range track and ticks and ends, needle act, seal act, both closes); per-frame writers for the charge line, thunk and orbit; ripple registration; the C4a collapse into the disc and the pinned label; `DossierStatic` for reduced motion; mobile variants.
- **Inputs:** `cardBuildBox` (geometry), `field.getAnchorScreen`, `field.sampleScreenPoints`, `field.addRipple`.
- **Outputs:** the `dos.*` rects and the `dos.liveBox` getter; settle hooks.
- **Done when:** no two text containers are ever semi-transparent together (stepVh 0.25 capture of 1110–1240 and 1560–1650); the seal is never visible before 1475; reversal is exact.

**WP-CH4 · Universe panel and odometer** (depends on WP0)
- **Owns:** `cinema/ch4/*`.
- **Does:** `.cx-ch4-stage` (panel, `Reels` with the █ strip, label, close), the C4b–C4d DOM tweens, the `countSettle` act, the reduced static referent SVG, the mobile layout.
- **Inputs:** none beyond ctx.
- **Outputs:** `ch4.close` and `ch4.panel` rects; settle hooks.
- **Done when:** "00.000" never appears, no digit bleeds, and every ch4 layer is at 0 by 1880.

**WP-RIG · Anchored overlays** (depends on WP0)
- **Owns:** `cinema/rig/*`.
- **Does:** `.cx-rig` (4 brackets in every mode: frame → search/lock → silhouette → frame → card build → card ride → disc ring → release), the tag (lock, park, split into slots), the leader hairline, the ring pulse, the `lock` and `ringLock` acts, on-dark inversion.
- **Inputs:** `field.getAnchorScreen`, `field.isDarkAt`, `cardBuildBox`, `dos.liveBox`, `dos.slot.*`, `ch4.close`.
- **Outputs:** the `rig.box` getter; settle hooks.
- **Done when:** the brackets never lag the 3D by a frame; the slot swap at 860 is pixel-identical; there is no shimmer at rest (0.5 px rounding).

**WP-QA · Integration acceptance** (depends on all packages; owns no project files; works under `scratchpad/work/qa/`)
- Runs §13 and reports. Timing retunes go back to the `beats.ts` owner (WP0).

### 12.4 Merge order and rules
- Order: WP0 → {GL, GW, GUIDE, CH1, DOSSIER, CH4, RIG} in any order → QA.
- A package may only edit its own files. Cross-package needs go through `types.ts` (WP0 owns it, so changes are requested from WP0) or through registry keys.
- The dev assertion wraps `ctx.tl.to`/`fromTo`/`set` and per-frame writers to record (element, property) → package, and warns on any second writer. It also lists every `.cx-*` node without a registered settle state.
- All initial states come from `gsap.set` at build time or from CSS. Inside the master use only `.to()`, or `fromTo` with `immediateRender: false`.

---

## 13. Acceptance checklist (verify in the browser before declaring done)

Capture tools write only under `…/scratchpad/work/<label>/`:
- `node …/scratchpad/tools/capture.cjs <outDir> <w> <h> <stepVh>`
- `node …/scratchpad/tools/contact.cjs <dir> <outPrefix> <cols> <perSheet> <thumbW>`

Use the running dev server on :5173 and do not start another.

**Build hygiene**
- [ ] `npx tsc --noEmit` is clean; `find src -name '*.js'` is empty; no console errors or warnings across a full run (including no "GSAP target not found").

**Desktop: 1440×900, 1366×768, 1024×768 (capture at stepVh 0.5, plus 0.25 around swaps)**
- [ ] The Gateway boots; the caption is passive; the CTA is the only filled element; the idle armed pulse runs at most 3 times.
- [ ] Click: text exits upward; the emblem lands on ring[0]; there is a shockwave and ring light-up; the chrome slides off; no contrast pop when the gate unmounts.
- [ ] The onboarding card appears last, stays until the first scroll (never on a timer), Flips into the dock, and the rail draws.
- [ ] The first wheel notch visibly moves the camera, accelerates the sweep and starts filling the dock ring.
- [ ] No two consecutive frames outside plateaus show the same foreground (pacing rule). Plateaus R1–R7 are static.
- [ ] Target lock at R1: brackets plus the redacted tag. Cursor labels are suppressed near the target and off by 300.
- [ ] The sphere has no banding or sawtooth; points in front overlap it and points behind are hidden. The crossing streams points past the lens, with the FOV thud and the warm rim on dark only.
- [ ] Respiro words are written in light, legible at every frame of 490–657 (≥ 14:1). The dark is never empty.
- [ ] The dawn front and the ink-twin edge coincide within 1 px; no gold haze on paper.
- [ ] The CTA appears at about 755–775.
- [ ] J6: the swaps at 850 and 860 are pixel-identical; the card is drawn by the brackets.
- [ ] C2a: chips are anonymous and unlabelled; each impact lights a tick; the orbit happens in C2b. The rev-note appears only in C2b.
- [ ] C3a: one card grows; the tarja grows without stretching its stripes; no double exposure (check 1160–1240 at stepVh 0.25).
- [ ] C3c: the number is uncovered by the line and is sharp at R5. The seal is invisible until 1475, then stamps after the needle settles.
- [ ] C4a: the card collapses into the lit disc with no seam at 1640; "R$ 24,3 mi" pins at 15 px with no pop; the brackets lock (ringLock).
- [ ] C4b: the count rolls from "██.███" (never "00.000", no digit slivers) in step with the dust wave; the rings and sweep re-wake; there is no beamless gold wedge before 1850.
- [ ] C4c: the leader points at the ring; sweep-flash labels are always redacted.
- [ ] C4d: directional exits, no blur on large containers; the chrome returns at 1840–1880; the dock lifts above the footer; every ch1–4 layer is at 0 by 1880; the field is exactly in the park state at 1900.
- [ ] Ch5–Ch8: pixel diff against the `before/desktop` captures at matching ch5 progress (ignoring field noise and drift phase). The CTA hides at ch5 0.18; the dock hides at ch5 start; the CH-03 sweep and the CH-09 roll are unchanged.
- [ ] Reverse: scroll 1900 → 0 slowly and in flicks. Every state replays; acts reverse; nothing is orphaned (seal, needle, count).
- [ ] Snap: stop within 30 vh before a rest while moving forward and it completes to the rest. Stop 10 vh past a rest moving forward: no pull back. Never targets R0 or vh ≥ 1800. Any wheel interrupts. `SNAP = false` disables it.
- [ ] Dock button: click, Enter and Space advance to the next rest, and the wheel interrupts. aria-live announces "Etapa N de 8 · …" at rests only.
- [ ] Idle: 1.6 s at a rest gives the 2-bob nudge; 1.2 s mid-transit shows "continue rolando" plus the ring pulse; backward shows "voltando · ⟨Estação⟩" with the chevron flipped.

**Flows (desktop and mobile)**
- [ ] Teleport ("Ver planos") from R0 and from every rest R1–R7: covered cut, lands on the finished plans, nothing from ch1–4 visible.
- [ ] Teleport from the portal (the header "Ver planos", Historia `onPlans`, `?auth=plans`): one transition (the quiet exit into paper), no onboarding.
- [ ] Return home (brand click) from ch2, ch4, ch5 and ch8: covered cut; the Gateway reboots; `.lp-cta` and the dock are not visible over the Gateway (watch for 2 s); `?auth` is not reopened; re-entry plays onboarding again.
- [ ] Point-of-no-return: past the ch6 top, scrolling back clamps to the plans floor on both the Lenis and native paths.
- [ ] Deep links `?auth=login|signup|verify|reset` open the overlay as today; `?checkout=cancelado` shows the toast.

**Mobile: 390×844 (capture at stepVh 0.5) and a real-device pass (iOS Safari, Android Chrome)**
- [ ] The dock never overlaps `.lp-cta` or footer links; every verb fits one line; the dock stacks above the CTA after 755.
- [ ] The convergence swarm is present (12 chips); no blur; the respiro is legible; the tag and CNPJ do not wrap an orphan "██".
- [ ] No snapping; native momentum; a tap on the dock advances; rotating the device and toggling the URL bar keep rects correct after refresh.
- [ ] At master end nothing from ch1–4 paints over the static `.ch5-stage`.

**Reduced motion (DevTools emulation)**
- [ ] No Lenis; static sections in narrative order (hero, respiro, Ch2 static, Ch3 final, Ch4 with the static referent); the seal is visible; the number is visible; no chips; the dock is hidden; the static captions are present.
- [ ] Teleport and the queued flush use `scrollIntoView`; the floor clamp works natively.

**No-WebGL (`?nowebgl` in dev)**
- [ ] CSS dot field; the DOM dome darkens and dawns; the cinema and guidance run; the plans render; no crash.

**Performance**
- [ ] Chrome trace, reference laptop, 4× CPU throttle, over J3, J5, C2a and C4b: no frame over 16.7 ms unthrottled and none over 20 ms throttled. If over budget, cut in this order: warp, ripples, dust tier.
- [ ] Idle radar: 0 layouts per frame; scrolling ≤ 0.1 forced layouts per frame.
- [ ] Governor tier logged once; DPR ≤ 1.5 on mobile; render pauses when the tab is hidden and when Historia/Boletim are open.
- [ ] `PAUSE_UNDER_CH6`: Ch6–Ch8 screenshots are identical with the flag on and off.

---

## 14. Sign-off list (needs the user's explicit OK before shipping)

1. **New guidance microcopy (§3.4):** the 8 imperatives, 14 gerunds, "a seguir: os planos", "voltando · ⟨Estação⟩", the station names "Radar · Convergência · Estimativa · Universo · Planos", the dock `aria-label`, the aria-live pattern "Etapa N de 8 · …", and the reduced-motion section captions.
2. **Hero instruction change:** "role para varrer o campo" → "role para mergulhar no campo". The old copy is one flag away: `HERO_VERB_LEGACY`.
3. **Target tag:** "Empresa em análise · CNPJ ██.███.███/0001-██" (existing strings, newly joined).
4. **Ch3 company line** folded into the persistent dossier header (same content).
5. **Snap feel test** (desktop), with `SNAP` as the kill switch.
6. **Optional Ch5-zone options, all OFF by default and not built now:** extending the dock into Ch5; handing the CTA to the header; hiding the mobile CTA over the plans; removing the beamless charge wedge behind the plans (`PLANS_BACKDROP_PARITY = false`); dust behind the plans; Lenis lerp mode in the cinema; stopping Lenis behind the auth overlay.
7. **Deferred:** `manualChunks` for three (a build-config change); the gateway "ink strike bars" text exit (C's idea; optional polish); HUD zoom readout (`HUD_ZOOM_READOUT`).

## 15. Provenance (why this shape)
- **Winner: A** on the judges' combined scores (A 121, B 116, C 113). All three judges ranked A first. Key reasons: the one-object, one-shot concept; the rigorous camera (arc-length splines plus a monotone speed profile); the depth-correct sphere with depth-tested points; the field driven by the playhead; the per-frame reducer as a second guard; a dossier laid out at its final size with clip-only morphs; directional snap.
- **Grafts:**
  - From C: the gerund/imperative grammar; field ink ripples; ticks → scan line → ruler; the sharp/soft focus pull; `settleScrubbed` on return; the mobile dock stacked above the CTA with a 30-character cap; the rail inside the dock (one locus); the text-slot rule; P0 bug fixes first.
  - From B: the dock as a focusable button with aria-live "Etapa N de M"; 16 vh zero-change plateaus; every ch1–4 layer ending at master progress 1 with the existing cue-off trigger as the sole owner; light words cooling from gold-hot to paper; no dust on low tier and mobile.
- **Vetoes honoured:**
  - none of A's Ch5-zone changes, and no relay into the Ch5 lead;
  - no B auto-complete snap, no non-uniform tarja scale, no `rk-exit` ease-in, no HUD telemetry or percentages, no ellipsis on verbs, no dock-folds-into-CTA;
  - no C ScrambleText, no `lenis/snap` proximity, no global `rk-path` camera ease, no Range-rect relay, no DOM 100vmax rim, no dynamic import of three;
  - no per-character █ textContent on the proportional em phrase (ink bars instead);
  - points depth-tested whenever the sphere is opaque;
  - no shortened return wait without settling Ch5's scrub tween;
  - no runtime Lenis swap without sign-off.
