# Nona

A fly over Bangalore whose sense of direction is computed by **166 real neurons**
from the male *Drosophila* connectome, and who **learns what your words mean**
through real synaptic plasticity in a real mushroom body.

Built for the Fruit Fly-athon (2586Labs, Indiranagar). Her home is the venue.

Data: **MaleCNS v1.0** — Janelia / Google Research, CC-BY 4.0.

---

## The honest claim

This matters more than any feature, so it goes first.

**What is real:**

- The **central complex** navigation circuit — 166 neurons, 10,402 connections,
  pulled from neuPrint. Every neuron sits at the heading its protocerebral-bridge
  glomerulus actually encodes. Run as leaky integrate-and-fire, it produces a
  single bump of activity that **holds a heading with no input at all**. That is
  working memory, and it comes from the wiring.
- The **mushroom body** learning circuit — 4,063 Kenyon cells, 97 MBONs, 332
  dopaminergic neurons, 51,085 KC→MBON synapses. Teaching her depresses those
  synapses by the real plasticity rule. Reward compartments (PAM) and punishment
  compartments (PPL1) are **derived from the connectome**, not assigned by hand.
- The controls: **lesion Delta7** and **scramble the wiring**. Scrambled wiring
  keeps every neuron's degree and weights but randomises partners, and the bump
  collapses (0.38 → 0.06). That is the proof the structure does the work.

- The **3D brain view** is real traced morphology. Every strand is one neuron's
  actual shape, from neuPrint's skeletons (xyz + radius, electron microscopy).
  The ellipsoid-body donut and the protocerebral bridge are **not drawn** — they
  are what the arbors form when placed where they belong. Brightness is live
  firing rate. The view carries **472 neurons, 15,327 branches, 597k vertices**:
  the 166-neuron core plus the two surrounding real populations —
  **ER (282, landmark input)** and **PFL3 (24, steering output)** — each a toggle.
  ER/PFL3 default off in the small panel (they are most of the vertices) and are
  shown responding to the real landmark and heading signals.

**What is NOT claimed:**

- She has **not learned a programming language**, and no fly connectome ever will.
  She learns *associations* — that a sound predicts something good or bad —
  exactly as you would train an animal.
- There is **no uploaded consciousness** and no digital fly. This is a
  connectome-based controller.
- **Angular velocity integration does not work.** The round-trip offset through
  the PEN populations is real and correctly signed (L +5.9°, R −5.9°, see
  `roundtrip.mjs`), but under sustained turn the bump jumps between discrete
  states instead of integrating smoothly. Heading is therefore set by **visual
  landmark**, which is how a real fly pins its compass anyway. Documented rather
  than hidden.
- The 3D render **simplifies the skeletons**: EM traces are covered in tiny spine
  stubs (63,142 paths, median length 2 points), so terminal branches that do not
  travel far are pruned and each run is simplified with Ramer-Douglas-Peucker.
  142k points become 32k. Tube radius is capped, since trunks are ~6x the mean
  and read as faceted blocks uncapped. Shape is preserved; only detail no camera
  would resolve is dropped.
- **ER and PFL3 are shown, not put in control.** ER (the visual-landmark input)
  and PFL3 (the steering output) are rendered as real populations lit by the real
  signals, but the *control* still uses the clean landmark cue + goal-from-mushroom-
  body. Routing the landmark through ER as-is makes pointing *worse* (30–60° vs
  22°): real ring neurons are broadly tuned, unevenly tiled, and GABAergic, and
  PFL3 can only steer given a goal signal that lives in circuits (fan-shaped body,
  hΔ) outside this subgraph. Closing that loop faithfully is a research problem,
  not forced here. (`diag_er.mjs`, `ertrack.mjs` hold the measurements.)
- Two documented modelling choices: per-neuron **input normalisation** (this
  subgraph is the dense interconnected core, ~63 edges/neuron, and raw summed
  input saturates every cell), and hand-tuned gains found by sweep. The
  *relative* connection pattern — the part that encodes heading — is untouched.

The language parser (`src/listen.js`) is deliberately tiny, local and
keyword-based. It produces only a **stimulus** and a **dopamine sign**. It never
steers her. That constraint is what makes the claim true.

---

## Run it

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>. No build step, no dependencies, no API keys,
and it works with the wifi off.

(It must be *served* — ES modules and `fetch` do not work from `file://`.)

## Teach her

| Say | What happens |
|---|---|
| `this is home` | binds the word to what she can see |
| `good girl` | dopamine → PAM compartments → approach |
| `no` / `bad` | dopamine → PPL1 compartments → avoid |
| `go home` | she orients on it, if it means anything to her |
| `traffic is bad` | teaches avoidance of 100 Feet Road |
| `forget` | every synapse back to naive |

Say `this is home`, then `good girl` four or five times. Watch the valence climb
and **flying toward** change. Before you teach her, every valence is 0 and she
just wanders — nothing is hardcoded.

Voice input works in Chrome via the Web Speech API. The text box is the fallback
and does everything the microphone does.

## The computer inside home

