# UNDERTALE web rebuild

A from-scratch HTML + JavaScript rebuild of the decompiled GameMaker project of UNDERTALE
(`undertale-master`). The original game logic (about 5,800 object events plus 170 scripts) is
translated from GML into JavaScript and runs on a small GameMaker-compatible engine written
for the browser. No plugins, no server, no build step needed to play.

---
## How to run it via GitHub Pages **(works with mobile devices!)**
1. **Go to:** [goshdakirby.github.io/UTWeb](goshdakirby.github.io/UTWeb)
2. **That's it!**

## How to run it locally

1. **Unzip** `UndertaleWeb.zip` somewhere, for example your Desktop. You get a folder called
   `UndertaleWeb` containing `index.html`, `engine`, `data`, `tools` and this README.
2. **Double-click `index.html`.** It opens in your default browser. Wait for "Loading
   graphics..." to finish, then click or press any key to start.

That's it. Most web-browsers all work straight from the file.

### If double-clicking doesn't work

Some locked-down browsers refuse to load local files. In that case, serve the folder instead.
Open a terminal in the `UndertaleWeb` folder and run either of these:

```
python -m http.server 8000
```
```
npx serve .
```

Then open <http://localhost:8000> in your browser.

On Windows with WSL you can also copy the folder to
`/mnt/c/Users/joshu/Downloads/` and double-click `index.html` from Explorer.

---

## Controls

| Key | Action |
|---|---|
| Arrow keys | Move / navigate menus |
| Z or Enter | Confirm |
| X or Shift | Cancel |
| C or Ctrl | Menu |
| F4 | Toggle fullscreen |
| Hold Esc | Quit to the "game has closed" screen |

A gamepad also works (through the game's own joystick settings).

### Phones and tablets

On a touch screen the page adds on-screen controls: a joystick on the left for moving (it
works in 8 directions, like holding two arrow keys) and Z (confirm), X (cancel) and C (menu)
buttons on the right. Held the long way up, the game sits at the top and the controls sit
underneath it; turned sideways, the controls sit on either side of the game. Either way they
never cover the picture, and the layout switches by itself when you rotate the device. The
small square button opens fullscreen. Add `?touch=1` to the address to force the controls on
(for example on a touch screen laptop) or `?touch=0` to hide them.

Phone browsers usually cannot open a page straight from a file, so serve the folder from your
computer instead: run `python -m http.server 8000` in the `UndertaleWeb` folder, then on the
phone (on the same Wi-Fi) open `http://<your computer's IP address>:8000`.

Sound starts after your first click or key press because browsers block audio until you
interact with the page. The music is in `.ogg` format: Chrome, Edge and Firefox play it; older
Safari versions do not (the page shows a notice if that happens).

## Saves

The game's save files (`file0`, `file8`, `file9`, `undertale.ini`, etc.) are written to your
browser's local storage, under keys starting with `undertale_web:`. They survive closing the
browser. They are per browser, so Chrome and Firefox keep separate saves. To wipe everything,
use the game's own Reset option, or clear site data for the page in your browser settings.

## Optional URL switches

Add these after `index.html` in the address bar (for example
`index.html?errors`):

| Switch | Effect |
|---|---|
| `?errors` | Shows any script errors in a small red box in the corner |
| `?seed=123` | Makes the random number generator deterministic |
| `?autostart` | Skips the "press any key" screen |
| `?touch=1` / `?touch=0` | Forces the on-screen touch controls on or off |
| `?par=4` | Loads fewer images at once (default 16). Use a small number if loading stalls or fails on a slow machine |

---

## What was fixed

### Damage done by the decompiler (all repaired automatically at build time)

- **Every `switch` statement had its case labels reversed** (and rotated by one in `SCR_TEXT`).
  Without this fix almost every conversation in the game shows the wrong text.
- **Every animated sprite had its frames in reverse order** (digit sprites counted 9 to 0).
- **Every sprite frame was exported cropped** to its visible pixels, with the crop offsets
  thrown away. Frames are put back on their original canvases (exactly, for 800+ sprites,
  using the bounding boxes the project still records). This is why, for example, Froggit's
  head and legs line up again.
- **Numbers written with a comma** in the text typing script (`1,2` instead of `1.2`).
- **The single backslash string** was mangled into `"\" + chr(ord('"'))`.
- **Line breaks inside the dust (vapor) data** replaced the letter `m`, breaking every
  monster's death animation.
- **Inverted "does this exist" checks.** In about two dozen places the decompiler turned
  `instance_exists(x) && x.value` into `!instance_exists(x) && x.value`, which can never work.
  This broke portrait cleanup in the dialogue box and would have stalled the Papyrus and Alphys
  dates, several Hotland and Waterfall scenes and the end of battles.
- **Lost parentheses in the depth formula.** `50000 - (y*10 + height*10)` became
  `50000 - y*10 + height*10`, so taller sprites were drawn in front of things they should be
  behind (Frisk over Toriel, the save star over Frisk). Fixed in the shared depth script and the
  four other places with the same formula. The same dropped parentheses broke Toriel's hallway
  mirror (`horizon - (y - horizon)`), which now shows your reflection again.
- **Lost collision types.** Every sprite was exported as "precise" collision. Sprites with a
  hand-drawn collision box now use that box as a rectangle, which is what lets Napstablook
  block the corridor. Invisible walls, doors, markers and trigger boxes are drawn as hollow
  outlines in the project, so as "precise" shapes they only collided on the outline; they now
  use a rectangle (slopes keep their triangle shape). This is what makes the Waterfall bridge
  seed puzzles work: the seeds can be thrown, slide and bloom into a bridge again.
- **Cutscene triggers drawn by mistake.** Three trigger objects use the blue editor marker as
  their sprite but were exported as visible. The one in Undyne's first scene is stretched to the
  full height of the room and showed as a blue bar over her; they are hidden again.
- **Wrong frame positions** for Grillby behind the bar (he sat on the counter instead of behind it,
  now lined up with his walking sprite), for the dark-room shadow under Frisk before Undyne's
  first scene (it was drawn at head height) and for Undyne's floor spears (the blue warning
  circle sat at the spear tip instead of on the floor) and for Undyne collapsing in Hotland (she
  lay in mid air above the floor).
