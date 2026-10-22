#!/usr/bin/env python3
"""
============================================================
roomscan.py: turn a RoomScan photo dump into a 3D room

    python3 roomscan.py info      SCAN    what's in the scan
    python3 roomscan.py cloud     SCAN    colored point cloud      -> SCAN/out/cloud.ply
    python3 roomscan.py mesh      SCAN    solid textured surface   -> SCAN/out/mesh.ply   (needs open3d)
    python3 roomscan.py keyframes SCAN    sharp, upright photos    -> SCAN/out/keyframes/
    python3 roomscan.py boxes     SCAN    objects.json boxes drawn on their photos, to check them
    python3 roomscan.py locate    SCAN    2D boxes in objects.json -> 3D boxes + crops in SCAN/out/
    python3 roomscan.py view      SCAN    3D viewer in the browser (room, cameras, knolled objects)

SCAN is the unzipped folder the iPhone app exports: frames.json, rgb/, depth/, confidence/, mesh.obj.

Why this works: every photo was taken with a LiDAR depth map and the phone's exact position and
direction (frames.json). So nothing has to be guessed the way photogrammetry guesses. Each depth
pixel is pushed out along its camera ray, into the shared world space ARKit tracked, and gets the
color of the photo pixel it came from. Every photo lands in the same room, at true scale.
============================================================
"""
import argparse
import http.server
import json
import math
import sys
import threading
import urllib.parse
import warnings
import webbrowser
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# ARKit cameras look down -Z with +Y up. OpenCV/Open3D cameras look down +Z with +Y down.
ARKIT_TO_CV = np.diag([1.0, -1.0, -1.0, 1.0])
ROTATIONS = [None, Image.Transpose.ROTATE_90, Image.Transpose.ROTATE_180, Image.Transpose.ROTATE_270]


class Scan:
    def __init__(self, folder):
        self.root = Path(folder).expanduser().resolve()
        manifest = self.root / "frames.json"
        if not manifest.exists():
            sys.exit(f"No frames.json in {self.root}. Point this at the unzipped scan folder.")
        self.meta = json.loads(manifest.read_text())
        self.frames = self.meta["frames"]
        if not self.frames:
            sys.exit("This scan has no photos in it.")
        self.by_index = {f["index"]: f for f in self.frames}
        self.out = self.root / "out"

    def frame(self, index):
        if index not in self.by_index:
            sys.exit(f"Frame {index} isn't in this scan (frames run {self.frames[0]['index']}..{self.frames[-1]['index']}).")
        return self.by_index[index]

    @staticmethod
    def pose(frame):
        """Camera-to-world 4x4 in ARKit's camera axes."""
        return np.array(frame["transform"], dtype=np.float64)

    def intrinsics(self, frame, width, height):
        """fx, fy, cx, cy rescaled from the RGB resolution to (width, height). Pixel centers sit on integers."""
        sx = width / self.meta["image"]["width"]
        sy = height / self.meta["image"]["height"]
        k = frame["intrinsics"]
        return k["fx"] * sx, k["fy"] * sy, (k["cx"] + 0.5) * sx - 0.5, (k["cy"] + 0.5) * sy - 0.5

    def depth(self, frame):
        """Meters as float32, 0 where the LiDAR had no reading."""
        return np.asarray(Image.open(self.root / frame["depth"]), dtype=np.float32) / 1000.0

    def confidence(self, frame):
        path = frame.get("confidence")
        if not path or not (self.root / path).exists():
            return None
        return np.asarray(Image.open(self.root / path), dtype=np.uint8)

    def rgb(self, frame):
        return np.asarray(Image.open(self.root / frame["rgb"]).convert("RGB"))


# ------------------------------------------------------------------ geometry

def backproject(depth, intrinsics, pose, mask):
    """Depth pixels where mask is set -> world points (N, 3), plus their pixel coordinates."""
    fx, fy, cx, cy = intrinsics
    v, u = np.nonzero(mask)
    d = depth[v, u].astype(np.float64)
    x = (u - cx) / fx * d
    y = (v - cy) / fy * d
    camera = np.stack([x, -y, -d, np.ones_like(d)])  # image +v runs down, ARKit +Y runs up
    return (pose @ camera)[:3].T, u, v


