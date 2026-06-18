"""
Sound Dome OBJ Processor
========================
Reads a Polycam LiDAR OBJ scan of a dome interior and extracts:
1. Bounding box & overall dimensions
2. Horizontal cross-sections at regular height intervals
3. Dome interior profile curve (radius vs height)
4. Construction ring table (diameter at each height step)

Usage:
    python process_dome_obj.py <path_to_obj> [--slice-interval 0.1]
"""

import sys
import math
import json
from pathlib import Path
from collections import defaultdict


def parse_obj_vertices(obj_path):
    """Extract all vertex positions from an OBJ file."""
    vertices = []
    with open(obj_path, 'r') as f:
        for line in f:
            if line.startswith('v '):
                parts = line.strip().split()
                x, y, z = float(parts[1]), float(parts[2]), float(parts[3])
                vertices.append((x, y, z))
    return vertices


def compute_bounding_box(vertices):
    """Compute axis-aligned bounding box."""
    xs = [v[0] for v in vertices]
    ys = [v[1] for v in vertices]
    zs = [v[2] for v in vertices]
    return {
        'x_min': min(xs), 'x_max': max(xs),
        'y_min': min(ys), 'y_max': max(ys),
        'z_min': min(zs), 'z_max': max(zs),
        'width_x': max(xs) - min(xs),
        'height_y': max(ys) - min(ys),
        'depth_z': max(zs) - min(zs),
    }


def compute_cross_sections(vertices, bbox, axis='y', interval=0.1):
    """
    Slice the point cloud at regular intervals along the given axis.
    For each slice, compute the centroid, max radius from centroid,
    and the bounding extent in the other two axes.

    'axis' is the vertical axis of the dome (typically Y for Polycam exports).
    'interval' is the slice thickness in meters.
    """
    if axis == 'y':
        v_idx, h1_idx, h2_idx = 1, 0, 2
        v_min, v_max = bbox['y_min'], bbox['y_max']
    elif axis == 'z':
        v_idx, h1_idx, h2_idx = 2, 0, 1
        v_min, v_max = bbox['z_min'], bbox['z_max']
    else:
        v_idx, h1_idx, h2_idx = 0, 1, 2
        v_min, v_max = bbox['x_min'], bbox['x_max']

    # Bin vertices into slices
    slices = defaultdict(list)
    for v in vertices:
        # Determine which slice bin this vertex falls into
        bin_idx = int((v[v_idx] - v_min) / interval)
        slices[bin_idx].append(v)

    # Process each slice
    sections = []
    for bin_idx in sorted(slices.keys()):
        pts = slices[bin_idx]
        height = v_min + (bin_idx + 0.5) * interval  # midpoint of slice

        # Horizontal coordinates
        h1_vals = [p[h1_idx] for p in pts]
        h2_vals = [p[h2_idx] for p in pts]

        h1_center = (max(h1_vals) + min(h1_vals)) / 2
        h2_center = (max(h2_vals) + min(h2_vals)) / 2

        # Compute radial distances from centroid
        radii = []
        for p in pts:
            r = math.sqrt((p[h1_idx] - h1_center)**2 + (p[h2_idx] - h2_center)**2)
            radii.append(r)

        extent_h1 = max(h1_vals) - min(h1_vals)
        extent_h2 = max(h2_vals) - min(h2_vals)

        sections.append({
            'height_m': round(height, 3),
            'n_points': len(pts),
            'extent_h1_m': round(extent_h1, 3),
            'extent_h2_m': round(extent_h2, 3),
            'max_radius_m': round(max(radii), 3) if radii else 0,
            'mean_radius_m': round(sum(radii) / len(radii), 3) if radii else 0,
            'center_h1': round(h1_center, 3),
            'center_h2': round(h2_center, 3),
        })

    return sections


def estimate_dome_profile(sections):
    """
    From cross-sections, identify the dome profile:
    - Floor region (constant/max width)
    - Drum/wall region (near-constant width)
    - Dome curvature region (decreasing width toward apex)
    """
    if not sections:
        return {}

    max_extent = max(s['extent_h1_m'] for s in sections)
    floor_sections = [s for s in sections if s['extent_h1_m'] > 0.9 * max_extent]
    dome_sections = [s for s in sections if s['extent_h1_m'] < 0.9 * max_extent and s['n_points'] > 5]

    floor_top = max(s['height_m'] for s in floor_sections) if floor_sections else sections[0]['height_m']
    dome_start = min(s['height_m'] for s in dome_sections) if dome_sections else floor_top

    return {
        'floor_level_m': round(min(s['height_m'] for s in sections), 3),
        'apex_level_m': round(max(s['height_m'] for s in sections), 3),
        'drum_top_m': round(dome_start, 3),
        'max_floor_extent_h1_m': round(max_extent, 3),
        'max_floor_extent_h2_m': round(max(s['extent_h2_m'] for s in floor_sections), 3) if floor_sections else 0,
    }


