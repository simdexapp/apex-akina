# Day Build Log

Full day of upgrades on top of yesterday's overnight wave. Live at:

**https://simdexapp.github.io/apex-akina/next/**

## Visual / FX

- **Damage flash** on barrier hits — red inset border + camera shake +
  gamepad rumble (rising-edge only).
- **Drift score popups** — gold "+345" floats up + fades from above the
  player car on each successful drift exit.
- **Animated countdown numbers** — big "3 / 2 / 1 / GO" pop in/out at
  screen center during the start-lights sequence.
- **Victory confetti** (already in) refined.
- **Time-of-day variants** in settings: Auto / Dawn / Day / Sunset / Night,
  each overrides sky shader colors, fog, ambient + hemisphere + moon.
- **Color-blind palette toggle** — orange/blue/yellow swap for deuteranopia.
- **Reduced-motion toggle** — disables shake-style animations.

## HUD

- **Tire grip indicator** — bottom-left bar above speedometer, gradient
  red→gold→green, drops while drifting.
- **RPM readout** under the gear pill on the speedometer.
- **Time-trial leaderboard** — top 5 lap times per track on finish screen.
- **Live lap delta** vs personal best (already from yesterday).
- **Sector splits** with delta vs best (already from yesterday).
- **Better minimap**:
  - Track outline gets a 6px transparent glow halo.
  - Start point marker as a hot-pink dot.
  - Rivals colored by personality (red=aggressive, green=smooth,
    gold=consistent, purple=wildcard).
  - Player rendered as a triangle pointing in heading direction with
    a soft white glow.

## Audio

- **Engine staging by gear** — updateAudio takes gear/RPM, so each shift
  audibly resets the pitch + LPF sweep within the new gear's window.
- **Downshift rev-match blip** — sawtooth swept 180→260→150 Hz through
  a 1.2 kHz lowpass on top of the existing thunk.
- **Music vs SFX volume sliders** — split the master into music + sfxBus.
  Engine, tire, wind, countdown, shift, turbo, brake all route through
  sfxBus; music goes direct.

## Mechanics

- **Per-car gear profiles**:
  - gt:    6 / 7800 / 7200 / 2400 (default)
  - drift: 6 / 8200 / 7600 / 2800 (revvy 2JZ)
  - rally: 6 / 7600 / 7000 / 2400
  - super: 7 / 8800 / 8200 / 2600 (PDK)
  - kei:   5 / 9000 / 8400 / 3000 (K20 screamer)
  - muscle:4 / 6800 / 6400 / 1800 (long-geared brute)

## Career mode

- **Round interstitial** — "Round 2 / 5" callout flashes 1.4 s when
  starting any career race.

## Settings

- **Fullscreen** button.
- **Reset progress** button (wipes profile + best laps + sectors +
  achievements + career + ghosts after a confirm dialog).
- **Color-blind palette** toggle.
- **Reduced motion** toggle.
- **Time of day** select (5 options).
- **Music** + **SFX** volume sliders.

## Input

- **Gamepad haptics** (Chrome dual-rumble): barrier hit (strong),
  boost activation (medium). Silent fallback if the pad doesn't support
  haptics.
- **R key** restarts the current race instantly (works mid-race or after
  the finish overlay).

## Player engagement

- **Achievements grid** in the garage — all 12 achievements visible,
  earned ones glow gold with ✓, locked ones show 🔒 + description.
- **Local TT leaderboard** persists top 5 times per track in localStorage.

## Reliability

- All modules cache-bust via `?v=N` query string. Bumped 12 → 20 today
  across multiple deploys; every deploy verified clean console on
  the live URL.

## Files added today

- (none — all edits to existing modules + a few small new helper sections)

## What to try

- Pick **Career → Master Championship** for a 6-round tournament across
  all 8 tracks at hard AI difficulty.
- Toggle **Time of day → Sunset** and reload Neon Highway for the
  cyberpunk-at-dusk vibe.
- Settings → **Color-blind palette** for an alternate theme.
- Gamepad players should feel **rumble on barrier hits** and a softer
  bump on **boost activation**.
- Press **R** mid-race to instantly restart.
- Open **Garage** to see your achievements progress.

## Live URL recap

**https://simdexapp.github.io/apex-akina/next/**

Repo: **https://github.com/simdexapp/apex-akina**