def depth_edges(depth, tolerance=0.06):
    """Pixels on a depth jump. LiDAR blends foreground and background there into 'flying' points."""
    pad = np.pad(depth, 1, mode="edge")
    center = pad[1:-1, 1:-1]
    jump = np.max([np.abs(center - pad[:-2, 1:-1]), np.abs(center - pad[2:, 1:-1]),
                   np.abs(center - pad[1:-1, :-2]), np.abs(center - pad[1:-1, 2:])], axis=0)
    return jump > tolerance * np.maximum(center, 1e-3)


def usable(depth, confidence, min_confidence, max_depth):
    mask = (depth > 0.05) & (depth < max_depth) & ~depth_edges(depth)
    if confidence is not None:
        mask &= confidence >= min_confidence
    return mask


def upsample(depth, mask, factor):
    """Bilinear upsampling that never blends a valid depth with a missing one."""
    if factor <= 1:
        return depth, mask
    h, w = depth.shape
    size = (w * factor, h * factor)
    weight = mask.astype(np.float32)
    summed = np.asarray(Image.fromarray(np.where(mask, depth, 0).astype(np.float32)).resize(size, Image.Resampling.BILINEAR))
    cover = np.asarray(Image.fromarray(weight).resize(size, Image.Resampling.BILINEAR))
    good = cover > 0.999
    return np.where(good, summed / np.maximum(cover, 1e-6), 0).astype(np.float32), good


def upright_turns(pose):
    """Quarter turns counter-clockwise that stand a photo upright, worked out from where gravity points in it.

    Photos are saved in the sensor's landscape orientation. Held in portrait, "up" in the
    scene points at the left edge of the raw image, so it needs three turns (one clockwise).
    """
    up = pose[:3, :3].T @ np.array([0.0, 1.0, 0.0])  # world up, in camera axes
    ux, uy = up[0], -up[1]                            # in image axes: +u right, +v down
    return int(np.argmax([-uy, ux, uy, -ux]))         # up points at: top, right, bottom, left


def to_raw(x, y, turns):
    """Normalized point in the upright photo -> the same point in the raw, as-saved photo."""
    for _ in range(turns):
        x, y = 1.0 - y, x
    return x, y


def to_upright(x, y, turns):
    for _ in range(turns):
        x, y = y, 1.0 - x
    return x, y


class VoxelGrid:
    """Averages points and colors per voxel, merging as it goes so memory stays bounded."""

    def __init__(self, size):
        self.size = size
        self.parts = []
        self.pending = 0

    def add(self, points, colors):
        q = np.floor(points / self.size).astype(np.int64) + (1 << 20)
        keys = (q[:, 0] << 42) | (q[:, 1] << 21) | q[:, 2]
        self.parts.append((keys, points.astype(np.float64), colors.astype(np.float64), np.ones(len(points))))
        self.pending += len(points)
        if self.pending > 6_000_000:
            self.merge()

    def merge(self):
        if not self.parts:
            return
        keys = np.concatenate([p[0] for p in self.parts])
        unique, inverse = np.unique(keys, return_inverse=True)
        merged = [unique]
        for column in (1, 2):
            values = np.concatenate([p[column] for p in self.parts])
            merged.append(np.stack([np.bincount(inverse, weights=values[:, c], minlength=len(unique)) for c in range(3)], axis=1))
        merged.append(np.bincount(inverse, weights=np.concatenate([p[3] for p in self.parts]), minlength=len(unique)))
        self.parts = [tuple(merged)]
        self.pending = len(unique)

    def result(self):
        self.merge()
        if not self.parts:
            return np.zeros((0, 3)), np.zeros((0, 3)), np.zeros(0)
        _, points, colors, hits = self.parts[0]
        return points / hits[:, None], colors / hits[:, None], hits


