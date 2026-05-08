import React, { useCallback, useRef } from 'react';
import { useAudioPlayback } from './useAudioPlayback';

interface AudioPlayerProps {
  fileId: string;
  audioUrl: string;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ fileId, audioUrl }: AudioPlayerProps) {
  const { currentFileId, isPlaying, currentTime, duration, play, pause, seek } = useAudioPlayback();
  const barRef = useRef<HTMLDivElement>(null);

  const isActive = currentFileId === fileId;
  const playing = isActive && isPlaying;
  const time = isActive ? currentTime : 0;
  const dur = isActive ? duration : 0;
  const progress = dur > 0 ? time / dur : 0;

  const handlePlayPause = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (playing) {
        pause();
      } else {
        play(fileId, audioUrl);
      }
    },
    [playing, pause, play, fileId, audioUrl],
  );

  const seekTo = useCallback(
    (clientX: number) => {
      if (!barRef.current || !dur) return;
      const rect = barRef.current.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seek(frac * dur);
    },
    [dur, seek],
  );

  const handleBarClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isActive) {
        play(fileId, audioUrl);
        return;
      }
      seekTo(e.clientX);
    },
    [isActive, play, fileId, audioUrl, seekTo],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      if (!isActive) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      seekTo(e.clientX);
    },
    [isActive, seekTo],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      if (!isActive || !(e.buttons & 1)) return;
      seekTo(e.clientX);
    },
    [isActive, seekTo],
  );

  const stopProp = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    <div className="audio-player" onClick={stopProp}>
      {/* Play/Pause button */}
      <button className="audio-player-btn" onClick={handlePlayPause} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="1" width="3" height="10" rx="0.5" fill="currentColor" />
            <rect x="7" y="1" width="3" height="10" rx="0.5" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <polygon points="2,1 11,6 2,11" fill="currentColor" />
          </svg>
        )}
      </button>

      {/* Seek bar */}
      <div
        className="audio-player-bar"
        ref={barRef}
        onClick={handleBarClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <div className="audio-player-fill" style={{ width: `${progress * 100}%` }} />
        <div className="audio-player-thumb" style={{ left: `${progress * 100}%` }} />
      </div>

      {/* Time display */}
      <span className="audio-player-time">
        {formatTime(time)} / {dur > 0 ? formatTime(dur) : '--:--'}
      </span>
    </div>
  );
}
