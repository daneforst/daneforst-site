# RoomScan: notes for Claude

`ios/` is the iPhone capture app (SwiftUI + ARKit + RealityKit). `process/roomscan.py` turns a scan into 3D. `README.md` has the whole workflow.

## Scans are private

Scans are photos of the inside of the user's home. Keep them in `roomscan/scans/` (gitignored) or outside the repo. Never `git add` a scan, its `out/` folder, crops or models. This repo publishes to a public website.

## Processing a scan

Run from `roomscan/process/`:

```sh
python3 roomscan.py info SCAN        # sanity check
python3 roomscan.py cloud SCAN       # out/cloud.ply
python3 roomscan.py mesh SCAN        # out/mesh.ply, needs open3d
python3 roomscan.py keyframes SCAN   # out/keyframes/*.jpg + contact-sheet.jpg + index.json
python3 roomscan.py boxes SCAN       # out/boxes/*.jpg: objects.json boxes drawn on their photos
python3 roomscan.py locate SCAN      # out/objects.json (3D boxes) + out/crops/<id>.jpg
python3 roomscan.py view SCAN        # browser viewer
```

## Finding objects: writing SCAN/objects.json

Look at `out/keyframes/contact-sheet.jpg` first, then open individual keyframes. Every keyframe is already upright, and is named after its frame number (`000412.jpg` is frame 412). Any frame in `frames.json` can be used, not just the keyframes.

```json
{
  "objects": [
    {"id": "desk", "label": "walnut standing desk", "category": "furniture",
     "frame": 412, "bbox": [0.12, 0.41, 0.88, 0.97]},
    {"id": "monitor", "label": "27 inch monitor", "category": "tech",
     "views": [
       {"frame": 412, "bbox": [0.31, 0.18, 0.62, 0.44]},
       {"frame": 530, "bbox": [0.08, 0.22, 0.40, 0.51]}
     ]}
  ]
}
```

- `bbox` is `[left, top, right, bottom]` as fractions of the upright photo's width and height, with (0, 0) at the top left.
- Keep boxes tight around the one object. Whatever else is inside the box and in front of the wall behind it gets measured as part of the object.
- Prefer photos where the whole object is in frame, seen from a meter or two away. Add a second or third view from a different side (`views`) for anything big: one view only sees the near faces, so it under-measures depth.
- `id` becomes the file name for the crop and the model. Keep it short, lowercase, hyphenated, and unique.
- `category` groups the rows in the knolled layout: use a small set like furniture, tech, lighting, decor, plants, storage, tools, books.
- After writing the file, run `boxes` and look at `out/boxes/*.jpg`. Fix any box that's off, then run `locate`.

`locate` prints each object's measured size. Check them against common sense: a desk is about 75 cm tall, a door 200 cm. A size that's far off usually means the box caught a neighbor or the view was too oblique. Fix the box or add a view.

## 3D models for knolling

`locate` writes a padded crop of each object to `out/crops/<id>.jpg`. Turn each crop into a GLB with an image-to-3D model and save it as `out/models/<id>.glb`. The viewer swaps it in for the box and scales it to the measured height. Image-to-3D services usually charge per model, so confirm with the user before running a batch.

Optional per-object fields in objects.json, carried through by `locate`:

- `modelYaw`: degrees to turn the model if it faces the wrong way.
- `modelScale`: an exact scale factor, if the height-based fit is wrong (for example, something lying down).

## Conventions the code relies on

- ARKit world space: meters, +Y up. `transform` in frames.json is camera-to-world, row-major. Cameras look down -Z. Image +v runs down, so a pixel back-projects to `(x, -y, -d)`.
- Photos are stored in the sensor's landscape orientation. `upright_turns()` works out the rotation from gravity, and everything shown to people or to Claude is turned upright first.
- Intrinsics are in RGB pixels. Scale them to the depth map with `Scan.intrinsics(frame, w, h)`.
- After changing the processing code, rerun `python3 tests/synthetic_scan.py /tmp/fake-room` and the pipeline on it. `truth.json` there holds the real object boxes to compare against.