def write_ply(path, points, colors):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = np.empty(len(points), dtype=[("x", "<f4"), ("y", "<f4"), ("z", "<f4"),
                                        ("red", "u1"), ("green", "u1"), ("blue", "u1")])
    for i, axis in enumerate("xyz"):
        data[axis] = points[:, i]
    for i, channel in enumerate(("red", "green", "blue")):
        data[channel] = np.clip(np.round(colors[:, i]), 0, 255)
    header = ("ply\nformat binary_little_endian 1.0\ncomment RoomScan, ARKit world space, meters, +Y up\n"
              f"element vertex {len(data)}\n"
              "property float x\nproperty float y\nproperty float z\n"
              "property uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n")
    with open(path, "wb") as fh:
        fh.write(header.encode("ascii"))
        fh.write(data.tobytes())


def progress(i, total, label):
    if i + 1 == total or i % 10 == 0:
        print(f"\r  {label} {i + 1}/{total}", end="" if i + 1 < total else "\n", flush=True)


# ------------------------------------------------------------------ commands

def cmd_info(args):
    scan = Scan(args.scan)
    meta = scan.meta
    positions = np.array([f["position"] for f in scan.frames])
    walked = float(np.sum(np.linalg.norm(np.diff(positions, axis=0), axis=1))) if len(positions) > 1 else 0.0
    seconds = scan.frames[-1]["timestamp"] - scan.frames[0]["timestamp"]
    print(f"{meta.get('name', scan.root.name)}  ({meta.get('device', 'unknown device')}, {meta.get('created', '')})")
    print(f"  {len(scan.frames)} photos at {meta['image']['width']}x{meta['image']['height']}, "
          f"depth {meta['depth']['width']}x{meta['depth']['height']}")
    print(f"  {seconds:.0f} s of scanning, {walked:.1f} m walked")
    lo, hi = positions.min(axis=0), positions.max(axis=0)
    print(f"  phone stayed within {hi[0] - lo[0]:.1f} x {hi[1] - lo[1]:.1f} x {hi[2] - lo[2]:.1f} m (x, y, z)")
    print(f"  ARKit mesh: {'mesh.obj' if meta.get('mesh') else 'none'}")
    for name in ("cloud.ply", "mesh.ply", "keyframes/index.json", "objects.json"):
        print(f"  out/{name}: {'yes' if (scan.out / name).exists() else '-'}")


def cmd_cloud(args):
    scan = Scan(args.scan)
    frames = scan.frames[::args.every]
    grid = VoxelGrid(args.voxel)
    print(f"Fusing {len(frames)} photos into a {args.voxel * 100:g} cm point cloud")
    for i, frame in enumerate(frames):
        depth = scan.depth(frame)
        depth, mask = upsample(depth, usable(depth, scan.confidence(frame), args.min_confidence, args.max_depth), args.upsample)
        h, w = depth.shape
        points, u, v = backproject(depth, scan.intrinsics(frame, w, h), scan.pose(frame), mask)
        rgb = scan.rgb(frame)
        ih, iw = rgb.shape[:2]
        # the same pixel-center mapping the intrinsics use, from depth pixels to photo pixels
        ru = np.clip(np.round((u + 0.5) * iw / w - 0.5).astype(int), 0, iw - 1)
        rv = np.clip(np.round((v + 0.5) * ih / h - 0.5).astype(int), 0, ih - 1)
        grid.add(points, rgb[rv, ru])
        progress(i, len(frames), "photos")
    points, colors, hits = grid.result()
    keep = hits >= args.min_hits
    path = scan.out / "cloud.ply"
    write_ply(path, points[keep], colors[keep])
    print(f"Wrote {path} ({keep.sum():,} points; {(~keep).sum():,} seen fewer than {args.min_hits} times dropped)")
    print(f"Next: python3 {Path(__file__).name} view \"{scan.root}\"")