- **Lost "camera follows player" setting** in every room. The camera now follows and clamps to
  the room edge like the original.
- **Lost room background layers** in 21 rooms (the Ruins entrance, the Ruins city view where the
  toy knife is, the stairwells in Toriel's and Asgore's houses, Undyne's house, the castle in the
  Waterfall rain walk, the crag Undyne stands on before her fight, the shops and others) are
  restored from the unused background images.
- **Missing path data.** All 38 movement paths (Toriel's walks, the Froggit head bob,
  Papyrus's moves and more) were rebuilt from the room layouts and the code that uses them.
- **A missing room.** The Hotland room between the hot dog stand and the "sorry" room was not
  in the project at all. It was rebuilt (as `room_fire_walkandbranch`) with the exits, NPC,
  phone update and genocide forcefield that the game code expects there.
- **Portraits referenced by bare numbers.** Toriel, Papyrus, Sans, Flowey, Alphys, Undyne,
  Asgore and Asriel portraits, the Snowdin shopkeeper, Asgore's battle body, the news anchor
  poses and the microwave spaghetti were all pointing at the wrong images. Each expression was
  matched to its sprite using the dialogue lines that use it.
- **Objects and sprites referenced by bare numbers.** A few hundred places in the code name an
  object or sprite only by its index, with no name the decompiler could check. Where those
  indices pointed at the wrong thing, they are now named explicitly: the game over screen (which
  froze on a stray elevator panel), the bodies of Snowdrake, Doggo, the Royal Guards, Gyftrot,
  Shyren, the Dogi and other monsters, Frisk's umbrella, shadow, wet and burnt walk sprites,
  Napstablook's and Temmie's overworld sprites, and Papyrus's heads on the date.
- **Sprite index table corrected for bare numbers.** About 230 sprite numbers that the code uses
  without a name are now pinned to the right sprite in the index table itself, so every use
  agrees (including comparisons). This restores Papyrus's and Sans's bones (they showed as small
  squares), the Gauntlet of Deadly Terror (spear, mace, dog and cannon instead of a giant rope),
  the igloo roofs in Snowdin, the fog before the Papyrus fight (it showed an umbrella bucket
  pattern), Undyne's house and date props, Mettaton EX's legs and arms, Grillby's counter,
  the water cooler, Muffet's spiders and more. Also Sans's and Frisk's food at Grillby's (they
  showed as two extra copies of Sans), Ice Cap's and Jerry's hurt pictures and Vulkin's faces.
  The water reflections in Waterfall's puddles (Frisk, Frisk with the umbrella and Monster Kid
  showed random marker letters or the wrong direction) are also back.
- **Sound index table corrected.** Many sounds are referenced only by number, and the table
  that turns numbers into sound files had guessed wrong in places. The game's own music loader
  (`scr_getmusindex`) lists every music file with its number, which pins about 50 of them exactly: the
  Waterfall piano notes, Shyren's humming, Asriel's attack sounds, the drum kit, the dial up
  tones and the cast music. Monster hurt sounds (Aaron, Snowdrake, Madjick, Glyde, Knight Knight
  and the generic one) were also matched by name; Aaron's used to play the dial up static.
- **Inverted "wait for the text" check** in Papyrus's capture sequence. Losing to Papyrus froze
  after his speech; it now sends you to the garage like the original.
- **Background pictures exported trimmed.** Like sprite frames, background images lost their
  empty borders. Where a room places the whole picture as a tile, the real size is known and the
  picture is put back in place; this is what made the crystal rocks at the edges of the Waterfall
  castle view cover the path with a black block.
- **Lost parallax trigger.** Frisk's end step tells the scrolling backgrounds to update, but the
  decompiler wrote the target as object 0, so no parallax background ever moved. Restored; the
  castle in the Waterfall rain walk (which was also missing its background layer) now drifts
  across the sky, as do the Snowdin, Core and last Ruins corridor backdrops.
