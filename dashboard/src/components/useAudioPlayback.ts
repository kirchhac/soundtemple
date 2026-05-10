import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface AudioPlaybackState {
  currentFileId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: (fileId: string, url: string) => void;
  pause: () => void;
  seek: (time: number) => void;
}

const AudioPlaybackContext = createContext<AudioPlaybackState>({
  currentFileId: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  play: () => {},
  pause: () => {},
  seek: () => {},
});

// Module-level singleton — only one audio plays at a time
let sharedAudio: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
  }
  return sharedAudio;
}

export function AudioPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const rafRef = useRef<number>(0);
  const fileIdRef = useRef<string | null>(null);
  const seekingRef = useRef(false);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    const tick = () => {
      const audio = getAudio();
      setCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop]);

  const play = useCallback((fileId: string, url: string) => {
    const audio = getAudio();

    if (fileIdRef.current !== fileId) {
      // Different file — swap source
      audio.pause();
      audio.volume = 1;
      audio.src = url;
      audio.load();
      fileIdRef.current = fileId;
      setCurrentFileId(fileId);
      setCurrentTime(0);

      const onLoaded = () => {
        setDuration(audio.duration);
        audio.play();
        setIsPlaying(true);
        startLoop();
        audio.removeEventListener('loadedmetadata', onLoaded);
      };
      audio.addEventListener('loadedmetadata', onLoaded);
    } else {
      // Same file — resume with fade-in
      audio.volume = 0;
      audio.play();
      setIsPlaying(true);
      startLoop();
      // Quick fade-in to avoid pop
      let vol = 0;
      const fadeIn = () => {
        vol = Math.min(1, vol + 0.1);
        audio.volume = vol;
        if (vol < 1) requestAnimationFrame(fadeIn);
      };
      requestAnimationFrame(fadeIn);
    }
  }, [startLoop]);

  const pause = useCallback(() => {
    const audio = getAudio();
    // Fade out quickly to avoid pop/click
    let vol = audio.volume;
    const fadeOut = () => {
      vol -= 0.15;
      if (vol <= 0) {
        audio.volume = 0;
        audio.pause();
        audio.volume = 1; // Reset for next play
        setIsPlaying(false);
        stopLoop();
      } else {
        audio.volume = vol;
        requestAnimationFrame(fadeOut);
      }
    };
    requestAnimationFrame(fadeOut);
  }, [stopLoop]);

  const seek = useCallback((time: number) => {
    const audio = getAudio();
    // Mute during seek to prevent squeal
    if (!seekingRef.current) {
      seekingRef.current = true;
      audio.volume = 0;
    }
    audio.currentTime = time;
    setCurrentTime(time);

    // Debounced unmute — restore volume after seeking stops
    const restore = () => {
      seekingRef.current = false;
      // Quick fade back in
      let vol = 0;
      const fadeIn = () => {
        vol = Math.min(1, vol + 0.2);
        if (!seekingRef.current) {
          audio.volume = vol;
        }
        if (vol < 1 && !seekingRef.current) requestAnimationFrame(fadeIn);
      };
      requestAnimationFrame(fadeIn);
    };
    // Use a short timeout so rapid seek calls don't each trigger a fade-in
    clearTimeout((seek as any)._timer);
    (seek as any)._timer = setTimeout(restore, 80);
  }, []);

  // Listen for natural end of playback
  useEffect(() => {
    const audio = getAudio();
    const onEnded = () => {
      setIsPlaying(false);
      stopLoop();
      setCurrentTime(0);
    };
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('ended', onEnded);
      stopLoop();
    };
  }, [stopLoop]);

  const value: AudioPlaybackState = {
    currentFileId,
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    seek,
  };

  return React.createElement(AudioPlaybackContext.Provider, { value }, children);
}

export function useAudioPlayback() {
  return useContext(AudioPlaybackContext);
}
