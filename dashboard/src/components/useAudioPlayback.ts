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
      // Same file — resume
      audio.play();
      setIsPlaying(true);
      startLoop();
    }
  }, [startLoop]);

  const pause = useCallback(() => {
    const audio = getAudio();
    audio.pause();
    setIsPlaying(false);
    stopLoop();
  }, [stopLoop]);

  const seek = useCallback((time: number) => {
    const audio = getAudio();
    audio.currentTime = time;
    setCurrentTime(time);
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