- **Missing `credits.txt`** (the backer list for the final credits) is replaced by a short
  stand-in so that ending no longer freezes.

### Bugs in the original game (fixed; see "Playing it exactly as shipped" to undo)

- Sans's bullets set `innage_karma` instead of `innate_karma`, so the karma reduction never
  happened.
- The Sound Test's LEFT key moved forward instead of back.
- The "MTT" name check could never match because it compared against a lowercased name.
- Flowey's final battle set `facemotion` instead of `faceemotion`.

### Web port behaviour

- Step, alarm, keyboard and collision events run object by object in resource order, like
  GameMaker Studio. Some scenes rely on it (talking to Napstablook in the leaves used to lock the
  game because the dialogue box finished after the ghost looked for it).
- Writing an array slot through an object name (`obj_specialtile.alarm[0] = 2`) now reaches
  every instance of that object, as in GameMaker. Before, only the first one changed, which is
  why the colour tile puzzle stayed grey.
- An instance with no sprite counts as outside the room every step, as in GameMaker. Several
  controllers rely on this to run their Outside Room event as a second step event: the spear rain
  you get when one of Undyne's floor spears hits you (it never ended), Undyne's battle body
  animation and a few screen effects.
- Solid collisions follow GameMaker exactly: both objects are put back where they were, and
  collision events run object by object in resource order. This fixes rock pushing (no speed
  boost, no walking through rocks) and makes the talking rock respond when you walk into it.
- Movement paths that are started paused (speed 0) wait instead of ending at once, and a paused
  path no longer overrides positions the game sets by hand. This is what
  kept Toriel frozen in place in the spike room.
- Images load 16 at a time, and an image that fails to load is retried a few times before it
  counts as missing, so slow machines no longer stop with "Could not find the game files".
- A room made non-persistent after you leave it (loading a save does this to the room a battle
  started from) is rebuilt fresh the next time, as in GameMaker. And on Continue after a game
  over, the battle's room stops running the moment the save loads; before, Mad Dummy's cutscene
  ran one more step and left Frisk unable to move.
- Views follow GameMaker more closely: `view_angle` tilts the view, a follow border wider than half
  the view keeps the followed object centred, and a view switched on by an earlier view's Draw
  event is drawn in the same frame. Together with view 1's lost settings for that room, this
  restores the tilted close ups of Undyne during her speech before the fight, with the text box
  staying upright at the bottom.
- Sounds a browser refuses to start are retried on your next key press, and finished sound
  players are released so long play sessions do not run out of them.
- Runs at a fixed 30 frames per second like the original, scaled to fit the window with
  crisp pixels.
- Save files and settings go to browser storage instead of the Windows AppData folder.
- Fullscreen, window shaking and "close the game" are emulated inside the page.

## Known approximations

- Rebuilt paths and the rebuilt Hotland room follow the code closely but are not
  pixel-identical to the originals, which no longer exist in the project.
- A small number of sprites store a hand-drawn collision box instead of an automatic one;
  for those, frames of different sizes are aligned by best fit (bottom-aligned, centred).
- The final credits show a short stand-in list instead of the backer names.
- The decompiler never writes parentheses after a minus sign, so any other `a - (b + c)` in the
  original now reads `a - b + c`. The depth formula was the visible case; others may exist.
- Toriel's overworld objects are not solid in the game data, so Frisk can walk through her
  in the Ruins. That matches the project as shipped.
- Developer and debug rooms (`TESTROOM`, `room_spritecheck`, the old unused rooms) are left as
  they are.

---

## Rebuilding the data files (only if you change something)

`data/game_data.js` and `data/game_code.js` are generated from `undertale-master` by the
build script. You only need this if you edit the project or the fix lists. Requires Node.js 18+.

```
node tools/build.js                 # reads ./undertale-master, writes ./data
node tools/build.js path/to/undertale-master path/to/output
node tools/build.js --no-bugfix     # "Playing it exactly as shipped": keeps the 4 original bugs
```

Files in `tools/`:

| File | Purpose |
|---|---|
| `build.js` | Reads the project, applies repairs, writes the two data files |
| `gml.js` | GML to JavaScript translator |
| `maps.json` | Resource index order recovered from the compiled game's numeric references |
| `extra.json` | Bug fix list, rebuilt paths, rooms, background layers and sprite name tables |
| `test_run.js` | Headless playtest driver (needs Playwright) |
| `room_sweep.js` | Visits every room, screenshots it and reports script errors |

## Testing done

- Full new-game run: intro story, title, naming screen, Flowey's encounter and battle, Toriel's
  rescue, the first Ruins rooms (Toriel's walk, the switch demonstration puzzle), a Froggit
  fight with ACT and MERCY, a random encounter, and saving then continuing after a page reload.
- Every one of the 335 rooms was loaded and run: no script errors outside the developer test
  room.
- Spot checks of Snowdin, Waterfall, Hotland (including every exit of the rebuilt room), the
  Core, New Home, the True Lab, shops and the Asgore fight.
- Runs at roughly 2 to 3 ms per frame (the budget is 33 ms), so it plays smoothly on modest
  hardware. Also checked with the browser's normal local file security (no special flags).
