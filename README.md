# vibe / ideas

English · [简体中文](README.zh-CN.md)

Small ideas, made playable. A collection of interactive experiments, useful tools, and things made just for fun.

[Explore the collection](https://huccct.github.io/vibe/)

## Ideas

<!-- ideas:start -->
| Idea | Description | Made with |
| --- | --- | --- |
| [Splat!](toys/wall-slime/) | That sticky childhood toy. Grab it, fling it against a wall, and watch it stretch, peel, and plop down. | gpt-6-astra |
| [Digital Demolition](toys/demolition/) | Turn a public website into a destructible arcade level. Run, fly, shoot and throw grenades, then rewind the damage. | gpt-6-astra |
| [Water Ring Toss](toys/water-rings/) | A handheld water ring toy with two pumps and an underwater backdrop. Press either button and tilt the toy to land rings on the pegs. | gpt-6-astra |
| [Zhang Heng’s Seismoscope](toys/fly-cube/) | Eight dragons, eight toads. Trigger a vibration, watch a bronze ball fall, and reveal an illustrative internal mechanism. | gpt-6-astra |
| [West Lake · Leifeng Pagoda](toys/west-lake/) | A reference-based reconstruction of Leifeng Pagoda, using official dimensions and public terrain data. | gpt-6-astra |
| [Night Emotion Data Office](toys/worry-paper-mill/) | Register a worry, encode it, and press it into a one-of-a-kind pixel paper record. | gpt-5.6-sol |
| [RIPPLE MIRROR](toys/armor-up/) | Move your hands to ripple and twist your live camera reflection. | gpt-5.6-sol |
| [Bead Pattern Maker](toys/bead-pattern/) | Turn an image into an editable, printable fuse-bead pattern with a color and quantity list. | gpt-5.6-sol |
| [Movable Type Press](toys/movable-type/) | Set mirrored wooden type, roll the ink, pull the press, and peel away a print whose imperfections are entirely your own. | gpt-5.6-sol |
| [Bambu Lab A1 Print Desk](toys/a1-printer/) | An unofficial Three.js A1 study at work. Orbit around it as a ripple vase grows layer by layer. | gpt-5.6-sol |
| [Mythical Beast Field Guide](toys/shan-hai-beasts/) | Turn a page and meet a beast no ancient book remembered. | gpt-5.6-sol |
| [Gravity Calligraphy](toys/gravity-calligraphy/) | Ink refuses to stay on the page. Release a stroke and let gravity and wind take over. | gpt-5.6-sol |
| [chladni](toys/chladni/) | Nodal lines solved out of the standing wave equation. Twelve thousand grains of sand find the spots that don't vibrate and settle there. | gpt-5.6-sol (later edits) |
| [flow field](toys/flow-field/) | A few thousand particles drift along a noise field, trails piling up into streamlines. Your cursor pushes them around. | gpt-5.6-sol (later edits) |
| [pixel sort](toys/pixel-sort/) | Pixels sorted by luminance into smeared glitch streaks. Drop in your own image, download the result. | gpt-5.6-sol (later edits) |
<!-- ideas:end -->

Model credits name the AI models used to create each idea. Missing records are marked “To be added”; editors and libraries are not model names.

## Run locally

```sh
pnpm dev
```

Open http://localhost:4173. Native ES modules; no install or build step.

## Add an idea

```sh
pnpm new my-idea
```

Build in `toys/my-idea/`. Fill in the bilingual title, description, tags, and `models` array in `meta.json`. Use confirmed model names; leave the array empty when unknown. Keep a link back to the collection.

```sh
pnpm sync
```

Updates the gallery registry and both README indexes. New ideas are welcome in [Issues](https://github.com/huccct/vibe/issues).

## Deployment and license

Pushes to `main` deploy automatically to GitHub Pages.

Code is [MIT](LICENSE). Third-party models and assets retain their own licenses; see the source notes in each idea.
