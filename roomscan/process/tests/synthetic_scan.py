#!/usr/bin/env python3
"""
============================================================
synthetic_scan.py: a fake RoomScan export of a room with known geometry

    python3 tests/synthetic_scan.py /tmp/fake-room
    python3 roomscan.py cloud /tmp/fake-room && python3 roomscan.py view /tmp/fake-room

Ray-traces a painted box room with a desk, a cabinet and a crate in it, from a walk of
phone poses, and writes it out exactly the way the iPhone app does: landscape JPEGs, 16-bit
millimeter depth PNGs, confidence PNGs, and frames.json with ARKit-style camera-to-world
transforms, mostly held in portrait. Also writes truth.json (the real object boxes) and an
objects.json with 2D boxes on upright photos, the way Claude would mark them.

So the whole pipeline can be checked against ground truth without a phone.
============================================================
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from roomscan import to_upright, upright_turns  # noqa: E402

ROOM_LO = np.array([-2.0, -1.35, -1.8])  # ARKit's origin is wherever the phone started, ~1.35 m up
ROOM_HI = np.array([2.2, 1.25, 1.7])
FLOOR = ROOM_LO[1]
OBJECTS = [
    {"id": "desk", "label": "walnut desk", "category": "furniture",
     "center": [0.9, FLOOR + 0.375, -1.35], "size": [1.6, 0.75, 0.7], "yaw": 0.0, "color": (118, 84, 58)},
    {"id": "cabinet", "label": "grey filing cabinet", "category": "storage",
     "center": [-1.5, FLOOR + 0.6, 0.45], "size": [0.5, 1.2, 0.9], "yaw": 0.35, "color": (70, 72, 82)},
    {"id": "crate", "label": "orange crate", "category": "storage",
     "center": [0.35, FLOOR + 0.25, 0.55], "size": [0.6, 0.5, 0.45], "yaw": -0.6, "color": (214, 96, 44)},
]
RGB_SIZE = (960, 720)
DEPTH_SIZE = (256, 192)
K = {"fx": 726.0, "fy": 726.0, "cx": 481.3, "cy": 358.6}  # in RGB pixels, slightly off-center like a real lens


def rot_y(yaw):
    c, s = math.cos(yaw), math.sin(yaw)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])  # three.js makeRotationY


def look(position, target, portrait):
    f = target - position
    f /= np.linalg.norm(f)
    z = -f
    x = np.cross([0.0, 1.0, 0.0], z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    if portrait:  # phone upright: the sensor's +X (image right) points at the floor
        x, y = -y, x
    pose = np.eye(4)
    pose[:3, 0], pose[:3, 1], pose[:3, 2], pose[:3, 3] = x, y, z, position
    return pose


def shade(points, normals_axis, which):
    """Paint: wood floor checks, striped walls with a rail, plain ceiling, objects with a lighter top."""
    n = len(points)
    color = np.zeros((n, 3))
    x, y, z = points.T
    stripes = (np.floor(np.where(normals_axis == 0, z, x) / 0.3) % 2)[:, None]
    walls = {(0, 0): (92, 122, 172), (0, 1): (196, 172, 116), (2, 0): (118, 162, 120), (2, 1): (176, 112, 110)}
    for (axis, side), base in walls.items():
        on_wall = points[:, axis] > ROOM_HI[axis] - 1e-3 if side else points[:, axis] < ROOM_LO[axis] + 1e-3
        m = (which == -1) & (normals_axis == axis) & on_wall
        color[m] = np.array(base) * (0.85 + 0.15 * stripes[m])
    rail = (which == -1) & (normals_axis != 1) & (np.abs(y - 0.0) < 0.04)
    color[rail] = (240, 236, 228)
    floor = (which == -1) & (normals_axis == 1) & (y < FLOOR + 1e-3)
    check = ((np.floor(x / 0.25) + np.floor(z / 0.25)) % 2)[floor, None]
    color[floor] = np.array([164, 124, 84]) * (0.82 + 0.18 * check)
    ceiling = (which == -1) & (normals_axis == 1) & (y > ROOM_HI[1] - 1e-3)
    color[ceiling] = (226, 224, 218)
    for i, obj in enumerate(OBJECTS):
        m = which == i
        top = m & (normals_axis == 1)
        color[m] = obj["color"]
        color[top] = np.minimum(255, np.array(obj["color"]) * 1.35)
    return color


def trace(pose, width, height):
    """Z-depth, hit points, surface axis and what was hit, for every pixel of a width x height image."""
    sx, sy = width / RGB_SIZE[0], height / RGB_SIZE[1]
    fx, fy = K["fx"] * sx, K["fy"] * sy
    cx, cy = (K["cx"] + 0.5) * sx - 0.5, (K["cy"] + 0.5) * sy - 0.5
    u, v = np.meshgrid(np.arange(width), np.arange(height))
    cam = np.stack([(u - cx) / fx, -(v - cy) / fy, -np.ones_like(u, dtype=float)], axis=-1).reshape(-1, 3)
    dirs = cam @ pose[:3, :3].T  # camera z component is -1, so t along these is z-depth
    origin = pose[:3, 3]

    with np.errstate(divide="ignore", invalid="ignore"):
        exits = np.where(dirs > 0, (ROOM_HI - origin) / dirs, (ROOM_LO - origin) / dirs)
    exits[~np.isfinite(exits)] = np.inf
    t = exits.min(axis=1)
    axis = exits.argmin(axis=1)
    which = np.full(len(t), -1)

    for i, obj in enumerate(OBJECTS):
        r = rot_y(obj["yaw"])
        o = r.T @ (origin - np.array(obj["center"]))
        d = dirs @ r  # each row: r.T @ dir
        half = np.array(obj["size"]) / 2
        with np.errstate(divide="ignore", invalid="ignore"):
            t1, t2 = (-half - o) / d, (half - o) / d
        near, far = np.minimum(t1, t2), np.maximum(t1, t2)
        near[~np.isfinite(near)] = -np.inf
        far[~np.isfinite(far)] = np.inf
        t_near, t_far = near.max(axis=1), far.min(axis=1)
        hit = (t_near <= t_far) & (t_near > 0) & (t_near < t)
        t[hit] = t_near[hit]
        axis[hit] = near.argmax(axis=1)[hit]  # in the box's own axes; x/z still mean "side", y means "top"
        which[hit] = i

    points = origin + dirs * t[:, None]
    return t.reshape(height, width), points, axis, which


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    out = Path(sys.argv[1])
    for sub in ("rgb", "depth", "confidence"):
        (out / sub).mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(7)

    # a lap around the room, looking outward and down, plus a few long looks at each object
    poses = []
    for i in range(56):
        a = 2 * math.pi * i / 56
        p = np.array([0.1 + 1.0 * math.cos(a), 0.05 + 0.08 * math.sin(3 * a), -0.05 + 0.75 * math.sin(a)])
        out_dir = np.array([math.cos(a + 0.5), 0, math.sin(a + 0.5)])
        target = p + out_dir * 2.0 + np.array([0, -0.9 - 0.4 * math.sin(2 * a), 0])
        poses.append(look(p, target, portrait=(i % 9 != 4)))
    for obj in OBJECTS:
        c = np.array(obj["center"])
        for j, offset in enumerate(([1.3, 1.0, 1.2], [-1.2, 1.1, 1.3], [0.2, 1.2, 1.6])):
            p = c + np.array(offset) * 0.95
            p = np.clip(p, ROOM_LO + 0.25, ROOM_HI - 0.25)
            poses.append(look(p, c, portrait=j != 2))

    frames = []
    picked = {}
    for n, pose in enumerate(poses, start=1):
        depth, _, _, which_d = trace(pose, *DEPTH_SIZE)
        noisy = depth * (1 + rng.normal(0, 0.003, depth.shape))
        Image.fromarray(np.round(noisy * 1000).clip(0, 65535).astype(np.uint16)).save(out / f"depth/{n:06d}.png")
        confidence = np.where(depth < 3.5, 2, 1).astype(np.uint8)
        Image.fromarray(confidence).save(out / f"confidence/{n:06d}.png")

        _, points, axis, which = trace(pose, *RGB_SIZE)
        rgb = shade(points, axis, which).reshape(RGB_SIZE[1], RGB_SIZE[0], 3)
        Image.fromarray(rgb.clip(0, 255).astype(np.uint8)).save(out / f"rgb/{n:06d}.jpg", quality=90)

        frames.append({
            "index": n, "timestamp": 1000 + n * 0.6,
            "rgb": f"rgb/{n:06d}.jpg", "depth": f"depth/{n:06d}.png", "confidence": f"confidence/{n:06d}.png",
            "intrinsics": K,
            "transform": pose.tolist(),
            "position": pose[:3, 3].tolist(), "forward": (-pose[:3, 2]).tolist(),
        })

        # remember the frame that shows each object biggest, fully in view and mostly unblocked
        turns = upright_turns(pose)
        for i, obj in enumerate(OBJECTS):
            corners = np.array([[sx, sy, sz] for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]) * np.array(obj["size"]) / 2
            world = corners @ rot_y(obj["yaw"]).T + obj["center"]
            cam = (np.linalg.inv(pose) @ np.c_[world, np.ones(8)].T)[:3]
            if (cam[2] > -0.2).any():
                continue
            u = (K["fx"] * cam[0] / -cam[2] + K["cx"]) / RGB_SIZE[0]
            v = (K["fy"] * -cam[1] / -cam[2] + K["cy"]) / RGB_SIZE[1]
            if u.min() < 0.02 or u.max() > 0.98 or v.min() < 0.02 or v.max() > 0.98:
                continue
            visible = (which_d == i).mean()
            area = (u.max() - u.min()) * (v.max() - v.min())
            if visible < 0.6 * area or area <= picked.get(obj["id"], (0, None))[0]:
                continue
            upright = [to_upright(x, y, turns) for x, y in zip(u, v)]
            xs, ys = [p[0] for p in upright], [p[1] for p in upright]
            picked[obj["id"]] = (area, {"frame": n, "bbox": [round(min(xs), 4), round(min(ys), 4),
                                                              round(max(xs), 4), round(max(ys), 4)]})
        print(f"\r  frame {n}/{len(poses)}", end="", flush=True)
    print()

    (out / "frames.json").write_text(json.dumps({
        "format": "roomscan/1", "name": "Synthetic room", "created": "2026-10-22T10:32:00Z", "device": "synthetic",
        "image": {"width": RGB_SIZE[0], "height": RGB_SIZE[1]},
        "depth": {"width": DEPTH_SIZE[0], "height": DEPTH_SIZE[1], "unit": "millimeters, 0 = no reading"},
        "mesh": "mesh.obj", "frames": frames}, indent=2))
    (out / "objects.json").write_text(json.dumps({"objects": [
        {"id": o["id"], "label": o["label"], "category": o["category"], **picked[o["id"]][1]}
        for o in OBJECTS if o["id"] in picked]}, indent=2))
    (out / "truth.json").write_text(json.dumps({"floor": FLOOR, "objects": [
        {k: o[k] for k in ("id", "center", "size", "yaw")} for o in OBJECTS]}, indent=2))
    write_obj(out / "mesh.obj")
    print(f"Wrote {len(frames)} frames to {out}")


def write_obj(path):
    """A coarse stand-in for ARKit's mesh: the room shell and the object boxes."""
    lines, offset = ["# synthetic ARKit-style mesh"], 1
    boxes = [(ROOM_LO, ROOM_HI, 0.0)] + [(np.array(o["center"]) - np.array(o["size"]) / 2,
                                          np.array(o["center"]) + np.array(o["size"]) / 2, o["yaw"]) for o in OBJECTS]
    for n, (lo, hi, yaw) in enumerate(boxes):
        center = (lo + hi) / 2
        for sx in (0, 1):
            for sy in (0, 1):
                for sz in (0, 1):
                    corner = np.where([sx, sy, sz], hi, lo) - center
                    p = rot_y(yaw) @ corner + center
                    lines.append(f"v {p[0]:.4f} {p[1]:.4f} {p[2]:.4f}")
        quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        for a, b, c, d in quads:
            if n == 0:  # the room is seen from inside, so flip its faces
                a, b, c, d = d, c, b, a
            lines.append(f"f {a + offset} {b + offset} {c + offset}")
            lines.append(f"f {a + offset} {c + offset} {d + offset}")
        offset += 8
    path.write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