def cmd_mesh(args):
    try:
        import open3d as o3d
        import open3d.core as o3c
    except ImportError:
        sys.exit("The mesh step needs Open3D:  pip install open3d   (if pip finds no wheel, use Python 3.12)")
    scan = Scan(args.scan)
    frames = scan.frames[::args.every]
    # A sparse TSDF: each depth map votes for where surfaces are, block by block, and the
    # surface is wherever the averaged signed distance crosses zero.
    grid = o3d.t.geometry.VoxelBlockGrid(
        attr_names=("tsdf", "weight", "color"), attr_dtypes=(o3c.float32, o3c.float32, o3c.float32),
        attr_channels=((1), (1), (3)), voxel_size=args.voxel, block_resolution=8, block_count=20000)
    print(f"Integrating {len(frames)} photos into a {args.voxel * 100:g} cm TSDF volume")
    for i, frame in enumerate(frames):
        depth = scan.depth(frame)
        depth, mask = upsample(depth, usable(depth, scan.confidence(frame), args.min_confidence, args.max_depth), args.upsample)
        h, w = depth.shape
        color = Image.open(scan.root / frame["rgb"]).convert("RGB").resize((w, h), Image.Resampling.BILINEAR)
        millimeters = o3d.t.geometry.Image(o3c.Tensor(np.where(mask, np.round(depth * 1000), 0).astype(np.uint16)))
        pixels = o3d.t.geometry.Image(o3c.Tensor(np.ascontiguousarray(np.asarray(color))))
        fx, fy, cx, cy = scan.intrinsics(frame, w, h)
        k = o3c.Tensor(np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1]]))
        extrinsic = o3c.Tensor(np.linalg.inv(scan.pose(frame) @ ARKIT_TO_CV))  # world -> camera, OpenCV axes
        blocks = grid.compute_unique_block_coordinates(millimeters, k, extrinsic, 1000.0, args.max_depth)
        grid.integrate(blocks, millimeters, pixels, k, k, extrinsic, 1000.0, args.max_depth)
        progress(i, len(frames), "photos")
    # keep surfaces at least two photos agree on; one-off noise doesn't survive
    mesh = grid.extract_triangle_mesh(weight_threshold=min(2.0, len(frames))).to_legacy()
    # drop floating scraps: connected pieces much smaller than the room
    clusters, sizes, _ = mesh.cluster_connected_triangles()
    clusters, sizes = np.asarray(clusters), np.asarray(sizes)
    if len(sizes):
        mesh.remove_triangles_by_mask(sizes[clusters] < max(200, int(0.002 * sizes.sum())))
        mesh.remove_unreferenced_vertices()
    mesh.compute_vertex_normals()
    scan.out.mkdir(parents=True, exist_ok=True)
    path = scan.out / "mesh.ply"
    o3d.io.write_triangle_mesh(str(path), mesh)
    print(f"Wrote {path} ({len(mesh.vertices):,} vertices, {len(mesh.triangles):,} triangles)")


def sharpness(path):
    """Variance of the Laplacian on a small grayscale copy. Blurry photos score low."""
    img = Image.open(path)
    img.draft("L", (480, 480))
    g = np.asarray(img.convert("L").resize((480, 360)), dtype=np.float32)
    lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(lap.var())


