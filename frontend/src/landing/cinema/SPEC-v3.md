# Genesis Radar landing — cinema v3 "Sonar Líquido": execution spec (rev 3.1)

**Revision 3.1 (2026-10-29):** resolves the critic round (6 blockers, 5 of them distinct; 27 majors; the minors). Every change is listed with its resolution in §12. Numbers were recomputed with `scratchpad/work/v3dir/rev/dwell31.cjs`.
**Direction:** Proposal A "Liquid Sonar" (panel winner: A 23, B 20.5, C 16; clarity and feasibility judges ranked A first, the wow judge ranked B first by 0.5), with the grafts listed in §12.3 and every veto honoured.
**Authority to ship:** the user granted unrestricted authorisation ("te dou autorização irrestrita, só faça… publica… atualiza o github e committa"). Nothing in this spec waits for a user sign-off. Former sign-off items are decided defaults (§10.3), reviewed by the integrator, and shipped through §10.2 Release.
**Scope:** the Gateway through the handoff at master vh 1900. Chapter 5 (plans, prices) and everything after it stay untouched, pixel for pixel.
**Supersedes:** the v2 spec (`scratchpad/spec/direction.md`) wherever this document says something different. Anything v3 does not mention stays exactly as v2 and as built today on `feature/landing-plano-sequencia`.
**Audience:** about 8 engineers building in parallel git worktrees, plus an integrator. This document is self-contained; v2 is only needed for unchanged details.
**Language:** English. UI copy stays pt-BR and verbatim (`cinema/copy.ts`, `Landing.tsx`). v3 adds **no new words**.

Paths are relative to `C:/Users/danie/genesis/frontend/src/landing/` unless they start with `src/` or `scratchpad/` (`scratchpad/` = `C:/Users/danie/AppData/Local/Temp/claude/C--Users-danie-genesis/de83f23a-899e-440a-ba5b-621b344aaf08/scratchpad/`).

---

## 0. Read me first

### 0.1 Brief compliance

| User point (pt-BR, verbatim intent) | v3 answer | Where |
|---|---|---|
| 1 · "melhore o radar… o efeito de busca e os pontos, tudo da parte inicial… outro nível, bem superior" | The flat orange wedge becomes a **phosphor sonar**: a hairline of real brand gold (sRGB `#cf9b1e`, fixing the `#9F5403` artefact) over an ink veil with no trailing edge and no leading edge (the veil ends exactly on the gold line), turned by the scroll wheel. "Bem superior" is measured, not assumed: the salience criterion of §11 item 45 requires the v3 search effect to read at least as strongly as v2's wedge (≥ 0.8× its ΔL* plus ping counts), with a side-by-side checkpoint right after WP2 + WP3 merge (§10.1). Every company it touches **pings** (ink ring, gold line on the top decile). Struck companies send **echo wavefronts** through their neighbours. Tens of thousands of real dust companies show up **only in the afterglow** ("o radar ilumina cada um"). The field flows like a liquid (curl current, water-drop cursor). Points become wet **ink beads** with depth of field. In J2 the beam **hunts** (overshoots, swings back, locks), three decoy companies flare and are **struck through**, the four rings **drain into the target** and hand off to a round reticle within 1 px, the field **drains and packs** into a meniscus around the black sphere, and the lens racks focus onto it. Gateway text pours in glyph by glyph. | §3 G1–J2, §4 |
| 2 · "gostei muito do efeito dentro da empresa bola preta" | J3/J4 (and J5) are **preserved**: the camera path from 352 on, the contact, FOV thud, dome, embers, the superellipse rimIn, the sphere veins from 400 on, respiro timing, per-word cooling colours and layout are byte-identical. Only the refinements listed in §1.4 are allowed (glyphs without the hard mask line, tag plate, dock fixes, round bracket caps), each with its own golden-frame mask, verified by the integrator's golden-frame and side-by-side review (§10.2). The two refinements that would change the look of the interior itself (radial rimIn, per-glyph cooling) ship **OFF** behind flags. | §1.4, §3 J3–J5, §11 items 30–33 |
| 3 · "letras fluidas" | A glyph engine: text **condenses** glyph by glyph (INK on paper, LIGHT in the dark) and **evaporates** from the far edge. Glyphs are absolutely placed at their kerned positions, so the rest swap never shifts a glyph. No `overflow:hidden` word masks remain anywhere in 0–1900. | §5 |
| 3 · "câmera dinâmica que não pareça engessada" | A **liquid playhead** (critically damped follower) removes the wheel-notch staccato. J1–J2 fly a new curved **seek path** (5° yaw, 7° pitch of real parallax) with **roll** (horizon levels at the lock), a hunting FOV, and a spring time layer (lean from path acceleration, bank, FOV and look-ahead kicks, focus-pull hunt, cursor parallax). All of it decays to exactly 0 at rest and is hard-gated off inside the sphere. Over Ch2–Ch3 (1112–1552) a pure-f(vh) backdrop drift plus a slow look sway keep the GL camera answering the wheel while the text plates stay still. | §6 |
| 3 · "as partes escritas devem durar um pouco mais… sem parar de scrollar com o mouse" | **Scroll-space dilation**: the page gets longer only inside text holds, so the wheel moves the story 1.5–4.3× slower exactly where there is something to read. The three closes go from 1.1 / 1.6 / 2.0 s (v2, legible at 35 vh/s) to 7.6 / 9.3 / 9.2 s. **Every text block passes at 25, 35 and 50 vh/s on desktop and on touch** (break-even ≈ 50.5–50.9 vh/s desktop, 51–54 vh/s touch). The dock keeps saying what to do (lead imperative plus a reading meter). | §2 |
| 4 · "melhore MUITO a fluidez… menos quadrado, mais liquid style" | One motion grammar (§1.2): pills, capsules and arcs replace every rectangle that moves, including the Gateway CTA and its ping ring; fronts are soft; eases come from one C¹-continuous family; springs drive the camera and UI acts (compositor-only). Every square element in the inventory has a liquid replacement (§7). | §1.2, §7 |
| Standing brief · "sempre sinalize o que precisa ser feito para continuar" | Dock never blank (fixes vh 380/460), lead imperatives inside reading holds, a 1.2 s minimum for any imperative, a reading meter that is full when the text leaves, every `VERB_SEGMENTS` gerund still shown, no "continue rolando" nag while a reader pauses on text. | §5.7, §8.2 |
| Standing brief · "só vale até os planos" | Ch5+ untouched. Every new GL channel equals its neutral value from vh 1890 on, the legacy sweep integrator's expression is not modified, no font face changes outside the cinema (Plex Mono 600 is a cinema-only alias), `.lp-cta` and `.lp-nav` keep their shape, and the dock/rail restyle is scoped to vh < 1900 and leaves only after the dock has faded. | §8.1, §11 items 1–4 |
| "publica… atualiza o github e committa" | A release section: one build, the §11 run, integrator review, commit + push to `main`, `deploy.sh`, live smoke check, changelog to the user. | §10.2 |

### 0.2 Units used everywhere
- **vh (master vh).** Master time, as in v2: one GSAP timeline, 0–1900, 1 timeline second = 1 vh. **Every table in the code stays in master vh.** `MASTER_END = 1900`, `PACE = 1.0`.
- **s (scroll vh, "s-vh").** Physical scroll distance in viewport heights from the top of `.lp-scroll`. In v2, s = vh. In v3 the page is longer inside text holds: `vh = W(s)`, `s = W⁻¹(vh)`, with `dW/ds = 1/k(vh) ≤ 1`. Reading speeds ("35 vh/s") are always in s-vh per second, i.e. what the wheel produces.
- **Followed vh.** The value the cinema renders: a critically damped follower of `W(s)` (§6.2). Every consumer (DOM tweens, acts, GL, guide) reads the same followed vh in the same frame.
- **Rests, plateaus, acts, SP, single writer:** unchanged from v2 §0.1.

### 0.3 Dev rules (v2 rules, amended for parallel worktrees)
- Each WP works in its own git worktree off `feature/landing-plano-sequencia` (after WP0 merges), branch `v3/wpN-<slug>`.
- Verify with `npx tsc --noEmit` only. Never `npm run build` during dev; the single build happens in §10.2. `find src -name '*.js'` must return nothing.
- **One dev server per worktree.** WPn runs `npx vite --port 520n --strictPort` from its own worktree (WP0 → 5200 … WP8 → 5208); the integrator keeps `http://localhost:5173/landing.html` on the integration branch. No server is started before the current release gate has freed ports 5173/5190. Every QA tool takes `--base http://localhost:520n`.
- **GPU and perf jobs run one at a time** across all worktrees (a lock file `scratchpad/work/v3qa/perf.lock` holding the WP id; take it, run, delete it). Captures and unit tests may run in parallel.
- Dev flags: `?cx-flags=NAME=0,…`, `?nowebgl`, and the new `?cx-still` (freezes every time-based term at t = 0 for captures, §11) and `?cx-perf` (per-beat GPU timer log). `?cx-still` is also back-ported onto the baseline build (WP0 step 0), so every "identical to v2" check compares two frozen builds.

---

## 1. Direction and the liquid design language

### 1.1 Direction in one paragraph
You don't watch the radar, you drive it. Each notch of the wheel turns a hairline of gold that develops the field the way ink develops in water. Companies rise out of the paper one by one and each one **rings**. The ring pushes a crest through its neighbours, and behind the line tens of thousands of hidden companies flicker into view and sink again. Then the search narrows and **hunts**: the line overshoots, swings back and locks, three candidates flare and are struck out, the rings of the instrument drain into the one black sphere and become its reticle, and the field drains around it into a bead meniscus while the lens pulls focus. The camera dives into the interior the user loved, which stays exactly as it is. After that, everything that was a box becomes a liquid shape: letters condense and evaporate, corners melt into arcs, cards round off and pour into discs, and the page turns viscous wherever there is something to read, so nobody has to stop the wheel to read it. **On paper, everything is ink; in the dark, everything is light** (B's rule, adopted as the colour law).

### 1.2 The liquid design language

**Shapes (tokens in the new `cinema/tokens.css`, WP0):**

| Token | Value | Used by |
|---|---|---|
| `--lq-pill` | `999px` | dock pill (cinema only), label/echo chips, tag plate, eyebrow, pinned chip, seal, onboarding after Flip, scan head, rail dots |
| `--lq-panel` | `18px` (`14px` ≤ 720 px) | close panels (C2, C3, Ch4), Ch4 panel, onboarding card, rotate card |
| `--lq-card` | `18px` | dossier card paper (`insetClip … round 18px`) |
| `--lq-capsule` | `calc(var(--h) / 2)`, implemented as `999px` | redaction bars, tarja, odometer redaction cell, chips in flight, range track/fill, C2a comets |
| `--lq-reticle-rr` | scrubbed (§3, §7) | RIG reticle corner radius |
| stroke caps | `round` everywhere (SVG `stroke-linecap/linejoin: round`) | reticle, leaders, hairlines, ticks, Ch4Stage reduced SVG |

**Mask technique.**
- No `overflow:hidden` text window anywhere in 0–1900. `.cx-mw` becomes `overflow: visible` (glyphs rise only 0.32 em, so nothing shows below the line).
- Windows that must stay (reels: eyebrow, dock rail labels, odometer) use a **feathered** mask: `mask-image: linear-gradient(transparent 0, #000 22%, #000 78%, transparent 100%)` (as `ch4.css:99-100` already does).
- Rectangular `clip-path: inset()` wipes become **capsule wipes** (`inset(… round 999px)`) or glyph pours.
- No SVG filters (goo, turbulence) — vetoed for main-thread cost. Liquidity comes from shape, fronts and easing.

