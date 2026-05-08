#!/usr/bin/env python3
"""De-duplicate numbered recordings and enrich manifest with mini time series."""

import json
import os
import re
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
AUDIO_DIR = os.path.join(os.path.dirname(__file__), '..', 'audio_files')
MANIFEST_PATH = os.path.join(DATA_DIR, 'manifest.json')
MAX_POINTS = 200


def strip_number_suffix(filename: str) -> str:
    """Strip trailing ' N' or '- N' number suffixes from filenames.

    Examples:
        'Foo 2.m4a' -> 'Foo.m4a'
        'Foo- 3.m4a' -> 'Foo-.m4a'
        'Foo.m4a' -> 'Foo.m4a'
    """
    return re.sub(r'[- ]+\d+\.m4a$', '.m4a', filename)


def is_numbered_copy(filename: str) -> bool:
    """Check if filename has a trailing number suffix."""
    return bool(re.search(r'[- ]+\d+\.m4a$', filename))


def extract_copy_number(filename: str) -> int:
    """Extract the copy number from a numbered filename, or 0 for base files."""
    m = re.search(r'[- ]+(\d+)\.m4a$', filename)
    return int(m.group(1)) if m else 0


def values_match(a: float, b: float, tol: float = 0.1) -> bool:
    return abs(a - b) <= tol


def downsample(times: list, freqs: list, max_pts: int = MAX_POINTS) -> tuple:
    """Downsample time series to max_pts using strided selection."""
    n = len(times)
    if n <= max_pts:
        return times, freqs
    step = n / max_pts
    indices = [int(i * step) for i in range(max_pts)]
    # Always include last point
    if indices[-1] != n - 1:
        indices[-1] = n - 1
    return (
        [round(times[i], 2) for i in indices],
        [round(freqs[i], 1) for i in indices],
    )


def main():
    with open(MANIFEST_PATH) as f:
        manifest = json.load(f)

    files = manifest['files']
    print(f"Starting with {len(files)} recordings")

    # Group files by base name
    groups: dict[str, list[dict]] = {}
    for entry in files:
        base = strip_number_suffix(entry['filename'])
        groups.setdefault(base, []).append(entry)

    # Identify duplicates to remove
    to_remove_ids: set[str] = set()
    for base, group in groups.items():
        if len(group) < 2:
            continue

        # Sort: base file first (copy_number=0), then by copy number
        group.sort(key=lambda e: extract_copy_number(e['filename']))
        keeper = group[0]

        for other in group[1:]:
            dur_match = values_match(keeper['duration_s'], other['duration_s'], 0.1)
            freq_match = values_match(keeper['dominant_freq_hz'], other['dominant_freq_hz'], 0.1)
            peak_match = True
            if keeper['spectral_peaks'] and other['spectral_peaks']:
                peak_match = values_match(
                    keeper['spectral_peaks'][0]['freq_hz'],
                    other['spectral_peaks'][0]['freq_hz'],
                    0.1,
                )
            if dur_match and freq_match and peak_match:
                to_remove_ids.add(other['id'])
                print(f"  DUP: {other['filename']} (matches {keeper['filename']})")

    print(f"\nRemoving {len(to_remove_ids)} duplicates")

    # Delete duplicate audio + data files
    for entry in files:
        if entry['id'] in to_remove_ids:
            audio_path = os.path.join(AUDIO_DIR, entry['filename'])
            data_path = os.path.join(DATA_DIR, f"{entry['id']}.json")
            if os.path.exists(audio_path):
                os.remove(audio_path)
                print(f"  Deleted audio: {entry['filename']}")
            if os.path.exists(data_path):
                os.remove(data_path)
                print(f"  Deleted data:  {entry['id']}.json")

    # Filter manifest
    kept_files = [f for f in files if f['id'] not in to_remove_ids]
    print(f"\nKept {len(kept_files)} recordings")

    # Enrich each kept file with time_series_mini
    enriched = 0
    for entry in kept_files:
        data_path = os.path.join(DATA_DIR, f"{entry['id']}.json")
        if not os.path.exists(data_path):
            print(f"  WARN: no data file for {entry['id']}")
            entry['time_series_mini'] = {'times': [], 'freqs': []}
            continue

        with open(data_path) as f:
            detail = json.load(f)

        ts = detail.get('time_series', {})
        times = ts.get('times', [])
        freqs = ts.get('dominant_freqs', [])

        if times and freqs:
            mini_times, mini_freqs = downsample(times, freqs)
            entry['time_series_mini'] = {'times': mini_times, 'freqs': mini_freqs}
            enriched += 1
        else:
            entry['time_series_mini'] = {'times': [], 'freqs': []}

    print(f"Enriched {enriched} files with time_series_mini")

    # Write updated manifest
    manifest['files'] = kept_files
    manifest['analyzed'] = len(kept_files)
    manifest['total_files'] = len(kept_files)

    with open(MANIFEST_PATH, 'w') as f:
        json.dump(manifest, f, indent=2)

    size_kb = os.path.getsize(MANIFEST_PATH) / 1024
    print(f"\nWrote manifest: {len(kept_files)} files, {size_kb:.0f} KB")


if __name__ == '__main__':
    main()