def cmd_keyframes(args):
    scan = Scan(args.scan)
    out = scan.out / "keyframes"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.jpg"):
        old.unlink()
    frames = scan.frames
    print(f"Scoring {len(frames)} photos for sharpness")
    scores = []
    for i, frame in enumerate(frames):
        scores.append(sharpness(scan.root / frame["rgb"]))
        progress(i, len(frames), "photos")
    # one pick per stretch of the walk, so the picks cover the whole room; the sharpest in each stretch
    count = min(args.count, len(frames))
    bounds = np.linspace(0, len(frames), count + 1).astype(int)
    picks = [a + int(np.argmax(scores[a:b])) for a, b in zip(bounds[:-1], bounds[1:]) if b > a]

    index = []
    thumbs = []
    for i in picks:
        frame = frames[i]
        turns = upright_turns(scan.pose(frame))
        img = Image.open(scan.root / frame["rgb"]).convert("RGB")
        if turns:
            img = img.transpose(ROTATIONS[turns])
        img.thumbnail((args.size, args.size), Image.Resampling.LANCZOS)
        name = f"{frame['index']:06d}.jpg"
        img.save(out / name, quality=88)
        index.append({"frame": frame["index"], "file": f"keyframes/{name}", "turns": turns,
                      "width": img.width, "height": img.height})
        thumbs.append((frame["index"], img))
    (out / "index.json").write_text(json.dumps({"keyframes": index}, indent=2))
    contact_sheet(thumbs, out / "contact-sheet.jpg")
    print(f"Wrote {len(index)} upright keyframes and a contact sheet to {out}")


