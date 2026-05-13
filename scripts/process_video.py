"""
Video Overlay Renderer for Sound Dome Project
==============================================
Extracts audio from a video, runs FFT analysis, and burns a real-time
Hz / note / intensity overlay directly onto the video frames.

Outputs a new MP4 file you can watch in any player.

Usage:
    python process_video.py <video_file> [-o OUTPUT] [--site SITE]

Dependencies: numpy, scipy, pillow, ffmpeg (CLI)
"""

import sys
import os
import math
import subprocess
import tempfile
import wave
import struct
import argparse
import numpy as np
from scipy import signal
from scipy.fft import rfft, rfftfreq
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ── Constants ──

NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
RESONATION_THRESHOLD_DB = -16.5
METER_MIN_DB = -30.0
METER_MAX_DB = -8.0

# Font paths (macOS) — weight-specific for Apple-style hierarchy
FONT_SEMIBOLD = [
    '/Library/Fonts/SF-Pro-Display-Semibold.otf',
    '/Library/Fonts/SF-Pro.ttf',
    '/System/Library/Fonts/SFNS.ttf',
]
FONT_MEDIUM = [
    '/Library/Fonts/SF-Pro-Display-Medium.otf',
    '/Library/Fonts/SF-Pro-Text-Medium.otf',
    '/Library/Fonts/SF-Pro.ttf',
    '/System/Library/Fonts/SFNS.ttf',
]
FONT_REGULAR = [
    '/Library/Fonts/SF-Pro-Display-Regular.otf',
    '/Library/Fonts/SF-Pro-Text-Regular.otf',
    '/Library/Fonts/SF-Pro.ttf',
    '/System/Library/Fonts/SFNS.ttf',
]
FONT_MONO = [
    '/System/Library/Fonts/SFNSMono.ttf',
    '/System/Library/Fonts/Menlo.ttc',
]


def load_font(paths, size):
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


# ── Audio analysis (from batch_analyze.py) ──

