# 啪叽

Experience mode. Reference: the user’s small blue rubber wall-crawler, red waist and four red sticky pads. Keep the thin limbs, small unpainted head, pale tile wall, wide framing and compact controls.

Motion is driven by eleven masses connected by length constraints. Four pads attach independently on wall contact. Unequal hold times release them separately; remaining contacts stay fixed as gravity pulls the body around them. Released pads can catch again after a short cooldown. There is no authored rotation, circular flip trajectory or launch-selected falling direction. It is a small constraint simulation, not a volumetric soft-body model; self-collision is not modeled.

Each limb blends only its own segment chain, with roots following the torso and pads following the distal segment. Head, neck, eyes, torso and belt share the torso transform to keep their surfaces connected; a waist-to-head constraint limits neck folding. Joint constraints preserve the restrained rubber feel instead of stretching limbs into strings. A pointer grab chooses the nearest mass, so grabbing a hand lets the body hang beneath it. Button and Space throw through the same contact simulation. R resets; focused controls retain native keys. Pad color, adhesion and optional sound remain adjustable. No decorative idle motion.

Validation: `node toys/wall-slime/physics.test.js` covers fixed contacts, independent release and reattachment, bounded stretch, settling, hand grabbing, adhesion, 30 FPS, invalid input and rest-pose skinning. Browser checks cover rendered launch and errors. Existing Kaiti display lettering is retained.


Shared wall: play with the original Spider-Man, a wide-footed green gecko with a curved tail, a five-point pink star, and a squat blue frog. Each supplies its own rest proportions and contact points to the same solver. Gecko pads hold a little longer; the star has five independent contacts. All four toys retain independent physics and color materials. Hit testing selects the touched toy; the picker selects which toy to recolor. The button and Space throw all four, and R resets their positions. Wide screens use one row and narrow screens use a two-by-two arrangement. Adhesion is independent: Spider-Man 85%, gecko 100%, star 65%, frog 78%. Selecting a toy syncs its slider; reset and resize preserve these settings. Group throws target the top of the wall, using two staggered rows on narrow screens.

The star uses one closed, indexed cushion surface rather than overlapping limb tubes. Smooth skin weights keep its center on the same transform as its eyes while the tips bend; additional inner-arm constraints limit collapse. Regression checks require a closed two-face-per-edge mesh and shared face/center binding.

Group throws vary the upper-wall target, initial angle, sideways impulse, speed and angular velocity; gravity and contacts determine subsequent motion. Manual dragging retains the user’s own throw.

Contact hold time is calibrated in seconds: `(0.8 + adhesion * 10)` multiplied by the toy grip and per-pad variation. Default randomized throws are regression-checked to last more than 15 seconds before settling, while low adhesion remains quick to release.

Separate toys use broad bounds followed by rounded body, limb and tail samples for depth contacts on every physics substep. Empty space inside the broad bounds does not count as contact. Overlap pushes the front toy away from the wall and releases its obstructed pins, preserving the rear toy’s anchors and any shared velocity toward the wall. This prevents interpenetration without claiming precise deformable surface stacking.

Group landing slots have distinct heights and are shuffled between toys on each throw. Narrow screens reduce launch rotation to keep the shuffled toys clear of the side edges. The shared throw planner is exercised by the 200-batch contact regression.