def format_construction_table(sections, interval):
    """Format cross-sections as a construction ring table."""
    lines = []
    lines.append(f"{'Height (m)':>12} {'Width-X (m)':>12} {'Depth-Z (m)':>12} {'Max R (m)':>10} {'Points':>8}")
    lines.append("-" * 60)
    for s in sections:
        lines.append(
            f"{s['height_m']:>12.3f} {s['extent_h1_m']:>12.3f} {s['extent_h2_m']:>12.3f} "
            f"{s['max_radius_m']:>10.3f} {s['n_points']:>8d}"
        )
    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: python process_dome_obj.py <path_to_obj> [--slice-interval 0.1]")
        sys.exit(1)

    obj_path = sys.argv[1]
    interval = 0.1  # 10cm default

    for i, arg in enumerate(sys.argv):
        if arg == '--slice-interval' and i + 1 < len(sys.argv):
            interval = float(sys.argv[i + 1])

    print(f"Processing: {obj_path}")
    print(f"Slice interval: {interval}m ({interval*100:.0f}cm)\n")

    # Parse vertices
    vertices = parse_obj_vertices(obj_path)
    print(f"Vertices loaded: {len(vertices)}")

    # Bounding box
    bbox = compute_bounding_box(vertices)
    print(f"\n{'='*60}")
    print("BOUNDING BOX")
    print(f"{'='*60}")
    print(f"  Width  (X): {bbox['width_x']:.3f}m  ({bbox['width_x']*3.281:.1f} ft)")
    print(f"  Height (Y): {bbox['height_y']:.3f}m  ({bbox['height_y']*3.281:.1f} ft)")
    print(f"  Depth  (Z): {bbox['depth_z']:.3f}m  ({bbox['depth_z']*3.281:.1f} ft)")
    print(f"  Floor diagonal: {math.sqrt(bbox['width_x']**2 + bbox['depth_z']**2):.3f}m")
    print(f"  X/Z ratio: {bbox['width_x']/bbox['depth_z']:.3f}")
    print(f"  Volume (approx box): {bbox['width_x']*bbox['height_y']*bbox['depth_z']:.1f} m³")

    # Cross-sections
    sections = compute_cross_sections(vertices, bbox, axis='y', interval=interval)
    print(f"\n{'='*60}")
    print(f"CROSS-SECTIONS (every {interval*100:.0f}cm along Y-axis)")
    print(f"{'='*60}")
    print(format_construction_table(sections, interval))

    # Dome profile
    profile = estimate_dome_profile(sections)
    print(f"\n{'='*60}")
    print("DOME PROFILE ESTIMATE")
    print(f"{'='*60}")
    for k, v in profile.items():
        label = k.replace('_', ' ').replace(' m', ' (m)')
        print(f"  {label}: {v}")

    # Acoustic estimates (speed of sound in air = 343 m/s)
    c = 343.0  # m/s at 20°C
    print(f"\n{'='*60}")
    print("ACOUSTIC MODE ESTIMATES (c = 343 m/s at 20°C)")
    print(f"{'='*60}")
    for dim_name, dim_val in [('Width (X)', bbox['width_x']), ('Height (Y)', bbox['height_y']), ('Depth (Z)', bbox['depth_z'])]:
        f1 = c / (2 * dim_val)  # fundamental axial mode
        print(f"  {dim_name} = {dim_val:.3f}m -> f1 = {f1:.1f} Hz (axial fundamental)")
        print(f"    f2 = {2*f1:.1f} Hz, f3 = {3*f1:.1f} Hz")

    floor_diag = math.sqrt(bbox['width_x']**2 + bbox['depth_z']**2)
    f_diag = c / (2 * floor_diag)
    print(f"  Floor diagonal = {floor_diag:.3f}m -> f1 = {f_diag:.1f} Hz")

    print(f"\n  Measured resonance (field): G♭2 +7c ≈ 93 Hz")
    print(f"  Closest axial mode: check table above for nearest match")

    # Save JSON output
    output = {
        'source_file': obj_path,
        'vertex_count': len(vertices),
        'bounding_box': bbox,
        'cross_sections': sections,
        'dome_profile': profile,
        'acoustic_estimates': {
            'speed_of_sound_mps': c,
            'f1_x_hz': round(c / (2 * bbox['width_x']), 1),
            'f1_y_hz': round(c / (2 * bbox['height_y']), 1),
            'f1_z_hz': round(c / (2 * bbox['depth_z']), 1),
            'f1_diagonal_hz': round(f_diag, 1),
            'measured_resonance_hz': 93.0,
        }
    }

    out_dir = Path(obj_path).parent.parent
    json_path = out_dir / 'dome_analysis.json'
    with open(json_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\nFull analysis saved to: {json_path}")

    # Save construction profile as standalone table
    profile_path = out_dir / 'construction_profile.txt'
    with open(profile_path, 'w') as f:
        f.write(f"SOUND DOME CONSTRUCTION PROFILE\n")
        f.write(f"Source: {Path(obj_path).name}\n")
        f.write(f"Target frequency: ~93 Hz (G♭2)\n")
        f.write(f"Slice interval: {interval*100:.0f}cm\n\n")
        f.write(f"Overall dimensions:\n")
        f.write(f"  Width (X):  {bbox['width_x']:.3f}m ({bbox['width_x']*3.281:.1f} ft)\n")
        f.write(f"  Height (Y): {bbox['height_y']:.3f}m ({bbox['height_y']*3.281:.1f} ft)\n")
        f.write(f"  Depth (Z):  {bbox['depth_z']:.3f}m ({bbox['depth_z']*3.281:.1f} ft)\n\n")
        f.write(f"Ring table (build from bottom up):\n")
        f.write(format_construction_table(sections, interval))
    print(f"Construction profile saved to: {profile_path}")


if __name__ == '__main__':
    main()