def hz_to_note(freq):
    if freq <= 0:
        return {'name': '-', 'cents': 0, 'midi': 0}
    semitones = 12 * math.log2(freq / 440.0)
    midi = round(semitones) + 69
    cents = (semitones - round(semitones)) * 100
    idx = midi % 12
    octave = (midi // 12) - 1
    return {'name': f"{NOTE_NAMES[idx]}{octave}", 'cents': round(cents, 1), 'midi': midi}


def convert_to_wav(input_path):
    tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
    tmp.close()
    r = subprocess.run(
        ['ffmpeg', '-y', '-i', input_path, '-ar', '48000', '-ac', '1', '-sample_fmt', 's16', tmp.name],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg audio extract failed: {r.stderr[:300]}")
    return tmp.name


def read_wav(wav_path):
    with wave.open(wav_path, 'r') as w:
        n = w.getnframes()
        sr = w.getframerate()
        ch = w.getnchannels()
        sw = w.getsampwidth()
        raw = w.readframes(n)
    fmt = f'<{n * ch}{"h" if sw == 2 else "i"}'
    samples = np.array(struct.unpack(fmt, raw), dtype=np.float64)
    if ch > 1:
        samples = samples[::ch]
    samples /= 2 ** (sw * 8 - 1)
    return samples, sr


def analyze_audio(audio_path, segment_duration=1.0, overlap=0.5):
    """FFT analysis returning time-aligned arrays for overlay rendering."""
    wav_path = convert_to_wav(audio_path)
    try:
        samples, sr = read_wav(wav_path)
    finally:
        os.unlink(wav_path)

    duration = len(samples) / sr
    seg = int(segment_duration * sr)
    hop = int(seg * (1 - overlap))

    times, freqs_out, rms_out = [], [], []
    mask = None
    pos = 0

    while pos + seg <= len(samples):
        chunk = samples[pos:pos + seg]
        t = (pos + seg / 2) / sr

        windowed = chunk * np.hanning(len(chunk))
        spectrum = np.abs(rfft(windowed))
        f_axis = rfftfreq(len(windowed), 1.0 / sr)

        if mask is None:
            mask = (f_axis >= 30) & (f_axis <= 500)
        band = spectrum[mask]
        f_band = f_axis[mask]

        if len(band) == 0:
            pos += hop
            continue

        rms = np.sqrt(np.mean(chunk ** 2))
        rms_db = 20 * math.log10(rms + 1e-10)
        peak_freq = float(f_band[np.argmax(band)])

        times.append(round(t, 3))
        freqs_out.append(round(peak_freq, 1))
        rms_out.append(round(rms_db, 1))

        pos += hop

    if not times:
        return None

    # Detect resonant frequencies
    rms_arr = np.array(rms_out)
    dom_arr = np.array(freqs_out)
    res_mask = rms_arr > RESONATION_THRESHOLD_DB
    resonant_freqs = []
    if res_mask.any():
        rf = dom_arr[res_mask]
        rounded = np.round(rf / 5) * 5
        unique, counts = np.unique(rounded, return_counts=True)
        thresh = max(1, len(rf) * 0.2)
        resonant_freqs = sorted([float(f) for f, c in zip(unique, counts) if c >= thresh])

    weighted_avg = float(np.average(dom_arr, weights=np.abs(rms_arr - METER_MIN_DB) + 0.1))
    note = hz_to_note(weighted_avg)

    return {
        'times': np.array(times),
        'freqs': np.array(freqs_out),
        'rms': np.array(rms_out),
        'duration': duration,
        'dominant_freq': round(weighted_avg, 1),
        'dominant_note': note['name'],
        'resonant_freqs': resonant_freqs,
    }


def interpolate(times, values, t):
    """Linear interpolation at time t."""
    if len(times) == 0:
        return 0.0
    if t <= times[0]:
        return float(values[0])
    if t >= times[-1]:
        return float(values[-1])
    idx = np.searchsorted(times, t, side='right') - 1
    idx = min(idx, len(times) - 2)
    frac = (t - times[idx]) / (times[idx + 1] - times[idx] + 1e-10)
    return float(values[idx] + frac * (values[idx + 1] - values[idx]))


# ── Video info ──

def get_video_info(path):
    """Get width, height, fps, duration, rotation via ffprobe."""
    import json as _json
    r = subprocess.run([
        'ffprobe', '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,r_frame_rate,duration',
        '-show_entries', 'stream_side_data=rotation',
        '-show_entries', 'format=duration',
        '-of', 'json', str(path),
    ], capture_output=True, text=True)
    info = _json.loads(r.stdout)
    stream = info['streams'][0]
    w, h = int(stream['width']), int(stream['height'])
    fps_str = stream['r_frame_rate']
    num, den = fps_str.split('/')
    fps = float(num) / float(den)
    dur = float(stream.get('duration', 0)) or float(info.get('format', {}).get('duration', 0))
    # Check rotation from side_data
    rotation = 0
    for sd in stream.get('side_data_list', []):
        if 'rotation' in sd:
            rotation = int(sd['rotation'])
            break
    return w, h, fps, dur, rotation


# ── Overlay rendering ──

class OverlayRenderer:
    """Single unified dark HUD panel — all elements inside one container."""

    def __init__(self, width, height, analysis, site_name=''):
        self.w = width
        self.h = height
        self.analysis = analysis
        self.site_name = site_name

        # Scale relative to short edge so portrait/landscape both work
        short = min(width, height)
        self.s = short / 1080.0

        # Fonts — Apple weight hierarchy (+20% size)
        self.font_hz = load_font(FONT_SEMIBOLD, max(17, int(41 * self.s)))
        self.font_unit = load_font(FONT_REGULAR, max(12, int(20 * self.s)))
        self.font_note = load_font(FONT_MEDIUM, max(11, int(17 * self.s)))
        self.font_db = load_font(FONT_MONO, max(10, int(14 * self.s)))
        self.font_site = load_font(FONT_REGULAR, max(9, int(13 * self.s)))
        self.font_res = load_font(FONT_SEMIBOLD, max(9, int(12 * self.s)))

        # Spacing
        self.pad = max(10, int(16 * self.s))
        self.margin = max(12, int(18 * self.s))
        self.row_gap = max(4, int(7 * self.s))
        self.track_h = max(3, int(4 * self.s))
        self.dot_r = max(5, int(7 * self.s))
        self.corner_r = max(7, int(12 * self.s))

    def _measure(self, font, text):
        """Return (width, ascent, descent) — ascent is above baseline, descent below."""
        bb = font.getbbox(text)
        # bb = (x_offset, y_offset, x_end, y_end) relative to anchor
        # For top-left anchor: y_offset is typically negative (ascender above origin)
        # but Pillow anchors at the ascent line so y_offset ~ 0 or slightly negative
        return bb[2] - bb[0], bb[3]  # width, total bottom from anchor

    def render_frame(self, frame_img, current_time):
        a = self.analysis
        freq = interpolate(a['times'], a['freqs'], current_time)
        rms = interpolate(a['times'], a['rms'], current_time)
        note = hz_to_note(freq)
        is_res = rms > RESONATION_THRESHOLD_DB

        pad = self.pad
        mg = self.margin

        # ── Measure everything first to get true panel size ──
        hz_val = f"{freq:.0f}"
        hz_unit = " Hz"
        note_text = f"{note['name']}  {note['cents']:+.0f}c"
        db_text = f"{rms:.0f} dB"

        hz_w, hz_bot = self._measure(self.font_hz, hz_val)
        unit_w, unit_bot = self._measure(self.font_unit, hz_unit)
        note_tw, note_bot = self._measure(self.font_note, note_text)

        row1_h = hz_bot   # Hz row height (actual rendered)
        row2_h = note_bot  # note row height (actual rendered)
        row3_h = self.dot_r * 2  # track + dot

        total_content_h = row1_h + self.row_gap + row2_h + self.row_gap + row3_h
        panel_w = self.w - mg * 2
        panel_h = total_content_h + pad * 2
        panel_x = mg
        panel_y = self.h - mg - panel_h  # anchor to bottom

        # ── Draw overlay ──
        overlay = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Panel background
        draw.rounded_rectangle(
            [panel_x, panel_y, panel_x + panel_w, panel_y + panel_h],
            radius=self.corner_r,
            fill=(10, 10, 18, 200),
            outline=(255, 255, 255, 20),
        )

        cx = panel_x + pad
        cr = panel_x + panel_w - pad
        y = panel_y + pad

        # ── Row 1: Hz ──
        draw.text((cx, y), hz_val, fill=(255, 255, 255), font=self.font_hz)
        # Unit baseline-aligned
        unit_y_offset = hz_bot - unit_bot
        draw.text((cx + hz_w + int(2 * self.s), y + unit_y_offset),
                  hz_unit, fill=(255, 255, 255, 130), font=self.font_unit)

        # Site name — right-aligned
        if self.site_name and self.site_name != 'Unknown':
            site_w, _ = self._measure(self.font_site, self.site_name)
            draw.text((cr - site_w, y + unit_y_offset),
                      self.site_name, fill=(255, 255, 255, 90), font=self.font_site)

        # ── Row 2: Note + dB ──
        y += row1_h + self.row_gap
        note_color = (0, 255, 136) if is_res else (180, 180, 200)
        draw.text((cx, y), note_text, fill=note_color, font=self.font_note)

        db_w, _ = self._measure(self.font_db, db_text)
        draw.text((cr - db_w, y), db_text, fill=(140, 140, 160), font=self.font_db)

        # ── Row 3: Intensity track ──
        y += row2_h + self.row_gap
        track_x0 = cx
        track_x1 = cr
        track_w = track_x1 - track_x0
        th = self.track_h
        track_cy = y + self.dot_r  # vertically center the dot

        # Track background
        draw.rounded_rectangle(
            [track_x0, track_cy - th // 2, track_x1, track_cy + (th + 1) // 2],
            radius=th,
            fill=(60, 60, 80),
        )

        # Threshold tick
        thresh_pct = (RESONATION_THRESHOLD_DB - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)
        thresh_x = track_x0 + int(thresh_pct * track_w)
        tick_ext = self.dot_r + int(2 * self.s)
        draw.line(
            [(thresh_x, track_cy - tick_ext), (thresh_x, track_cy + tick_ext)],
            fill=(0, 255, 136, 100),
            width=max(1, int(1.5 * self.s)),
        )

        # Level indicator position
        clamped = max(METER_MIN_DB, min(METER_MAX_DB, rms))
        pct = (clamped - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)
        ind_x = track_x0 + int(pct * track_w)
        dr = self.dot_r

        if is_res:
            # Green fill from threshold to indicator
            if ind_x > thresh_x:
                draw.rounded_rectangle(
                    [thresh_x, track_cy - th // 2, ind_x, track_cy + (th + 1) // 2],
                    radius=th, fill=(0, 255, 136, 200),
                )
            # Glow
            gr = dr + int(4 * self.s)
            draw.ellipse([ind_x - gr, track_cy - gr, ind_x + gr, track_cy + gr],
                         fill=(0, 255, 136, 25))
            # Dot
            draw.ellipse([ind_x - dr, track_cy - dr, ind_x + dr, track_cy + dr],
                         fill=(0, 255, 136))
            # Label
            res_w, _ = self._measure(self.font_res, "RESONATING")
            res_x = ind_x + dr + int(6 * self.s)
            if res_x + res_w > cr:
                res_x = ind_x - dr - int(6 * self.s) - res_w
            res_h_half = self._measure(self.font_res, "R")[1] // 2
            draw.text((res_x, track_cy - res_h_half),
                      "RESONATING", fill=(0, 255, 136), font=self.font_res)
        else:
            # Neutral fill
            if ind_x > track_x0 + 2:
                draw.rounded_rectangle(
                    [track_x0, track_cy - th // 2, ind_x, track_cy + (th + 1) // 2],
                    radius=th, fill=(140, 140, 170),
                )
            # Dot
            draw.ellipse([ind_x - dr, track_cy - dr, ind_x + dr, track_cy + dr],
                         fill=(220, 220, 230))

        # ── Resonant frequency badges (top-left) ──
        if self.analysis['resonant_freqs']:
            badge_y = mg
            badge_x = mg
            for rf in self.analysis['resonant_freqs'][:3]:
                rn = hz_to_note(rf)
                rf_text = f"{rf:.0f} Hz {rn['name']}"
                rfw, rfh = self._measure(self.font_res, rf_text)
                bp = int(5 * self.s)
                draw.rounded_rectangle(
                    [badge_x, badge_y,
                     badge_x + rfw + bp * 2, badge_y + rfh + bp * 2],
                    radius=max(3, int(5 * self.s)),
                    fill=(10, 10, 18, 180), outline=(0, 212, 255, 80),
                )
                draw.text((badge_x + bp, badge_y + bp), rf_text,
                          fill=(0, 212, 255), font=self.font_res)
                badge_x += rfw + bp * 2 + int(6 * self.s)

        # Composite
        result = frame_img.convert('RGBA')
        result = Image.alpha_composite(result, overlay)
        return result.convert('RGB')


# ── Main pipeline ──

def main():
    parser = argparse.ArgumentParser(
        description='Burn real-time resonation stats overlay onto a dome video'
    )
    parser.add_argument('video_file', help='Path to input video file')
    parser.add_argument('-o', '--output', help='Output MP4 path (default: <input>_overlay.mp4)')
    parser.add_argument('--site', default='Unknown', help='Site name for badge')
    parser.add_argument('--crf', type=int, default=18, help='x264 CRF quality (default: 18, lower=better)')
    args = parser.parse_args()

    video_path = Path(args.video_file).resolve()
    if not video_path.exists():
        print(f"Error: {video_path} not found")
        sys.exit(1)

    output_path = args.output or str(video_path.with_name(video_path.stem + '_overlay.mp4'))

    # Step 1: Get video metadata
    print(f"Input:  {video_path.name}")
    w, h, fps, dur, rotation = get_video_info(str(video_path))
    # Apply rotation to get display dimensions
    needs_rotate = rotation in (-90, 90, -270, 270)
    if needs_rotate:
        out_w, out_h = h, w
        print(f"  Stream: {w}x{h}, rotation: {rotation}° → display: {out_w}x{out_h}")
    else:
        out_w, out_h = w, h
        print(f"  {out_w}x{out_h} @ {fps:.2f} fps, {dur:.1f}s")
    total_frames = int(dur * fps)
    print(f"  {fps:.2f} fps, {dur:.1f}s ({total_frames} frames)")
    print()

    # Step 2: Analyze audio
    print("Analyzing audio...")
    analysis = analyze_audio(str(video_path))
    if analysis is None:
        print("Error: no analyzable audio content")
        sys.exit(1)
    print(f"  Dominant: {analysis['dominant_freq']:.1f} Hz ({analysis['dominant_note']})")
    print(f"  Resonant freqs: {analysis['resonant_freqs']}")
    print(f"  Analysis segments: {len(analysis['times'])}")
    print()

    # Step 3: Set up ffmpeg pipelines
    renderer = OverlayRenderer(out_w, out_h, analysis, site_name=args.site)

    # Determine PIL rotation for phone videos
    pil_rotate = None
    if rotation in (-90, 270):
        pil_rotate = Image.Transpose.ROTATE_270
    elif rotation in (90, -270):
        pil_rotate = Image.Transpose.ROTATE_90
    elif rotation in (180, -180):
        pil_rotate = Image.Transpose.ROTATE_180

    # Decoder: raw frames at stream dimensions (no ffmpeg rotation — we rotate in PIL)
    decode_cmd = [
        'ffmpeg', '-v', 'error', '-noautorotate',
        '-i', str(video_path),
        '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-an', 'pipe:1',
    ]

    # Encoder: frames at display dimensions
    encode_cmd = [
        'ffmpeg', '-v', 'error', '-y',
        '-f', 'rawvideo', '-pix_fmt', 'rgb24',
        '-s', f'{out_w}x{out_h}', '-r', str(fps),
        '-i', 'pipe:0',
        '-i', str(video_path),
        '-map', '0:v', '-map', '1:a?',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', str(args.crf),
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart',
        str(output_path),
    ]

    print(f"Rendering overlay → {output_path}")

    # Decode at stream dimensions, rotate in PIL, encode at display dimensions
    raw_frame_size = w * h * 3
    out_frame_size = out_w * out_h * 3
    decoder = subprocess.Popen(decode_cmd, stdout=subprocess.PIPE, bufsize=raw_frame_size * 4)
    encoder = subprocess.Popen(encode_cmd, stdin=subprocess.PIPE, bufsize=out_frame_size * 4)

    frame_num = 0

    try:
        while True:
            raw = decoder.stdout.read(raw_frame_size)
            if len(raw) < raw_frame_size:
                break

            current_time = frame_num / fps

            # Convert raw bytes → PIL Image at stream dimensions, then rotate
            frame = Image.frombytes('RGB', (w, h), raw)
            if pil_rotate is not None:
                frame = frame.transpose(pil_rotate)

            # Render overlay
            frame = renderer.render_frame(frame, current_time)

            # Write to encoder
            encoder.stdin.write(frame.tobytes())

            frame_num += 1
            if frame_num % int(fps) == 0 or frame_num == 1:
                pct = frame_num / total_frames * 100 if total_frames > 0 else 0
                freq = interpolate(analysis['times'], analysis['freqs'], current_time)
                rms = interpolate(analysis['times'], analysis['rms'], current_time)
                res = " [RESONATING]" if rms > RESONATION_THRESHOLD_DB else ""
                print(f"  Frame {frame_num}/{total_frames} ({pct:.0f}%)  "
                      f"t={current_time:.1f}s  {freq:.1f} Hz  {rms:.1f} dB{res}")

    finally:
        if encoder.stdin:
            encoder.stdin.close()
        decoder.stdout.close()
        decoder.wait()
        encoder.wait()

    if encoder.returncode != 0:
        print(f"\nError: encoder exited with code {encoder.returncode}")
        sys.exit(1)

    out_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\nDone! {frame_num} frames rendered")
    print(f"Output: {output_path} ({out_size:.1f} MB)")


if __name__ == '__main__':
    main()
