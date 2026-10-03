# 啪叽

An experience-led nostalgic sticky toy: grab and fling the orange goo at a pale green ceramic wall. It splats, sticks, stretches from an attached tip, detaches, settles, and can be grabbed again. Directional sunlight, glossy material and small eyes carry the scene; controls stay compact.

Uses the existing vendored Three.js and shared animation loop, with no new dependencies. Physics intentionally uses one mass, damped shape springs and a single peeling contact; introduce a soft-body solver only if multiple blobs must collide or tear.

Pointer dragging and the throw button share the release/collision path. Space throws when page focus permits; focused controls retain native Space behavior. R resets outside editable controls. Color, adhesion and optional synthesized sound are adjustable. Reduced-motion preference removes idle animation and UI transitions.

Validation: `node toys/wall-slime/physics.test.js` covers the complete cycle, adhesion, 30 FPS, bounds, invalid inputs and regrab. Builder checked pointer fling, controls, audio toggle and R after button focus. Finish review inspected 1440×900 and 1280×720 desktop, 390×844 initial/stretching, and 320×568 resting captures. Screenshots do not independently certify motion timing, audio or contrast across animated frames.

The title deliberately keeps the installed Kaiti/STKaiti/KaiTi → serif fallback to avoid adding a font asset for two characters. Lettering therefore varies across platforms; this is a recorded exception to the self-hosted display-font preference.
