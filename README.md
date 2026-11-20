# Trebuchet Lab

A 3D trebuchet simulator for learning (and building with kids). Change each part of the machine, throw, and see how far, how high and how fast the ball goes. Every throw is saved as a version so you can compare your builds side by side.

## How to use it

1. **Build**: go through the steps (Size, Arm, Tower, Weight, Sling, Ball, World). Move the sliders, or drag the yellow handles right on the 3D model.
2. **Guess**: type how far you think it will go (optional, but fun).
3. **Throw!**: watch it in slow motion. The results appear when the ball lands.
4. **Change one thing and throw again.** Each changed build is saved as a new version with its results.
5. **Compare**: pick two or more versions to see their arcs in 3D and a table of what changed.
6. **Built it for real?** Type the real distance on the version card to see how close the simulation was.

Versions are saved in the browser on the device you use. Use **Download backup** on the Versions tab to keep a copy or move them to another device.

## Learn the parts first

The **📖 Learn** tab has a short lesson for each part (13 in all): what it is, why it matters, how it works, and what it changes. The diagrams and charts are made from your own build by running test throws in the simulator, and the 3D model can play "what if" test throws and show comparison arcs. Test throws are never saved as versions. Every control in the Build tab also has a **📖 Learn** button that opens its lesson.

## What the simulation includes

- Arm turning on its axle (length, turning point, weight)
- Fixed or swinging (hinged) counterweight
- Sling with the ball sliding along the trough before it lifts off
- Release hook that decides when the ball lets go
- Flight with gravity, air drag and wind; Earth, Moon or Mars

The physics uses the standard equations of motion for these machines, solved in small time steps. Energy is checked to stay constant during the swing (see `tests/`). Real builds will throw shorter than the simulation because of friction, wood bending and sling stretch.

## For developers

```bash
npm install
npm run dev      # local dev server
npm test         # physics tests
npm run build    # builds one self-contained dist/index.html
npm run build:claude  # also writes dist/trebuchet-lab.html, the version published as a private Claude page
```

- `src/physics/`: the simulator (no 3D code; easy to test)
- `src/scene/`: the 3D world (Three.js via React Three Fiber)
- `src/ui/`: panels and controls
- `src/state/store.ts`: current build, saved versions, playback