When she reaches home the camera dives into the building's machine and a small
IDE fills the screen (Esc or **exit** to fly back out). It has an editor on the
left and her live brain on the right. The command language is tiny:

```
teach home        # bind the word to what she can see
reward            # dopamine -> approach
avoid traffic     # dopamine -> avoidance
go home           # orient on it
forget            # back to naive
```

**The honest part:** every line here runs the *same* `runCommand` path the chat
box uses — `parse` -> `mb.teach` / `compass.setCue`. There is no second brain.
The console is a code-like way to train a real mushroom body, and the right pane
shows the real synapses moving as you run. It is a trainer, not a compiler; a fly
does not execute code.

Like the reference it borrows from ([henryheffernan.com](https://henryheffernan.com/)),
the "screen" is a DOM/CSS overlay over a zoomed 3D monitor, not a 3D room — sharp
text, cheap, and able to call straight into the running simulation. A full walk-in
3D interior, and the light-theme city, are the next slices.

---

## Verify the claims

```bash
node verify.mjs    # the compass: 5 checks
node mbtest.mjs    # the learning: 5 checks
```

Both must be green before any claim in this README is repeated out loud.

```
 PASS  bump forms                    strength 0.41, 69 Hz
 PASS  tracks landmark               mean error 22 deg
 PASS  holds heading 3 s, no input   mean drift 60 deg, strength 0.33
 PASS  lesion Delta7 breaks compass  bump 0.41 -> 0.03, 118 Hz
 PASS  scrambled wiring cannot sustain   real holds 0.38 vs scrambled 0.06

 PASS  reward builds approach valence    0.00 -> 0.37 -> 0.66 -> 0.83 -> 0.96
 PASS  punishment builds avoidance       0.00 -> -0.91
 PASS  learning is specific to the word  home 0.96, worst other 0.000
 PASS  teaching changes real synapses    1409 of 51085 depressed
 PASS  forget restores naive state
```

## What is in the wiring

Measured out of the data with `diag.mjs`, not assumed. This is the canonical ring
attractor, and finding it is what made the simulation work:

| Pathway | Peak offset | Role |
|---|---|---|
| EPG → EPG | **0°** | local recurrent excitation — the bump feeds itself |
| EPG → Delta7 | **158°** | drives inhibition on the opposite side |
| Delta7 → EPG | **23°** | surround inhibition — suppresses rivals |
| PEN → EPG | **45°** | the offset that would rotate the bump |

The left protocerebral-bridge hemisphere had to be **mirrored** (the PB runs
L9…L1 | R1…R9). Without that, both PEN populations project the same way and
nothing can steer; with it, they come out at L +55.6° / R −55.9° and EPG→EPG
local weight rises from 51% to 89%. Two independent confirmations of the same
anatomy — see `mirror.mjs`.

## Layout

```
index.html          the page, no build
src/lif.js          leaky integrate-and-fire engine (CSR, adaptation)
src/compass.js      ring attractor, glomerulus -> heading, lesion + scramble
src/mushroom.js     Kenyon cells, MBONs, dopamine-gated depression
src/world.js        Three.js Bangalore and Nona
src/hud.js          the live 2D ring and mushroom-body raster
src/brain3d.js      the 3D brain: merged tubes, activity texture, PBR + bloom
src/listen.js       speech + the deliberately-small intent parser
src/desk.js         the computer inside home: monitor overlay + training IDE
src/main.js         the loop that joins them (shared runCommand, enter/exit)

data/compass.json   166 neurons, 10,402 connections
data/mushroom.json  4,492 neurons, 51,085 plastic synapses
data/skeletons.json 166 real traced morphologies, 7,260 branches

verify.mjs mbtest.mjs          the claims, as tests
diag.mjs mirror.mjs roundtrip.mjs   the measurements that shaped the model
scan.mjs tune.mjs final.mjs         the parameter sweeps
extract_compass.py extract_mushroom.py extract_skeletons.py   pull from neuPrint
check.py            confirm the neuPrint token works
```

## Re-pull the data

Needs a free neuPrint token in `.env` (`NEUPRINT_APPLICATION_CREDENTIALS`).
The cached JSON is committed, so you only need this to change which cell types
are included.

```bash
python check.py
python extract_compass.py
python extract_mushroom.py
python extract_skeletons.py    # ~40 s, the 3D morphology
```

## On the rendering

The 3D brain follows [Blob Mixer](https://blobmixer.14islands.com/)'s approach —
PBR `MeshPhysicalMaterial`, real environment lighting, activity driving vertex
displacement in the shader, bloom on what is firing.

Two deliberate departures, stated rather than hidden:

- The reference **recomputes normals after displacing vertices**, because its
  blobs deform arbitrarily. Ours swell *radially* along a tube, and a uniform
  radial scale leaves the surface normal pointing the same way — so there is
  nothing to recompute. Performing the step anyway would be theatre.
- **No `transmission`.** It re-renders the scene every frame and is too costly at
  256k vertices alongside the city. Clearcoat and iridescence carry the glassiness.

Per-neuron brightness with one draw call per cell type comes from a per-vertex
`aNeuron` attribute indexing a 166-texel activity texture, rewritten each frame.