**Easing family (`cinema/eases.ts`, WP0, registered at module scope from `cinema/index.ts`; `rk-*` stay for Ch5 and existing UI; the master's local default stays `ease: "none"`). Every multi-segment curve has collinear handles at its joints (C¹ in y(x), no velocity kink), and no text ease exceeds 1. WP0 unit test: 1,000 samples per ease are monotone, ≤ 1 for the text eases, and the slope jump at every joint is < 1e−3.**

| Name | CustomEase string | Use | Overshoot |
|---|---|---|---|
| `cx-ink-bloom` | `M0,0 C0.08,0.02 0.16,0.564 0.34,0.78 0.52,0.996 0.72,1 1,1` (joint slope 1.2 both sides) | glyph opacity (soak, then settle) | none |
| `cx-ink-settle` | `M0,0 C0.16,0.64 0.3,0.97 0.5,0.985 0.7,1 0.86,1 1,1` (joint slope 0.075 both sides) | glyph y / skew / rotate; **any text being read** | none |
| `cx-ink-dry` | `M0,0 C0.24,0.42 0.5,0.86 1,1` | word blur → 0, colour cooling, rack focus | none |
| `cx-evap` | `M0,0 C0.32,0 0.52,0.18 0.68,0.44 0.82,0.6675 0.9,0.92 1,1` (joint slope 1.625 both sides) | every exit (glyph evaporation, panel out) | none |
| `cx-flow` | `M0,0 C0.5,0 0.2,1 1,1` | in-place positional moves: reels, card grow, collapse size, dims, ring travel, tag park; replaces every linear scrub on visible elements | none |
| `cx-pour` | `M0,0 C0.12,0 0.2,0.72 0.42,0.94 0.52,1.04 0.7,1.012 1,1` | non-text UI arrivals (chips, panels' scale, collapse radius) | ≈1.5 % |
| `cx-meniscus` | `M0,0 C0.2,0.06 0.3,1.04 0.52,1.04 0.68,1.04 0.8,1 1,1` | instrument closures: reticle bend into the circle, GL lock ring, capture | ≈4 % |
| (kept) `back.out(1.6)`, `back.out(1.15)` | — | instrument acts only: `lock`, `needle`, `ringLock`, `countSettle` | as v2 |

Rule: **text never overshoots** (clarity veto on C's 6 % glyph bounce). Bounce stays reserved for instrument mechanics, as in v2 §1.2.

**Springs (`three/springs.ts`: WP0 ships the final API and a working critically damped integrator so WP1/WP3/WP8 can test before WP4 merges; WP4 owns tuning afterwards. Semi-implicit integration, dt sub-stepped to ≤ 1/60 s; every target is 0 when the playhead is at rest):**

| Spring | ζ | ω (rad/s) | Target / clamp |
|---|---|---|---|
| playhead follower (§6.2) | 1.0 | 8 (fine pointer) / 11 (touch) | `W(s)`; lag cap 28 vh → 0 by 1880 |
| lean (operator follow-through) | 0.62 | 4.2 | `−g·a_path` in camera space, g = 0.035 s²; soft clamp `0.18·tanh(o/0.18)` world |
| bank (rollKick) | 0.70 | 5.0 | `−0.9°·a_lat` (normalised), clamp ±1.8° |
| fovKick | 0.60 | 4.5 | `+2.2°·pvelN`, clamp +2.5° |
| lookAhead | 0.85 | 5.0 | `0.15·pvelN` world along the path tangent |
| focus pull (DOF) | 0.58 | 3.2 | `focusD` from the `focusSP` channel (a visible ~9 % hunt) |
| cursor parallax | 1.0 | 3.0 | look += (mx·0.05, my·0.035) world × `parallax` channel |
| cursor wake chain (5 nodes) | 1.0 | 16 / 11 / 8 / 5.5 / 4 | mouse (field uniform `uWake[5]`) |
| dock visual width on verb swap | 0.6 | 14 | **compositor only:** the pill's box keeps v2's fixed slot width (widest verb, `machine.ts:129`, never resized); the spring drives `clip-path: inset(0 Δpx 0 Δpx round 999px)` on the background and edge layers, Δ = (W_slot − w_verb)/2, w_verb measured once per verb at refresh (no read per swap); text centred in the fixed slot. 0 layouts per swap. |

`pvelN = damp(clamp01(|v_playhead| / 120 vh·s⁻¹), λ 6)`. It is a new signal; the v2 `vel` (from Lenis px velocity) is kept unchanged for the legacy sweep integrator (§8.1).

**Colour and light rules.**
- Palette unchanged: paper `#fbf9f4`, ink `#1f1812`, brown-deep, gold `#b8860b`, sweep gold `#cf9b1e`, gold-hot `#e6b54a`, gold-editorial `#9a6f0c`, tan `#8b6a3d`, dome `#1d140b → #0c0a07`. No new colours, no glass, no neon, no bloom.
- **On paper everything is ink.** Veils, afterglow, pings, wakes and shadows are ink at ≤ 7 % alpha (the salience tuning of §11 item 45 may raise the veil peak to 9 %, never more). Gold on paper appears only as a saturated line ≤ 2.25 px, a 1 px ring, a droplet ≤ 5 px, or a tick. No gold halo on the beam (clarity veto).
- **In the dark everything is light.** Gold fresnel rims, glows and embers are allowed on the dark sphere and inside it.
- New GL surfaces that must equal a DOM colour use the `SRGB` family (`three/constants.ts`). New point terms keep the displayed v2 ink (the `LINEAR` values written raw) so the sonar gate never shows a seam; only gold switches to `SRGB.gold` (brand gold) in the sonar path.
- Every readable text meets WCAG AA (§5.6). Small or medium text never sits directly on moving GL. It either gets an opaque or ≥ 0.98 paper plate (or ink plate) with rounded corners, or it sits inside a **GL text mask** (`uTextMask`, §4.4): up to 4 screen rects (Gateway text block, Gateway CTA + cue, HUD, one spare) inside which the beam veil, afterglow darkening, pings and echo darkening fade to 0 over a 12 px feather. Text that is free on the field (Gateway, HUD) therefore always sits on clean paper.

### 1.3 What is preserved (no change unless this spec names it)
- **Narrative and copy:** chapter order, beats, every string in `cinema/copy.ts`, `beats.ts` verbs/stations names and `Landing.tsx`. No new microcopy.
- **J3 Travessia and J4 Interior (and J5 Alvorada):** `CAMERA.in` knots and profile (sampled from vh 352 on), `fovThud gauss(465, 18, −4)`, `warp` 400–480, `CONTACT_BAND`, the `uNear` contact blend, the dome palette and dither, the superellipse `rimIn` frame (flag `RIMIN_RADIAL` off), the sphere veins from vh 400 on, embers 465–765, `RESPIRO_T` (rise 472 / 7.6 / 24, dolly, sweep, fuse, swap 850), HOT `#e6b54a` → COOL `#fbf9f4` cooling **per word** (flag `RESPIRO_GLYPH_COOL` off), em gold with the 18 px glow, Playfair ~52 px / 22 px mobile, 4 lines, top at 41 % / 39 %, the dawn as a **circle** in both GL and the DOM ink twin, the paper dock pill on dark, RIG bracket geometry, arm lengths and timing.
- **Ch5 and after:** markup, CSS, **computed font faces**, timelines, triggers, `.lp-cta` (shape included), `.lp-nav` (shape and markup), the cue-off trigger (`Landing.tsx` ≈ 611–630, the tween at :622), the park state at 1900, the legacy sweep integrator expression (`PointField.ts:572` today, `this.sweepAngle += dt * SWEEP_SPEED * (1 + 1.6 * this.vel) * m`; WP0 may move it verbatim into `field/beam.ts`, the expression stays byte-identical), `chargeGain` parity keys, `PLANS_BACKDROP_PARITY = true`.
- **Guide-dock semantics:** states (hidden, arrival, rest, transit, back, handoff), gerund/imperative grammar, rail with 5 stations, aria-live at rests only, dock button advancing to the next rest, `VERB_SEGMENTS` copy and boundaries. Every gerund is still shown for part of its segment; the only change is that inside D4/D7/D9 the rest's imperative holds past its rest until the text break (§5.7, decided default §10.3).
- **Rail stations:** same 5 stations and names; two `at` values move (§2.1).
- **Rest/snap model:** R0–R7 at the same master vh with 16 vh zero-change plateaus; directional snap, desktop only, never R0, never ≥ 1800. The snap's *motion* changes (§6.4).
- **Contracts:** master unit and `MASTER_END`, settle registry, act runner and hysteresis, `FieldAdapter` (additive changes only), Ch5 handoff, teleport/return/floor, deep links, z-index ladder, header (including the open-access "Entrar no radar" button). See §8.

### 1.4 Allowed refinements inside the protected interior (368–770), and nothing else
Each refinement has its own golden-frame mask in §11 item 31; anything outside these masks must be pixel-identical to the v3-baseline build from vh 400 on.

1. Respiro glyphs condense without the hard mask line (LIGHT grammar, §5.3): y and opacity per glyph, absolutely placed at kerned x. Word windows, word-level blur and **word-level colours unchanged** (per-glyph cooling exists behind `FLAGS.RESPIRO_GLYPH_COOL`, default **off**). Mask: glyph boxes.
2. `rimIn` radial falloff is built behind `FLAGS.RIMIN_RADIAL`, default **off**: the v2 superellipse frame ships. Mask (only if the flag is turned on): the rimIn band 465–495.
3. The CNPJ tag sits on an ink capsule plate (fixes the half-white tag at 440); in the dark the plate is nearly invisible. Mask: the tag plate box.
4. The dock is never blank (380, 460). Mask: the dock box.
5. The sonar layer fades out over 368–400 (capture release, ink beads → v2 glass imposter, sphere marbling → v2 veins, rim hold → 0; every one of these terms is multiplied by the `sonar` channel). From 400 on, the field and the sphere are v2's. Mask: none from 400 on; at 380 the whole frame may differ only by the fading sonar terms.
6. The playhead follower and the D1/D2 dilation only change *when* a frame is shown, never *what* it shows.
7. RIG brackets and the gold viewport-frame corners over 368–770 get round caps and round joins with corner radius `rr ≤ 4` px. Geometry, arm lengths, positions, colours and timing are v2's. Mask: each bracket stroke's bounding box ± 3 px.

Not allowed (vetoes): J3 roll, J4 cursor parallax (both ship OFF behind flags), any change to `CAMERA.in`, any dawn wobble or polygon dawn, any camera time-layer term between 352 and 1112 (see §6.1), any sphere skin change from 400 on.

---

## 2. Timing

### 2.1 Master tables (master vh) — BEATS and RESTS unchanged, two STATIONS move

`PACE = 1.0`. `MASTER_END = 1900` (unchanged). New: `S_END = 2730.2` s-vh on fine pointers (+43.7 %), `2784.4` on coarse pointers (+46.5 %) (§2.2).

| id | start | end | len | rest after | station | s(start) desktop | s(end) desktop | s-len desktop | s-len touch |
|---|---|---|---|---|---|---|---|---|---|
| J1 Mergulho | 0 | 220 | 220 | — | Radar | 0.0 | 220.0 | 220.0 | 220.0 |
| J2 Mira | 220 | 352 | 132 | R1 @360 (352–368) | Radar | 220.0 | 355.0 | 135.0 | 135.0 |
| R1 plateau | 352 | 368 | 16 | — | Radar | 355.0 | 380.6 | 25.6 | 25.6 |
| J3 Travessia | 368 | 480 | 112 | — | Radar | 380.6 | 494.4 | 113.8 | 113.8 |
| J4 Interior | 480 | 657 | 177 | R2 @665 (657–673) | Radar | 494.4 | 695.4 | 201.0 | 207.0 |
| R2 plateau | 657 | 673 | 16 | — | Radar | 695.4 | 719.4 | 24.0 | 26.0 |
| J5 Alvorada | 673 | 770 | 97 | — | Radar | 719.4 | 824.4 | 105.0 | 107.0 |
| J6 Dossiê nasce | 770 | 872 | 102 | R3 @880 (872–888) | Radar → Convergência @880 | 824.4 | 928.9 | 104.5 | 104.5 |
| R3 plateau | 872 | 888 | 16 | — | Convergência | 928.9 | 952.9 | 24.0 | 24.0 |
| C2a Convergência | 888 | 1110 | 222 | — | Convergência | 952.9 | 1176.6 | 223.7 | 223.8 |
| C2b Cerco | 1110 | 1152 | 42 | R4 @1160 (1152–1168) | Convergência | 1176.6 | 1331.5 | 154.9 | 163.7 |
| R4 plateau | 1152 | 1168 | 16 | — | Convergência | 1331.5 | 1393.9 | 62.4 | 66.0 |
| C3a Metamorfose | 1168 | 1230 | 62 | — | Convergência → **Estimativa @1198** | 1393.9 | 1505.2 | 111.3 | 115.1 |
| C3b Fusão | 1230 | 1270 | 40 | — | Estimativa | 1505.2 | 1545.2 | 40.0 | 40.0 |
| C3c Varredura | 1270 | 1392 | 122 | R5 @1400 (1392–1408) | Estimativa | 1545.2 | 1668.7 | 123.5 | 123.5 |
| R5 plateau | 1392 | 1408 | 16 | — | Estimativa | 1668.7 | 1692.4 | 23.7 | 23.7 |
| C3d Faixa + selo | 1408 | 1490 | 82 | — | Estimativa | 1692.4 | 1792.7 | 100.3 | 100.3 |
| C3e Desfecho | 1490 | 1552 | 62 | R6 @1560 (1552–1568) | Estimativa | 1792.7 | 2000.5 | 207.8 | 221.1 |
| R6 plateau | 1552 | 1568 | 16 | — | Estimativa | 2000.5 | 2060.5 | 60.0 | 64.0 |
| C4a Recuo | 1568 | 1650 | 82 | — | Estimativa → **Universo @1602** | 2060.5 | 2194.8 | 134.3 | 139.0 |
| C4b Universo | 1650 | 1755 | 105 | — | Universo | 2194.8 | 2313.8 | 119.0 | 119.0 |
| C4c Referente | 1755 | 1782 | 27 | R7 @1790 (1782–1798) | Universo | 2313.8 | 2410.9 | 97.1 | 98.5 |
| R7 plateau | 1782 | 1798 | 16 | — | Universo | 2410.9 | 2479.7 | 68.8 | 70.0 |
| C4d Entrega | 1798 | 1900 | 102 | — (Ch5 at 1900) | Universo → Planos @1900 | 2479.7 | 2730.2 | 250.5 | 253.9 |

Stations in s-vh (desktop / touch): radar 0 / 0, convergência 940.9 / 950.9, estimativa 1473.2 / 1499.4, universo 2146.8 / 2195.0, planos 2730.2 / 2784.4.

- **RESTS:** R0 @0 (no plateau), R1 @360, R2 @665, R3 @880, R4 @1160, R5 @1400, R6 @1560, R7 @1790. Verbs, stations and steps unchanged.
- **STATIONS:** `radar 0`, `convergencia 880`, **`estimativa 1198`** (was 1172), **`universo 1602`** (was 1572), `planos 1900`. They now change when the previous chapter's close has fully evaporated, together with the eyebrow reel (reel1 1194–1208, reel2 1592–1606). The rail, eyebrow and aria-live never name the next chapter while the previous close is on screen. WP0 publishes the new values as `STATIONS_V3` (inert); WP8 switches the rail/aria consumer and WP7 the eyebrow reel (§10 WP0).
- **VERB_SEGMENTS:** copy and boundaries unchanged. New dock rules in §5.7.
- **ACTS_AT:** `lock 345`, `needle 1450`, `seal 1475`, `ringLock 1645`, `countSettle 1752` (unchanged).
- **MARKS changes:** `snap: { aheadS: 24, anyS: 6, maxVh: 1800, idleMs: 420, maxRateNotchesPerS: 2.0 }`. aheadS/anyS are in s-vh and are measured to the **near edge of the rest's plateau** (not its centre), so dilated rests snap too. Everything else unchanged (`ctaIn 755–775`, `chromeIn/dockLift 1840–1880`, `layersOff 1880`).
- **Shared windows (new, `beats.ts` `SHARED_WINDOWS`, WP0).** Every window read by more than one package lives here and is imported on both sides: `cardGrow 1202–1236` (dossier card and RIG card-mode ride, both `cx-flow`; was RIG 1186–1226 `sineInOut`), `tarjaGrow 1204–1236`, `chipsOrbitFrom 1105`, `chipsOrbitPause 1152–1168`, `chipsLandStart 1172` (kept: orbiters land 1172–1194 while the C2 close is held; this is the read window's ambient motion, and the WP7 assert keeps every landing path outside the close panel's rect), `swarm 895–1202` (`.is-swarm` toggles off after the close and its panel are gone, before the card grows), `pulse 1768–1780`, `leaderDraw 1762–1774`, **`leaderRetract 1848–1858`** (was 1798–1808: the leader that links "uma delas" to the disc now stays until the Ch4 close's break), **`release 1848–1878` / `releaseFade 1856–1878`** (was 1800–1830 / 1808–1830: the reticle no longer opens while the close is read; it ends before `layersOff` 1880).

### 2.2 Dilation, S_END and the track mirror

`cinema/dilation.ts` (WP0, pure, no DOM):
```ts
export interface Dwell { id: string; from: number; to: number; K: number; Ktouch: number; read: boolean }
export const RAMP = 10;                    // vh, smoothstep at both ends
// K per profile is explicit (no TOUCH_SCALE): touch keeps the rev-3.0 values, which already pass at 50 vh/s
k(vh) = max(1, max_i 1 + (K_i(profile) − 1)·ss(from_i, from_i+RAMP, vh)·(1 − ss(to_i−RAMP, to_i, vh)))
Winv(vh) = ∫0^vh k      // tabulated every 0.25 vh (7601 doubles), linear between samples
W(s)     = Winv⁻¹(s)    // binary search on the same table; dW/ds = 1/k(W(s))
```

| Window | Master vh | K desktop | K touch | Holds | Added s-vh desktop / touch (window alone) |
|---|---|---|---|---|---|
| D1 | 342–376 | 1.6 | 1.6 | lock act, target tag, R1 | 14.4 / 14.4 |
| D2 (read) | 604–694 | 1.5 | 1.625 | respiro fully written, R2 | 40.0 / 50.0 |
| D3 | 862–896 | 1.5 | 1.5 | dossier header, R3 | 12.0 / 12.0 |
| D4 (read) | 1108–1190 | **3.9** | 4.125 | rev-note, C2 close, R4 | 208.8 / 225.0 |
| D5 | 1384–1414 | 1.5 | 1.5 | amount sharp, R5 | 10.0 / 10.0 |
| D6 | 1460–1492 | 1.8 | 1.8 | range ends and seal, alone | 17.6 / 17.6 |
| D7 (read) | 1494–1592 | **3.75** | 4.0 | C3 close, R6 | 242.0 / 264.0 |
| D8 | 1740–1768 | 2.4 | 2.4 | count settles, alone | 37.9 / 38.3 |
| D9 (read) | 1758–1848 | **4.3** | 4.375 | Ch4 close, R7 | 267.2 / 273.2 |

D8 and D9 overlap (1758–1768), so the per-window column does not sum to the total; `S_END` is computed from k(vh) directly. Computed with `scratchpad/work/v3dir/rev/dwell31.cjs` (rerun after any retune; `--touch` for the touch profile). The rev-3.0 script `lead/dwell.cjs` is superseded.

- **Desktop (fine pointer):** `S_END = 2730.2` (+43.7 %). `TRACKS_VH = { lpScroll: 940.9, ch2: 421.8, ch3: 667.8, ch4: 799.7 }`, sum 2830.2 = S_END + 100.
- **Touch (`(pointer: coarse)`):** `S_END = 2784.4` (+46.5 %). `TRACKS_VH_TOUCH = { lpScroll: 950.9, ch2: 432.4, ch3: 688.7, ch4: 812.4 }`, sum 2884.4.
- **CSS mirror** (`landing.css:175-178, 682-690`, WP1): `.lp-scroll { height: 940.9vh }`, `.ch2-track { height: 421.8vh }`, `.ch3-track { height: 667.8vh }`, `.ch4-track { height: 799.7vh }`, plus `@media (pointer: coarse) { … 950.9 / 432.4 / 688.7 / 812.4 }`. Only the sum is load-bearing (the stages are `position: fixed`; `CHAPTERS[].track` is documentation).
- **Dev assert (WP0):** on every ScrollTrigger refresh, `|(st.end − st.start)/probe100 − S_END(profile)| < 0.5`, where `probe100` is the measured height of a hidden `height: 100vh` probe element (not `innerHeight`, which differs from CSS `vh` on mobile browsers). The profile is chosen by the same `matchMedia("(pointer: coarse)")` that CSS uses.
- **Profile change** (hybrid devices, `matchMedia` `change`): read the master vh first, `ScrollTrigger.refresh()`, then `lenis.scrollTo(vhToPx(vh), { immediate: true, force: true })` and `playhead.jump(vh)` (WP1). The master vh never jumps.
- **Reduced motion:** no tracks (unchanged v2 behaviour), so no dilation.
- **Ch1–J3 run at 1:1** except D1 (34 vh at K 1.6 around the lock and R1). The radar part keeps its pace.
- Time to the plans at 35 vh/s: 78 s desktop, 80 s touch (v2: 54 s; the pre-cinema page: 91 s).

### 2.3 Text windows (master vh) — what moves in the timelines

`dossier/dossier.timeline.ts` `T` (WP7), old → new:

| key | v2 | v3 | note |
|---|---|---|---|
| `revIn` | 1118–1132 (linear clip wipe) | **1086–1100** INK pour | de-overlaps the C2 close |
| `c2In` (panel) | 1124–1134 | **1106–1116** condense (opacity + scale .97 → 1, `cx-flow`) | opaque paper plate r 18 |
| `c2Lead` | 1126–1142 | **1110–1134** INK | 6 words, rise ≥ 10 vh each |
| `c2Sub` | 1138–1150 (5 vh/word) | **1126–1150** INK | 8 words; full at 1150 < R4 1152 |
| `c2Drop` / `c2Fade` | 1168–1200 / 1170–1180 | **retired** → `c2Evap` **1186–1198** EVAPORATE, `c2PanelOut` **1192–1200** (`cx-evap`) | no horizon clip, no autoAlpha cut |
| `captionOut` | 1170–1182 | **1188–1200** EVAPORATE + hairlines scaleX → 0 (`cx-flow`) | |
| `revOut` | 1172–1184 | **1186–1196** EVAPORATE | |
| `haloOut` | 1186–1196 | **1190–1200** | |
| `reel1` | 1172–1188 | **1194–1208** (`cx-flow`, feathered window) | station `estimativa.at = 1198` |
| `cardGrow` | 1186–1226 (`lerpRect`, radius 0) | **1202–1236** (`cx-flow`, radius 18 kept) | starts after the close is gone; from `SHARED_WINDOWS.cardGrow`, which RIG's card-mode ride (`rig.timeline.ts:86, 463`) also reads, with the same `cx-flow` |
| `tarjaGrow` | 1190–1228 | **1204–1236** | |
| `est` ("estimado") | 1200–1216 rect wipe | **1216–1232** INK pour | |
| `chips.ts DIAL.converge` | 1230–1258 | **1236–1262** | |
| `lineBorn` | 1250–1268 | **1254–1270** | C3c `sweep` 1272–1382 unchanged |
| `focus` (sharp/soft) | 1290–1385 linear | 1290–1385, `cx-flow`, feathered mask that follows the scan x | |
| `endsWords` | 1442–1466 maskRise | 1442–1466 INK | |
| `c3In` (panel) | 1490–1520 (rise 0.4·innerH) | **1492–1500** condense in place | starts when D6 ("range and seal read alone") ends; the panel is opaque before the first lead word is legible (1501) |
| `c3Lead` | 1500–1530 | **1494–1522** INK | 12 tokens |
| `c3Sub` | 1526–1546 | **1514–1540** INK | full at 1540 < R6 1552 |
| `c3Drop` / `c3Fade` | 1568–1590 / 1568–1576 | **retired** → `c3Evap` **1590–1602**, `c3PanelOut` **1594–1602** | |
| `reel2` | 1572–1588 | **1592–1606** | station `universo.at = 1602` |
| `dimSeal / dimRange / dimLabel / dimHead` | 1575–83 / 1582–90 / 1589–97 / 1596–1603 | **1588–96 / 1590–98 / 1594–1601 / 1597–1604** (`cx-flow`) | after the close starts leaving |
| `collapse` | 1605–1640 | 1605–1640 (radius leads, size lags, §3) | membrane at 1605 is fixed |
| `pinnedOut` | 1800–1812 | 1800–1812 (pill) | |
| `eyebrowOut` | 1835–1850 | 1835–1850 EVAPORATE | |

`ch4/ch4.timeline.ts` `CH4_T` (WP7):

| key | v2 | v3 |
|---|---|---|
| `panelIn` | 1652 / 1662 / 1668 (linear opacity) | 1652–1668 condense (`cx-flow`), opaque paper r 18 |
| `label` | 1660–1672 (7 vh/word) | **1660–1676** INK |
| `reels` | from 1680, step 8, len 36 | unchanged (feathered windows); `countSettle` act 1752 |
| `closeIn` | 1756 / 1762 / 1768 | **1758–1766** condense |
| `lead` | 1757–1768 (6 vh/word) | **1762–1776** INK |
| `sub` | 1768–1780 (5.4 vh/word) | **1770–1782** INK (full exactly at the R7 plateau start) |
| `closeOut` | 1820–1850 (y −32) | **1848–1862** EVAPORATE |
| `panelOut` | 1830–1862 | **1850–1866** `cx-evap` |
| `stageOff` | 1862 | **1868** (< `layersOff` 1880) |

Respiro (`RESPIRO_T`) is unchanged. HUD exit 30–70 (linear) → **30–62** EVAPORATE.

**Dev assert (WP0, clarity graft):** every scrubbed text pour in `T`, `CH4_T` and `RESPIRO_T` ends at or before the start of the next rest plateau, and every read window's text is fully settled before its rest. The assert lists violations at build in dev.

**Function-based values and refresh.** `dossier.timeline.ts:620-621, 630-632` (`-closeShift()`) and `:665, :676` (`innerHeight·0.4/0.45`) are function-based tween values. Most of them are retired by the in-place condense (B6/F3), but any function-based value left in the master must be re-evaluated on refresh: the director replays ScrollTrigger's `invalidateOnRefresh` itself (§8.2).

### 2.4 Reading-time proof

Model (v2 camread): a word is legible at 70 % of its own rise; a block breaks when its exit starts; need = 0.3 s/word + 1.0 s. "Legible" = first legible word → break; "full" = last word settled → break. Values are s-vh, then seconds at the given wheel speed (s-vh/s).

| Block (verbatim start) | Words | Need | Master window (first legible → full → break) | Legible s-vh (desktop) | Full s-vh | @25 legible / full | @35 | @50 | Touch @50 |
|---|---|---|---|---|---|---|---|---|---|
| Tag "Empresa em análise · CNPJ…" | 5 | 2.5 s | 346 → 346 → 470 (parks, stays legible to 830) | 138.1 | 138.1 | 5.5 / 5.5 ✓ | 3.9 ✓ | 2.8 ✓ | 2.8 ✓ |
| Respiro "São 117.965 pontos…" | 17 | 6.1 s | 488.8 → 617.6 → 776 | 327.2 | 194.1 | 13.1 / 7.8 ✓ | 9.3 ✓ | 6.5 ✓ | 6.7 ✓ |
| Dossier header (desc, label, eyebrow, caption) | 13 | 4.9 s | 847 → 870 → 1186 | 558.3 | 533.8 | 22.3 / 21.4 ✓ | 16.0 ✓ | 11.2 ✓ | 11.5 ✓ |
| Rev-note "valor que nenhuma base pública declara" | 6 | 2.8 s | 1093 → 1100 → 1186 | 300.3 | 293.3 | 12.0 / 11.7 ✓ | 8.6 ✓ | 6.0 ✓ | 6.3 ✓ |
| **C2 close** "Nenhuma base pública…" / "Mas dezenas…" | 14 | 5.2 s | 1117 → 1150 → 1186 | 264.7 | 136.0 | 10.6 / 5.4 ✓ | 7.6 ✓ | 5.3 ✓ | 5.6 ✓ |
| "estimado" | 1 | 1.3 s | 1223 → 1232 → 1594 | 640.6 | 631.6 | 25.6 ✓ | 18.3 ✓ | 12.8 ✓ | 13.3 ✓ |
| Eyebrow reel "A estimativa" | 2 | 1.6 s | 1205 → 1208 → 1592 | 656.6 | 653.6 | 26.3 ✓ | 18.8 ✓ | 13.1 ✓ | 13.6 ✓ |
| Amount "R$ 24,3 mi" | 3 | 1.9 s | 1385 → 1385 → 1605 (then pinned to 1800) | 489.6 | 489.6 | 19.6 ✓ | 14.0 ✓ | 9.8 ✓ | 10.2 ✓ |
| Range "mínimo R$ 20,7 mi / máximo R$ 27,9 mi" | 8 | 3.4 s | 1449 → 1466 → 1590 (`dimRange`) | 400.4 | 382.2 | 16.0 / 15.3 ✓ | 11.4 ✓ | 8.0 ✓ | 8.4 ✓ |
| Seal "Fonte pública oficial · auditável" | 4 | 2.2 s | 1476 → 1476 → 1588 (`dimSeal`) | 361.4 | 361.4 | 14.5 ✓ | 10.3 ✓ | 7.2 ✓ | 7.7 ✓ |
| **C3 close** "A precisão do mercado de elite…" / "Nenhum outro produto…" | 18 | 6.4 s | 1501 → 1540 → 1590 | 324.7 | 179.1 | 13.0 / 7.2 ✓ | 9.3 ✓ | 6.5 ✓ | 6.9 ✓ |
| Eyebrow reel "O universo" | 2 | 1.6 s | 1603 → 1606 → 1835 | 491.0 | 488.0 | 19.6 ✓ | 14.0 ✓ | 9.8 ✓ | 9.9 ✓ |
| Ch4 count + label "117.965 empresas de capital fechado no radar" | 7 | 3.1 s | 1667 → 1756 → 1850 | 468.4 | 364.0 | 18.7 / 14.6 ✓ | 13.4 ✓ | 9.4 ✓ | 9.5 ✓ |
| Ch4 count alone (settled, before the close's first word) | — | ≥ 0.8 s | 1752 → 1769 | 48.4 | — | 1.9 | 1.4 | 1.0 | 1.0 |
| **Ch4 close** "Você esteve dentro de uma delas." / "As outras 117.964…" | 18 | 6.4 s | 1769 → 1782 → 1848 | 323.2 | 267.3 | 12.9 / 10.7 ✓ | 9.2 ✓ | 6.5 ✓ | 6.6 ✓ |

v2 for comparison (35 vh/s): C2 close 1.1 s, C3 close 1.6 s, Ch4 close 2.0 s legible.

- Break-even wheel speed (legible = need): desktop C2 50.9, C3 50.7, Ch4 50.5 vh/s; touch 53.8, 54.1, 51.4 vh/s. **Every row passes at 25, 35 and 50 vh/s on both profiles** (50 vh/s ≈ 4.5 notches/s; the camread reference for "reading while still scrolling" is 40 vh/s).
- `FLAGS.WHEEL_VISCOSITY` stays built but **off** (feasibility veto): dilation alone now closes the gap.
- No rate cap of any kind (vetoed by two judges).
- Plateaus at 25 vh/s: R1/R2/R3/R5 0.95–1.02 s; R4 2.50 s, R6 2.40 s, R7 2.75 s. Imperatives are not limited to plateaus (§5.7).
- Inside a read window the foreground text is static; the pacing rule of v2 §4.3 ("every 50 vh outside plateaus shows a visible change") is satisfied by the dock reading meter, the C2b orbit (D4) and the GL backdrop drift (§6.1 L6, 1112–1552), all of which move with the wheel.

**Exempt blocks (not modelled by 0.3 s/word, with the reason):**
| Block | Why exempt | Guarantee instead |
|---|---|---|
| Gateway title, phrase, CTA, cue | time-based; the user leaves the Gateway by clicking | stays until the click; text over the field sits in `uTextMask` |
| Onboarding card | shown at R0 (no scroll needed to read it) | dismissed only by real scroll px, as v2 |
| HUD "AZ ###° · varredura ativa" | instrument readout at R0, not content | inside `uTextMask` until it evaporates 30–62 |
| Cursor labels | user-driven (they follow the cursor) | unchanged v2 rules |
| Echo chips | ambient, time-based | hold **≥ 2.4 s** (cap 3 s) ≥ the 2.2 s need of a 4-word name; value shown only if `strength > LABEL_VALUE_MIN_STRENGTH`, else redacted |
| Decoy chips | the message is the strike, not the name | time-based once triggered (forward crossing of the flare peak): bloom 240 ms, hold 1.8 s, strike drawn 0.5–0.8 s after bloom, evaporate 160 ms; value always redacted; on reverse past the flare − 4 vh they evaporate at once |
| Ch4 sweep-flash labels (C4c 1720–1800, `ch1/labels.ts:12-17`) | ambient, always redacted, 0.9 s | unchanged timing; pill shape, INK/EVAPORATE time variants (§5.4) |

---

## 3. Act-by-act choreography, Gateway → 1900

Notation: rows are `vh range | what happens | system / channel / tween (owner WP) | easing`. Channels are `SCORE` keys (§4.2), pure f(vh). "Time" rows are acts or time-layer terms. Everything not listed is v2.

### G1 · Gateway boot (time-based, ≈ 1.9 s) — WP5 (text), WP2/WP3 (field)
| time | what happens | system | easing |
|---|---|---|---|
| 0–1.9 s | The field behind the portal is already the v3 sonar: hairline beam turning on time only (16 s per turn), afterglow, pings, echoes, current. No scroll coupling (vh = 0). | `three/field/beam.ts` θ = SWEEP_START + θ_time; points sonar path (`sonar` = 1 at vh 0) | — |
| 1.05 s | "Genesis Radar" pours glyph by glyph instead of the hard word window (`gateway.css:141-147` → no clip; `Gateway.tsx:281`) | `glyphs.play(title, "ink", { dur: 0.9, stagger: 0.018 })` | `cx-ink-settle` y/skew, `cx-ink-bloom` opacity |
| 1.35 s | "Toda empresa fechada esconde um número. *O radar ilumina cada um.*" pours (was one block, `Gateway.tsx:286`) | `glyphs.play(line, "ink", { dur: 0.9, stagger: 0.012 })` | same |
| 1.5 s | The CTA `.gx-cta` (now a **pill**, radius 999) condenses in: opacity 0 → 1, scale .94 → 1, y 10 → 0 (was `tl.from(".gx-cta", { autoAlpha: 0, y: 16 })`, `Gateway.tsx:287`) | WP5 | `cx-pour` 0.6 s |
| 1.72 s | The cue `.gx-cue` ("mova o cursor — o campo responde") pours glyph by glyph (was a 0.4 s fade, `Gateway.tsx:288`) | `glyphs.play(cue, "ink", { dur: 0.5, stagger: 0.01 })` | INK time |
| armed | The CTA's ping ring `.gx-cta::after` (`gateway.css:242-262`, 3 pings every 7 s) becomes a **concentric pill ring** that keeps its ping: scale 1 → 1.14, opacity .55 → 0 | WP5 | `cx-pour` |
| — | The emblem rule diamond `.grl__rule-dia` (`gateway.css:175-180`, `rotate(45deg)`) becomes a 5 px round dot | WP5 | — |
| — | `.gx-em` colour: tan `#8b6a3d` below 24 px (was gold-editorial at 4.29:1) | `gateway.css:190` | — |
| — | `uTextMask` rect 0 = the Gateway text block (title + phrase + em), rect 1 = CTA + cue; written by WP5 from `ctx.rects` at refresh; the field under them shows no veil, afterglow darkening or pings | `field.setTextMask(i, rect)` (WP0 stub, WP3 shader) | — |

### G2 · Gateway exit (time-based, 1.1 s) — WP5, WP2, WP3
| time | what happens | system | easing |
|---|---|---|---|
| 0–0.26 s | Gateway text evaporates from the far edge (was y −12 per word, `Gateway.tsx:449`) | `glyphs.play(…, "evaporate", { dur: 0.26, stagger: 0.006 })` | `cx-evap` |
| 0–1.1 s | Emblem glides onto ring0 (unchanged MorphSVG), `shockR` 2.4 → 14, `ringBoost` | unchanged GW timeline | unchanged |
| with the shock | The shock front is the **first ping**: crest lift z +0.30 and resolve in the sonar path. The ribbon rings wobble as the front crosses them: `r += 0.06·exp(−((R_i − shockR)/0.5)²)·sin(9θ)` | `points.ts` (sonar branch), `three/ribbons.ts` (ribbon shaders in `shaders/sweep.ts`) | — |

**G2 contract (unchanged):** ring0 radius 2.4 at hub (0, 0, −1) at the hero pose; `ringRadiusPx(2.4, heroPose)`; the ribbon width at the hero pose equals the emblem stroke. WP2 measures the emblem stroke in CSS px and sets the kind-0 ribbon width for vh < 8 to match within 0.25 px.

### G3 · Wake → R0 (time-based, ≤ 0.9 s) — WP8, WP6
| time | what happens | system | easing |
|---|---|---|---|
| 0–0.35 s | HUD "AZ ###° · varredura ativa" counts (unchanged); AZ reads the v3 beam bearing. The three AZ digits sit in fixed-width cells (`font-variant-numeric: tabular-nums`, each cell `contain: layout size`); only changed cells are written, so the per-frame AZ update never lays out the page. The HUD rect is `uTextMask` rect 2. | `ch1/hud.ts` (WP6) | unchanged |
| 0.35 s | Dock appears as a **pill** (radius 999, scoped to `.is-cinema`) | `guide/machine.ts`, `guide.css:60,121-135` | `rk-settle` |
| 0.5 s | Onboarding card: r 18 on an opaque paper plate; its four square gold corner brackets become round-cap quarter arcs (rr 12). Its rect is a no-go zone for echo chips (fixes chips under the card at vh 0) | `guide.css:469-512`, `rects.register("guide.onboarding")` | — |
| first scroll | Morph into the dock **without scaling** (replaces `Flip.fit(cardBg, pillBg, { scale: true })`, `machine.ts:548`, which turned the 18 px radius elliptical mid-morph): the card background is sized once to the union box and animates `clip-path: inset(t r b l round R)` from the card rect (R 18) to the pill rect (R 999 → clamped to h/2); text out 160 ms | GSAP on `clipPath` (WP8) | `rk-glide` |

### J1 · Mergulho [0–220] (s 0–220, 1:1)
| vh | what happens | system / channel (owner) | easing |
|---|---|---|---|
| 0–8 (R0) | Front-on hero pose (P0/L0 kept for the G2 match-cut). Beam on time only. HUD visible. | `CAMERA.seek` S0; `sonar` = 1 | — |
| 0 → 100 | Camera **eases out of R0** (start slope 0.5× secant, so the first notch moves) and floats **up-left** on the seek arc: (0, 0, 16) → (−1.2, 0.78, 13.0); yaw 0 → 4.5°, pitch 0 → −2.9° | `CAMERA.seek` (WP4) | monotone cubic profile |
| 0 → 110 | Roll drifts to −2.2° | `roll` (WP4) | `sine` ramp |
| 0 → 226 | **Scroll drives the beam:** θ = SWEEP_START + θ_time + 2π·vh/180 (1.22 turns from scroll plus 16 s per turn of time). Scrolling back rewinds it. The HUD AZ spins with it. θ_time stops integrating while the hunt latch is set (§4.3), so the beam never jumps when the user scrolls back out of J2. | `three/field/beamClock.ts` (WP2) | — |
| 0 → 226 | **Afterglow:** points behind the lead darken and grow (`exp(−b/1.6)`), no gold fill. **Pings:** each point the lead crosses shows a 1.2 px ink ring that expands and fades over ≈ 0.22 rad; the ring is gold only for the top 9 % by size (`aSize > 2.91`). **Echoes:** 12 build-time candidates (one per 30° sector) send crests through their neighbours (lift z +0.22, push 0.06, resolve +0.55). | `points.ts` sonar branch, `three/sonar.ts` (WP3) | analytic |
| 0 → 280 | **Hidden universe** (T0/T1): a prefix of the dust buffer (≤ 24k T0 / ≤ 12k T1, sized so its measured cost is ≤ 1.0 ms, §4.5) lights only in the afterglow (`exp(−b/1.0)·0.55`): 1–1.5 px ink grains that sink back. Drawn by its own cheap `DUST_SONAR` program. It fades in over 0.8 s if the dust warm-up is not ready yet. | `field/dustDriver.ts`, `dustSonar` (WP3) | — |
| 0 → 226 | **Current:** a divergence-free 3-wave stream function moves neighbourhoods together (amplitude 0.09 world × (1 + 0.6·pvelN)). Scrolling stirs it (T += dt·(1 + 2·pvelN)). | `three/flow.ts` (WP3) | — |
| 0 → 300 | **Cursor = drop of water:** dimple (push ≤ 9 px) plus a 5-node wake chain that springs back; the resolve lens is kept. Cursor labels as v2 (gated by `labelsGate`). Points that carry a DOM label or chip are **pinned** (`uPinned[8]`, §4.4): dimple, wake, lens, echo push and capture skip them, so leaders stay on their points. | `uMouse`, `uWake[5]` (WP3); labels (WP6) | springs |
| 8 → 226 | **Echo chips:** when a named candidate pings, its chip blooms (pill, leader drawn from the point), holds **≥ 2.4 s (cap 3 s)**, then evaporates. At most 3 chips on screen on desktop (2 on mobile), decoys included, never within 120 px of the target, the onboarding card, the HUD, the dock or a live cursor label. Pools: cursor labels keep `POOL = 4` (`ch1/labels.ts:30`); chips get their own `CHIP_POOL = 4` (3 live + 1 evaporating); a decoy pre-empts the oldest echo chip (which then evaporates early, after ≥ 1.2 s shown). Content: name always full; value full only if `strength > LABEL_VALUE_MIN_STRENGTH`, else the redacted run. | `ch1/labels.ts` (WP6) from `frameData.echoes` (WP3) | time: in 240 ms `cx-ink-settle`, out 160 ms `cx-evap` |
| 30 → 62 | HUD evaporates per glyph (was a linear y −8 over 30–70) | `ch1/hud.ts` (WP6) | `cx-evap` |
| 100 → 190 | Camera climbs to (−0.55, 1.05, 10.0), pitch −7.1°: the volumetric field (z −6…2) shows ≈ 2.6° of near/far parallax. | `CAMERA.seek` | — |
| 0 → 226 | **Target pre-signal:** each time the lead crosses SP's bearing, the black sphere answers with a gold fresnel flick (`uEchoRim = exp(−b_SP/0.3)·sonar`, light on dark). | `sphere.ts` exterior (WP3) | analytic |
| 120 → 220 | **Lens:** points behind SP within 1–2.2 disc radii are pushed outward ≤ 5 px: the sphere has mass. | `lens` (WP3) | `smooth` |
| 0 → 336 | **Time layer:** lean from path acceleration, bank, fovKick, lookAhead, cursor parallax (gain 1). All are 0 at rest, and the gates reach 0 at 352 (R1 plateau start). | `three/field/camlayer.ts` (WP4) | springs §1.2 |

### J2 · Mira + trava [220–352] (s 220–355)
| vh | what happens | system / channel | easing |
|---|---|---|---|
| 226 | **Hunt latch:** δ0 = wrapPi(θ_free(226) − θ_hunt(0)) is stored once and θ_time **freezes** (cleared below 222, where θ_time resumes from its frozen value, so θ is continuous both ways, §4.3). | `beamClock.ts` | — |
| 226 → 336 | **The beam hunts:** θ = θ_hunt(u) + (δ0 + 2π(vh − 226)/180)·(1 − smoothstep(0, 0.35, u)), with θ_hunt(u) = β_SP + 0.9·(1−u)²·e^(−2.4u)·cos(2.6πu) and u = `seek`. It whips to the target, overshoots ≈ 9°, swings back and settles exactly at 336 with zero angular velocity. Maximum rate 0.16 rad/vh (verified: `scratchpad/work/v3dir/lead/hunt.cjs`). | `seek` linear 226 → 336 (WP2) | closed form |
| 226 → 336 | The afterglow tightens (`glowTau` 1.6 → 0.5 at 300 → 0.12 at 336) and turns into a **searchlight** (symmetric glow around the lead) as `seek` rises. | `glowTau`, `seek` (WP3) | `smooth` |
| 230 → 352 | Camera crests and dives under the target along the seek arc to the R1 pose (0.73, −0.41, 5.65). Roll swings +1.2° at 230 → +2.4° at 320 → **0 at 346 (the lock levels the horizon)**. FOV narrows (−2° at 300, −3.2° over 336–346) and **releases** to 46° over 346–352 (a lens snap after acquisition). | `CAMERA.seek`, `roll`, `fovSeek` (WP4) | `sine` |
| 238 / 262 / 286 | **Decoys:** three build-time candidates within ±0.6 rad of β_SP flare as the hunt passes (gold meniscus line, size ×1.8), then grey to ink α 0.35: rejected (GL, pure f(vh)). In the DOM their chips are **time-based** once the flare peak is crossed going forward: bloom 240 ms, an ink strike line draws across the name 0.5–0.8 s after the bloom, hold 1.8 s, evaporate 160 ms; value always redacted; scrolling back past the flare − 4 vh evaporates them at once. Names come from `COMPANY_NAMES` (no new copy). Decoy 3's point is pinned, so the capture swirl (from 286) never pulls it off its chip. | `decoy0..2` = gauss(…, 7, 1) (WP3); chips (WP6) | strike `cx-flow` (time), out `cx-evap` |
| 200 → 300 | **Rack focus:** the focus distance racks from mid-field to \|cam − SP\| through the focus spring (a visible hunt). Far and near points go soft (energy-conserving bokeh). | `focusSP`, `dof`, focus spring (WP3/WP4) | spring ζ 0.58 |
| 256 → 296 | Dial ticks undraw (round tips); the crosshair undraws over 256–290. One centre remains: the target. | `ticks_v3`, `cross_v3` (WP2) | linear draw |
| 260 → 300 | Cursor labels gate out (unchanged). | `labelsGate` | linear |
| 262 → 340 | **The rings drain into the target**, outer first (ring3 262–318, ring2 272–326, ring1 282–334, ring0 292–340). The centre moves hub → SP, the plane turns to face the camera, and the radius goes to disc + 14 + 6i px, wobbling by `4t(1−t)·(0.035 sin(2θ+p_i) + 0.025 sin(3θ+q_i))` in transit and arriving as perfect circles. Over 326–342 they merge onto ring0. | `ringTravel0..3`, `ringMerge` (WP2) | `smooth` + wobble |
| 240 → 340 | **The DOM reticle bends:** the four L-corners grow their corner radius (rr → arm, arm → side/2) until the four quarter arcs form **one circle** of radius (disc r + 14) at 340. | `rig.timeline.ts` rr/arm (WP6) | `cx-meniscus` |
| 340 → 348 | GL ring0 cross-fades into the DOM circle. **Hand-off within 1 px** (centre and radius) via `field.ringScreen(0)`. | `ringFade` (WP2), RIG (WP6) | linear |
| 286 → 352 | **Liquid capture:** the field drains toward SP with a 1.1 rad swirl and packs into a bead **meniscus** at R_m = 0.63 (1.5 sphere radii). No point enters 0.95 R_m. Far points dim radially (this replaces the flat `fieldOp` .6 in the sonar path). | `capture` (WP3) | `smooth` |
| 296 → 336 | **Needle:** the lead line shortens until it ends on the target (line end = mix(12.8, ρ_SP + 0.4, needle)); width 1.5 → 2.25 px. | `needle` (WP2) | `smooth` |
| 330 → 345 | **Implosion:** one inward ink ripple (420 px → 0) at the anchor. | `ripples.ts` inward event (WP3) | analytic |
| 344 → 352 | The beam fades (`sweepGain_v3` 1 → 0). | `sweepGain_v3` (WP0 keys, consumer switched by WP2) | linear |
| **@345 `lock` act** | Reticle squeeze .92 → 1 (`back.out(1.6)`, 220 ms) plus a gold arc flash (300 ms); GL meniscus ring flash 1.08 → 1 (260 ms, `field.time.lockPulse`); ink ripple amp 0.30 (≈ 10 px push); the tag pours glyph by glyph on its ink capsule (300 ms). Reverses at 1.6×. | `rig.timeline.ts` (WP6), `field.time.lockPulse` (WP2) | `back.out(1.6)`, `cx-meniscus`, `cx-ink-settle` |

### R1 · rest [352–368] (D1, K 1.6: s 355.0–380.6)
Zero foreground change: the camera is still, the sonar is frozen in its packed state and the beam is off. Every SCORE channel is flat over 352–368 (asserted, §4.2). Dock: "role para entrar na empresa", shown from the `lock` act at 345 (lead imperative, §5.7). The camera time-layer gates (`camLean`, `camLook`, `parallax`) reached 0 at 352.

### J3 · Travessia [368–480] — preserved
| vh | what happens | system | easing |
|---|---|---|---|
| 368–480 | Camera: v2 `CAMERA.in` (byte-identical), warp 400–480, `fovThud` at 465, contact ≈ 462. | unchanged | unchanged |
| 368–400 | **The meniscus breaks** as the dolly starts: `capture` 1 → 0 by 398 (beads relax outward) and `sonar` 1 → 0 by 400 (ink beads cross-fade back to v2's glass imposter; flow, lens and DOF → 0; sphere marbling → v2 veins; rim hold → 0). From 400 on the field and the sphere are v2's. | `capture`, `sonar` (WP3) | `smooth` |
| 398–400 | J2 transit channels reset while invisible (`seek`, `needle`, `ringTravel*`, `ringMerge` → 0, `ringFade` → 1; the beam is off and the rings are undrawn). | WP0 keys | step |
| 368–440 | The DOM reticle circle **opens** back into corner brackets on the silhouette box (rr → 4, arm → armMax), with round caps (§1.4 item 7). | RIG (WP6) | `cx-flow` |
| 400–470 | The tag parks (unchanged arc) on its ink capsule plate, so it is never white on paper at 440. | RIG (WP6) | unchanged |
| 380, 460 | The dock is never blank (fix). | WP8 | — |
| 465–495 | `rimIn`: v2 superellipse (flag `RIMIN_RADIAL` off). | `sphere.ts` dome | — |

### J4 · Interior [480–657] — preserved
Respiro words keep their windows `[472 + 7.6k, 496 + 7.6k]`. Inside each word the glyphs condense left to right (LIGHT grammar, §5.3): y 0.32 em → 0 and opacity, per glyph. The HOT → COOL colour and the word-level blur 6 → 0 stay **per word**, exactly as v2 (`RESPIRO_GLYPH_COOL` off). No mask line. The em glow is unchanged. Everything else is v2.

### R2 [657–673] (D2, K 1.5) · J5 Alvorada [673–770] — preserved
Dawn circle in GL and in the DOM ink twin unchanged. CTA 755–775 unchanged. Dock lead imperative from 645 and the reading meter during D2 until **673** (the R2 plateau end); J5 then shows its gerund "iluminando a empresa" as v2 (§5.7).

### J6 · O dossiê nasce [770–872]
| vh | what happens | system (owner) | easing |
|---|---|---|---|
| 770–830 | Ink-twin words dolly (geometry unchanged, `respiro.ts:325-357`). Instead of the giant fading ghost, their glyphs **evaporate** over 778–800 (s 1.15 → 1.45). | `respiro.ts` (WP6) | `cx-evap` |
| 775 + 5i → 783 + 5i | Em words are covered by **ink capsules** (radius h/2), each led by a 5 px gold **droplet** nib (was a 2 px square nib). | `respiro.ts:360-425`, `ch1.css:175-179` (WP6) | `cx-flow` |
| 815 + 2i → 840 + 2i | The capsules fly along the existing arcs and **stretch along their velocity** (scaleX 1 + min(0.35, 0.02·\|dx/dvh\|)), squash to 0.94 on landing (closed form in vh) and merge into the **capsule tarja**. | WP6 | x `cx-flow`, y `power2.out` |
| 802–850 | **The card paper condenses** out of the tarja: its outer edge starts as a pill hugging the tarja (radius h/2) and relaxes to 18 px as the box opens (was radius 0, `dossier.timeline.ts:531-537`). During the build the paper keeps its **hole** (the CH1 capsule bars at z 4 must show through the paper at z 6 inside the tarja slot until the 850 swap), so the clip is `clip-path: path(evenodd, "<rounded outer rect> <capsule hole>")` built in px by the writer (arcs for the card radius and for the tarja capsule, h/2), replacing `holePoly` (`:750, :829`). The 1 px rim ring is the same: `path(evenodd, outer r+1, inner r)` (`:830`). After 850, once the hole is gone, the writer switches to `inset(… round r)`. | WP7 | box `cx-flow`, radius `cx-pour` |
| 850 | The bars → tarja swap stays **pixel-identical** (both capsules, same radius token). | WP6 + WP7 | — |
| 830–850 | The tag splits into the slots; its ink plate fades out by 850 so the 860 swap stays pixel-identical; `white-space: nowrap` fixes the 840 reflow. | WP6 | `cx-flow` |
| 836–1615 | The card shadow `.cx-dos__shade` (`dossier.css:66-77`, scaled non-uniformly to the box at `dossier.timeline.ts:852-857`) gets rounded corners that match the card: the writer compensates the radius per axis, writing `border-radius: ${18/sx}px / ${18/sy}px` (computed in JS, quantised to 0.05 px, written only when it changes, a paint and never a layout), so the scaled shadow has 18 px corners. During the C4a collapse the same rule uses the collapse radius instead of 18. | WP7 | — |
| 840–870 | Desc 840–862, label 852–866, eyebrow 852–862 (pill) and caption 856–870 pour with INK glyphs (same windows). Reels use feathered windows. | WP7 | INK |
| 770–872 | Brackets in card mode with **rr 10** (concentric with the 18 px card: the brackets sit 8 px inside the paper, `rig.timeline.ts:496`, pad −8). | WP6 | — |
| 770–1112 | Camera look layer stays 0 (v2 camera). It wakes at 1112, after the last C2a comet spark (§6.1). | WP4 | — |

### R3 [872–888] (D3, K 1.5)

### C2a · Convergência [888–1110]
| vh | what happens | system | easing |
|---|---|---|---|
| 888–1110 | Chips become **ink comets**: capsule bodies with a 4 px gold droplet head, stretched along the Bézier tangent by speed (scaleX ≤ 1.6) and squashed to 0.9 at impact (closed form). The grey trail becomes a second, thinner capsule that lags 3 vh. Transform-only. | `chips.ts` render (WP7) | flight unchanged |
| impacts | The tick on the tarja lights as a round-capped capsule tick; the ink ripple is unchanged. | WP7 | — |
| 888–1112 | The camera stays on v2's pose (no look layer), because the comet origins are sampled once at vh 1000 from the base pose (`dossier.timeline.ts:479`) and the sparks are visible until ≈ 1111. The comets are the motion here. | WP4 gates | — |
| 1112–1552 | **The GL backdrop answers the wheel:** a pure-f(vh) look drift `driftCard·(0.10·sin(2π·u/420), 0.06·sin(2π·u/560 + 1.1))` world, where u is a plateau-frozen vh (u stops advancing inside R4 and R5, so plateaus stay static), plus a time-based look sway (0.14·sin 0.09t, 0.10·sin 0.07t) world (exactly 0 at t = 0) and cursor parallax ×0.4. GL only: the card and every text plate never move. | `driftCard`, `breathCard`, `parallax` (WP4) | analytic + springs |
| 1086–1100 | Rev-note pours (Playfair italic, INK), moved here from C2b. | WP7 | INK |

### C2b · Cerco [1110–1152] (inside D4 from 1108)
| vh | what happens | system | easing |
|---|---|---|---|
| 1110–1152 | Orbit unchanged (from `SHARED_WINDOWS`). | WP7 | — |
| 1106–1116 | The C2 close panel condenses in place (opacity, scale .97 → 1), opaque paper, r 18. | WP7 | `cx-flow` |
| 1110–1134 / 1126–1150 | Lead / sub pour (INK). | WP7 | INK |
| 1110–1200 | The gold halo around the tarja `.cx-dos__halo` (`dossier.css:346-356`, a square 1 px ring + 22 px glow) gets `border-radius: 999px`, concentric with the capsule tarja. | WP7 | — |
| from 1152 | The dock shows "role para revelar o número" (lead start = max(s(R4) − 30, last act) = 1152.3) plus the reading meter from the close's full state (1150). | WP8 | — |

### R4 [1152–1168] (D4, K 3.9: 62.4 s-vh)

### C3a · Metamorfose [1168–1230]
| vh | what happens | easing |
|---|---|---|
| 1168–1186 | The C2 close is still held (inside D4). The dock keeps the R4 imperative and the meter until 1186. | — |
| 1186–1198 | The close evaporates from the far edge; panel out 1192–1200. Rev-note out 1186–1196; caption out 1188–1200; halo out 1190–1200. | `cx-evap` |
| 1194–1208 | Eyebrow reel "Convergência" → "A estimativa" (feathered window). Station **Estimativa at 1198**. | `cx-flow` |
| 1202–1236 | The card grows (radius stays 18); the tarja grows over 1204–1236; "estimado" pours over 1216–1232. | `cx-flow`, INK |

### C3b · Fusão [1230–1270]
Converge 1236–1262, line born 1254–1270 (shifted +6 / +4). The ticks fuse into one gold line (an instrument line, which the gold rule allows).

### C3c · Varredura [1270–1392]
| vh | what happens | system | easing |
|---|---|---|---|
| 1272–1382 | The tarja is eaten by a **capsule wipe** (`inset(0 X% 0 0 round 999px)`) whose rounded edge follows the scan. The scan head is a capsule with a gold nib (was a vertical line eating a rectangle, `dossier.timeline.ts:763, 883`). | WP7 | linear in vh (instrument motion), 1 px edge feather |
| 1290–1385 | "R$ 24,3 mi" sharpens behind the scan: the sharp copy is revealed by a feathered mask whose edge tracks the scan x (`--scan-x` written per frame), and the soft copy fades opposite. | WP7 | `cx-flow` |

### R5 [1392–1408] (D5, K 1.5)

### C3d · Faixa honesta e selo [1408–1490]
| vh | what happens | easing |
|---|---|---|
| 1408–1452 | Line turn and ruler (geometry unchanged); the ruler track becomes a capsule. | unchanged |
| 1440–1460 | Range fill: a capsule that opens from the centre (scaleX); was a rectangular scale clip (`:588/656`). | `cx-flow` |
| 1442–1466 | Ends pour (INK). | INK |
| @1450 `needle` | Act unchanged (`back.out(1.6)`). | — |
| @1475 `seal` | The seal is a pill stamp (radius 999); act unchanged (scale 1.12 → 1, check DrawSVG). | — |
| 1460–1492 | D6 (K 1.8): range and seal are read alone before the close appears (the C3 panel starts at 1492). | — |

### C3e · Desfecho [1490–1552] (inside D7 from 1494)
Panel condenses over 1492–1500; lead 1494–1522 (first word legible at 1501, panel opaque from 1500); sub 1514–1540 (INK). Dock lead imperative "role para recuar ao universo" from 1552 (= max(s(R6) − 30, last act)), plus the meter from 1540.

### R6 [1552–1568] (D7, K 3.75: 60.0 s-vh)
The backdrop drift and sway gates reached 0 at 1552; every SCORE channel is flat over 1552–1568.

### C4a · Recuo [1568–1650]
| vh | what happens | system | easing |
|---|---|---|---|
| 1568–1650 | Camera OUT path unchanged (recoil, membrane at 1605). **Every camera time-layer term is 0** (1552–1700). | WP4 gates | — |
| 1568–1590 | The C3 close is still held (inside D7). | — | — |
| 1590–1602 | The C3 close evaporates; panel out 1594–1602. | WP7 | `cx-evap` |
| 1592–1606 | Eyebrow reel → "O universo"; station **Universo at 1602**. | WP7, WP0 | `cx-flow` |
| 1588–1604 | The card empties: seal, range, label and header dim (compressed cascade). | WP7 | `cx-flow` |
| 1605–1640 | **Card → pill → circle:** the clip radius leads (`cx-pour`, 18 → min(w,h)/2) while the box lags (`cx-flow`, card → disc), so the shape becomes a pill before it lands as the lit disc. Paper out 1630–1640 and gold rim 1626–1634 unchanged. | `dossier.timeline.ts:531-537, 741-750` (WP7) | `cx-pour` / `cx-flow` |
| @1645 `ringLock` | The brackets are a circle (rr = arm = side/2) around the disc; act unchanged. | WP6 | `back.out(1.6)` |

### C4b · Universo [1650–1755]
| vh | what happens | system | easing |
|---|---|---|---|
| 1650–1755 | Dust wavefront unchanged (v2 dust program; the J1 `DUST_SONAR` program is not used here). The rings redraw inner-first as ribbons with round tips, with a small crest wobble when the dust front crosses a ring. They are the **hub rings** (v2 centre, plane and radii): `ringTravel*` and `ringMerge` were reset to 0 at 400. | WP2 | linear draw |
| 1652–1668 | The Ch4 panel condenses (opaque paper r 18, never unboxed over the moving field). The label pours over 1660–1676. | WP7 | `cx-flow`, INK |
| 1680–1756 | Odometer reels unchanged (feathered windows). The `countSettle` act at 1752 also settles the digits' weight 640 → 500 on T0/T1 (fixed-width cells only). | WP7 | `back.out(1.15)` |
| 1690–1830 | The beam returns with the v3 shader (sector, hairline, ink veil) on the **legacy angle** (the time integrator with its `1.6·vel` boost, untouched), at full length (`needle` = 0 since 400, line end = `uFadeR`) and 1.5 px wide. Points use the sonar afterglow and pings (`sonarC4`; `seek` = 0, so the afterglow is the one-sided phosphor trail, not the searchlight), with no echoes and no capture. | `sweepGain_v3` 1700 → 1740, `sonarC4` (WP2/WP3) | — |
| 1716 | Roll −1.6° (back to 0 by 1782). | `roll` (WP4) | `sine` |
| 1700–1830 | The camera time layer is back on (lean, kicks, parallax ×0.6). | `camLean`, `camLook` | springs |

### C4c · Referente [1755–1782] (D8 over 1740–1768, D9 from 1758)
Close panel 1758–1766; lead 1762–1776; sub 1770–1782 (INK). The RIG leader draws over 1762–1774 with round caps and stays until the close's break. Sweep-flash labels (1720–1800) are pills with INK in / EVAPORATE out (time), always redacted, and avoid the Ch4 panel, the close and the pinned chip (unchanged rule). Dock lead imperative "role para ver os planos" from 1783 (= max(s(R7) − 30, `countSettle` 1752)) plus the meter from 1782.

### R7 [1782–1798] (D9, K 4.3: 68.8 s-vh)

### C4d · Entrega [1798–1900]
| vh | what happens | system | easing |
|---|---|---|---|
| 1798–1848 | The Ch4 close is still held (inside D9); the leader and the reticle circle around the disc stay with it. | — | — |
| 1800–1812 | The pinned "R$ 24,3 mi" (pill) leaves. | WP7 | `cx-evap` |
| 1835–1850 | The eyebrow evaporates. | WP7 | `cx-evap` |
| 1840–1880 | Chrome returns and the dock lifts (unchanged). | WP8 | unchanged |
| 1848–1862 | The Ch4 close evaporates; panel out 1850–1866; stage off at 1868. | WP7 | `cx-evap` |
| 1848–1858 | The leader retracts (round cap). | WP6 (`SHARED_WINDOWS.leaderRetract`) | `cx-evap` |
| 1848–1878 | The reticle releases: the circle opens (rr → 4) and fades over 1856–1878. | WP6 (`SHARED_WINDOWS.release`) | `cx-flow` |
| 1830–1885 | `sonarC4`, `flowAmp`, `dof`, `camLean`, `camLook` and `parallax` → 0. The points cross-fade to the **legacy gold charge** (today's park look). | WP3, WP4 | `smooth` |
| 1880 | Every ch1–4 layer is at autoAlpha 0 (unchanged). | WP8 reducer | — |
| 1880–1900 | The follower's lag cap is 0, so the playhead equals W(s) exactly. | WP1 | — |
| 1900 | **Park state exactly as v2** (camera P8, sweepGain 0, chargeGain 1, dust 0, sphere hidden). Ch5 takes over. | — | — |
| ≥ 1900 | The dock keeps its pill shape while the cue-off trigger (`Landing.tsx` ≈ 611–630) fades it; the reducer removes `.is-cinema` only once the dock's opacity reads 0 (`gsap.getProperty(dock, "autoAlpha") === 0`, checked per frame, no layout) and re-adds it before the dock becomes visible again on reverse. No pill → square snap at the handoff. | WP8 reducer | — |

---

## 4. Radar field and search effect — technical design

### 4.1 Engine shape after the WP0 split
WP0 splits `PointField.update()` (`three/PointField.ts:552-733`) **and** the construction code (`PointField.ts:226-466`: uniforms, materials, geometry, meshes, instrument wiring, ripple registrations) into owner modules, behaviour-identical. After WP0, `PointField.ts` holds only orchestration: renderer, scene, resize, warm-up scheduling, anchor, `sampleScreenPoints`, pause, render, and the calls below. It is then **frozen: every WP's done-when includes "`PointField.ts` diff = 0"**. Every v3 seam exists after WP0 as a compiling, behaviour-neutral stub, so WP2–WP4 edit only their own modules.

**Typed frame state (`three/field/frame.ts`, WP0):** one object reused every frame, written in call order and read by later drivers. No driver reads another driver's internals.
```ts
export interface FieldFrame {
  vh: number; t: number; dt: number; motion: number;       // motion 0 under reduced motion and ?cx-still
  score: ScoreValues;                                       // every SCORE channel, evaluated once (field/score.ts)
  vel: number;                                              // v2 Lenis-based vel (legacy integrator only)
  pvel: number; pvelN: number; pvelS: number;               // playhead velocity, |normalised|, signed normalised
  base: { pos: Vec3; look: Vec3; up: Vec3; fov: number };   // camlayer.basePose(vh): path + L2 only, before the time layer
  cam: { pos: Vec3; look: Vec3; up: Vec3; fov: number };    // after camlayer.apply (time layer included)
  theta: number; lag: number; betaSP: number; rhoSP: number; // beam.preUpdate (β/ρ from `base`)
  legacySweep: number;                                       // legacy integrator angle (unchanged expression)
  anchor: { x: number; y: number; r: number; visible: boolean };
  focusD: number;                                           // camlayer focus spring
  flowT: number;                                            // sonar driver
  pinned: Int32Array;                                       // ≤ 8 point indices carrying DOM labels/chips: labelsDriver's cursor picks ∪ field.setPinned() from the WP6 chip pool
  textMask: Float32Array;                                   // 4 × vec4 CSS-px rects (setTextMask)
  tier: TierSpec; subStep: number;                          // governor
}
export interface FieldDriver {
  init(k: DriverInit): void;              // called once from the constructor, in the order below
  preUpdate?(f: FieldFrame): void;
  update(f: FieldFrame): void;
  resize?(w: number, h: number, dpr: number): void;
  dispose(): void;
}
export interface DriverInit {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; ord: typeof ORD;
  pu: PointUniforms; baseGeo: THREE.BufferGeometry; dustMat: THREE.ShaderMaterial; extUniforms: ExteriorUniforms;
}
```

**Construction factories (moved by WP0, owned afterwards by the module's WP):**
| Factory | Module | Owner | Moved from |
|---|---|---|---|
| `createPointUniforms()` (the shared `pu`, incl. every v3 uniform created zeroed), `createPointMaterial(pu)`, `createBaseGeometry()` (incl. `aTag` and `aIndex`, zero-filled) | `three/field/sonar.ts` | WP3 | `PointField.ts:226-271` |
| `createDustMaterials(pu)` → `{ dust (v2 path), dustSonar (DUST_SONAR program) }` | `three/field/dustDriver.ts` | WP3 | `:459-466` |
| `createExteriorUniforms()` (`uEchoRim`, marbling, rim hold, zeroed) | `three/field/sonar.ts` | WP3 | `:315` |
| `createBeamMeshes()` → `{ beam, ribbons, legacyWedge, legacyLines }` with their `renderOrder` | `three/field/beam.ts` | WP2 | `:293-297`, instrument wiring `:662-681` |
| ripple registrations from the `RIPPLES` table (`{ vh, at, amp, inward }`, `beats.ts`) | `three/field/ripplesDriver.ts` | WP3 | `:386-389` |
| dust visibility + `uBaseWave` (`:651-656`) and the tier hold / `applyTier` (`:742-753`) | `three/field/dustDriver.ts`, `three/governor.ts` | WP3 | — |
| FOV sum (`fovThud`, `fovWiden`, `fovUniverse`, `fovSeek`, kick) and near plane | `three/field/camlayer.ts` | WP4 | `update()` |
| legacy `sweepAngle` integrator (expression byte-identical) and `beamClock` | `three/field/beam.ts`, `three/field/beamClock.ts` | WP2 | `:568-575` |

| Driver module | Owner | Holds |
|---|---|---|
| `three/field/camlayer.ts` | WP4 | `basePose(vh)` (path, creep, roll, FOV channels), time layer (breath, springs, drift), `apply(cam, f)` used for the main camera **and** `scratchCam` |
| `three/field/beam.ts` + `beamClock.ts` | WP2 | beam angle (time integrator, scroll term, hunt latch with frozen θ_time), beam mesh uniforms, ribbons uniforms, `ringScreen()`, legacy integrator |
| `three/field/sonar.ts` | WP3 | point / sphere-exterior uniforms of the sonar path, echo selection, decoys, capture, lens, DOF, wake chain, flow time, pinned list upload, text mask upload |
| `three/field/dustDriver.ts` | WP3 | dust lifecycle (`ensureDust`, `setDustBudget`, draw range per vh) moved out of `PointField.ts:480-548`, J1 prefix sizing, C4b hold |
| `three/field/labelsDriver.ts` | WP3 | `updateLabels` (cursor labels, sweep-flash, echo chip picks), writes `f.pinned` |
| `three/field/ripplesDriver.ts` | WP3 | fixed ripples from `RIPPLES` (lock amp 0.30, inward 330 → 345) |

Call order inside `update(vh, t, dt)`: score → heartbeat → `camlayer.preUpdate` (base pose) → `beam.preUpdate` (angle, β_SP/ρ_SP from the base pose) → `camlayer.apply(camera)` → anchor → `labelsDriver.preUpdate` (pinned) → `sonar.update` → `dustDriver.update` → `beam.update` (uniforms, ribbons) → sphere/interior/embers (unchanged) → `ripplesDriver.update` → `labelsDriver.update`.

**Draw order (`ORD`, `PointField.ts:89`, set to its final value by WP0):** interior 1, atmo 2, **beam 3**, **ribbons 4** / legacyLines 4, points 5, dust 6, legacySweep 7, embers 8, film 9 (v2: interior 1, atmo 2, lines 3, points 4, dust 5, sweep 6, embers 7, film 8). The v2 meshes keep their relative order, so WP0's pixel identity holds; ribbons and legacy lines are never visible together (`FLAGS.SONAR` picks one). The beam draws before the points, so points sit on the beam. J1 draws: sphere exterior, atmo (when `gateDark` > 0), beam, ribbons, points, dust prefix = 6 (cap 12).

**Shader compilation:** the beam, ribbons, v3 point and `DUST_SONAR` programs compile with `renderer.compileAsync` (KHR_parallel_shader_compile) after the first synchronous v2 frame (`PointField.ts:394-395`); until they are ready the field renders the legacy path and then cross-fades to the sonar over 0.3 s. The Gateway boot (≈ 1.9 s) hides this.

### 4.2 Score channels (`cinema/beats.ts` SCORE, WP0; evaluated generically by `field/score.ts`)
`evalChannel` (`geometry.ts:274-283`) holds the last key forever, so every channel that must return to rest has an explicit return key. Three rules, each a dev assert at build (WP0):
1. **Neutral at park:** every new channel equals its **neutral value** for vh ≥ 1890. Neutral table: `glowTau` 1.6, `ringFade` 1, every other new channel 0. The legacy shader path is what renders at park.
2. **Flat plateaus:** for every SCORE channel (new, `_v3` and v2) and every plateau R1–R7, max − min over the plateau sampled every 0.25 vh is exactly 0. (If a v2 channel already violates this on the baseline, the assert lists it and it is accepted only if the v3-baseline has the identical violation.) Knees therefore sit on plateau edges.
3. **J2 reset at 400:** the J2 transit channels (`seek`, `needle`, `ringTravel*`, `ringMerge`) return to 0 and `ringFade` to 1 over 398–400, while the beam is off and the rings are undrawn, so nothing from the hunt leaks into Ch4 (rings, beam, afterglow).

| Channel | Interp | Keys `[vh, value]` | Neutral | Consumer |
|---|---|---|---|---|
| `sonar` | smooth | [0,1] [368,1] [400,0] | 0 | gate of every J1–J2 point/dust/beam-veil/sphere-skin term |
| `sonarC4` | smooth | [1690,0] [1730,1] [1830,1] [1885,0] | 0 | Ch4 reuse: afterglow + pings only |
| `glowTau` | smooth | [0,1.6] [226,1.6] [300,0.5] [336,0.12] [400,0.12] [401,1.6] | 1.6 | point afterglow τ (rad); veil τ = 0.34·glowTau ≤ 0.544 |
| `seek` | linear | [226,0] [336,1] [398,1] [400,0] | 0 | hunt progress u; searchlight blend `smoothstep(0.2, 0.6, seek)`; rim hold |
| `needle` | smooth | [296,0] [336,1] [398,1] [400,0] | 0 | line end and width |
| `capture` | smooth | [286,0] [350,1] [368,1] [398,0] | 0 | liquid capture |
| `lens` | smooth | [120,0] [220,1] [368,1] [398,0] | 0 | screen-space lensing behind SP |
| `focusSP` | smooth | [200,0] [300,1] [368,1] [398,0] | 0 | focus target mid-field → SP |
| `dof` | smooth | [0,0.35] [220,0.45] [300,1] [368,1] [398,0] [1690,0] [1740,0.4] [1830,0.4] [1885,0] | 0 | CoC scale |
| `flowAmp` | smooth | [0,0.09] [300,0.07] [352,0.05] [368,0.05] [398,0] [1690,0] [1740,0.06] [1830,0.06] [1885,0] | 0 | current amplitude (world) |
| `echoGate` | linear | [0,1] [296,1] [320,0] | 0 | echo wavefronts and echo chips |
| `decoy0/1/2` | gauss | (238, 7, 1) (262, 7, 1) (286, 7, 1) | 0 | decoy flare |
| `dustSonar` | smooth | [0,1] [280,1] [330,0] | 0 | hidden universe |
| `ringTravel3/2/1/0` | smooth | [262,0][318,1] / [272,0][326,1] / [282,0][334,1] / [292,0][340,1], each + [398,1][400,0] | 0 | ring drain |
| `ringMerge` | smooth | [326,0] [342,1] [398,1] [400,0] | 0 | rings 1–3 → ring0 radius |
| `ringFade` | linear | [340,1] [348,0] [398,0] [400,1] | 1 | J2 GL → DOM hand-off (back to 1 while draw = 0) |
| `roll` (deg) | sine | [0,0] [110,−2.2] [230,1.2] [320,2.4] [346,0] [352,0] [1650,0] [1716,−1.6] [1782,0] | 0 | camera roll |
| `fovSeek` (deg) | sine | [226,0] [300,−2] [336,−3.2] [346,−3.2] [352,0] | 0 | FOV |
| `camLean` | smooth | [0,1] [336,1] [352,0] [1700,0] [1740,1] [1830,1] [1885,0] | 0 | position lean, bank, fovKick |
| `camLook` | smooth | [0,1] [336,1] [352,0] [1112,0] [1140,1] [1536,1] [1552,0] [1700,0] [1740,1] [1830,1] [1885,0] | 0 | lookAhead, breathCard, parallax |
| `parallax` | smooth | [0,1] [336,1] [352,0] [1112,0] [1140,0.4] [1536,0.4] [1552,0] [1700,0] [1740,0.6] [1830,0.6] [1885,0] | 0 | cursor parallax gain (J4 = 0; flag `INTERIOR_PARALLAX` off) |
| `breathCard` | linear | [1112,0] [1140,1] [1536,1] [1552,0] | 0 | Ch2–Ch3 time-based look sway (sin on both axes: exactly 0 at t = 0) |
| `driftCard` | smooth | [1112,0] [1140,1] [1536,1] [1552,0] | 0 | Ch2–Ch3 pure-f(vh) look drift (§6.1 L6) |

**Changed keys of v2 channels — published as new, inert `_v3` channels.** WP0 cannot change a v2 channel's keys without changing v2 frames, so it adds: `sweepGain_v3` → [344,1] [352,0] [1700,0] [1740,1] [1850,1] [1900,0] (the beam stays visible until the lock; the C4 part equals v2's; `chargeGain` keeps its own parity keys, unchanged); `ring0_v3..ring3_v3` = v2 keys with the J2 part → [352,1] [352,0] (C4 keys unchanged; J2 hiding is done by `ringFade`); `ticks_v3` = v2 with J2 → [256,1] [296,0]; `cross_v3` = v2 with J2 → [256,1] [290,0]. WP2 switches the consumers; the integrator deletes the unused v2 entries at release (§10.2). Everything else unchanged (`dive`, `soft`, `fieldOp`, `focus`, `warp`, `rimIn`, `embers`, `dawn`, `lit`, `creep`, `fovThud`, `fovWiden`, `fovUniverse`, `dust`, `dustGain`, `labelsGate`, `sweepFlash`, `breathHero`, `breathUni`).

**New time-layer field (`FieldTime`):** `lockPulse` (0..1, tweened by the RIG `lock` act; like `ringBoost`).

### 4.3 The beam (`three/shaders/beam.ts` new; mesh in `three/instrument.ts`; angle in `three/field/beam.ts`) — WP2
**Geometry.** A sector mesh replaces the fan (`instrument.ts:105-115`): 128 segments, apex at the hub **at `INSTRUMENT_Z` = −1** (fixes the 27 px apex parallax at `005-vh80`), radius 12.8. Vertices store a normalised angle `t ∈ [0, 1]`; the vertex shader maps it to the local angle `mix(−uBack, +0.06, t)` with `uBack = min(2.6, 4.6·uTauV)` (the veil at the back edge is ≤ exp(−4.6) = 1 % of peak, and in J2, where τ shrinks, the sector shrinks with it, which cuts the fill cost). The mesh is rotated by θ each frame. `depthTest` on (the beam passes behind the sphere), `depthWrite` off, premultiplied blending (`CustomBlending`, `ONE`, `ONE_MINUS_SRC_ALPHA`).

**Fragment** (`vLocal` = sector-local xy):
```glsl
float r    = length(vLocal);
float lag  = uLag * (r / 12.8) * (r / 12.8);         // spoon lag: the rim trails. uLag = clamp(0.10 + 0.25·pvelS, 0.0, 0.35) rad
float a    = atan(vLocal.y, vLocal.x) + lag;         // signed angle from the (bent) lead line; behind = a < 0, ahead = a > 0
float pxW  = 1.0 / length(fwidth(vLocal));           // px per world unit
float sPx  = a * r * pxW;                            // signed px distance to the lead line
float dpx  = abs(sPx);
float rad  = smoothstep(0.35, 0.9, r) * (1.0 - smoothstep(0.7 * uFadeR, uFadeR, r));
float lineA = (1.0 - smoothstep(0.5*uLineW - 0.5, 0.5*uLineW + 0.75, dpx))
            * rad * (1.0 - smoothstep(uLineEnd - 0.6, uLineEnd, r));
float behind = 1.0 - smoothstep(-0.75, 0.75, sPx);   // AA'd cut: the veil and shade exist only behind the line
float b     = max(-a, 0.0);
float grain = 0.75 + 0.5 * hash(floor(gl_FragCoord.xy / (1.5 * uDpr)) + uGrainT);
float veil  = min(uVeilMax, exp(-b / uTauV) * (0.035 + 0.025 * grain) * rad) * behind;   // ink, never gold; uVeilMax 0.07
float shade = exp(-dpx / 5.0) * 0.10 * rad * behind;                                      // ink shadow behind the line
float inkA  = (veil + shade) * (1.0 - lineA) * (1.0 - textMask(gl_FragCoord.xy));        // uTextMask (§4.4)
gl_FragColor = vec4(uInk * inkA + uGold * lineA, inkA + lineA) * uGain;                   // premultiplied
```
- `uGold = SRGB.gold` (`#cf9b1e`), `uInk = SRGB.ink`. No trailing core, no gold body, no gold halo: the v2 `trailCore`/`trailHalo` (`sweep.ts:50-52`) are gone.
- **No straight edge anywhere.** Ahead of the line the veil is cut by `behind` within ±0.75 px of the line itself, so the only leading edge is the gold hairline (fixes rev 3.0, where the veil stayed at peak up to the mesh's straight edge at +0.06 rad). Behind, `uTauV = 0.34·glowTau ≤ 0.544` and `uBack = 4.6·uTauV` keep the back edge ≤ 1 % of peak. The lag is positive, so the bent line lies at local angle −lag(r) ∈ [−0.35, 0], always inside the sector (rev 3.0 had the sign reversed: the line bent forward and left the mesh beyond r ≈ 9.9 world). On reverse scroll `pvelS < 0` relaxes the lag toward 0 instead of inverting it. `uFadeR = min(12.8, 0.95·halfDiagWorld)` where `halfDiagWorld` is the visible half-diagonal on the z = −1 plane for the current camera (portrait: `min(…, 1.6·halfWidthWorld)`), so the dial-radius arc never shows and portrait never shows a long triangle.
- `uLineW = 1.5 + 0.5·pvelN + 0.75·needle` px; `uLineEnd = mix(uFadeR, ρ_SP + 0.4, needle)`; `uGain = sweepGain_v3`; `uGrainT = floor(t·12)·motion` (static under reduced motion).
- Salience knobs (§11 item 45), in this order, with caps: `uVeilMax` 0.07 → 0.09; afterglow dark 0.85 → 1.0 and glow size 0.55 → 0.8 (§4.4); line width base 1.5 → 2.0 px; ping alpha exponent 0.7 → 0.5.

**Angle (CPU, `three/field/beamClock.ts` + `beam.ts`, WP2; one `BeamClock` class used by both `PointField` and `NullField`):**
- New time integrator `θ_time += dt·(2π/16)·motion` (no velocity boost). It integrates **only while the hunt latch is clear**. The **legacy** `sweepAngle` integrator (`PointField.ts:572`, moved verbatim by WP0) is left untouched and keeps feeding the legacy charge.
- Free: `θ_free(vh) = SWEEP_START + θ_time + 2π·vh/180`, used while the latch is clear.
- Latch: on the first frame with vh ≥ 226 (latch clear), store `δ0 = wrapPi(θ_free(226) − θ_hunt(0))` and freeze θ_time. While latched: vh ≥ 226 → hunt (§3 J2); 222 ≤ vh < 226 → `θ_free(vh)` with the frozen θ_time (equal to the hunt value at 226 mod 2π, so the crossing is continuous both ways). Below 222 the latch clears and θ_time resumes from its frozen value: no jump after any dwell in J2 (rev 3.0 jumped by Δt·2π/16, 112° after 5 s).
- β_SP and ρ_SP are the bearing and radius of SP's projection onto the z = −1 plane along the ray from the **base pose** (`f.base`, no time layer), so the hunt is a pure function of vh once latched.
- `jump(vh)` (§6.2): vh ≥ 226 → latch with δ0 = 0; vh < 222 → clear; θ_time unchanged.
- vh ≥ 400: beam source = legacy `sweepAngle` (Ch4 1690–1900).
- `frameData.sweepBearing` = the displayed θ (HUD AZ, gateway needle `--sweep-bearing`).
- Lag: the points apply the same `lag(ρ)` to their bearing (`φ_eff = φ + lag(ρ)`), so lit points line up with the curved lead.
- `NullField` calls the same `BeamClock.step(vh, dt, motion)`; `beamAngle()` is therefore not a pure function of (vh, t), and the spec no longer calls it one.

### 4.4 Points: the sonar path (`three/shaders/points.ts`) — WP3
All new terms are multiplied by `uSonar = max(sonar, sonarC4)` (echoes, capture, lens, decoys and wake use `sonar` only). At `uSonar = 0` the shader is exactly v2. The sonar terms live behind `#ifdef SONAR` in a separate program variant used only while `uSonar > 0` (the material swaps program at the gate, at vh 400 and 1690/1885 where the terms are 0), so the v2 path never pays for them even if the GPU compiler flattens branches. The dust never uses this variant (§4.5).

| Term | Formula (vertex unless noted) | Notes |
|---|---|---|
| bearing | `φ = aAngle + 0.06·(position.z + 1.0) + lag(length(position.xy))` | volumetric front; `lag` as the beam (§4.3) |
| behind | `b = mod(uTheta − φ, 2π)`; searchlight `bs = abs(wrapPi(uTheta − φ))`; `bb = mix(b, bs, smoothstep(0.2, 0.6, uSeek))` | |
| afterglow | `glow = exp(−bb/uGlowTau)`; `dark = max(resolved, 0.85·glow)`; size ×(1 + 0.55·glow); alpha +0.25·glow | ink develops, no gold |
| charge | `charge = mix(legacyCharge, 0.0, uSonar)` (the legacy gold charge is off in the sonar path) | park uses legacy |
| ping | `ping = 1 − b/0.22` for b < 0.22; sprite ×(1 + 1.4·ping) via `vEnlarge`; fragment ring at `mix(0.16, 0.48, 1 − ping)` of the sprite, 1.2 px wide (fwidth AA), alpha `ping^0.7` | ink ring; **gold (SRGB) only if aSize > 2.91** (top ≈ 9 %; sizes are `1.05 + big²·2.25`, `PointField.ts:436`, so 2.6 would be the top 17 %), and only on T0–T2 (T2: > 3.05, top 5 %) |
| echoes | for i < 6: `crest = exp(−((\|p − E_i.xyz\| − E_i.w)/0.45)²)·A_i`; `p.xy += normalize(p − E_i).xy·0.06·crest; p.z += 0.22·crest; resolved += 0.55·crest; size *= 1 + 0.5·crest` | `uEcho[6]` vec4, `uEchoA[6]`; × `echoGate` |
| flow | `p += A·curl(p, T)` with A = flowAmp·(1 + 0.6·pvelN) (§4.6) | replaces the per-point jiggle (`points.ts:82-84`) in the sonar path |
| capture | `q = p − SP; d = \|q\|; f = capture·exp(−(d/2.6)²); d' = d > R_m ? mix(d, R_m + (d − R_m)·0.30, f) : d; q' = rotate(q, uViewDir, 1.1·f); p = SP + normalize(q')·d'; vCap = f·exp(−((d' − R_m)/0.12)²)` | R_m = 0.63; never inside 0.95 R_m; meniscus beads dark +0.6, size ×(1 − 0.25·vCap) |
| radial focus | alpha ×(0.55 + 0.45·exp(−(d/3)²))·capture + (1 − capture) | replaces flat `fieldOp` .6 in the sonar path |
| lens | screen space: points with depth > \|cam − SP\| within 1–2.2 r_px of the anchor are pushed outward ≤ 5 px (`uLens = (ax, ay, r, lens)`) | |
| ink bead (frag) | replaces the white-specular imposter (`points.ts:225-234`) while `uSonar·uDive > 0`: core `mix(ink, paper, 0.25)`, meniscus rim `smoothstep(0.32, 0.5, r)` toward inkDeep, paper highlight r 0.08 at (−0.18, 0.2) | `mix(v2Imposter, bead, uSonar)` → J3 glass beads return by 400 |
| DOF | `coc = clamp(uDof·60·\|1/depth − 1/uFocusD\|, 0, uCocMax)` px; size += coc; alpha ×(size0/(size0 + coc))²; edge `mix(0.44, 0.05, coc/(coc + size0))` | `uFocusD` from the WP4 focus spring |
| cursor | dimple: `p` pushed outward in screen space by `9 px·(1 − d/R)²` within `MOUSE_RADIUS`; wake: `+ Σ uWake[k].z·0.06·exp(−d_k²/R²)` along the chain velocity | time layer |
| decoys | attribute `aTag` (0 none, 1–3 decoy index); flare `decoyK`: gold meniscus line ×1.8 size, then (after the peak) alpha → 0.35 ink | one float attribute |
| pinned points | attribute `aIndex` (float) + `uniform float uPinned[8]` (indices of the points carrying a DOM cursor label, echo chip or decoy chip; −1 = empty), 8 comparisons per vertex | a pinned point skips dimple, wake, lens, echo push/lift and capture swirl/pack; only `flow` moves it, and flow has an exact TS mirror (§4.6). Its colour/size terms (afterglow, ping, DOF, decoy flare) still apply. Leaders stay within 1.5 px. |
| text mask (vertex + frag) | `textMask(xy) = max_i (1 − smoothstep(0, 12, sdRect(xy, uTextMask[i])))` over 4 rects (CSS px × DPR) | multiplies the afterglow darkening, ping ring alpha and echo darkening by `1 − textMask` (points under Gateway/HUD text keep their v2 resolved ink); same function in the beam (§4.3). Rects are 0-area when unused. |

Colours: the sonar path keeps v2's displayed ink (the `LINEAR` uniforms as today) for every ink term, and uses `SRGB.gold` for every gold term. The gate never shows a hue seam.

### 4.5 Hidden universe (dust prefix) — WP3
- **Own program.** The J1 prefix is drawn by a separate `DUST_SONAR` program (`#define DUST_SONAR`): it computes only the afterglow reveal (`vReveal = uDustSonar·exp(−b/1.0)·0.55`, b from the dust's own `aAngle` + 0.06·(z+1) + lag) plus, on T0 only, the flow offset; no echoes, capture, lens, DOF, wake or v2 dust wave. Colour ink, alpha 0.22, size 1–1.5 px × DPR; the fragment discards at `vReveal ≤ 0.001` (`points.ts:209`), so the cost is vertex-bound. It shares the dust position buffer (no second copy).
- **C4b dust stays on the v2 dust program** (plus nothing): its budget is timed at warm-up with the v2 program and C4 uniforms, so the C4b universe is never thinner than v2's.
- **Prefix size from measured cost.** At warm-up the dust driver times the `DUST_SONAR` program on 8k points (GpuTimer, 3 samples, median) and sets `prefix = min(24,000 T0 / 12,000 T1, dustBuilt, floor(1.0 ms / costPerPoint))`; T2, T3 and mobile: 0. The draw range is set only on change.
- `uDustSonar = dustSonar·ready·prefixAlpha`, where `ready` fades 0 → 1 over 0.8 s once the post-boot warm-up has built the dust (`PointField.ts:487-497`; never built earlier, boot budget unchanged) and `prefixAlpha` ramps over 0.3 s whenever the governor cuts or restores the prefix (§4.9), so a cut is never a pop.
- The dust prefix is the **first** governor cut (§4.9). The v2 rule "never change tier while the dust is visible" (`PointField.ts:742-753`) applies only to the C4b universe, never to the J1 prefix.

### 4.6 The current (`three/flow.ts`, GLSL chunk + exact TS mirror) — WP3
```
w = p.xy·0.42
ψ = sin(0.83w.x + 0.31w.y + 0.9T) + 0.6·sin(−0.41w.x + 1.13w.y − 0.7T + 1.7) + 0.35·sin(1.7w.x − 1.4w.y + 1.3T + 4.1)
v = (∂ψ/∂y, −∂ψ/∂x)·0.5                   // divergence-free
p.xy += A·v;  p.z += A·0.4·ψ
```
`T` is integrated on the CPU (`T += dt·(1 + 2·pvelN)·motion`), `A = flowAmp·(1 + 0.6·pvelN)`. The TS mirror `flowOffset(p, T, A)` (unit test: TS vs GLSL readback on 64 points, max error < 1e−5 world) is applied by the CPU readers to the ≤ 8 pinned points (the only GPU displacement they receive, §4.4) and the 12 echo sources, so leaders stay within 1.5 px. `sampleScreenPoints` (C2a chip origins, sampled once at vh 1000) runs where `flowAmp` = 0 and every camera look term is 0 (888–1112, §6.1).

### 4.7 Ribbons: rings, ticks, crosshair (`three/ribbons.ts` + `shaders/sweep.ts` LINE_* → RIBBON_*) — WP2
- **One draw call.** Rings: 4 × 192 quads with attributes `(aTheta, aSide ±1, aKind, aT)`. 60 ticks and 2 crosshair arms as capsule quads in the same mesh.
- **Vertex:** for ring i, `c_i = mix(hub, SP, travel_i)`; plane normal `n_i = normalize(mix(ẑ, normalize(camPos − SP), travel_i))`; radius `r_i = mix(R_i, rT_i, travel_i)` then `mix(r_i, rT_0, ringMerge)`; wobble `r_i(θ)·(1 + 4t(1−t)·(0.035 sin(2θ + p_i) + 0.025 sin(3θ + q_i)))` with t = travel_i; G2 shock wobble (§3 G2). Each vertex is projected twice (θ and θ + ε) to get the screen tangent; it is extruded in clip space by `0.5·width·aSide` px (width 1.25 CSS px × DPR, 1.5 at merge and on mobile).
- `rT_i` (world) = `(anchor.r + 14 + 6i)·d/f` computed on the CPU each frame (d = |cam − SP|, f = focal length in px), so the arrived ring matches the DOM reticle radius `anchor.r + 14`.
- **Fragment:** analytic AA across the ribbon (`1 − smoothstep(0.5w − 0.5, 0.5w + 0.5, |side|·0.5w)`), draw cut `aT > draw` with a 1.5 px soft round tip (`fwidth(aT)`), base alpha as v2 (`uBase`), gold mix from `ringBoost` and `lockPulse`, × `ringFade`.
- **`field.ringScreen(i) → { x, y, r, visible }`** returns the CPU projection of the same centre and radius in CSS px (used by RIG for the hand-off assert and by the NullField from the anchor).
- G2 contract kept (§3 G2). At park everything is undrawn.

### 4.8 Sphere exterior, rimIn, ripples — WP3
- **Skin:** `skin = mix(v2Veins, marbling, sonar)` (the J1–J2 `sonar` channel only, never `sonarC4`). The v2 veins `sin(N.x·22)·cos(N.y·18)` (`sphere.ts:119-121`) stay the skin whenever `sonar` = 0 (from vh 400 on, and in Ch4); in J1–J2 they cross-fade to suminagashi marbling: `m = sin(19·length(N.xy + 0.14·vnoise(N·2.1 + 0.02t)) − 0.15t·uMotion)`, mixed at 30 % on the dark body with the same `core·(1 − 0.7·uGateDark)` fade. Light on dark only.
- **Rim flash:** `+ uRim·pow(1 − nv, 3)·1.2·uEchoRim` with `uEchoRim = exp(−b_SP/0.3)·sonar`; while `seek > 0.85` the rim holds at `(0.6 + 0.4·beat)·sonar` (0 by 400, so it never reaches J3's contact).
- `uNear`, the contact frame, `INTERIOR_FRAG` and the dawn are untouched.
- **rimIn radial** (flag `RIMIN_RADIAL`, default **off**; the v2 superellipse ships): with the flag on, `domeColour` replaces `s = pow(pow(q.x,4) + pow(q.y,4), 0.25)` (`sphere.ts:62-64`) by `s = length((fc − c)/c·vec2(1.0, 0.92))`.
- **Ripples** (`ripples.ts`, registrations from the `RIPPLES` table): add `inward: boolean` (radius = (1 − d)·R) and `amp`. Events: inward 330 → 345 at the anchor (420 px); `lock` @345 amp 0.30. Others unchanged.

### 4.9 CPU side, tiers and the governor
**CPU work per frame (sonar path):** echo selection over 12 sources + 3 decoys (`three/sonar.ts`, build-time picks: `big ≥ 0.82`, `1.5 < |xy| < 9`, `z ∈ [−3.5, 1.5]`, one per 30° sector; decoys: 3 large points within ±0.6 rad of β_SP, 2–6 world from SP); upload of the 6 youngest crests with amplitude > 0.02 (`r_i = 2.6·b_i`, `A_i = exp(−b_i/1.1)·w_i`); the wake chain; the flow mirror for ≤ 20 points; the pinned list (`uPinned`, written only on change); `frameData.echoes` for the DOM (`{ x, y, i, kind: "echo" | "decoy", age, reject }`). Debug counters (dev only, read by §11): `crestsLive` (crests with A > 0.02 and their source ids), `pingsPerTurn`, `capInside` (points inside 0.95 R_m).
**`LabelPicker.sync`** (`three/labels.ts:65-110`): stop re-projecting all 2,772 points every frame. Project only the 12 × 8 bin under the cursor, padded by 12 px plus the breath and lean amplitude, plus the echo sources. Full re-projection only on resize or a camera move larger than 0.5 px at the screen corners.

**Per-tier table (`governor.ts:103-124` TierSpec gains the new fields):**

| Field | T0 | T1 | T2 | T3 | Mobile (starts T2) |
|---|---|---|---|---|---|
| DPR (unchanged) | ≤ 2 | 1.5 | 1.25 | 1 | ≤ 1.5 (1 at T3) |
| `sonarDust` (hidden universe, cap; actual = cost-sized, §4.5) | ≤ 24,000 | ≤ 12,000 | 0 | 0 | 0 |
| `cocMax` px | 40 | 28 | 16 | 0 | 16 |
| `echoes` uploaded | 6 | 6 | 4 | 2 | 4 |
| `pingGold` | top 9 % (`aSize > 2.91`) | top 9 % | top 5 % (`> 3.05`) | ink only | top 5 % |
| `flow` | 3 waves | 3 waves | 3 waves × 0.8 | 2 waves × 0.5 | 3 waves × 0.8 |
| `wake` (cursor chain) | 5 nodes | 3 nodes | 0 | 0 | 0 (touch drag uses the dimple) |
| `textBlur` (word level) | on | on (≤ 220 px words) | off | off | off |
| `camLean` | on | on | on | off | ×0.6 |
| embers / warp / dust (unchanged) | 240 / on / full | 160 / on / 15k | 120 / off / 0 | 80 / off / 0 | 80 / off / 0 |

**Two mechanisms, kept apart.**
1. **Tiers (T0–T3, v2 `Governor`, `governor.ts:103-124`)** bundle DPR, C4b dust, embers and warp, as v2. Their v2 thresholds (`SLOW_MS` 18, `GPU_BUDGET` 9) stay. A tier change that alters **DPR** (a canvas resize) is applied only while the playhead sits on a rest plateau, in the Gateway, or while the field is hidden; otherwise it waits (`tierPending`). The v2 "hold while dust is visible" rule now means the C4b universe only.
2. **Sub-steps (new, `subStep` 0–8, uniform-only, no rebuild, applied within 1 frame with a 0.3 s alpha ramp where visible)**, in this order: (1) hidden-universe prefix → ½ → 0; (2) word blur off; (3) `cocMax` 40 → 28 → 16 → 0; (4) echoes 6 → 4 → 2; (5) gold pings → ink only; (6) flow × 0.5; (7) cursor wake chain off; (8) camera lean off. **Never degraded:** beam, afterglow, follower, dilation, dock, glyph opacity/y.
   - **Refresh-relative judder rule:** the governor measures the median vsync interval `I` over the first 120 frames (6.06 ms on the 165 Hz reference panel). If ≥ 25 % of the last 30 frames exceed 1.5·I, advance one sub-step (at most one per 0.5 s). After 10 s with < 5 % such frames, step back one. This sees judder on high-refresh panels that the 18 ms / 9 ms tier thresholds cannot see (v2 C4b already drops 38 % of frames at p50 6.1 ms).
   - Sub-steps are per-session state and never persist.
**Text tier (CPU-bound, A's fallback):** measured on the glyph writer's own cost, not on total JS time. `clock.ts` (WP1) times the `FrameOrder.Glyphs = 31` callback each frame and exposes `ctx.perf.glyphMs` (rolling 60 live frames); WP5 consumes it. Trigger: writer p95 > 1.5 ms on fine pointers / > 3.0 ms on coarse pointers over 60 frames in which at least one block is live. Then blocks that have not started switch to word mode and blur stays off; live blocks finish as they are. The trigger is checked only between blocks, never mid-pour. Mid-range phones at today's CPU×4 cost (writer ≈ 1.0 ms) stay in glyph mode (§11 item 46).

### 4.10 Reduced motion and NullField
- **Reduced motion:** `renderStatic` (`PointField.ts:1060-1067`) calls update with motion 0. The beam is frozen at `SWEEP_START` with its static afterglow and hairline; no grain re-seed, pings, echoes, flow, dust prefix, capture, wake, springs, drift or roll. No follower, dilation or snap (no tracks). Every DOM shape has a static reduced-motion state (§7, including the `dossier.css:758-770` static copies) that is already liquid (r 18 panels, pills, round range mark).
- **NullField** (`three/NullField.ts`, WP2): implements the new API (`ringScreen` from the anchor: `{ x, y, r: anchor.r + 14 }`, `setPlayhead` no-op, `setTextMask`/`setLabelChip` no-ops, `frameData.echoes = []`, `time.lockPulse` ignored). **Required** CSS beam `.cx-null__beam` (host element created by WP0 in `Cinema.tsx`, styles in `three/nullBeam.css`) over 0–352: a static conic gradient (ink 6 % → transparent over 90°) plus a 1.5 px gold line, rotated by `transform` from the shared `BeamClock` (§4.3), never by animating the gradient; it fades with `sweepGain_v3`. Without it, no-WebGL users would get no search effect at all. Reduced motion: frozen at `SWEEP_START`. `R_FALLBACK` unchanged. No labels.

### 4.11 Rejected for v3 (with reasons)
FBO/feedback phosphor and GPGPU particles (not reversible with scroll, §7.10 no textures, CPU readback stalls); C's 24k non-company flock and constellation filaments (vetoed: they are not companies and imply a relationship graph); bloom and refraction lenses (gold wash / "no glass"); the bow wave (first scope cut, dropped); B's spiral bend beyond 0.35 rad.

---

## 5. Liquid text system

### 5.1 Markup (`cinema/MaskWords.tsx`, WP5)
`MaskWords` gains `split?: "words" | "chars"` (default `"chars"` in the cinema). Output for `split="chars"`:
```html
<p class="…">
  <span class="cx-sr">Nenhuma base pública declara esse faturamento.</span>   <!-- real text, visually hidden -->
  <span class="cx-mwv" aria-hidden="true">
    <span class="cx-mw" data-i="0">                    <!-- untransformed box: respiro, RIG, dossier still measure it -->
      <span class="cx-mw__i">                          <!-- word mover (word-level blur / colour / layer), position: relative -->
        <span class="cx-mw__w">Nenhuma</span>          <!-- whole word, kerned, IN FLOW: always gives the box its size -->
        <span class="cx-mw__g">                        <!-- position: absolute; inset: 0 — takes no width -->
          <span class="cx-ch" style="left: 0px">N</span> …   <!-- position: absolute at the kerned x -->
        </span>
      </span>
    </span> …
  </span>
</p>
```
- `.cx-mw` becomes `overflow: visible` (`base.css:56-63`); the `padding-bottom/margin-bottom` hack goes.
- **Stacking:** `.cx-mw__w` stays in flow and always sizes the word (so a word never takes double width). `.cx-mw__g` is `position: absolute; inset: 0` over it. Each `.cx-ch` is `position: absolute; left: x_j` where `x_j` is the **kerned** x of character j inside the word, measured once per refresh with `Range.getClientRects()` per character through `ctx.rects` (no per-frame reads). A character whose rect has zero width (ligature continuation, e.g. Playfair "fi"/"fl") is merged into the previous cell, which then holds the cluster's text. Glyphs therefore sit exactly where the kerned word draws them, and the rest swap moves no glyph (≤ 0.25 px, subpixel rounding only).
- **Rest swap:** the writer shows the glyph layer only while the word's progress p ∈ (0, 1) and the word layer at p = 0 (hidden) and p = 1 (settled). The swap uses `visibility` (and opacity on the glyph layer) only, never `display`, so it never triggers layout.
- **Lazy measurement:** glyph geometry (≈ 790 glyph cells) is measured after the Gateway's 90-frame boot verdict, in idle chunks of ≤ 4 ms (`requestIdleCallback`, 100 ms timeout), block by block in timeline order; a block not measured yet when it goes live renders in word mode (it never waits). Refreshes re-measure the same way. Cost ≈ 2–4 ms total at CPU×1, 10–15 ms at CPU×4, never inside the boot sample.
- **DOM size:** ≈ 3,900 nodes in the cinema (v2: 1,776); glyph cells carry no listeners and no per-glyph `will-change`.
- `.cx-sr` replaces the `aria-label` on generic spans (not reliably announced). Visible copy and `.cx-sr` are generated from the same string (unit test: concatenated glyphs, the joined words and `.cx-sr` are byte-identical to `copy.ts`).
- **Reduced motion and word mode:** the glyph layer is not rendered at all (`.cx-mw__w` only), and the CSS final state is the readable state, so reduced motion needs no JS.
- `renderExtra` (redaction bars) keeps working.

### 5.2 Engine API (`cinema/type/glyphs.ts`, `cinema/type/grammars.ts`, WP5; stub with word-level behaviour shipped by WP0)
```ts
export type Grammar = "ink" | "light" | "evaporate";
export interface GlyphBlockSpec {
  id: string;
  root: Element;                       // a MaskWords root (split="chars")
  grammar: Grammar;
  from: number; to: number;            // master vh (scrubbed, pure f(vh))
  order?: "bleed" | "ltr" | "rtl";     // default: ink "bleed", light "ltr", evaporate "rtl"
  glyphDur?: number;                   // vh per glyph (ink 8, light 18, evaporate 8)
  wordRiseMin?: number;                // vh, default 10 (floor; asserted)
  blur?: boolean;                      // word-level blur (desktop T0/T1, words ≤ 220 px)
}
export interface GlyphEngine {
  scrub(spec: GlyphBlockSpec): void;                          // registers a block on the glyph writer
  play(root: Element, g: Grammar, o?: { dur?: number; stagger?: number; delay?: number }): gsap.core.Timeline; // time-based variant
  cells(root: Element): GlyphCells;                           // low-level, for custom writers (respiro, HUD, chips)
  readonly mode: "glyph" | "word";                            // CPU text tier (§4.9)
}
export interface GlyphCells {                                  // write-on-change cells (respiro.ts:84-112 pattern)
  words: Array<{ el: HTMLElement; glyphs: HTMLElement[]; x0: number; w: number }>;
  setWord(k: number, p: number): void;                         // layer swap at 0/1
  writeGlyph(k: number, j: number, y: number, op: number, rot?: number, skew?: number, rgb?: number): void;
  writeWordBlur(k: number, px: number): void;
}
```
- **Writer** (`FrameOrder.Glyphs = 31`, after Labels 30): each frame it evaluates every block whose window `[from − 1, to + 1]` intersects `[min(prevVh, vh), max(prevVh, vh)]`, so a block crossed in one big step (scrollbar drag, dock flight, lag-capped fling) still gets its terminal state written. On `playhead.jump()` and `settle()` it writes every block once. It writes only changed glyphs (transform + opacity, quantised to 0.05 px / 0.004). Layer promotion (`will-change: transform, opacity`) per **word**, only while live, at most 8 words at once. Never per glyph.
- **Write cap: 140 glyph writes per frame** (dev assert; the measured peak is 139 at vh 1186–1200). Over the cap, the writer first collapses blocks whose words are all at q ≤ 0.02 or ≥ 0.98 to their word layer (1 write per word), then defers the remaining glyph writes round-robin to the next frame (the state is pure f(vh), so a one-frame defer is invisible). The assert logs any frame that needed a defer.
- Glyph x positions for the bleed order and `x0/w` are read **once per refresh** via `ctx.rects` (no per-frame layout reads).
- The master timeline no longer holds per-glyph tweens: text blocks are frame-writer driven (pure f(vh)), like the respiro writer today. Panels, plates and boxes stay as master tweens.

### 5.3 Grammars (glyph g, local progress q ∈ [0, 1])
| Grammar | Opacity | Transform | Blur (word level) | Order | Where |
|---|---|---|---|---|---|
| **INK** (paper) | `cx-ink-bloom(min(1, q·1.6))` | y `0.32em·(1 − cx-ink-settle(q))`; skewX `−7°·(1 − s)`; rotate `ρ_g·(1 − s)` with ρ_g seeded in ±3°, origin `0 100%` | 4 → 0 px, `cx-ink-dry`, desktop T0/T1, word ≤ 220 px | **bleed front in reading order:** `d_g = ((x_g + 0.35em·valueNoise(x_g, y_g)) / lineWidth_L + 0.65·L) / (1 + 0.65·(nLines − 1))`, L = the glyph's line index (from the refresh measurement). Each line fills like ink running along wet paper, and line L+1 starts only when line L's front is 65 % across | every scrubbed paper text block |
| **LIGHT** (dark) | `cx-ink-bloom(min(1, q·1.4))` | y `0.32em·(1 − cx-ink-settle(q))` only | the existing word blur 6 → 0 (`respiro.ts` BLUR_MAX, ≤ 220 px) | ltr inside each word: glyph j over `[a_k + j·6/(n_k − 1), +18]` | respiro only; colour HOT → COOL **per word** as v2 (per glyph only with `RESPIRO_GLYPH_COOL`, default off) |
| **EVAPORATE** | `1 − cx-evap(q)` | y `−0.22em·cx-evap(q)` | 0 → 3 px (T0/T1) | rtl (the line dissolves from its end); block ≤ 16 vh | every exit |
| time variants | same curves | same | off | same | gateway (0.9 s, 18 / 12 ms stagger), Gateway cue (0.5 s), dock verb (in 220 ms / 8 ms; out 140 ms / 6 ms), tag at the lock (300 ms), echo / decoy chips (in 240 ms, out 160 ms), sweep-flash labels (in 160 ms, out 160 ms), HUD count |

Text never overshoots. Mobile (≤ 720 px or coarse pointer): opacity and y only (no skew, rotate or blur), glyph stagger floor 0.5 vh.

### 5.4 Block mapping (every text block in 0–1900)
| Block | File | v2 technique | v3 grammar and window (master vh) |
|---|---|---|---|
| Gateway title / line | `Gateway.tsx:281,286` | word window / block fade | INK time variant, 0.9 s |
| Gateway cue "mova o cursor — o campo responde" | `Gateway.tsx:288` | 0.4 s fade | INK time variant, 0.5 s |
| Gateway exit | `Gateway.tsx:449` | y −12, 35 ms | EVAPORATE time, 260 ms |
| HUD "AZ ###° · varredura ativa" | `ch1/hud.ts:22-39` | linear y −8, 30–70 | EVAPORATE 30–62 |
| Onboarding "Role para baixo" / "A jornada segue…" | `guide/machine.ts:520-548` | y 16 → 0 | INK time 300 ms; Flip out unchanged |
| Cursor labels / echo chips / decoy chips | `ch1/labels.ts`, `landing.css:188-245` → `ch1/labels.css` | `textContent` hard swap | INK time in, EVAPORATE out; value/redacted layers cross-fade (no hard swap); decoy strike line. Pools: cursor `POOL = 4` (unchanged), chips `CHIP_POOL = 4` (§3 J1). Echo: full name, value full if `strength > LABEL_VALUE_MIN_STRENGTH` else redacted; decoy: full name, value always redacted, struck. Full names: no `max-width`/ellipsis (today 5 of the 12 `COMPANY_NAMES` are cut, e.g. "CASA SERENA ALIMENT…" in `fix/cap390/001-vh0.png`); the CSS `transition: opacity .22s` on `.lp-label` is removed (the JS owns in/out) |
| Ch4 sweep-flash labels (C4c 1720–1800) | `ch1/labels.ts:12-17`, `labelsDriver` | 160 ms fades, square chip | pill chip; INK time in 160 ms, EVAPORATE out 160 ms; always redacted; same 400 ms cadence and 900 ms life |
| Target tag | `rig/rig.timeline.ts:324-334, 657-662` | rectangular clip wipe | INK time 300 ms at the lock, on an ink capsule plate |
| Respiro (light copy) | `ch1/respiro.ts:282-315` | y 110 % in a hard mask, per word | LIGHT, same word windows |
| Respiro ink twin (J6) | `respiro.ts:325-357` | dolly + fade at s 1.2–1.6 | dolly unchanged + EVAPORATE 778–800 |
| Desc / label / eyebrow / caption | `dossier.timeline.ts:598-608` | maskRise / capmask | INK, same windows (840–870); eyebrow and caption reels feathered |
| "estimado" | `:604, :649` | clip wipe 1200–1216 | INK 1216–1232 |
| Rev-note | `:612, :648` | linear clip wipe 1118–1132 | INK 1086–1100, Playfair italic; EVAPORATE 1186–1196 |
| C2 close lead / sub | `:618-643` | maskRise, 5 vh/word sub, drop | INK 1110–1134 / 1126–1150; EVAPORATE 1186–1198 |
| Amount "R$ 24,3 mi" | `:652-653, :763, :883` | linear sharp/soft cross-fade | sharp copy behind a feathered mask that tracks the scan (`cx-flow`) |
| Range ends | `:657-658` | maskRise | INK 1442–1466 |
| Seal | act @1475 | autoAlpha box | pill stamp, act unchanged; text unchanged |
| C3 close lead / sub | `:661-679` | rise from horizon, drop | INK 1494–1522 / 1514–1540; EVAPORATE 1590–1602 |
| Ch4 label | `ch4.timeline.ts:45-57` | maskRise 7 vh/word | INK 1660–1676 |
| Odometer | `ch4/Reels.tsx`, `ch4.css:91-101` | hard reel windows | reels unchanged; feathered windows; weight settle 640 → 500 in `countSettle` (T0/T1) |
| Ch4 close lead / sub | `ch4.timeline.ts:134-151` | maskRise, 5.4 vh/word, y −32 exit | INK 1762–1776 / 1770–1782; EVAPORATE 1848–1862 |
| Pinned "R$ 24,3 mi" | `dossier.css:655-662` | square chip | pill chip; out 1800–1812 `cx-evap` |
| Dock verb | `guide/machine.ts:178-251` | y −4 blur 2 / rk-settle | EVAPORATE / INK time variants; the visual width springs on the compositor (clip-path, §1.2); the slot never resizes |
| Rail labels | `guide.css:398-409, 658-673` | hard reel window | feathered window; colour tan |

### 5.5 Fonts
- **No global font import.** `src/landing/main.tsx` keeps exactly its three Plex Mono imports (300/400/500, `main.tsx:7-9`). A global `600.css` would give every `var(--f-mono)` rule at weight 600/700 a real face instead of today's synthesized bold, changing glyphs and advances in Ch5–Ch8 (`.ch5-eyebrow`, `.ch5-card__badge`, `.ch5-toggle__save`, `.ch6-*`, `.ch7-*`, `.chsig-eyebrow`, `.ch8-eyebrow`, auth/historia/legal modals).
- Instead, `cinema/tokens.css` (WP0) declares a **cinema-only alias**:
  ```css
  @font-face { font-family: "Plex Mono Cx"; font-weight: 600; font-style: normal; font-display: swap;
    src: url("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2") format("woff2");
    unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }  /* copied from @fontsource/ibm-plex-mono/600.css:48 (latin) */
  ```
  (the woff2 exists at `node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2`; Vite resolves the bare import in `url()`).
  and only these cinema selectors use `font-family: "Plex Mono Cx", var(--f-mono)`: `.cx-dos__eyebrow` (`dossier.css:116`), `.cx-dos__caption` (`:152`), `.cx-dos__seal` (`:492`), `.lp-label-val` (`landing.css:238-242`, moving to `ch1/labels.css`), `.cx-ch4__eyebrow`. This removes their faux bold (+15.6 KB woff2, fetched only when one of them renders). Nothing outside the cinema references the alias (grep in §11 item 6).
- `.cx-dos__revnote` switches from synthesized Inter italic (`dossier.css:384-388`) to Playfair italic (already loaded; no download).
- No other font change. Playfair has only `wght`; weight is animated only in the fixed-width odometer cells.

### 5.6 Contrast (WCAG AA) — WP0 defines the tokens in `cinema/tokens.css`; each WP applies them to its own files
| Text | v2 | v3 rule | Ratio |
|---|---|---|---|
| Close subs (gold-editorial `#9a6f0c`, 500 italic, ≤ 20.3 px) | 4.29:1 ✗ | desktop: font-size ≥ 24 px (large text) keeps gold-editorial; ≤ 720 px: `--brown-deep` | ≥ 3:1 large / ≥ 7:1 |
| Gateway `.gx-em` (16–22.7 px) | 4.29:1 ✗ | tan `#8b6a3d` on clean paper: the Gateway text block is `uTextMask` rect 0, so no veil (tan under the 7 % veil would be 4.11:1) | 4.72:1 |
| Gateway title / phrase / cue | on the field | unchanged colours; inside `uTextMask` rects 0–1 | as v2 on clean paper |
| HUD (10 px tan, 11 px brown-deep, no plate, 0–62) | on the field | inside `uTextMask` rect 2 | tan 4.72:1, brown-deep ≥ 8:1 |
| Inactive rail labels `rgba(139,106,61,.6)` 8.5 px | ≈ 2.3:1 ✗ | solid tan `#8b6a3d` | 4.72:1 |
| Echo/cursor chip names | tan on the field | **brown-deep** on a paper plate **α ≥ 0.98**; values ink; redacted runs on ink capsules (tan on an α 0.94 plate over an ink bead was 4.19:1) | ≥ 8:1 worst case |
| Tag | ink on bare field / white on dark | paper text on an ink capsule α 0.92 | ≥ 12:1 |
| Closes, Ch4 panel/close | boxes | opaque paper panels r 18 (clarity veto: never unboxed over moving GL) | as v2 |
| Respiro light words | ≥ 14:1 | unchanged | ≥ 14:1 |
| Dock (paper / on dark) | ok | unchanged colours; inversion cross-fades over 220 ms (`cx-flow`) instead of a 120 ms linear flip | ≥ 7:1 |

### 5.7 Guidance during reading (dock rules) — WP8
Computed with `scratchpad/work/v3dir/rev/dwell31.cjs` (desktop; touch within 1.5 vh).
1. **Read windows** are D2, D4, D7 and D9 (`Dwell.read = true`, exported by `cinema/dilation.ts`). Each contains exactly one rest (R2, R4, R6, R7).
2. **Lead start:** the rest's imperative (`RESTS[].verb`, unchanged copy) with the breathing chevron starts at `max(W(s(R.at) − 30), the last act before R)`: R1 345 (the `lock` act; `s − 30` alone would give 337.8, before the lock), R2 645.0, R3 856.5, R4 1152.3, R5 1375.5, R6 1552.0, R7 1783.0 (`countSettle` 1752 is earlier).
3. **Lead end:** outside read windows (R1, R3, R5) the lead ends when the playhead leaves the plateau, as v2. Inside read windows it holds past the rest until the **meter end**: D2 → **673** (the R2 plateau end: J5's gerund "iluminando a empresa" then shows as v2, so every `VERB_SEGMENTS` gerund is still shown), D4 → 1186, D7 → 1590, D9 → 1848 (the text breaks). After the meter end the current `VERB_SEGMENTS` gerund resumes for the rest of its segment.
4. **Precedence:** the back verb ("voltando · ⟨Estação⟩") always wins while direction < 0 and |v_playhead| > 2 vh/s, also inside a lead or a read window. The 1.2 s floor (rule 5) yields to a reversal at once.
5. **Minimum visibility:** once an imperative is shown it stays ≥ 1.2 s (time-based), unless the user reverses.
6. **Reading meter:** inside a read window, `.cx-guide__meter` (a capsule inside the pill, ink 8 % on paper / paper 14 % on dark, `transform: scaleX(m)`, origin left) shows `m = clamp01((s − s(full)) / (s(end) − s(full)))` with `full` = the window's text settled (D2 617.6, D4 1150, D7 1540, D9 1782) and `end` = the meter end of rule 3. It is shown from `full` to `end` (and therefore reaches exactly 1 as the text leaves; it never vanishes part-filled) and fades in/out over 160 ms. Meter spans at 35 vh/s: D2 2.4 s, D4 3.9 s, D7 5.1 s, D9 7.6 s. The ring keeps its v2 meaning (beat progress, full at rests).
7. **No nagging:** inside a read window `idleMid` ("continue rolando", `machine.ts:112, 695`) never fires; the rest nudge cadence rises from 1.6 s to 6 s.
8. **Never blank:** the swapper keeps the previous verb until the new one is measured; on-dark inversion only changes colours (fixes vh 380 / 460).
9. **Velocity source:** the machine reads the playhead's velocity and direction (`ctx.playhead`), not `lenis.velocity`, for transit/landed/back (`machine.ts:683`'s `landV` becomes a playhead threshold in vh/s). Onboarding dismissal still uses real scroll px. The dock flight duration (`machine.ts:832-846`) is computed from the scroll distance in s-vh, `|vhToPx(target) − lenis.scroll| / vhPx`, not from master dvh, so a flight across a dilated window is not rushed.

---

## 6. Camera system

### 6.1 Layers
| Layer | What | Pure f(vh)? | Gates |
|---|---|---|---|
| L0 | Playhead follower (§6.2): the vh everything renders | yes at rest | — |
| L1 | Path: **`CAMERA.seek` for vh < 352**, unchanged `CAMERA.in` for 352 ≤ vh < 1568, unchanged `CAMERA.out` from 1568 | yes | — |
| L2 | Score: `roll`, `fovSeek`, plus `fovThud`, `fovWiden`, `fovUniverse`, `creep`, breath (all v2) | yes | — |
| L3 | Lean (follow-through from path acceleration) and bank | time | `camLean` (0 over 352–1700 and from 1885) |
| L4 | Velocity coupling: fovKick, lookAhead | time | `camLean` (fov), `camLook` (look) |
| L5 | Cursor parallax (look only) | time | `parallax` (J4 = 0; `INTERIOR_PARALLAX` flag off) |
| L6 | Ch2–Ch3 backdrop (look only, GL only): **drift** `driftCard·(0.10·sin(2π·u/420), 0.06·sin(2π·u/560 + 1.1))` world, with the plateau-frozen coordinate `u(vh) = vh − Σ_p clamp(vh − p.start, 0, 16)` over the plateaus p (so u, and the drift, stand still on R4/R5); plus the time sway `breathCard·(0.14·sin 0.09t, 0.10·sin 0.07t)` world (exactly 0 at t = 0) | drift: **yes**; sway: time | `driftCard`, `breathCard` (1112–1552) |
| L7 | Focus pull (DOF focus distance only, not the camera pose) | time | `focusSP` / `dof` |

The interior and J6–C2a (352–1112) and the C4a membrane (1552–1700) carry **no** time-layer or drift term (wow and feasibility grafts; feasibility veto on lean through J3 and the membrane). The camera there is v2's. Over 888–1112 this also keeps the C2a comet origins (sampled once at vh 1000 from the base pose) on their points. From 1112 to 1552 the backdrop answers the wheel (≈ 1° of look, ≈ 20 px at 1440×900, over a 420-vh period) while the text sits on opaque plates that never move.

### 6.2 Playhead follower (`cinema/playhead.ts`, WP1)
```
s       = st.progress · S_END(profile)            // ScrollTrigger geometry only (no animation)
target  = W(s)
lagMax  = 28 · (1 − smoothstep(1840, 1880, target))
Δ = x − target; (critically damped, ω = 8 fine / 11 coarse)
x' = target + (Δ + (v + ωΔ)·dt)·e^(−ω·dt);  v' = (v − ω(v + ωΔ)·dt)·e^(−ω·dt)
if |x' − target| > lagMax: x' = target ± lagMax (v' clamped to the target's rate)
if target ≥ 1880: x' = target, v' = 0
```
- Lag at 40 vh/s ≈ 2v/ω ≈ 10 vh (fine pointer) — gone within ≈ 0.6 s of idle. Notch ripple at 2–3 notches/s drops ≈ 5×.
- **No rate cap** (vetoed): the follower never holds the playhead back beyond its spring lag, and the lag cap only ever *forces* catch-up.
- `jump(vh)`: sets x = target = vh, v = 0, resets every L3–L7 spring and the hunt latch (§4.3), writes `tl.time(vh)`, runs listeners, and tells the glyph writer to write every block once. Called by settle(0|1), teleport, return home, deep links, refresh, Gateway re-entry, profile change.
- **Refresh (the master has no ScrollTrigger of its own any more, so the director replays what `invalidateOnRefresh` did):** on `ScrollTrigger` `refreshInit` store `vh = playhead.vh()`; on `refresh`: `tl.progress(0, true).invalidate()`, then `tl.time(vh, true)` and `tl.time(vh)` (re-evaluates every function-based value: `closeShift()`, `innerHeight·k`), run the listeners, and force one field render even if the playhead is at rest.
- **Determinism:** the rendered state is a pure function of x (L0–L2 and the L6 drift), plus time-layer terms whose targets are 0 at rest and which `jump()` zeroes. Snapping, settling or jumping to a station therefore always lands on the exact composed state of that vh.

### 6.3 Seek path (`CAMERA.seek` in `beats.ts`, WP0; sampled by `three/camera.ts`, WP4)
```ts
seek: {
  points: [[0, 0, 16], [-1.2, 0.78, 13.0], [-0.55, 1.05, 10.0], [0.5, 0.15, 7.3], R1_POSE],
  look:   [[0, 0, 0], [-0.15, 0.1, -0.4], [0.35, -0.18, 0.2], [0.8, -0.45, 0.95], R1_LOOK],
  profile: [{ vh: 0, a: 0, slope: "secant", slopeScale: 0.5 }, { vh: 100, a: { knot: 1 } }, { vh: 190, a: { knot: 2 } }, { vh: 285, a: { knot: 3 } }, { vh: 352, a: 1, slope: 0 }],
}
// ProfileKey (beats.ts:363-368) gains `slopeScale?: number` (multiplies the resolved slope, default 1), WP0.
// R1_POSE / R1_LOOK = CAMERA.in sampled at vh 352 at build: (0.7258, −0.4082, 5.6457) / (0.8114, −0.4522, 1.1176)
```
`CameraRig.pose(vh)` (`camera.ts:88-99`) branches: vh < 352 → seek; else v2. The v2 profile has slope 0 at 352 and the seek profile ends with slope 0 there, so the join is C¹ at zero velocity and J3 stays bit-exact. Computed (1440×900, `scratchpad/work/v3dir/lead/seek.mjs`):

| vh | camera | yaw / pitch | \|cam − SP\| | SP on screen (px) | hub on screen | speed (world/vh) |
|---|---|---|---|---|---|---|
| 0 | (0, 0, 16) | 0 / 0 | 14.84 | 784, 486 | 720, 450 | 0.017 (eases out) |
| 60 | (−0.77, 0.45, 14.40) | 2.6 / −1.5 | 13.34 | 806, 498 | 725, 454 | 0.039 |
| 100 | (−1.20, 0.78, 13.00) | 4.5 / −2.9 | 12.05 | 824, 510 | 728, 455 | 0.034 |
| 160 | (−0.86, 1.07, 10.97) | 5.3 / −5.9 | 10.05 | 810, 508 | 698, 435 | 0.035 |
| 220 | (−0.21, 0.84, 9.09) | 4.8 / −7.4 | 8.08 | 778, 491 | 653, 402 | 0.033 |
| 285 | (0.50, 0.15, 7.30) | 2.7 / −5.4 | 6.15 | 739, 463 | 605, 369 | 0.029 |
| 340 | (0.71, −0.38, 5.74) | 1.2 / −0.9 | 4.54 | 741, 461 | 585, 373 | 0.015 |
| 352 | R1 pose | 1.1 / −0.6 | 4.45 | 741, 462 | 584, 374 | 0 |

At 390×844 the target stays within x 213–293 px (on screen). On portrait the lateral offsets of knots 1–3 are scaled ×0.55 (WP4 builds a second `SplinePath` at refresh for aspect < 1).

**Roll** is applied by rotating `camera.up` about the view axis before `lookAt` (v2 has a fixed up vector). The same `camlayer.apply()` is used for `scratchCam`, so `sampleScreenPoints`, the label picker and the anchor projection see the identical matrix. `roll` is 0 at every rest plateau.

### 6.4 Snap (WP1, `guide/snap.ts`)
- Fires 420 ms after the last wheel event (was 220), only if the mean wheel input over the last 1 s is below 2.0 notches/s (sum of |deltaY| < 200 px/s after normalising `deltaMode`: lines × 16 px, pages × `innerHeight`, so trackpads and Firefox line mode count), and never while the playhead is in a read window's text hold *after* its rest (a reader who stops on a close is never pulled forward).
- **Decision in master and s units:** `landVh = pxToVh(lenis.targetScroll)` (replaces the linear `pxPerVh` at `snap.ts:126-128`); distances are s-distances from `s(landVh)` to the near edge of the candidate's plateau.
- Candidates R1–R7; ahead within **24 s-vh** of the plateau's near edge, any within **6 s-vh** of it. Measuring to the edge (not the centre) lets the dilated rests R4/R6/R7, whose half-plateaus are 30–34 s-vh long, snap too.
- **Motion = retarget:** `lenis.scrollTo(vhToPx(R.at), { immediate: true, force: true })`; the follower glides the playhead (ζ 1, ω 8). No hermite, no double ease-out "dead stop".
- `landed` (guide) requires the plateau **and** |playhead velocity| < 2 vh/s.
- The `GuideBus` fields the snap reads (`phase`, `flying`, `lastDir`, `lastInputAt`) are frozen by WP0, so WP1 (snap) and WP8 (machine) never edit each other's files.
- **Rotation restore** (`Landing.tsx:457-480`, QA M3): store `vh = cinema.pxToVh(scrollPx)` (master vh, not px/innerHeight) and restore with `vh < MASTER_END ? cinema.vhToPx(vh) : plansScrollTarget()`; `CinemaHandle` exposes `pxToVh`/`vhToPx` (WP1). Fixes the touch teleport to the plans after any rotation past master ≈ 1530.

### 6.5 Mobile and reduced motion
Mobile: seek lateral ×0.55, roll ×0.6, lean ×0.6, fovKick ×0.6, drift ×0.6, no cursor parallax, follower ω 11. Reduced motion: none of L0, L3–L7 (no tracks; `renderStatic`).

---

## 7. Shape language: every square element → its liquid replacement

| # | Element | file:line (today) | v2 | v3 | Owner |
|---|---|---|---|---|---|
| A1 | Word masks | `cinema/base.css:56-63` | `.cx-mw { overflow:hidden }` | `overflow: visible`; glyph engine (§5) | WP5 |
| A2 | Eyebrow reel window | `dossier/dossier.css:125-142` | hard 1.25em window | feathered `mask-image` (22 % / 78 %) | WP7 |
| A3 | Caption capmask | `dossier.css:171-178` | hard window | removed; INK pour | WP7 |
| A4 | Rev-note window | `dossier.css:379-389` | hard window + Inter faux italic | removed; Playfair italic INK | WP7 |
| A5 | Gateway logo window | `gateway.css:141-147` | hard window | removed; INK time pour | WP5 |
| A6 | Dock rail label reels | `guide/guide.css:398-409`, mobile `:658-673` | hard windows | feathered windows | WP8 |
| B1 | "estimado" wipe | `dossier.timeline.ts:583, 649` | `inset()` wipe | INK pour 1216–1232 | WP7 |
| B2 | Rev-note wipe | `:585, 612` | linear `inset()` | INK pour | WP7 |
| B3 | Range scale clip | `:588, 656` | rectangle from centre | capsule fill scaleX from centre | WP7 |
| B4 | Tag lock wipe | `rig/rig.timeline.ts:659` | `inset()` wipe | glyph pour on ink capsule | WP6 |
| B5 | Tarja + scan line | `dossier.timeline.ts:763, 883` | inset + vertical line | capsule wipe `inset(… round 999px)` + capsule scan head with gold nib | WP7 |
| B6 | Close horizon clip | `:359` | `inset()` horizon | removed (closes condense in place, evaporate out) | WP7 |
| B7 | Card paper | `:531-537` (radius 0), `holePoly` `:750, 829`, rim ring `:830` | square, evenodd polygons | during the build (802–850): `clip-path: path(evenodd, rounded outer + capsule hole)` for the paper and `path(evenodd, outer r+1, inner r)` for the rim, built in px with arcs; from 850: `inset(… round r)`; pill around the tarja → r 18 (J6); r 18 always; radius-leads collapse (C4a) | WP7 |
| C1 | Respiro redaction bars | `ch1/ch1.css:175-179`, writer `respiro.ts:360-425` | flat rectangles, 2 px square nib | ink capsules + 5 px gold droplet; stretch/squash in flight | WP6 |
| C2 | Hatched tarja | `dossier.css:330-344` | rectangle | capsule (same token as C1: pixel-identical swap at 850) | WP7 |
| C3 | C2a chips | `dossier.css:595-633`, `chips.ts` | rectangular slugs + 2 px tick, rods | ink comet capsules with droplet heads; round-capped ticks | WP7 |
| C4 | Odometer redaction cell | `ch4/ch4.css:126-134` | rectangle | capsule | WP7 |
| C5 | "███" glyph runs | `copy.ts:26-27, 84` | glyphs | unchanged copy; rendered as `color: transparent` over an ink capsule where they appear in chips and the tag | WP6/WP7 |
| D1 | RIG brackets | `rig/rig.css:32-106`, `Rig.tsx` | 8 rectangular arm divs, square corners | **4 small per-corner inline SVGs**, each placed by `transform` (as today's arms: moving the box never touches an attribute); each holds one path `M0,arm L0,rr A rr rr 0 0 1 rr,0 L arm,0` (mirrored per corner), stroke 1.5, round caps/joins, plus its gold flash path. The `d` attribute is rewritten **only when `rr` or `arm` change** (J2 240–340, J3 368–440, C4a ring, C4d release), never because the box moved. Card mode rr 10 (concentric with the 18 px card, brackets 8 px inside). Over 368–770 rr ≤ 4 with v2 geometry and timing (§1.4 item 7). | WP6 |
| D2 | Onboarding corner brackets | `guide.css:483-512` | square L corners | round-cap quarter arcs rr 12 | WP8 |
| D3 | Reduced-motion referent SVG | `ch4/Ch4Stage.tsx:59` | `strokeLinecap="square"` | `round` | WP7 |
| E1 | Eyebrow container | `dossier.css:110-123` | 1 px box | pill | WP7 |
| E2 | Close panels (+ reduced-motion static copies) | `dossier.css:518-534`; reduced motion `dossier.css:758-770` (`.cx-dos__frame`, `.cx-dos-static__card`: 1 px border, square) | 1 px box r 0 | opaque paper panel r 18; the reduced-motion static card/frame get `border-radius: 18px` | WP7 |
| E3 | Seal | `dossier.css:485-500` | square box | pill stamp | WP7 |
| E4 | Pinned chip | `dossier.css:655-662` | square chip | pill | WP7 |
| E5 | Ch4 panel and close | `ch4.css:50-61, 163-174` | boxes | opaque paper panels r 18 | WP7 |
| E6 | Cursor label / echo / decoy / sweep-flash chips | `landing.css:188-245` (moved verbatim by WP0 to `ch1/labels.css`), box `three/constants.ts:42` | rect chips, 9.5 px name, `max-width: 22ch` + ellipsis, `transition: opacity .22s` | pills on paper **α 0.98** + 1 px inset hairline, name 11 px Plex Mono 500 **brown-deep**, full names (no `max-width`, no `overflow`, no ellipsis), no CSS transition (JS owns in/out), value Playfair 13 px, leader with a round dot. The chip box used by the label picker (`LABEL_CHIP`, `constants.ts:42`) becomes **runtime-measured**: WP6 measures the widest full and redacted pill at refresh (the longest of the 12 names is 28 characters) and calls `field.setLabelChip({ wFull, wRedacted, h, gap })` (WP0 stub; WP3's picker reads it). | WP6 |
| E7 | Dock pill | `guide.css:60`, layers `:121-135` | `border-radius: 0` | `999px` on root, background and edge layers, **scoped to `.lp-scrollcue.is-cinema`**: the reducer sets it while vh < 1900 and phase radar, and at vh ≥ 1900 removes it only once the dock's opacity is 0 (re-adds it before the dock shows again on reverse). Visual width springs via `clip-path` (§1.2). | WP8 |
| E8 | Onboarding card | `guide.css:469-475` | square | r 18; morph into the pill with `clip-path: inset(… round R)` from the card rect (18) to the pill rect (999 → h/2), **no scale** (replaces `Flip.fit(…, { scale: true })`, `machine.ts:548`) | WP8 |
| E9 | Corner CTA `.lp-cta` + `::after` | `landing.css:451-530` | square | **unchanged** (visible in Ch5; clarity veto) | — |
| E9b | Header `.lp-nav` and its buttons | `landing.css` (`.lp-nav*`) | square buttons | **unchanged** (visible in the Gateway and in Ch5; same reason as E9) | — |
| E10 | Rotate card | `guide.css:258-267` | square | r 18 | WP8 |
| E11 | Mobile rail dots | `guide.css:688-703` | squares | 6 px round dots, 1 px gold ring when active (cinema-scoped) | WP8 |
| E12 | Rail needle / dossier needle diamonds (+ reduced-motion range mark) | `guide.css:385-396`, `dossier.css:468-477`; reduced motion `.cx-range__mark { rotate(45deg) }` (`dossier.css:758-770`) | rotated squares | rail: 7 px round dot with 1 px ring (cinema-scoped); dossier range needle: a 1.5 px round-capped stem with a 5 px round head (act unchanged); the reduced-motion mark is the same round head (no rotation) | WP8 / WP7 |
| E13 | Gateway CTA `.gx-cta` | `gateway.css:196-218`, boot `Gateway.tsx:287` | square 50 px brown button; `from(y 16)` | pill (radius 999), same size/colours; boot condenses (opacity, scale .94 → 1, y 10 → 0, `cx-pour`) | WP5 |
| E14 | Gateway CTA armed ring `.gx-cta::after` | `gateway.css:242-262` (`.is-armed`, 3 pings / 7 s), mobile `:344` | square pulsing ring | concentric pill ring, ping kept (scale 1 → 1.14, opacity .55 → 0, `cx-pour`) | WP5 |
| E15 | Emblem rule diamond `.grl__rule-dia` | `gateway.css:175-180` | `rotate(45deg)` square | 5 px round dot | WP5 |
| E16 | Gateway cue `.gx-cue` | `gateway.css:285-318`, `Gateway.tsx:288` | 0.4 s fade | INK time pour (0.5 s); its ring `.gx-cue__ring` is already round | WP5 |
| E17 | Dossier shade `.cx-dos__shade` | `dossier.css:66-77`, writer `dossier.timeline.ts:852-857` | square box-shadow scaled to the card | per-axis compensated radius so the scaled shadow has the card's corners (§3 J6) | WP7 |
| E18 | Tarja halo `.cx-dos__halo` | `dossier.css:346-356` | square 1 px gold ring + 22 px glow | `border-radius: 999px`, concentric with the capsule tarja | WP7 |
| F1 | Linear scrubs on visible elements | HUD exit `hud.ts:39`; rev-note `:612`; halo, hatch, sharp/soft `:652-653`; dims `:681-684`; Ch4 panel opacity | `ease: none` | `cx-flow` / `cx-evap` / glyph grammars | WP6/WP7 |
| F2 | Card grow | `dossier.timeline.ts:535` | `lerpRect` + `sineInOut`, radius 0 | `cx-flow`, radius 18 kept | WP7 |
| F3 | Close drops/rises | `:628-643, 661-679`, `ch4.timeline.ts:145-151` | straight y + scale | condense in place / evaporate | WP7 |
| G1 | Hard cuts (≤ 1 vh) | dossier root 790/1852; slot swap 859.99; C2 autoAlpha 1200; C3 1490/1590; Ch4 stage on/off over 1 vh | cuts | the pixel-identical swaps (850, 860) stay (they are invisible by design). The C2/C3 autoAlpha cuts are retired (the closes evaporate). Ch4 stage on/off happens while its content is at 0 (asserted). Light-word 0/1 flip at the dawn front stays (inside the protected J5) | WP7 |
| G2 | On-dark colour flips | `rig.css:39`, `guide.css:129` | 120 ms linear | 220 ms `cx-flow` cross-fade of two layers | WP6 / WP8 |
| H1 | Sweep wedge | `shaders/sweep.ts:29-63`, `instrument.ts:105-115` | flat fan with two hard cores, z 0.5 | sector beam (§4.3) | WP2 |
| H2 | Rings / ticks / crosshair | `instrument.ts:38-95`, `sweep.ts:65-111` | 1-device-px `LineSegments`, linear undraw | ribbons, round tips, drain (§4.7) | WP2 |
| H3 | Sphere veins | `shaders/sphere.ts:119-121` | basket weave | suminagashi marbling **only while `sonar` > 0** (J1–J2); v2 veins from 400 on | WP3 |
| H4 | rimIn frame | `sphere.ts:62-64` | superellipse (TV screen) | radial, built behind `RIMIN_RADIAL`, **default off** (the protected interior keeps the superellipse) | WP3 |

---

## 8. Contracts

### 8.1 Contracts that must not break (verify each in §11)
1. **Master timeline unit:** 1 timeline second = 1 master vh; duration `MASTER_END = 1900`; labels R0–R7 and beat starts; local default `ease: "none"`. Every table (`RESPIRO_T`, dossier `T`, `CH4_T`, `RIG_WINDOWS`, `SCORE`, `R_FALLBACK`, `MARKS`, `ACTS_AT`, `RIPPLES`, chips `DIAL`) stays in master vh.
2. **Settle registry** (`settle.ts`): `settle(0|1)` and `settleScrubbed(dir)` keep their semantics and idempotence. v3 adds a first step to both: `playhead.jump(0 | MASTER_END)` (which also resets springs and the hunt latch).
3. **Acts:** runner, ±0.5 vh hysteresis, 1.6× reverse, `settleActs`. Acts are fed the followed vh.
4. **Rests and snap model:** R0–R7 positions, 16 vh zero-change plateaus (every SCORE channel is flat there, asserted, §4.2; the velocity-driven time layer is 0 because velocity is 0; idle time terms such as v2's breath and v3's `breathCard` sway are frozen under `?cx-still`; dilation does not change content), never snap to R0 or ≥ 1800, snap only on fine pointers with motion allowed, `FLAGS.SNAP` kill switch, `snap.stop()` everywhere v2 stops it.
5. **Dock signalling:** the dock always shows either what is happening (gerund + ring) or what to do (imperative + breathing chevron); aria-live "Etapa N de 8 · …" at rest arrivals only, ≤ 1 per 1.5 s; dock button / Enter / Space advance to the next rest; back verb "voltando · ⟨Estação⟩" (wins over any lead, §5.7 rule 4). v3 adds §5.7; its one behavioural change to v2 is that inside D4/D7/D9 the rest's imperative holds past the rest until the text break, shortening (never removing) the following gerund's time on screen (decided default, §10.3).
6. **`FieldAdapter`:** every v2 member keeps its signature. Additions only (§8.2). `NullField` implements all of them.
7. **Ch5 handoff at MASTER_END:** the master end px is `.ch4-track` "bottom bottom" = `.ch5-track` "top bottom" (the track sum changes; the chaining does not). At s ≥ S_END the playhead is exactly 1900 (lag cap 0 from 1880). Park state at 1900 identical to v2. The reducer stops writing `.lp-nav`, `.lp-footer`, `.lp-cta` and the dock inner at vh ≥ 1900. The cue-off trigger (`Landing.tsx` ≈ 611–630, tween at :622) is unchanged and remains the sole owner of the dock's off state in Ch5; the reducer only removes `.is-cinema` after that fade has reached opacity 0.
8. **Legacy sweep integrator** (`PointField.ts:572` today, including `×(1 + 1.6·vel)` with v2's Lenis-based `vel`) keeps its byte-identical expression wherever it lives (WP0 may move it into `field/beam.ts`); the Ch5 backdrop charge rotates exactly as today.
8b. **Fonts outside the cinema:** no new `@font-face` reaches a non-cinema selector; computed font faces of every Ch5–Ch8 element equal the baseline (§11 item 1b).
9. **Teleport / goToPlans / pending queue / voltarAoPortal / floor / deep links / App phases:** unchanged shapes (v2 §11.3–§11.11). They gain `playhead.jump` only through `cinema.settle`.
10. **Header and the open-access button:** `.lp-nav` markup untouched, including the temporary "Entrar no radar" button (`config?.open_access`, navigates to `/?entrar=…`) and the conditional `--primary` class on "Ver planos". Chrome visibility: visible in the Gateway, hidden from `entering` until 1840, back over 1840–1880 (driven by the followed vh). z-index ladder unchanged (v2 §11.12); new layers (`.cx-guide__meter`, reticle SVG, tag plate) stay inside their existing roots.
11. **Lenis:** one instance, `{ duration: 1.15, smoothWheel: true }`; `lenis.on("scroll", ScrollTrigger.update)`; `lagSmoothing(0)` outside the Gateway. `virtualScroll` is installed only when `FLAGS.WHEEL_VISCOSITY` (default false).
12. **Reduced motion:** no Lenis, no tracks, static sections, every final state readable from CSS alone.
13. **Single writer:** every animated property has one owner; the dev assert extends to the glyph writer (glyph spans), the reticle `d` attributes, the dock clip-path and the shade radius.

### 8.2 Contracts that change, and how
| Contract | v2 | v3 |
|---|---|---|
| Director (`director.ts`) | `scrub: true` ScrollTrigger drives the master; `vhToPx` linear | ScrollTrigger kept for geometry only (same trigger/start/end, **no animation, no scrub**; `invalidateOnRefresh` on a geometry-only trigger does nothing for the master, so the director replays it: §6.2 Refresh); master `paused: true`; `vhToPx(vh) = st.start + Winv(vh)/S_END·(st.end − st.start)`; `pxToVh(px) = W((px − st.start)/(st.end − st.start)·S_END)`; `setProgress` → `playhead.jump`; `CinemaHandle` exposes `pxToVh` and `vhToPx` to `Landing.tsx` |
| Clock order (`clock.ts`) | lenis.raf → (master renders inside ScrollTrigger.update) → vel → field.update → frames → render | 1 `lenis.raf` → 2 `playhead.step(dt)` → 3 `tl.time(vh)` + listeners (acts, guide bookkeeping) when vh changed, and always once after a refresh → 4 `vel` (unchanged formula) and `pvel` → 5 `field.update(vh)` → 6 frames (Anchors 20, Dossier 25, Labels 30, **Glyphs 31** (timed → `ctx.perf.glyphMs`), Guide 40, Reducer 50) → 7 `field.render()` |
| `CinemaCtx` | — | `ctx.playhead: { vh(), target(), s(), velocity(), jump(vh), readWindow(vh) }`, `ctx.glyphs: GlyphEngine`, `ctx.perf: { glyphMs: { p95(): number } }` |
| `FieldAdapter` additions | — | `ringScreen(i)`, `setPlayhead(v: number)`, `frameData.echoes`, `time.lockPulse`, `resetTimeLayer()`, `setTextMask(i, rect \| null)`, `setLabelChip(box)`, `setPinned(indices)` (from the DOM label owner), all stubbed by WP0 |
| `FrameOrder` | 20/25/30/40/50 | + `Glyphs = 31` |
| Tracks | 880/280/400/440 | §2.2 (two profiles, CSS media query) |
| Snap motion | hermite `scrollTo` 0.45–0.7 s | immediate retarget + follower glide; idle 420 ms; rate gate; s-space distances |
| Guide velocity source | `lenis.velocity` | playhead velocity/direction (onboarding dismissal still uses scroll px) |
| Stations | estimativa 1172, universo 1572 | 1198, 1602 (`STATIONS_V3`, consumers switched by WP8/WP7) |
| `sweepGain` J2 keys | [260,1] [350,0] | [344,1] [352,0] (`sweepGain_v3`, consumer switched by WP2) |
| Ring J2 keys | undraw 280–350 | travel/merge/fade (§4.2; `ring*_v3`, `ticks_v3`, `cross_v3`) |
| Flags (`flags.ts`) | — | new, defaults: `PLAYHEAD_FOLLOW true`, `DILATION true`, `TOUCH_DILATION true`, `WHEEL_VISCOSITY false`, `SONAR true` (false = v2 shader path and v2 wedge look), `HIDDEN_UNIVERSE true`, `ECHO_CHIPS true`, `DECOY_CHIPS true`, `GLYPHS true` (false = word mode), `CAM_LIFE true`, `CARD_DRIFT true`, `RIMIN_RADIAL false`, `RESPIRO_GLYPH_COOL false`, `TAG_PLATE true`, `DOCK_LEAD true`, `DOCK_METER true`, `INTERIOR_PARALLAX false`, `J3_ROLL false` (not built; reserved), `ODO_WGHT true` |

---

## 9. Performance budget and test method

### 9.1 GPU (estimates from the v2 calibration: 680M full-screen moderate pass +1.7 ms at DPR 2 on 5.18 Mpx; dust 115k ≈ 4–10 ms ⇒ 35–87 ns/point; v2 J1 = 0.60 ms p50 / 3.49 ms p95; recalibrated by the critic round)
| Technique | 680M DPR 2 (T0) | 680M DPR 1 | Mid phone DPR 1.5 (T2) |
|---|---|---|---|
| Beam sector (J1: 40–60 % of the frame ≈ 2.1–3.1 Mpx blended; atan, hash, fwidth, text mask) | 0.70–1.00 | 0.25–0.40 | 0.20–0.35 |
| Beam sector in J2 (back angle ≤ 0.8 rad as τ shrinks, §4.3) | ≤ 0.35 | ≤ 0.15 | ≤ 0.15 |
| Points sonar vertex (2,772; flow, 6 echoes, capture, lens, DOF, 8 pinned compares) | 0.10–0.25 | 0.10–0.25 | 0.10–0.20 |
| Points fill (≤ 40 enlarged ping sprites, real CoC 1–8 px, cap 40) | 0.20–0.50 | 0.10–0.30 | 0.10–0.25 (CoC ≤ 16) |
| Hidden universe prefix (`DUST_SONAR`, sized to ≤ 1.0 ms by measured cost, ≤ 24k T0 / ≤ 12k T1) | ≤ 1.00 | ≤ 0.60 | off |
| Ribbons (4 rings, 60 ticks, cross; one draw) | ≤ 0.10 | ≤ 0.05 | ≤ 0.06 |
| Sphere skin (2-octave noise, J1–J2 only) | ≤ 0.05 | ≤ 0.03 | ≤ 0.05 |
| **J1 total** | **2.2–3.0 p50, ≤ 4.0 p95** | 1.0–1.8 / ≤ 3.0 | **0.6–1.2 / ≤ 2.5** |
| J2 (dust prefix off from 330, small sector) | ≤ 1.5 / ≤ 3.5 | — | ≤ 1.0 |
| J3–J5 | v2 ± 0.1 | v2 ± 0.1 | v2 ± 0.1 |
| C4b | v2 + 0.3–0.5 (beam) | — | v2 + 0.15 |
Budget: 8 ms (v2 §10.4), but the reference laptop's panel runs at **165 Hz (6.06 ms per frame)**: at that refresh v2 already drops 9 % of frames in J1 and 38 % in C4b (`perf/summary.txt`). Without the cost-sized prefix and the small J2 sector, rev 3.0 would have dropped an estimated 20–35 % in J1; the sub-step governor (§4.9) is the backstop. Draw calls in J1: 6 (cap 12). No new textures, no render targets. New programs compile asynchronously (§4.1).

### 9.2 CPU (main thread)
| Work | Desktop | Phone (4× slower CPU) |
|---|---|---|
| Playhead + springs + ~25 new channels | 0.04 ms | 0.15 |
| Beam angle/hunt, echo selection (15 sources), flow mirror (≤ 20 points), wake chain | 0.03 | 0.12 |
| LabelPicker (bin-only projection) | 0.02–0.05 (v2: 0.1–0.3) | 0.1–0.2 |
| Glyph writer (≤ 140 glyph writes, write-on-change) | ≤ 0.5 | ≤ 1.0 |
| Reticle `d` writes (only on rr/arm change) + echo chips (≤ 3) | ≤ 0.10 | ≤ 0.3 |
| Glyph geometry measurement (once per refresh, idle chunks ≤ 4 ms, after the boot verdict) | 2–4 total | 10–15 total |
**Targets (per bucket, relative to v2's `perf/summary.txt` and `perf/run-*.txt`, measured at the panel's native refresh):**
- CPU×1: frame p50 and JS p95 ≤ v2 + 5 %; dropped frames ≤ v2 + 3 percentage points; J1 GPU p95 ≤ 4.0 ms at T0 / DPR 2; JS p95 ≤ 2.5 ms in J1 and ≤ 3 ms in text windows; no tier change in J1 (sub-steps allowed).
- CPU×4 is a **no-regression gate**, not an absolute target (v2 already measures C2b p50 36.4 ms, C4c 36.5 ms, J1 js95 16.6 ms): every bucket's p50 and JS p95 ≤ v2 + 5 %; glyph writer p95 ≤ 2.0 ms; glyph mode stays on through C2b, C3e and C4c.
- Style + layout per second during J1 at CPU×4 ≤ v2 (227 / 154 ms/s). 0 forced layouts per frame (glyph geometry is read only at refresh); 0 layouts during a dock verb swap; 0 layouts from the HUD AZ update.

### 9.3 Bundle
No new dependency (CustomEase, MorphSVG, DrawSVG, Flip already in the bundle; SplitText not needed; ScrambleText vetoed). Code +9–13 KB gzip (landing chunk today ≈ 919 KB / 276 KB gzip; release gate ≤ +15 KB gzip). Font: Plex Mono 600 +15.6 KB as a separate woff2, fetched only by the cinema alias.

### 9.4 Test method
- **GPU:** `GpuTimer` (EXT_disjoint_timer_query, `three/gpuTimer.ts`, WP8) per beat via `?cx-perf`, logged as p50/p95 per beat plus dropped-frame % against the measured vsync interval; run `scratchpad/work/perf/perfrun.cjs` in the same configurations as `summary.txt` (amd-dpr1/dpr2 × cpu1/cpu4, nvidia for reference). Report the new table next to v2.
- **CPU:** Chrome trace (`tracerun.cjs` + `traceanalyze.cjs`) over J1, J2, J4, C2b, C3e, C4c at CPU×1 and ×4: style, layout, paint ms/s, long tasks.
- **Phone:** a **Pixel 6a** (or, if unavailable, the nearest Tensor G1 / Snapdragon 7-class Android phone, named in the report) with Chrome stable, remote DevTools at 390×844 (governed DPR 1.5): FPS meter over J1–J2 and the three closes; iOS Safari visual pass on any iPhone ≥ 12.
- Perf runs are serialised (§0.3 lock) and start only after the current release gate on ports 5173/5190 has finished.

---

## 10. Work packages

Nine packages. **WP0 lands first and alone.** Then WP1–WP8 run in parallel worktrees against WP0's contracts and stubs, each owning its files exclusively, each on its own dev-server port (§0.3). A package edits only its own files; anything else is a request to the integrator (who owns WP0's files after the merge, plus `cinema/geometry.ts`, `three/createField.ts` and `cinema/SPEC.md`). `beats.ts` retunes (channel keys, windows, camera knots) are requested from the integrator, never edited by a package. **Every WP's done-when includes: `npx tsc --noEmit` clean, `three/PointField.ts` diff = 0 against WP0's version, and the park diff = 0.**

### WP0 · Contracts, tables, seams and baselines (depends on nothing; lands alone)
- **Step 0 — baseline build.** Create branch `v3/baseline` = `473d8b8` + only the `?cx-still` freeze (in `clock.ts`, `PointField.ts` and the time sources it reads: field t and dt = 0 for heartbeat/beat throb, `breathHero`, the legacy sweep integrator, the point jiggle `points.ts:82`, embers, grain, the Ch5 legacy charge). Serve it on port 5200 and capture every baseline into `scratchpad/work/v3qa/baseline/`: frames 0–1960 every 20 vh at 1440×900 and 390×844; Ch5–Ch8 at Ch5 progress 0 / 0.18 / 0.5 / 1 at both sizes; camera `matrixWorld` + `projectionMatrix` for vh 352–1568 every 1 vh; computed font family/weight/face of every Ch5–Ch8 text element; the `RESPIRO_T`/`T`/`CH4_T` pour-assert list. The same freeze is then part of WP0, so every "identical to v2" check compares two frozen builds.
- **Owns:** `cinema/beats.ts`, `cinema/types.ts`, `cinema/flags.ts`, `cinema/field/score.ts`, `cinema/dev/assert.ts`, `three/constants.ts`, `three/PointField.ts` (split, then frozen), `three/field/frame.ts`; new `cinema/dilation.ts`, `cinema/eases.ts`, `cinema/tokens.css`. One-time edits before handing files over: `cinema/Cinema.tsx` (imports `tokens.css`; adds the `.cx-null__beam` host element), `cinema/index.ts` (wires `ctx.playhead`, `ctx.glyphs`, `ctx.perf`, `FrameOrder.Glyphs`, the eases import), `clock.ts` (`?cx-still`), moves `landing.css:188-245` (`.lp-label*`) verbatim into `cinema/ch1/labels.css` imported by `Ch1Stage.tsx`.
- **Creates compiling stubs whose ownership then passes on:** `cinema/playhead.ts` (identity follower → WP1); `cinema/type/glyphs.ts` + `grammars.ts` (word-level maskRise behaviour → WP5); `three/field/{camlayer,beam,beamClock,sonar,dustDriver,labelsDriver,ripplesDriver}.ts` (v2 code and construction moved verbatim, §4.1 → WP4/WP2/WP3); `three/{flow,sonar,ribbons}.ts`, `three/shaders/beam.ts` (no-op → WP3/WP2); **`three/springs.ts` with its final API and a working critically damped integrator** (→ WP4 for tuning); every new `FieldAdapter` member as a delegating stub (`ringScreen`, `setPlayhead`, `frameData.echoes`, `time.lockPulse`, `resetTimeLayer`, `setTextMask`, `setLabelChip`, `setPinned`), also on `NullField`; the `GuideBus` fields read by the snap, frozen.
- **Delivers:** every table in §2.1–§2.3 and §4.2 with final values. New channels are added to `SCORE` directly (they have no consumer yet, so they are inert). **Changed v2 keys are published under new names** (`sweepGain_v3`, `ring0_v3..ring3_v3`, `ticks_v3`, `cross_v3`, `STATIONS_V3`), so no v2 frame changes until the owning WP switches its consumer. Also: `SHARED_WINDOWS`; `RIPPLES` with `amp`/`inward`; `CAMERA.seek` and `ProfileKey.slopeScale`; final `ORD` (§4.1); construction factories and `FieldFrame`/`FieldDriver` (§4.1); `dilation.ts` (DILATION with explicit K/Ktouch, RAMP, `k`, `Winv`, `W`, `S_END(profile)`, `TRACKS_VH`, `TRACKS_VH_TOUCH`, `readWindows`, meter ends); types (§8.2); flags (§8.2); tokens and the Plex Mono Cx alias (§1.2, §5.5, §5.6). Dev asserts: neutral-at-park, flat plateaus, J2 reset (§4.2); track sum vs `S_END` against a 100vh probe (warn-only until WP1 lands the CSS); pour-before-plateau over `T`, `CH4_T`, `RESPIRO_T`; ≤ 140 glyph writes per frame; single-writer extension.
- **Done when:** `tsc --noEmit` clean; with stubs and inert v3 tables, the page is pixel-identical to `v3/baseline` at `?cx-still` over 0–1960 every 20 vh at both sizes (≤ 0.1 % of pixels differ by > 2 LSB) and camera matrices match to < 1e−6; a dev dump of `SCORE` at vh {0, 120, 226, 262, 300, 336, 345, 352, 360, 368, 380, 398, 400, 1112, 1160, 1200, 1400, 1560, 1720, 1790, 1889, 1890, 1900} matches §4.2; the three §4.2 asserts are silent for the new channels; unit tests: `S_END` = 2730.2 ± 0.1 (fine) and 2784.4 ± 0.1 (coarse), `W(Winv(x)) = x ± 1e−6` on 10k random x, W monotone, eases (§1.2: monotone, ≤ 1 for text, joint slope jump < 1e−3), `flowOffset` TS vs GLSL; the `T`/`CH4_T` violations list printed by the pour assert equals the baseline list (fixed later by WP7).

### WP1 · Playhead, scroll and director (depends on WP0)
- **Owns:** `cinema/playhead.ts`, `cinema/director.ts`, `cinema/clock.ts`, `cinema/settle.ts`, `cinema/index.ts`, `cinema/acts.ts`, `cinema/guide/snap.ts`, `Landing.tsx`, `landing.css` (track block and its coarse-pointer mirror only), `App.tsx` (only if a prop is needed).
- **Delivers:** §6.2 follower (ω 8 / 11, lag cap 28 → 0 by 1880, forced equality from 1880, `jump`), director geometry with W/Winv (§8.2), refresh replay of `invalidateOnRefresh` and forced render (§6.2), profile change preserving master vh (§2.2), clock order (§8.2) including `pvel`/`pvelS` → `field.setPlayhead` and the glyph-writer timer `ctx.perf.glyphMs`, `ctx.playhead`, `CinemaHandle.pxToVh/vhToPx`, settle → `jump`, acts fed the followed vh, snap (§6.4: retarget, gates, `deltaMode`, `pxToVh(targetScroll)`, plateau-edge distances), rotation restore through `pxToVh`/`vhToPx` (`Landing.tsx:457-480`), track CSS for both profiles + `matchMedia` refresh, optional `virtualScroll` behind `WHEEL_VISCOSITY` (off), teleport/return/pending flush/floor re-verified, dev hook `window.__cxPlayhead = { vh, target, s, vhToPx, pxToVh, jump }` (dev only).
- **Done when:** (a) synthetic wheel at 40 vh/s: lag ≤ 10 vh, residual < 0.05 vh within 0.6 s of idle; (b) at 2.25 notches/s the playhead speed max/min ratio over 3 s ≤ 3 (v2 ≈ 14); (c) a 2,000 px/s fling from R3 into Ch5: at Ch5 start + 100 ms no ch1–4 layer is visible (capture) and `vh === 1900`; (d) teleport from R0 and every rest R1–R7 and from the portal lands on finished plans; return home from ch2, ch4, ch5, ch8 shows no `.lp-cta`/dock over the Gateway for 2 s; floor clamp works on Lenis and native paths; (e) Ch5–Ch8 captures pixel-identical to the baseline at matching Ch5 progress; (f) snap: stopping within 24 s-vh before a plateau edge moving forward completes to the rest with no hermite, **including R4, R6 and R7**; stopping 10 vh past: no pull back; never R0, never ≥ 1800; no snap while the 1 s wheel rate ≥ 2 notches/s (also with `deltaMode` 1); (g) a resize and a font-load refresh while parked at R4 and at R6 re-render the master with fresh function-based values (no stale `closeShift`) and leave the playhead vh unchanged; a forced `(pointer: coarse)` flip at master 1500 keeps vh within 0.5; a 390×844 rotation at master 1700 restores to master 1700 ± 1, not to the plans; (h) reduced motion: no tracks, no follower, identical to the baseline.

### WP2 · Beam and instrument (GL) (depends on WP0)
- **Owns:** `three/shaders/beam.ts`, `three/shaders/sweep.ts` (ribbon shaders; the legacy SWEEP shader kept for `SONAR = false`), `three/instrument.ts`, `three/ribbons.ts`, `three/field/beam.ts`, `three/field/beamClock.ts`, `three/NullField.ts`, new `three/nullBeam.css`.
- **Delivers:** §4.3 beam (geometry with `uBack`, shader with the `behind` cut and positive lag, `BeamClock` with frozen θ_time while latched, hunt, `uFadeR`, text mask), §4.7 ribbons (travel, merge, fade, reset at 400, wobble, shock wobble, round tips, width match to the G2 emblem), `ringScreen(i)`, `time.lockPulse` consumption, Ch4 beam on the legacy angle, NullField API + the **required** CSS beam; switches the consumers of `sweepGain_v3`, `ring*_v3`, `ticks_v3`, `cross_v3`.
- **Done when:** captures at vh 0, 80, 150, 220, 300, 340 (both sizes, `?cx-still`) **and at pvelN = 1 and pvelS = −1 (forced through `?cx-flags=DEBUG_PVEL=1|-1`)** show no straight beam edge (alpha-mask edge detector finds no straight segment ≥ 40 px) and no visible dial-edge arc; the veil is 0 ahead of the line (sampled 3 px ahead: alpha < 0.5 LSB); beam apex on the hub ≤ 1 px at vh 80; hunt: per-frame θ step ≤ 0.16 rad/vh × Δvh at 35 vh/s, θ(336) = β_SP ± 0.002 rad, θ'(336) = 0; **after a 5 s dwell at vh 300, scrolling back across 226 to 200 shows per-frame |Δθ| ≤ 0.16·|Δvh| + (2π/16)·dt (no jump), both directions**; ring0 hand-off at 340: centre and radius of `ringScreen(0)` vs the DOM circle ≤ 1 px at both sizes; at vh 1700 the rings are the hub rings (centre/radius = v2); G2 emblem on ring0 ≤ 2 px; ribbon width 1.25 ± 0.1 CSS px at DPR 1, 1.5, 2; `sweepBearing` at 1720 equals the legacy integrator; beam GPU ≤ 1.0 ms p50 at DPR 2 on the 680M in J1 and ≤ 0.35 ms in J2; NullField run (`?nowebgl`) shows the CSS beam over 0–352 and no errors.

### WP3 · Field, points, dust, sphere skin, governor (GL) (depends on WP0)
- **Owns:** `three/shaders/points.ts`, `three/flow.ts`, `three/sonar.ts`, `three/field/sonar.ts`, `three/field/dustDriver.ts`, `three/field/labelsDriver.ts`, `three/field/ripplesDriver.ts`, `three/dust.ts`, `three/labels.ts`, `three/shaders/sphere.ts` (exterior skin, rim flash, rimIn flag only), `three/ripples.ts`, `three/governor.ts`.
- **Delivers:** §4.4–§4.6, §4.8, §4.9: the `SONAR` program variant, ink beads, DOF, lens, cursor dimple and wake, pinned points, text mask, echoes, decoys, capture, `DUST_SONAR` program with cost-sized prefix and 0.3 s cut ramp, flow + TS mirror, marbling and rim hold gated by `sonar`, radial rimIn behind its (off) flag, inward ripple and `RIPPLES` amps, `frameData.echoes`, LabelPicker bin projection reading the runtime `setLabelChip` box, the sub-step ladder and refresh-relative judder rule, DPR changes only on plateaus, the C4b-only dust hold, async compilation, debug counters.
- **Done when:** park diff = 0 at vh 1900 and 1960 (both sizes, `?cx-still`); the neutral-at-park assert is silent; golden frames 400–770 identical to the baseline outside the §11 item 31 masks (the sphere disc included: marbling and rim hold are 0 from 400); label/chip leader error ≤ 1.5 px over 0–300 with the cursor moving (pinned points); capture: `capInside` = 0 over 300–368; `crestsLive` reports ≥ 4 distinct sources with A > 0.02 in a 0–220 sweep; decoys flare and grey at 238/262/286; dust prefix drawn only on T0/T1, only while `dustSonar` > 0, and its measured cost ≤ 1.0 ms; a forced sub-step 1 in J1 removes the prefix over 0.3 s with no pop and no canvas resize; J1 GPU p95 ≤ 4.0 ms on the 680M at DPR 2 (`?cx-perf`); C4b dust cap ≥ the baseline's; `LabelPicker.sync` ≤ 0.05 ms p95.

### WP4 · Camera (depends on WP0)
- **Owns:** `three/camera.ts`, `three/springs.ts` (tuning; API fixed by WP0), `three/field/camlayer.ts`.
- **Delivers:** seek path branch and portrait variant, roll (on `camera.up`), FOV composition (+ `fovSeek`, fovKick), lean, bank, lookAhead, cursor parallax, `breathCard` sway (sin on both axes), `driftCard` drift with the plateau-frozen u, focus spring (exports `focusD`), gates (§6.1), `basePose(vh)`, `resetTimeLayer()`, `scratchCam` parity.
- **Done when:** with `?cx-still` and the cursor centred, `camera.matrixWorld` and `projectionMatrix` for vh 352–1112 and 1552–1568 (1 vh steps) equal the baseline (max abs diff < 1e−6), and over 1112–1552 differ from it by exactly the drift term (recomputed in the test, < 1e−6 residual); seek table of §6.3 reproduced to ±0.01 world / ±0.1°; at vh 320 (roll 2.4°) the DOM anchor and the GL sphere centre agree within 0.5 px; after 1.0 s of idle every time-layer offset is < 1e−4 world and < 0.01°; time-layer terms are exactly 0 over 352–1112 and 1552–1700; R4 and R5 captures at R ± 7.5 are identical (drift frozen on plateaus); a scroll-stop at 35 vh/s in J1 shows a visible lean settle (≤ 0.18 world, settles in ≤ 1.2 s, no oscillation > 2 cycles).

### WP5 · Type engine, fonts, Gateway (depends on WP0)
- **Owns:** `cinema/MaskWords.tsx`, `cinema/type/glyphs.ts`, `cinema/type/grammars.ts`, `cinema/base.css`, `cinema/prewarm.ts`, `Gateway.tsx`, `gateway.css`, `GenesisRadarLogo.tsx`. (`src/landing/main.tsx` is **not** touched: no global font import.)
- **Delivers:** §5.1–§5.3 (markup with the absolute glyph layer at kerned x and ligature merge, `.cx-sr`, visibility-only rest swap, lazy idle measurement, writer at FrameOrder 31 with interval evaluation, jump/settle full write, write cap and overflow rule, bleed front in reading order, grammars, time variants, word mode, text tier on `ctx.perf.glyphMs`, mobile reduction), the Plex Mono Cx alias applied in its own files, Gateway pour/evaporate and cue, CTA pill + pill ping ring + round rule dot (§7 E13–E16), Gateway `uTextMask` rects, contrast tokens in `gateway.css`, prewarm of the new clips (`path(evenodd)`, `inset(… round)`) and the `--scan-x` mask during the Gateway idle.
- **Done when:** unit test: glyphs, words and `.cx-sr` byte-identical to `copy.ts` for every block; writer never exceeds 140 glyph writes or 8 promoted words per frame across a full 0–1900 run (dev assert silent or only logging defers); a scrollbar drag from 0 to 1900 in one frame leaves every block in its terminal state; settled text renders identical to word rendering at 1440 and 390 (screenshot diff: no glyph shifted > 0.25 px, Playfair "Vo/Te/fa" pairs and "fi/fl" ligatures included); reduced motion renders no `.cx-ch`; `?cx-flags=GLYPHS=0` and a forced text tier both fall back to word mode without layout change; glyph mode stays on at CPU×4 through C2b, C3e and C4c; computed weight of the Plex Mono Cx elements is 600 from a real face and every Ch5–Ch8 element's computed face equals the baseline; `.gx-em` ≥ 4.5:1 sampled over 10 frames with the beam passing behind it.

### WP6 · Ch1 DOM and RIG (depends on WP0; uses WP5 and WP2 APIs, stubbed)
- **Owns:** `cinema/ch1/*` (`Ch1Stage.tsx`, `ch1.timeline.ts`, `hud.ts`, `labels.ts`, `labels.css`, `respiro.ts`, `ch1.css`), `cinema/rig/*` (`Rig.tsx`, `rig.ts`, `rig.timeline.ts`, `rig.css`).
- **Delivers:** respiro LIGHT via `glyphs.cells` (per-word colour; per-glyph only behind `RESPIRO_GLYPH_COOL`), J6 ink-twin evaporation, capsule bars with droplet nibs and stretch/squash, HUD evaporation with fixed-width AZ cells and its `uTextMask` rect, echo/decoy/sweep-flash chips (pills, full names, brown-deep, plate α 0.98, no CSS transition, `CHIP_POOL`, time-based decoys, leaders, strike, caps and no-go zones, `setPinned`, `setLabelChip` measurement), per-corner SVG reticle with `d` written only on rr/arm change, rr 10 in card mode, round caps over 368–770 with v2 geometry, `SHARED_WINDOWS` for cardGrow/pulse/leader/release (leader retract 1848–1858, release 1848–1878), `lock` act additions (`lockPulse`, glyph tag), tag ink capsule + `nowrap`, on-dark cross-fade.
- **Done when:** frames 480–657 at `?cx-still` differ from the baseline only inside glyph boxes (no mask line, per-word colours identical); frames 368–770 differ elsewhere only inside the bracket masks (§11 item 31); the 850 and 860 swaps are pixel-identical (frame pairs 849.9/850.1 and 859.9/860.1); reticle circle vs `ringScreen(0)` ≤ 1 px at 340; reticle reopens by 440; no `d` attribute write while only the box moves (MutationObserver count over 1642–1760 = only the rr/arm windows); tag text contrast ≥ 4.5:1 at every vh 345–830 (sampled every 5 vh); ≤ 3 chips at once on desktop, ≤ 2 on mobile, none within 120 px of the target, the onboarding card, the HUD, the dock or a live cursor label; echo chips hold 2.4–3.0 s; decoy strike visible 0.5–0.8 s after each decoy bloom; every chip name is shown in full; the leader is visible over 1774–1848 and the reticle stays closed until 1848; no `ease: "none"` tween on a visible property in ch1/rig.

### WP7 · Dossier and Ch4 (depends on WP0; uses the WP5 API, stubbed)
- **Owns:** `cinema/dossier/*` (`DossierStage.tsx`, `DossierStatic.tsx`, `dossier.timeline.ts`, `chips.ts`, `dossier.css`), `cinema/ch4/*` (`Ch4Stage.tsx`, `ch4.timeline.ts`, `Reels.tsx`, `ch4.css`).
- **Delivers:** every window of §2.3 (incl. `c3In` 1492–1500 and `SHARED_WINDOWS`), INK/EVAPORATE migrations, closes condensing in place on opaque r 18 panels, capsule tarja and wipes, comets, card paper radius logic with the `path(evenodd)` build clip and rim (J6), the `inset(round)` clip after 850, C3a grow, C4a radius-leading collapse, shade per-axis radius and round halo (E17, E18), range capsule, seal and pinned pills, feathered reels, odometer weight settle, Ch4 panel/close timings, eyebrow reel on `STATIONS_V3`, contrast (§5.6), reduced-motion static rules (E2, E12) and SVG round caps (D3, `Ch4Stage.tsx:59`).
- **Done when:** the pour-before-plateau assert is clean; stepVh 0.25 captures of 1100–1240 and 1480–1660 show no two closes semi-transparent together and the C2 close gone before the card grows (1198 < 1202); a capture at 830 shows the CH1 bars inside the paper's capsule hole; frame pairs 849.9/850.1 identical; rail, eyebrow and aria-live name the same chapter at every vh in 1186–1210 and 1588–1610; card → pill → disc with no seam at 1640 (≤ 1 px against the GL disc); the shade's corners match the card's (no square shadow corner at 840, 1100, 1300, 1600); every close/panel is opaque (sampled background behind text = paper ± 2 LSB while GL moves); no orbiter landing path crosses the C2 close panel rect over 1172–1194; no rectangle in motion in §7 rows A–G and E17–E18 owned by WP7.

### WP8 · Guide, reducer, GPU timer and QA harness (depends on WP0; runs final QA after the merges)
- **Owns:** `cinema/guide/GuideDock.tsx`, `cinema/guide/machine.ts`, `cinema/guide/reducer.ts`, `cinema/guide/guide.css`, `three/gpuTimer.ts`; QA tools `scratchpad/tools/capture3.cjs` (positions by master vh through `__cxPlayhead.vhToPx`, waits for |v| < 0.1 vh/s, `--base`), `scratchpad/tools/readharness.cjs` (synthetic wheel at 25/35/50 vh/s; **touch mode** via CDP `Emulation.setTouchEmulationEnabled` + `Emulation.setEmitTouchEventsForMouse` with a coarse-pointer media emulation and `Input.dispatchTouchEvent` drags; records legible seconds per block from the glyph writer's live state), `scratchpad/tools/golden.cjs` (region-masked diffs against `v3qa/baseline/`), `scratchpad/tools/salience.cjs` (§11 item 45), outputs under `scratchpad/work/v3qa/`.
- **Delivers:** §5.7 (lead starts and ends, back-verb precedence, 1.2 s floor, reading meter to the meter end, idle rules, never blank, playhead velocity source, dock flight timed in s-distance), dock pill and rail/dot restyle scoped by `.is-cinema` (removed only after the cue-off fade reaches 0), compositor-only dock width spring, onboarding card r 18 + arc corners + clip-path morph (no scale), on-dark cross-fade, rail label contrast, rotate card r 18, `STATIONS_V3` consumer for the rail and aria-live, `?cx-perf` per-beat log with dropped-frame % (`gpuTimer.ts`); then the §11 run.
- **Done when:** captures at 380 and 460 show a verb; at vh 1900+ the dock's computed `border-radius` and rail styles equal the baseline, and captures at Ch5 start + 100 ms and + 300 ms show a pill fading (never a square); the R1 imperative appears at 345 ± 1; for a continuous 35 vh/s scroll the R1–R7 imperatives are each visible ≥ 1.2 s; "iluminando a empresa" is visible during J5; the meter is shown only from full to meter end in D2/D4/D7/D9, monotone, and reads 1.00 ± 0.02 at its end; reversing inside D4 shows "voltando · …" within 1 frame of |v| > 2 vh/s; no "continue rolando" inside read windows after 5 s idle; aria-live announces only at rest arrivals; 0 layouts during a verb swap (Performance panel); the readharness results match §2.4 within ±5 % in wheel and touch modes.

### 10.1 Merge order and rules
1. WP0 alone. 2. WP1 (everything renders through the playhead). 3. WP4 (camera matrices and anchor). 4. WP2 (θ and ribbons). 5. WP3 (sonar path reads θ, focusD). **→ Radar checkpoint** (integrator, right after WP2 + WP3): run `salience.cjs` (§11 item 45) at 1440 and 390 on T0 and T2, and record a side-by-side video of 0–352 (baseline vs v3, synthetic wheel at 35 vh/s). If salience fails, tune the knobs of §4.3 in their listed order, within their caps, before any further merge. 6. WP5 (engine). 7. WP6 and WP7 (call sites; either order). 8. WP8 (guide), then the §11 run by WP8 + integrator, then §10.2.
- Each merge must keep `tsc` clean, `PointField.ts` unchanged and the park diff at 0.
- Initial states come from `gsap.set` at build or CSS; inside the master use `.to()` or `fromTo` with `immediateRender: false` (v2 rule).
- Run perf and capture tooling only after the current release gate on 5173/5190 has finished; perf jobs one at a time (§0.3).
- After WP6 merges, the integrator removes the static `LABEL_CHIP` fallback values only if `setLabelChip` is called on every path (including `?nowebgl`).
- **Scope-cut order if time runs short** (feasibility graft): cursor wake chain → screen-space lens → odometer weight settle → Ch2–Ch3 drift (`CARD_DRIFT` off) → hidden-universe prefix → decoy chips' strike (keep the GL flare). **Never cut:** follower, dilation, beam, afterglow, pings, hunt, ring drain + hand-off, glyph engine, dock rules, contrast fixes, text mask.

### 10.2 Release (integrator; after every merge and the §11 run, and only once the release gate has freed ports 5173/5190)
1. On the integration branch (`feature/landing-plano-sequencia`): `find src -name '*.js'` returns nothing; `npx tsc --noEmit` clean; once every consumer reads the `_v3` channels and `STATIONS_V3`, delete the unused v2 entries (`sweepGain`, `ring0..3`, `ticks`, `cross`, `STATIONS`); `tsc` proves nothing still reads them; rerun the WP0 SCORE dump.
2. **One** production build: `npm run build` in `frontend/`. Landing chunk ≤ 276 KB + 15 KB gzip (report the exact delta); no new npm dependency; the Plex Mono 600 woff2 is emitted once. Then `find src -name '*.js' -delete` (it must find nothing) and serve the build with `npx vite preview --port 5173 --strictPort` for the perf items of §11 (captures may use the dev server).
3. Run §11 in full. Any failing item is fixed or its feature is turned **off by its flag** (never extended). Record the result table in `scratchpad/work/v3qa/release.md`.
4. **Integrator review (replaces the former user sign-off):** golden frames of §11 item 31 and two side-by-side videos (baseline vs v3 at 35 vh/s): 0–352 (radar) and 368–770 (protected interior). The interior video must show no difference outside the §1.4 masks. Decisions can only move a flag toward its conservative value.
5. Replace `frontend/src/landing/cinema/SPEC.md` with this spec (rev 3.1 plus the release table).
6. Commit on `feature/landing-plano-sequencia` with a message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push the branch. Then `git fetch origin`, merge `origin/main` into the branch (a teammate also pushes to `main`; resolve conflicts, rerun `tsc` and the park/Ch5 diffs if anything outside `src/landing/` changed), merge the branch into `main`, push `main`.
7. Deploy: `ssh deploy@137.184.138.199`, then `sudo -iu genesis /opt/genesis/deploy/deploy.sh` (git pull → npm ci + build → uv sync → restart → `/health` smoke test). Verify the deployed commit with `sudo -u genesis git -C /opt/genesis log -1`.
8. **Live check** of `https://app.genesisradar.com.br/landing.html` (hard reload; HTML is `no-cache`) at 1440×900 and 390×844: Gateway boots, the J1 beam and pings are visible and turn with the wheel, the hunt locks at R1, the interior plays, the three closes are readable while scrolling, the plans (Ch5) look exactly as before, no console error. Captures saved to `scratchpad/work/v3qa/live/`.
9. **Changelog to the user (pt-BR, after publishing):** what changed, the decided defaults of §10.3 with their flags, the page-length increase, how to turn any of them off (`?cx-flags=…` for a preview; the flag in `flags.ts` for production).

### 10.3 Decided defaults (formerly "needs the user's OK"; shipped, listed in the changelog)
| # | Decision | Default | Flag / knob | Why |
|---|---|---|---|---|
| 1 | Page length: +43.7 % scroll on desktop, +46.5 % on touch, all of it inside text holds; ≈ 78 s to the plans at 35 vh/s | adopted | `DILATION`, `TOUCH_DILATION` | the user asked to read without stopping the wheel; every block now passes at 50 vh/s |
| 2 | Respiro LIGHT glyph condensation (no mask line) | on | `GLYPHS` | user point 3; colours and timing unchanged |
| 3 | Per-glyph cooling in the respiro | **off** | `RESPIRO_GLYPH_COOL` | user point 2 (keep the interior); §1.4 item 1 |
| 4 | Radial rimIn | **off** | `RIMIN_RADIAL` | user point 2; the superellipse frame is part of the interior the user approved |
| 5 | The tag on an ink capsule plate | on | `TAG_PLATE` | fixes the half-white tag at 440 |
| 6 | Echo and decoy chips with the existing fictitious `COMPANY_NAMES` | on | `ECHO_CHIPS`, `DECOY_CHIPS` | user point 1; no new copy |
| 7 | Dock lead imperatives inside reading holds and the reading meter | on | `DOCK_LEAD`, `DOCK_METER` | standing brief "sempre sinalize"; gerunds still shown |
| 8 | Stations Estimativa / Universo change at 1198 / 1602 | on | `STATIONS` table | the rail never names the next chapter over the previous close |
| 9 | Ch2–Ch3 backdrop drift | on | `CARD_DRIFT` | user point 3 ("câmera dinâmica") |
| 10 | Wheel viscosity, J4 cursor parallax | **off** | `WHEEL_VISCOSITY`, `INTERIOR_PARALLAX` | feasibility veto / protected interior; dilation alone now passes at 50 vh/s. `J3_ROLL` is not built |

---

## 11. Acceptance checklist (integrator / QA; every item measurable)

Captures use `capture3.cjs` at master vh with `?cx-still` unless stated; 1440×900 and 390×844. **"Baseline" always means `v3/baseline` (473d8b8 + the `?cx-still` freeze only, WP0 step 0)**, captured into `scratchpad/work/v3qa/baseline/`.

**Untouched zone and parity**
1. Ch5–Ch8 at matching Ch5 progress (0, 0.18, 0.5, 1) and Ch6–Ch8: pixel diff 0 against the baseline at both sizes.
1b. Computed `font-family`, `font-weight` and the resolved face (`document.fonts` check of the loaded faces) of every Ch5–Ch8 text element equal the baseline; `grep -rn "Plex Mono Cx" src/` finds only cinema files; `main.tsx` imports are unchanged.
2. Park state at vh 1900 and Ch5 at 1960: pixel diff 0 (field included, `?cx-still`).
3. Every new SCORE channel equals its neutral value for vh ≥ 1890 (`glowTau` 1.6, `ringFade` 1, all others 0) and every v3 sonar/beam/ribbon uniform is at its neutral value (dev assert log silent).
4. The legacy sweep integrator's expression is byte-identical to the baseline's, wherever it lives (diff of the expression); `.lp-cta` and `.lp-nav` CSS and markup unchanged (diff of the rules); the dock and rail restyle is absent at vh ≥ 1900 once the dock has faded (computed styles at Ch5 start + 400 ms).

**Build hygiene**
5. `npx tsc --noEmit` clean; `find src -name '*.js'` empty; no console error or warning in a full run (including "GSAP target not found").
6. Landing chunk grows ≤ 15 KB gzip over 276 KB; no new npm dependency; the Plex Mono 600 woff2 is requested at most once, and only after a cinema element using the alias renders.

**Timing and reading**
7. Track sum per profile equals `S_END + 100` within 0.5 vh against the 100vh probe (dev assert silent at 1440×900, 1366×768, 390×844 coarse): 2830.2 desktop, 2884.4 touch.
8. `readharness` at 25, 35 and 50 vh/s, wheel mode (desktop) and touch mode (coarse emulation): every block in §2.4 meets its row (✓ at 25, 35 and 50 on both profiles), ±5 %.
9. No text pour ends after its rest plateau starts (assert silent); every close is fully settled at 1150 / 1540 / 1782.
10. Stations: the rail reads Convergência at 1197 and Estimativa at 1199; Estimativa at 1601 and Universo at 1603; the eyebrow and aria-live agree at every rest.
11. No two closes or panels are semi-transparent at the same time (stepVh 0.25 over 1100–1240, 1480–1660, 1750–1870).

**Playhead, snap and flows**
12. Lag ≤ 10 vh at 40 vh/s; residual < 0.05 vh within 0.6 s idle; playhead speed max/min ratio ≤ 3 at 2.25 notches/s.
13. Plateaus R1–R7 are static: capture pairs at R − 7.5 and R + 7.5 after 1.5 s idle differ by 0 pixels outside the dock (`?cx-still`); the flat-plateau assert (§4.2) is silent.
14. Snap passes v2's checklist rules plus: retarget (no hermite), no snap while the wheel rate ≥ 2 notches/s (also `deltaMode` 1), s-space distances to the plateau edge, snaps into R4/R6/R7 work, `landed` requires |v| < 2 vh/s.
15. A fling into Ch5 never shows a ch1–4 layer over Ch5; `vh === 1900` at Ch5 start.
16. Teleport from R0–R7 and from the portal; return home from ch2/ch4/ch5/ch8; floor clamp; deep links (`?auth=…`, `?checkout=cancelado`) — all as v2. Rotation at master 1700 on 390×844 restores to 1700 ± 1. A refresh (resize, font load) at R4/R6 re-renders fresh function-based values without moving the playhead.
17. Header: "Entrar no radar" (open access) and "Ver planos" work from the Gateway and from ≥ 1880; the header is hidden 0–1840 in the cinema and back by 1880.

**Radar (J1–J2)**
18. No straight edge in the beam at vh 0, 80, 150, 220, 300, 340 (both sizes) and at forced pvelN = 1 / pvelS = −1; veil alpha < 0.5 LSB 3 px ahead of the line; apex on the hub ≤ 1 px.
19. The beam turns with the wheel: θ(vh 150) − θ(vh 50) at `?cx-still` = 2π·100/180 ± 0.01 rad; scrolling back rewinds it; after a 5 s dwell at 300, crossing 226 backwards and forwards gives per-frame |Δθ| ≤ 0.16·|Δvh| + (2π/16)·dt.
20. Pings and afterglow: in a 0–220 capture sweep, every frame shows ink rings at the lead; no gold fill on points (sampled pixels within the beam's afterglow are ink-hued); gold appears only on lines/rings ≤ 2.25 px.
21. Echoes: the `crestsLive` debug counter reports crests with A > 0.02 from ≥ 4 distinct sources over a 0–220 sweep; ≤ 3 chips on screen (desktop), ≤ 2 (mobile); none inside the no-go zones; echo chips hold 2.4–3.0 s; every chip name is shown in full.
22. Target pre-signal: in a 0–220 sweep, ≥ 1 frame where the mean L* of the sphere's outer 3 px annulus is ≥ 12 L* units above its value when the lead is opposite (b_SP ≈ π).
23. Hunt: the sign of θ − β_SP (from the `sweepBearing` trace) changes at least once between 250 and 300 (overshoot and swing back); θ(336) = β_SP ± 0.002 rad; decoys at 238/262/286 flare (GL), and their chips bloom, show the strike 0.5–0.8 s later, and evaporate.
24. Rings drain into the target; one centre at vh 300 (no crosshair, no hub rings); ring0 vs DOM circle ≤ 1 px at 340; at vh 1700 the rings are the v2 hub rings.
25. Capture: the field visibly packs around the sphere at 352 (bead halo at ≈ 1.5 R); `capInside` = 0 over 300–368.
26. Lock at 345: squeeze + arc flash + GL ring flash + tag pour; reverses on scroll back; the dock shows the R1 imperative from 345.
27. Camera: the seek table of §6.3 reproduced (±0.01); roll 0 at every rest; FOV 46° at 352.
28. Hidden universe: on T0 the afterglow shows dust grains over 0–280; none on T2/T3/mobile; its measured cost ≤ 1.0 ms; a forced sub-step cut ramps it out over 0.3 s without a canvas resize.
29. Reduced motion: frozen beam at `SWEEP_START`, no pings/echoes/flow; every reduced-motion static rule is liquid (no square panel, no diamond). NullField (`?nowebgl`): no crash, the CSS beam turns over 0–352 and fades with `sweepGain_v3`, dock and text work.
45. **Salience ("bem superior").** `salience.cjs`, at 1440 and 390, on T0 and T2 (forced), synthetic wheel at 35 vh/s over 0–220, 60 frames: (a) mean |ΔL*| between each v3 frame and the same frame with the beam and sonar terms off, inside the region 0–0.6 rad behind the lead (points included), is ≥ 0.8 × the same measure for the baseline's wedge (baseline frame vs baseline frame with `sweepGain` 0, same region behind its leading edge); (b) the `pingsPerTurn` counter is ≥ 20 at 1440 and ≥ 12 at 390. If (a) or (b) fails, the §4.3 knobs are tuned in order within their caps (veil ≤ 9 %); the final values are recorded in the release table.

**Protected interior**
30. Camera matrices identical to the baseline over 352–1112 and 1552–1568 (`?cx-still`, cursor centred, max abs diff < 1e−6); over 1112–1552 the difference equals the drift term exactly (< 1e−6 residual).
31. Golden frames at 380, 420, 440, 465, 480, 520, 580, 620, 657, 700, 740, 760: from 400 on, identical to the baseline outside these masks only: respiro glyph boxes, the tag plate, the dock, and the RIG bracket strokes ± 3 px (§1.4 item 7). The sphere disc and the rimIn band are **not** masked (marbling, rim hold and radial rimIn are off from 400). 380 differs only by the fading sonar terms (field, sphere skin) plus those masks.
32. Respiro word windows unchanged (start 472, step 7.6, len 24); colours HOT → COOL per word identical to the baseline (sampled at the centre of each word at its 25/50/75 % progress); contrast ≥ 14:1 over 618–657.
33. Integrator review before release (§10.2 step 4): golden frames + side-by-side videos of 0–352 and 368–770, baseline vs v3. The interior video shows no difference outside the item 31 masks.

**Text and shapes**
34. No `overflow: hidden` text window and no rectangular `inset()` wipe remains in `src/landing/cinema/**` and `gateway.css` (grep), except this allowlist: `.cx-sr` / `.cx-sr-only` (screen-reader hiding, `base.css:78`), `.cx-dos-stage` containment (`dossier.css:44`), and reels with a feathered `mask-image`.
35. Glyph writer ≤ 140 writes and ≤ 8 promoted words per frame (assert silent; defers logged, none at 35 vh/s); a one-frame jump 0 → 1900 leaves every block in its terminal state.
36. Every row of §7 is implemented, including E13–E18 (checklist by row; screenshots at the listed vh).
37. WCAG AA over GL: for every readable text at its legible vh, take the 5th-percentile background luminance under each glyph box over 10 consecutive frames (beam passing where applicable) and compute the contrast with the text colour: ≥ 4.5:1 (≥ 3:1 for large text). axe-core covers only the DOM-on-DOM cases.
38. Text never overshoots: glyph y never goes below 0 (min of recorded transforms ≥ −0.01 px past rest).
46. Glyph mode stays on at CPU×4 through C2b, C3e and C4c; settled text shows no glyph shift > 0.25 px against word rendering (kerning pairs and ligatures included).

**Guide**
39. Dock never blank (captures at 380, 460 and every 20 vh); R1–R7 imperatives start at 345 / 645 / 856.5 / 1152.3 / 1375.5 / 1552 / 1783 (± 1 vh) and are visible ≥ 1.2 s at 35 vh/s; "iluminando a empresa" is shown during J5; the reading meter is present only from full to meter end in D2/D4/D7/D9, monotone, and reaches 1.00 ± 0.02; the back verb wins on reversal; no idleMid inside read windows.
40. Dock pill radius 999 in the cinema, and still a pill at Ch5 start + 100 / + 300 ms while it fades; onboarding morph keeps circular corners at every frame (no elliptical radius); rail inactive labels ≥ 4.5:1; 0 layouts during a verb swap.

**Performance** (per bucket, at the panel's native refresh, relative to v2 runs in `scratchpad/work/perf/`)
41. 680M at DPR 2, CPU×1: frame p50 and JS p95 ≤ v2 + 5 % in every bucket; dropped frames ≤ v2 + 3 points in every bucket; J1 GPU p95 ≤ 4.0 ms; J2 GPU p95 ≤ 3.5 ms; J3–J5 GPU within v2 ± 0.1 ms; no tier change in J1.
42. CPU×4 (no-regression gate): every bucket's frame p50 and JS p95 ≤ v2 + 5 %; glyph writer p95 ≤ 2.0 ms; style + layout ms/s in J1 ≤ v2.
43. Pixel 6a (or the named substitute, §9.4) at 390×844, governed DPR 1.5: ≥ 55 fps median in J1–J2 and through the three closes; no tier below T2 on boot.
44. 0 forced layouts per frame during scrolling (Performance panel); idle radar 0 layouts; the HUD AZ update causes no page layout.

**Release**
47. §10.2 completed: build delta reported, release table written, commit with the attribution line pushed, `main` updated, `deploy.sh` succeeded, deployed commit = pushed commit, live checks at 1440 and 390 saved, changelog sent.

---

## 12. Revision log (rev 3.0 → 3.1) and provenance

### 12.1 Critic 0 (completeness)
| # | Sev. | Issue | Resolution |
|---|---|---|---|
| 0.1 | blocker | Global `@fontsource/ibm-plex-mono/600.css` changes Ch5–Ch8 (synthesized bold → real face) | Rejected the global import. Cinema-only `@font-face` alias "Plex Mono Cx" in `tokens.css`, used only by 5 cinema selectors; `main.tsx` untouched; new §8.1 item 8b and §11 item 1b (computed faces of Ch5–Ch8 = baseline). §5.5, WP5. |
| 0.2 | blocker | `seek`, `needle`, `ringTravel*`, `ringMerge` never return (evalChannel holds the last key): broke the C4b rings, Ch4 beam, sonarC4 afterglow and the rim hold; WP0 asserts contradicted | J2 reset at 398–400 for all transit channels (`ringFade` back to 1 at 400, where draw = 0); rim hold and marbling × `sonar`; rule restated as "neutral at park" with a neutral table (`glowTau` 1.6, `ringFade` 1, others 0). §4.2 rules 1 and 3, §3 J3/C4b, §4.8, §11 items 3 and 24. |
| 0.3 | blocker | Seven user sign-offs + a video gate contradicted "autorização irrestrita… publica"; no release section | Sign-offs became decided defaults (§10.3) with flags; item 33 is now an integrator review; new §10.2 Release (one build, chunk gate, §11 run, review, SPEC.md, commit with attribution, push branch and `main` after merging `origin/main`, `deploy.sh`, deployed-commit check, live check at 1440/390, changelog). Two defaults deliberately differ from the critic's list: `RIMIN_RADIAL` and per-glyph cooling ship **off** (see 1.13). |
| 0.4 | major | Channels ramp inside R1/R6 plateaus | Knees moved to plateau edges (`sonar` [368,1]; `lens`/`focusSP`/`dof` [368,1]; `flowAmp` [368,0.05]; `camLean`/`camLook`/`parallax` [336,1][352,0]; `camLook`/`parallax`/`breathCard`/`driftCard` [1536,…][1552,0]); new flat-plateau assert over every channel. §4.2 rule 2, §11 item 13. |
| 0.5 | major | PointField.ts frozen but owns construction WP2/WP3 must change | WP0 also moves construction into owner factories (uniforms, materials, geometry incl. `aTag`/`aIndex`, beam meshes, exterior uniforms, ripples, dust hold, FOV sum, legacy integrator), sets the final ORD, stubs every new FieldAdapter member; "`PointField.ts` diff = 0" in every WP's done-when. §4.1, §10. |
| 0.6 | major | `holePoly → inset(round)` impossible (the tarja hole) | `clip-path: path(evenodd, rounded outer + capsule hole)` and an evenodd path rim during the build; `inset(… round)` only after 850; capture at 830 + the 849.9/850.1 pair. §3 J6, §7 B7, WP7. |
| 0.7 | major | No deterministic baseline (pre-v3 has no `?cx-still`); `breathCard` ≠ 0 at t = 0 | WP0 step 0: `v3/baseline` = 473d8b8 + freeze only, with every baseline captured from it; `breathCard` uses sin on both axes (0 at t = 0). §0.3, §10 WP0, §11 header. |
| 0.8 | major | Protected interior changed without masks (RIG brackets, sphere skin) | Bracket round caps (rr ≤ 4, v2 geometry/timing) became allowed refinement 7 with its own mask; marbling and rim hold gated by `sonar` (v2 veins from 400). §1.4, §4.8, §11 item 31. |
| 0.9 | major | Gateway CTA, its ping ring, the rule diamond, CTA boot and cue unmapped; `.lp-nav` not listed | §7 E13–E16 (pill CTA, concentric pill ping, round dot, INK cue) owned by WP5; §3 G1 rows; `.lp-nav` added as unchanged exception E9b. |
| 0.10 | major | Dossier shade and halo stay square | §7 E17 (per-axis compensated radius on the scaled shadow, paint-only) and E18 (halo radius 999); WP7 done-when checks shade corners. |
| 0.11 | major | Dock width spring animated layout | Fixed v2 slot width kept; the visual width springs via `clip-path: inset(… round 999px)` on the background/edge layers; 0-layout acceptance. §1.2, §5.4, §7 E7, §11 item 40. |
| 0.12 | major | Text tier on total JS p95 > 9 ms would kill glyphs on phones | Trigger on the glyph writer's own cost (`ctx.perf.glyphMs`, measured by WP1's clock): p95 > 1.5 ms fine / 3.0 ms coarse; checked between blocks only. Acceptance: glyph mode on at CPU×4 (item 46). The critic's alternative "frame p95 > 20 ms" was **rejected**: v2 already runs CPU×4 at p50 ≈ 30–36 ms, so it would fire everywhere. §4.9, §5.2. |
| 0.13 | major | Beam jumps after a dwell when scrolling back past 226 | θ_time frozen while latched and resumed from its frozen value below 222 (no blend needed); one `BeamClock` shared by PointField and NullField; acceptance with a 5 s dwell. §4.3, §11 item 19, WP2. |
| 0.14 | major | Closes reach only 88–92 % at 50 vh/s | Desktop K raised to D4 3.9 / D7 3.75 / D9 4.3; touch K kept explicit at the rev-3.0 values (no `TOUCH_SCALE`, which would have pushed touch to +53.6 %). Recomputed: S_END 2730.2 desktop (+43.7 %), 2784.4 touch; all blocks pass at 50 vh/s on both profiles (C2 5.29 s, C3 6.49 s, Ch4 6.46 s). New tracks 940.9 / 421.8 / 667.8 / 799.7. §2. |
| 0.15 | major | Dock rules vs copy: "iluminando a empresa" never shown, D2 meter vanished at 58 %, R1 lead before the lock, precedence undefined | D2 lead and meter end at 673 (gerund shown in J5); meter shown from full to meter end so it reaches 1; lead start = max(s(R) − 30, last act) → R1 at 345; back verb wins on reversal and the 1.2 s floor yields. §5.7 rules 2–6, §11 item 39. |
| 0.16 | major | Text over GL below AA (Gateway tan under veil 4.11:1, HUD, chips 4.19:1) | `uTextMask` (4 screen rects: Gateway text, CTA + cue, HUD, spare) removes veil/afterglow/pings under free text; chip plates α 0.98 with brown-deep names; contrast measured on the 5th-percentile background over 10 frames. §1.2, §4.3, §4.4, §5.6, §11 item 37. |
| 0.17 | major | Parallel worktrees share one dev server | One server per worktree on 520n (`--strictPort`), started after the release gate; QA tools take `--base`; perf jobs serialised by a lock file. §0.3, §9.4. |
| 0.18 | major | Nothing measures that the radar is "bem superior" | Salience criterion (ΔL* behind the lead ≥ 0.8 × v2's wedge; pings per turn ≥ 20 / 12) at 1440 and 390 on T0 and T2; radar checkpoint with a side-by-side video right after WP2 + WP3; ordered tuning knobs with caps (veil ≤ 9 %). §11 item 45, §10.1, §4.3, §1.2. |
| 0.19 | minor | §2.4 coverage gaps (decoys, echoes, "estimado", eyebrow reels, sweep-flash, Gateway/onboarding/HUD) | Rows added for "estimado" and both eyebrow reels; exemption table with guarantees; echo hold ≥ 2.4 s; decoys time-based (1.8 s, strike is the message); pools specified (`POOL` 4 cursor + `CHIP_POOL` 4). §2.4, §3 J1/J2, §5.4. |
| 0.20 | minor | Unowned files; LABEL_CHIP timing; springs stub | `gpuTimer.ts` → WP8; `prewarm.ts` → WP5; `Cinema.tsx` one-time WP0 edit; `SPEC.md` replaced at release; `LABEL_CHIP` runtime-measured by WP6 via `setLabelChip`; WP0 ships `springs.ts` with the final API and a working integrator. §10. |
| 0.21 | minor | Glyph stacking, kerning, line order | Word layer in flow; glyph layer absolute at Range-measured kerned x; ligature merge; `+0.65·L` line term in the bleed front. §5.1, §5.3. |
| 0.22 | minor | Chip names cut by `max-width` + ellipsis; CSS opacity transition | Full names, no overflow/ellipsis, no CSS transition; grep allowlist for sr-only / stage containment / feathered reels. §5.4, §7 E6, §11 item 34. |
| 0.23 | minor | `.is-cinema` dropped while the dock is still fading | Removed only when the dock's opacity reads 0; re-added before it shows on reverse; captures at +100/+300 ms. §3 C4d, §7 E7, §8.1 item 7. |
| 0.24 | minor | Weak camera over Ch2–Ch3; comet origins vs sway | Pure-f(vh) look drift with a plateau-frozen coordinate over 1112–1552 (+ time sway, ×0.4 parallax), GL only; all look terms 0 over 888–1112 so the comet origins (sampled at 1000) match. §3 C2a, §6.1 L6, §4.2 `driftCard`. |
| 0.25 | minor | Wrong citations; v2 timings in proof rows; D6/c3In overlap; byte-identical file | Citations fixed (`Ch4Stage.tsx:59`, cue-off ≈ 611–630, `gateway.css:190`, integrator at :572); proof rows use v3 windows (header 847, rev-note 1093, range 1590, seal 1588); `c3In` 1492–1500; item 4 reads "byte-identical expression". |
| 0.26 | minor | `cx-ink-bloom`/`-settle` only C⁰ | Handles made collinear (and `cx-evap`'s small kink too), y ≤ 1; WP0 unit test on monotonicity, ≤ 1 and joint slope. §1.2. |
| 0.27 | minor | Reduced-motion static copies; Flip with non-uniform scale; optional NullField beam | Reduced-motion rules added to E2/E12; onboarding morph via `clip-path` without scale; NullField CSS beam required. §3 G3, §4.10, §7. |
| 0.28 | minor | Unmeasurable acceptance items; touch harness; profile change | Items 21–23 and 37 given thresholds/methods; phone named (Pixel 6a or named substitute); readharness touch mode via CDP; profile change preserves master vh. §11, §9.4, §2.2. |

### 12.2 Critic 1 (feasibility)
| # | Sev. | Issue | Resolution |
|---|---|---|---|
| 1.1 | blocker | Global Plex Mono 600 import changes Ch5+ | Same as 0.1. |
| 1.2 | blocker | WP0 "pixel-identical" impossible with v3 keys on v2 consumers | Changed v2 keys published as inert `_v3` channels and `STATIONS_V3`; owning WPs switch consumers; integrator deletes the v2 entries at release. WP0 now compares against `v3/baseline`. §4.2, §10 WP0, §10.2 step 1. |
| 1.3 | blocker | Frozen PointField with no seams/shared frame state | Typed `FieldFrame`, `FieldDriver`/`DriverInit`, `basePose()`, factories, final ORD (v2 meshes keep their relative order), RIPPLES table, dust hold and FOV sum moved. §4.1. |
| 1.4 | major | Beam veil has no front cut; bend sign reversed | `behind` AA mask (veil ends on the line); positive lag (rim trails, stays inside the sector), relaxes on reverse; edge-detector captures at pvelN = 1 and pvelS = −1. §4.3, WP2. |
| 1.5 | major | Master without ScrollTrigger loses invalidate-on-refresh; no re-render at rest; profile switch jumps | Director replays invalidate on `refreshInit`/`refresh` (`progress(0,true).invalidate()`, `time(vh)`, listeners, forced render); profile change preserves master vh. §6.2, §2.2, §8.2, WP1 (g). |
| 1.6 | major | Hidden couplings: rotation restore, snap maths, dock flight | Rotation restore via `pxToVh`/`vhToPx` on `CinemaHandle`; `snap.ts` decides on `pxToVh(targetScroll)` in s-space; `landV` and the dock flight in playhead/s units. §6.4, §5.7 rule 9, WP1/WP8. |
| 1.7 | major | Unlisted cross-package windows (cardGrow, landStart, swarm, leader, release) | `SHARED_WINDOWS` in `beats.ts`: cardGrow 1202–1236 `cx-flow` on both sides; landStart 1172 kept explicitly (with a no-crossing assert); swarm → 1202; leaderRetract → 1848–1858; release → 1848–1878. §2.1, §3 C4d, WP6/WP7. |
| 1.8 | major | Governor blocked during J1; tiers can't express 8 steps; thresholds blind at 165 Hz | Prefix is a live draw-range cut with a 0.3 s ramp, separate from tiers; DPR changes only on plateaus; sub-step ladder (0–8) with a refresh-relative judder rule; prefix sized from measured cost (≤ 1.0 ms); C4b-only dust hold. §4.5, §4.9. |
| 1.9 | major | GPU estimates low; branch flattening; C4b budget; sync compile | Estimates corrected (beam 0.7–1.0 ms, J1 2.2–3.0 / ≤ 4.0 p95 after mitigations); separate `SONAR` point variant and `DUST_SONAR` program; C4b dust on the v2 program and budgeted with C4 uniforms; J2 sector shrinks with τ; async compile with a legacy fallback. §4.1, §4.3–§4.5, §9.1. |
| 1.10 | major | Hunt jump on reverse | Same as 0.13. |
| 1.11 | major | Per-glyph inline-blocks lose kerning/ligatures; display swap lays out; measurement in boot | Same as 0.21, plus visibility-only swap and lazy idle measurement after the boot verdict. §5.1. |
| 1.12 | major | Writer skips blocks on big steps | Interval evaluation over [prevVh, vh]; full write on jump/settle; acceptance with a one-frame 0 → 1900 jump. §5.2, §11 item 35. |
| 1.13 | major | Protected interior: per-glyph HOT→COOL and RIMIN_RADIAL default on | Both behind flags, **default off**: v2 per-word cooling and superellipse rimIn ship. This deliberately overrides critic 0's "RIMIN_RADIAL on": the user explicitly loved the interior, so changes to its look default to off without a sign-off channel. §1.4, §4.8, §5.3, §10.3. |
| 1.14 | major | Points displaced on the GPU drift from CPU-anchored labels | Pinned points (`uPinned[8]`, `aIndex`) skip dimple, wake, lens, echo push and capture; only flow moves them and flow is mirrored exactly. §4.4, §4.6. |
| 1.15 | major | Acceptance targets stricter than v2; 16.7 ms meaningless at 165 Hz | Per-bucket targets relative to v2 at native refresh (p50/js95 ≤ v2 + 5 %, drop ≤ v2 + 3 points, J1 GPU p95 ≤ 4 ms); CPU×4 is a no-regression gate. §9.2, §11 items 41–42. |
| 1.16 | minor | `.is-cinema` removal at 1900 | Same as 0.23 (done in the reducer, so `Landing.tsx` stays untouched for this). |
| 1.17 | minor | Snap distances fall inside dilated plateaus; `deltaMode` | Distances to the plateau's near edge; `deltaMode` normalised. §2.1 MARKS, §6.4. |
| 1.18 | minor | Reticle `d` per frame; rr 22 wrong | 4 per-corner SVGs moved by transform, `d` only on rr/arm change; card-mode rr 10. §7 D1, §3 J6. |
| 1.19 | minor | Numeric nits (gold threshold, D8/D9 overlap, innerHeight assert, line ref, write cap overflow, grep, c3In, ProfileKey slope, HUD layout) | `aSize > 2.91`; overlap note; 100vh probe; :572; overflow rule (collapse to word layers, then one-frame defer); grep allowlist; `c3In` 1492; `ProfileKey.slopeScale`; fixed-width AZ cells with `contain`. |
| 1.20 | minor | Unowned files; LABEL_CHIP; GuideBus; gerund suppression | Same as 0.20; `geometry.ts`/`createField.ts` → integrator; GuideBus snap fields frozen by WP0; gerund shortening inside D4/D7/D9 is decided default 7 and stated in §8.1 item 5 (D2 no longer suppresses its gerund). |

### 12.3 Provenance (unchanged from rev 3.0 except where noted)
- **Winner: A "Liquid Sonar"** on the summed scores (A 23, B 20.5, C 16). Clarity and feasibility (the gates) both ranked A first; the wow judge ranked B first by 0.5. A is kept as the spine: scroll-space dilation as the reading mechanism, the sonar physics (afterglow, pings, echo wavefronts, hidden universe, capture), the reticle that bends into a circle, the C4a radius-leading collapse, the CPU text fallback, opaque text plates, and "never move text being read".
- **Grafts taken:**
  - From B: the "ink on paper, light in the dark" rule; the hunt with a fixed absolute amplitude (fixed to settle exactly); decoys struck through; rack focus; rings draining onto the reticle; the pure-f(vh) write-on-change glyph writer with rejoin at rest and the byte-equality test; INK/LIGHT/EVAPORATE grammars and the bleed-front order; `cx-ink-*` eases (no overshoot on text); snap as an immediate retarget; the dock reading meter and the 1.2 s imperative floor; golden-frame suite; suminagashi skin (J1–J2 only since rev 3.1); ink beads; Plex Mono 600 (cinema-only alias since rev 3.1); Playfair italic rev-note; the spoon-stir bend (capped, sign fixed in rev 3.1).
  - From C: operator lean and focus-pull hunt spring; `FieldAdapter.ringScreen()`; lead verbs; the per-glyph Gateway pour; the beam radial fade by projected visible radius; the `sweepGain` retime so the hunt is visible to the lock; the lag cap with forced catch-up near Ch5; splitting `PointField.update()` before parallel work; the pour-before-plateau assert; moving cardGrow after the close.
  - From the judges: stations change with the close exit; ≤ 3 chips on desktop; idleMid suppressed while reading; hard gates for every camera time-layer term over the interior and the membrane; the scope-cut order; the dust prefix as the first governor cut with the code's own cost calibration.
- **Vetoes honoured:** C's murmuration flock and constellation filaments; C's skew/scale "liquid bodies" and dock scaleX·vel; C's handheld shake; every playhead **rate cap** (B's and C's; only the lag cap that forces catch-up remains); B's and C's card/close tilt (no DOM transform on text being read; the rev-3.1 Ch2–Ch3 drift is GL-only); B's fan with τ 1.2 against a 1.15 rad fan (v3's veil τ ≤ 0.544 inside a ≤ 2.6 rad sector); J3 roll and J4 parallax ship OFF; `CAMERA.in` untouched; B's Ch4 close pouring through R7; reshaping `.lp-cta` (and, since rev 3.1, `.lp-nav`); any change to the sweep integrator at ≥ 1850; B's AA claim at 20.3 px; unboxing small text onto halos over moving GL; B's 150 vh bypass; C's 6 % glyph overshoot and gold beam halo; wheel viscosity as a default (flag, off); C's per-glyph `filter: blur()` (word-level only); C's lean through J3 and the membrane; B's animated SVG filters (goo, dissolve); B's OUT-path knot edits (the Ch4 crane is dropped); the polygon/wobbling dawn (circle kept); chrome restyles visible in Ch5 (scoped to vh < 1900 and to a visible dock).
- **Grafts declined, and why:** the clarity judge's bounded rate cap (blocked by the wow and feasibility vetoes on rate caps; fast reading is covered by dilation, which now passes at 50 vh/s on both profiles); the wow judge's default wheel viscosity at k 0.8/0.7 (blocked by the feasibility veto; kept as an OFF flag, no longer needed); B's dawn wobble ≤ 2.5 % (blocked by the feasibility veto on polygon dawns); B's crane look-down in Ch4 (blocked by the feasibility veto on OUT knots); A's bow wave (first scope cut).
- **Scripts behind the numbers:** `scratchpad/work/v3dir/rev/dwell31.cjs` (dilation with explicit K/Ktouch, tracks, reading proof incl. new rows, lead starts, meter spans, beat table; supersedes `lead/dwell.cjs`), `…/lead/seek.mjs` (seek path), `…/lead/hunt.cjs` (hunt continuity), `…/critic-complete/kfit.cjs` and `meter.cjs` (critic checks).
