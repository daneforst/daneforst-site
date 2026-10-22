# RoomScan

A small iPhone app for capturing rooms properly, plus the scripts that turn what it captures into a 3D room you can orbit, measure, and pull apart into a knolled flat-lay.

```
iPhone (LiDAR Pro model)                      Mac
┌──────────────────────────┐   AirDrop    ┌──────────────────────────────────────────────┐
│ RoomScan app             │   .zip       │ process/roomscan.py                          │
│  photos  (rgb/*.jpg)     │ ───────────▶ │  cloud / mesh   → the room in 3D             │
│  depth   (depth/*.png)   │              │  keyframes      → sharp photos to spot things │
│  pose    (frames.json)   │              │  locate         → measured 3D boxes + crops   │
│  coverage overlay        │              │  view           → browser viewer + knolling   │
└──────────────────────────┘              └──────────────────────────────────────────────┘
```

The point of rolling your own: you keep every raw photo, its LiDAR depth map, and exactly where the phone was when it took it, instead of whatever a scanning app decides to bake out of them. Nothing has to be guessed afterwards. Each depth pixel goes straight out along its camera ray into one shared, true-scale world, and takes its color from the photo. And the app shows you which surfaces still need photos, so you decide when the room is done.

---

## 1. Put the app on your iPhone

You need a Mac with Xcode 16 or newer, a cable, and an iPhone with LiDAR (any Pro or Pro Max from the 12 Pro on).

1. Open `roomscan/ios/RoomScan.xcodeproj` in Xcode.
2. Click the **RoomScan** project in the sidebar, then the **RoomScan** target, then **Signing & Capabilities**. Set **Team** to your Apple ID (Xcode › Settings › Accounts › + if it isn't there yet).
   If Xcode says the bundle identifier is taken, change `com.daneforst.roomscan` to anything unique.
3. Plug in the iPhone, pick it as the run destination at the top of the window, and press **Run** (⌘R).
4. The first time, the phone will ask you to turn on **Developer Mode** (Settings › Privacy & Security › Developer Mode, then restart) and to trust your developer profile (Settings › General › VPN & Device Management).

With a free Apple ID the app stops opening after 7 days. Plug in and press Run again to renew it. A paid developer account makes that a year.

## 2. Scan a room

- Turn the lights on. Tap **+**, then walk slowly around the room.
- Photos save themselves as you move, roughly one every 15 cm or 12° of turn. The camera button forces one.
- The mesh overlay is the to-do list: **red** surfaces still need a photo from within 3 m, **green** ones are done. The ring at the top right is the share of the room that's green.
- Get close (half a meter to two meters) to anything you'll want as its own 3D object later.
- When the ring stops climbing, the app says so. Tap **Save room**.
- Tap the name at the top to rename the scan. The gear on the scan list turns on 4K photos: sharper textures, bigger files.

## 3. Get the scan onto your Mac

On the scan list, tap the share icon next to a scan and AirDrop it. You get a `.zip`. Unzip it into `roomscan/scans/` in this repo. That folder is in `.gitignore`, so photos of your house never get committed. The scans are also in the Files app under On My iPhone › RoomScan.

## 4. Build the 3D room

```sh
cd roomscan/process
python3 -m pip install -r requirements.txt

python3 roomscan.py info  "../scans/Office 2026-10-22 103200"
python3 roomscan.py cloud "../scans/Office 2026-10-22 103200"   # colored point cloud
python3 roomscan.py mesh  "../scans/Office 2026-10-22 103200"   # solid surface (needs: pip install open3d)
python3 roomscan.py view  "../scans/Office 2026-10-22 103200"   # opens the viewer
```

`--voxel 0.005` gives finer detail (slower, bigger files). `--every 3` uses every third photo for a quick preview.

In the viewer, drag to orbit, right-drag to pan, and drag the **Ceiling cut** slider to see inside. Click any of the little camera frustums along the path to see the photo it took and where it was standing.

## 5. Objects and knolling, with Claude

This is the part from the Wes Bos video: every object in the room as its own true-size 3D model, laid out flat.

1. `python3 roomscan.py keyframes SCAN`: picks the sharpest photo from each stretch of the walk, turns it upright, and makes a contact sheet.
2. Open Claude Code in `roomscan/` and ask something like *"Look through the keyframes in scans/Office…/out/keyframes and write objects.json for everything worth modeling."* `CLAUDE.md` in this folder tells it the format and how to check its boxes with `python3 roomscan.py boxes SCAN`.
3. `python3 roomscan.py locate SCAN`: turns each 2D box into a measured 3D box (true size, from the LiDAR) and saves a clean crop of each object in `out/crops/`.
4. Turn each crop into a 3D model with an image-to-3D generator (Meshy, Tripo, Rodin, Hunyuan3D or TRELLIS all work), and save it as `out/models/<id>.glb`. If Claude has an image-to-3D connector (Higgsfield's has one), it can run the crops through it for you.
5. `python3 roomscan.py view SCAN` and press **Knolled** (or K). Every object flies out of the room into rows by category, scaled to its measured height. Objects without a model yet show as measured boxes.

## What's in a scan

```
Office 2026-10-22 103200/
  frames.json          index: device, image sizes, and per photo its files, intrinsics and pose
  rgb/000001.jpg       photo, in the sensor's landscape orientation
  depth/000001.png     LiDAR depth, 16-bit, millimeters (0 = no reading), 256 x 192
  confidence/000001.png  LiDAR confidence per depth pixel: 0 low, 1 medium, 2 high
  mesh.obj             ARKit's own rough room mesh, world space
  out/                 everything the scripts make
```

Coordinates are ARKit's: meters, +Y up, origin wherever the scan started. `transform` is the camera-to-world matrix (row-major). The camera looks down its own -Z axis, so a depth pixel `(u, v)` at depth `d` sits at `((u - cx) / fx * d, -(v - cy) / fy * d, -d)` in camera space.

## Trying it without a phone

`process/tests/synthetic_scan.py` ray-traces a fake room with a desk, a cabinet and a crate, and writes it out exactly like the app does, with the true object sizes alongside.

```sh
python3 tests/synthetic_scan.py /tmp/fake-room
python3 roomscan.py cloud /tmp/fake-room && python3 roomscan.py locate /tmp/fake-room && python3 roomscan.py view /tmp/fake-room
```

## Troubleshooting

- **The overlay stays red.** Red means not yet photographed from within 3 m. Get closer, and check the status under the scan name says Tracking.
- **The room looks doubled or smeared.** Tracking drifted. Scan one room at a time, move slowly, and finish near where you started so ARKit can close the loop.
- **The viewer is blank.** It loads three.js from a CDN, so it needs internet.
- **`pip install open3d` fails.** There's no wheel for your Python yet. Use 3.12, for example `uv run --python 3.12 --with numpy --with pillow --with open3d roomscan.py mesh SCAN`.
- **The Xcode project won't open** (older Xcode). Make a new iOS App project called RoomScan (SwiftUI, iOS 17), delete its generated Swift files, drag in everything from `ios/RoomScan/`, and add *Privacy - Camera Usage Description* under the target's Info tab.
