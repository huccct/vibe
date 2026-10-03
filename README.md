# vibe / ideas

**English** · [简体中文](README.zh-CN.md)

**Serious about playing around.**

Fling a sticky childhood toy. Demolish a webpage. Let handwritten ink fall off the page. vibe is a playground of ideas we build with AI, turning curiosity, nostalgia, and passing thoughts into things you can actually play with.

**[Enter the playground →](https://huccct.github.io/vibe/)** · [Share an idea](https://github.com/huccct/vibe/issues)

## What feels fun today?

Start with a random play ticket on the homepage, or pick a mood:

- **Let off some steam:** fling the goo in [Splat!](https://huccct.github.io/vibe/toys/wall-slime/), or break a page and rewind the damage in [Digital Demolition](https://huccct.github.io/vibe/toys/demolition/).
- **Get hands-on:** pump the buttons in [Water Ring Toss](https://huccct.github.io/vibe/toys/water-rings/), or pull a print at the [Movable Type Press](https://huccct.github.io/vibe/toys/movable-type/).
- **Make something yours:** write falling ink with [Gravity Calligraphy](https://huccct.github.io/vibe/toys/gravity-calligraphy/), or turn a picture into a craft project with [Bead Pattern Maker](https://huccct.github.io/vibe/toys/bead-pattern/).

No installation needed to explore. Camera experiences need permission; some effects require WebGL or external resources.

## The idea shelf

The homepage collection, newest first. Names below link to source folders; visit the [live collection](https://huccct.github.io/vibe/) to play.

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

## About the model credits

Each entry lists verified AI models using the original identifiers from its production records. These are confirmed contributors, not necessarily an exhaustive history.

“Later edits” confirms work on the page, theme, or metadata; it does not identify the original creator. Coding credits do not identify image-generation models either. Unknown models stay unknown. See the [curation record](CURATION.md) (in Chinese) for decisions and evidence.

## Play locally

Use Node.js 22 or newer:

```sh
node scripts/serve.mjs 4173
```

Open [localhost:4173](http://localhost:4173/). `pnpm dev` works too. No dependency installation or build step: the browser runs native ES modules.

## Add your idea

```sh
node scripts/new-toy.mjs my-idea
```

Build in `toys/my-idea/` and keep a link back to the collection. Update the bilingual title, description, tags, color, and date in `meta.json`. Put confirmed model names in the `models` array; leave it empty when unknown.

```sh
node scripts/sync.mjs
node scripts/check-gallery.mjs
```

Sync updates the gallery registry and both README tables. Do not edit those tables by hand. Set `hidden: true` to take an unfinished idea out of the collection while keeping its source.

An idea does not need an implementation plan. Open an [Issue](https://github.com/huccct/vibe/issues), describe what you would like to play, and include its inspiration.

## Publishing and license

Pushes to `main` run the index and sync checks in GitHub Actions, then deploy to GitHub Pages.

Code is [MIT](LICENSE). Third-party models, images, and other assets retain their own licenses; check the source notes in each idea before reusing them.