def contact_sheet(thumbs, path, columns=4, cell=360):
    rows = math.ceil(len(thumbs) / columns)
    sheet = Image.new("RGB", (columns * cell, rows * cell), (20, 20, 22))
    draw = ImageDraw.Draw(sheet)
    for n, (index, img) in enumerate(thumbs):
        tile = img.copy()
        tile.thumbnail((cell - 12, cell - 12))
        x, y = (n % columns) * cell, (n // columns) * cell
        sheet.paste(tile, (x + (cell - tile.width) // 2, y + (cell - tile.height) // 2))
        draw.rectangle([x + 6, y + 6, x + 92, y + 30], fill=(242, 194, 48))
        draw.text((x + 12, y + 11), f"frame {index}", fill=(0, 0, 0))
    sheet.save(path, quality=85)


def estimate_floor(scan, samples=40):
    """Floor height: the lowest big horizontal surface the LiDAR saw."""
    heights = []
    for frame in scan.frames[::max(1, len(scan.frames) // samples)]:
        depth = scan.depth(frame)
        mask = usable(depth, scan.confidence(frame), 2, 4.0)
        mask[::2, :] = False
        h, w = depth.shape
        points, _, _ = backproject(depth, scan.intrinsics(frame, w, h), scan.pose(frame), mask)
        heights.append(points[:, 1])
    y = np.concatenate(heights)
    if len(y) < 1000:
        return None
    low = np.percentile(y, 1.0)
    near = y[(y > low - 0.1) & (y < low + 0.1)]
    return float(np.median(near))


def surface_behind(depth, valid, u0, u1, v0, v1):
    """Depth of whatever the object stands in front of, at every pixel of its box.

    Read off a thin band of pixels just left and right of the box, row by row, and blended
    across in inverse depth (which is exactly linear across a flat wall or floor). Rows show
    wall up top and floor down low, so this follows both. Unknown where neither side is visible.
    """
    h, w = depth.shape
    band = max(2, (u1 - u0) // 10)
    sides = []
    for a, b in ((max(0, u0 - band), u0), (u1, min(w, u1 + band))):
        if b - a < 1:
            sides.append(np.full(v1 - v0, np.nan))
            continue
        strip = np.where(valid[v0:v1, a:b], depth[v0:v1, a:b], np.nan)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)  # all-empty rows
            sides.append(1.0 / np.nanmedian(strip, axis=1))
    left, right = sides
    t = (np.arange(u0, u1) - (u0 - band / 2)) / ((u1 + band / 2) - (u0 - band / 2))
    inverse = left[:, None] * (1 - t) + right[:, None] * t
    inverse = np.where(np.isnan(left)[:, None], right[:, None], inverse)
    inverse = np.where(np.isnan(right)[:, None], left[:, None], inverse)
    return 1.0 / inverse


def points_in_box(scan, frame, bbox, orientation, floor):
    """World points of the object inside a 2D box on one photo.

    The box also catches the wall behind the object and the floor under it. Those are the same
    surfaces seen just outside the box, so anything not clearly in front of them is dropped.
    Flat things hung on a wall have nothing in front, and fall back to a depth band around the
    middle of the box.
    """
    turns = upright_turns(scan.pose(frame)) if orientation == "upright" else 0
    x0, y0, x1, y1 = bbox
    corners = [to_raw(x, y, turns) for x in (x0, x1) for y in (y0, y1)]
    rx0, rx1 = min(c[0] for c in corners), max(c[0] for c in corners)
    ry0, ry1 = min(c[1] for c in corners), max(c[1] for c in corners)

    depth = scan.depth(frame)
    valid = usable(depth, scan.confidence(frame), 1, 6.0)
    h, w = depth.shape
    u0, u1 = int(np.clip(math.floor(rx0 * w), 0, w - 1)), int(np.clip(math.ceil(rx1 * w), 1, w))
    v0, v1 = int(np.clip(math.floor(ry0 * h), 0, h - 1)), int(np.clip(math.ceil(ry1 * h), 1, h))
    box = depth[v0:v1, u0:u1]
    box_valid = valid[v0:v1, u0:u1]
    if not box_valid.any():
        return np.zeros((0, 3))

    behind = surface_behind(depth, valid, u0, u1, v0, v1)
    known = np.isfinite(behind)
    in_front = box_valid & known & (box < behind - np.maximum(0.04, 0.03 * box))
    if in_front.sum() < 0.15 * box_valid.sum():
        du, dv = (u1 - u0) // 4, (v1 - v0) // 4
        middle = box[dv:box.shape[0] - dv, du:box.shape[1] - du][box_valid[dv:box.shape[0] - dv, du:box.shape[1] - du]]
        d0 = float(np.median(middle if middle.size else box[box_valid]))
        in_front = box_valid & (np.abs(box - d0) < 0.15)

    selected = np.zeros_like(valid)
    selected[v0:v1, u0:u1] = in_front
    points, _, _ = backproject(depth, scan.intrinsics(frame, w, h), scan.pose(frame), selected)
    if floor is not None:
        points = points[points[:, 1] > floor + 0.03]
    return points


def fit_box(points, floor):
    """Upright box around a point set: the smallest footprint rectangle over all headings, robust extents.

    Smallest-area rather than principal axes, because one view usually shows an object as an L
    (a front face and a side, or a face and the top), and principal axes run down the diagonal of an L.
    """
    lo, hi = np.percentile(points[:, 1], [2, 98])
    if floor is not None and lo - floor < 0.45:
        lo = floor  # standing on the floor; the bottom few cm hide against it
    xz = points[:, [0, 2]]
    if len(xz) > 6000:
        xz = xz[np.random.default_rng(0).choice(len(xz), 6000, replace=False)]

    def extents(yaw):
        # three.js rotation.y = yaw sends local +X to (cos, -sin) and local +Z to (sin, cos) in x/z
        a = np.percentile(xz @ np.array([math.cos(yaw), -math.sin(yaw)]), [1, 99])
        b = np.percentile(xz @ np.array([math.sin(yaw), math.cos(yaw)]), [1, 99])
        return a, b

    yaw = min(np.radians(np.arange(0, 90, 1.0)), key=lambda y: np.prod([np.ptp(e) for e in extents(y)]))
    (a0, a1), (b0, b1) = extents(yaw)
    if b1 - b0 > a1 - a0:  # keep local X along the long side
        yaw -= math.pi / 2
        (a0, a1), (b0, b1) = extents(yaw)
    yaw = float(yaw)
    mid = (np.array([math.cos(yaw), -math.sin(yaw)]) * (a0 + a1) / 2
           + np.array([math.sin(yaw), math.cos(yaw)]) * (b0 + b1) / 2)
    return {
        "center": [round(float(mid[0]), 4), round(float((lo + hi) / 2), 4), round(float(mid[1]), 4)],
        "size": [round(float(a1 - a0), 4), round(float(hi - lo), 4), round(float(b1 - b0), 4)],
        "yaw": round(yaw, 4),
    }


def save_crop(scan, view, path, pad=0.06):
    frame = scan.frame(view["frame"])
    raw = view.get("orientation", "upright") != "upright"
    img = Image.open(scan.root / frame["rgb"]).convert("RGB")
    turns = 0 if raw else upright_turns(scan.pose(frame))
    if turns:
        img = img.transpose(ROTATIONS[turns])
    x0, y0, x1, y1 = view["bbox"]
    box = (max(0, (x0 - pad) * img.width), max(0, (y0 - pad) * img.height),
           min(img.width, (x1 + pad) * img.width), min(img.height, (y1 + pad) * img.height))
    crop = img.crop(tuple(int(round(v)) for v in box))
    crop.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(path, quality=92)


def slug(text):
    keep = "".join(c.lower() if c.isalnum() else "-" for c in text)
    return "-".join(part for part in keep.split("-") if part) or "object"


def load_objects(scan, path):
    spec_path = Path(path).expanduser() if path else scan.root / "objects.json"
    if not spec_path.exists():
        sys.exit(f"No {spec_path}. Write one first (see roomscan/CLAUDE.md for the format).")
    spec = json.loads(spec_path.read_text())
    return spec["objects"] if isinstance(spec, dict) else spec


def object_views(obj):
    """An object is marked on one photo (frame + bbox) or several (views)."""
    return obj.get("views") or [{"frame": obj["frame"], "bbox": obj["bbox"],
                                 "orientation": obj.get("orientation", "upright")}]


def cmd_boxes(args):
    """Draw the boxes from objects.json onto their photos, to check them by eye before locating."""
    scan = Scan(args.scan)
    out = scan.out / "boxes"
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.jpg"):
        old.unlink()
    marks = {}
    for obj in load_objects(scan, args.objects):
        for view in object_views(obj):
            marks.setdefault(view["frame"], []).append((obj.get("label") or obj.get("id", "?"), view))
    colors = [(242, 194, 48), (108, 195, 213), (239, 125, 87), (155, 209, 107), (197, 143, 224), (242, 143, 177)]
    for index, entries in sorted(marks.items()):
        frame = scan.frame(index)
        upright = entries[0][1].get("orientation", "upright") == "upright"
        turns = upright_turns(scan.pose(frame)) if upright else 0
        img = Image.open(scan.root / frame["rgb"]).convert("RGB")
        if turns:
            img = img.transpose(ROTATIONS[turns])
        img.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
        draw = ImageDraw.Draw(img)
        for n, (label, view) in enumerate(entries):
            x0, y0, x1, y1 = view["bbox"]
            color = colors[n % len(colors)]
            draw.rectangle([x0 * img.width, y0 * img.height, x1 * img.width, y1 * img.height], outline=color, width=4)
            draw.rectangle([x0 * img.width, y0 * img.height - 18, x0 * img.width + 8 + 7 * len(label), y0 * img.height], fill=color)
            draw.text((x0 * img.width + 4, y0 * img.height - 15), label, fill=(0, 0, 0))
        img.save(out / f"{index:06d}.jpg", quality=88)
    print(f"Drew {sum(len(e) for e in marks.values())} boxes on {len(marks)} photos in {out}")


def cmd_locate(args):
    scan = Scan(args.scan)
    items = load_objects(scan, args.objects)
    floor = estimate_floor(scan)
    print(f"Floor at y = {floor:.3f} m" if floor is not None else "Couldn't find the floor; boxes won't snap to it")

    located = []
    for obj in items:
        oid = slug(obj.get("id") or obj.get("label", "object"))
        views = object_views(obj)
        points = np.concatenate([points_in_box(scan, scan.frame(v["frame"]), v["bbox"],
                                               v.get("orientation", "upright"), floor) for v in views])
        if len(points) < 30:
            print(f"  {oid}: not enough depth inside its box, skipped (try a tighter box or another frame)")
            continue
        box = fit_box(points, floor)
        crop = scan.out / "crops" / f"{oid}.jpg"
        save_crop(scan, views[0], crop)
        model = scan.out / "models" / f"{oid}.glb"
        entry = {"id": oid, "label": obj.get("label", oid), "category": obj.get("category", "object"),
                 **box, "points": int(len(points)), "views": views, "crop": f"crops/{oid}.jpg"}
        for key in ("modelYaw", "modelScale", "notes"):
            if key in obj:
                entry[key] = obj[key]
        if model.exists():
            entry["model"] = f"models/{oid}.glb"
        located.append(entry)
        w, h, d = box["size"]
        print(f"  {oid}: {w * 100:.0f} x {h * 100:.0f} x {d * 100:.0f} cm (w x h x d), yaw {math.degrees(box['yaw']):.0f}°")

    scan.out.mkdir(parents=True, exist_ok=True)
    (scan.out / "objects.json").write_text(json.dumps({"floor": floor, "objects": located}, indent=2))
    print(f"Wrote {scan.out / 'objects.json'} and {len(located)} crops in {scan.out / 'crops'}")
    print("Generate a 3D model from each crop and save it as out/models/<id>.glb; the viewer picks them up.")


def cmd_view(args):
    scan = Scan(args.scan)
    viewer = Path(__file__).resolve().parent / "viewer"

    class Handler(http.server.SimpleHTTPRequestHandler):
        def translate_path(self, path):
            path = urllib.parse.unquote(urllib.parse.urlsplit(path).path)
            base, rel = (scan.root, path[len("/scan/"):]) if path.startswith("/scan/") else (viewer, path.lstrip("/"))
            full = (base / rel).resolve()
            return str(full if full == base or base in full.parents else viewer / "missing")

        def end_headers(self):
            self.send_header("Cache-Control", "no-store")
            super().end_headers()

        def log_message(self, *_):
            pass

    for port in range(args.port, args.port + 20):
        try:
            server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    else:
        sys.exit("No free port found.")
    url = f"http://127.0.0.1:{port}/"
    print(f"Viewing {scan.root.name} at {url}   (Ctrl+C to stop)")
    if not args.no_browser:
        threading.Timer(0.4, webbrowser.open, [url]).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    def command(name, func, help):
        p = sub.add_parser(name, help=help)
        p.add_argument("scan", help="unzipped scan folder (has frames.json)")
        p.set_defaults(func=func)
        return p

    command("info", cmd_info, "summarize a scan")

    for name, func, voxel, help in (("cloud", cmd_cloud, 0.01, "fuse photos + depth into a colored point cloud"),
                                    ("mesh", cmd_mesh, 0.01, "fuse into a solid colored mesh (needs open3d)")):
        p = command(name, func, help)
        p.add_argument("--voxel", type=float, default=voxel, help="detail in meters (default %(default)s)")
        p.add_argument("--max-depth", type=float, default=3.5, help="ignore LiDAR readings farther than this (m)")
        p.add_argument("--min-confidence", type=int, default=2, choices=(0, 1, 2), help="0 low, 1 medium, 2 high")
        p.add_argument("--every", type=int, default=1, help="use every Nth photo (faster previews)")
        p.add_argument("--upsample", type=int, default=2, help="sample depth this many times finer for more color detail")
        if name == "cloud":
            p.add_argument("--min-hits", type=int, default=2, help="drop voxels seen by fewer depth samples (noise)")

    p = command("keyframes", cmd_keyframes, "pick sharp, upright photos for spotting objects")
    p.add_argument("--count", type=int, default=24)
    p.add_argument("--size", type=int, default=1280, help="longest side of each keyframe in pixels")

    p = command("boxes", cmd_boxes, "draw the boxes in objects.json onto their photos, to check them")
    p.add_argument("objects", nargs="?", help="objects file (default: SCAN/objects.json)")

    p = command("locate", cmd_locate, "turn 2D object boxes into measured 3D boxes and crops")
    p.add_argument("objects", nargs="?", help="objects file (default: SCAN/objects.json)")

    p = command("view", cmd_view, "open the 3D viewer")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--no-browser", action="store_true")

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
