import { useCallback, useEffect, useRef, useState } from "react";
import type { Checkin } from "../types";

export type Speed = "slow" | "normal" | "fast";

const STEP_MS: Record<Speed, number> = {
  slow: 1500,
  normal: 800,
  fast: 350,
};

export interface Playback {
  playing: boolean;
  /** Index into `checkins` of the current stop, or -1 before playback starts. */
  index: number;
  current: Checkin | null;
  speed: Speed;
  play: () => void;
  pause: () => void;
  stop: () => void;
  stepTo: (index: number) => void;
  setSpeed: (s: Speed) => void;
}

/**
 * Chronological playback over the currently-filtered check-ins. Advancing past
 * the last check-in stops (no loop). Any change to the check-in list resets
 * playback to the start.
 */
export function usePlayback(checkins: Checkin[]): Playback {
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(-1);
  const [speed, setSpeed] = useState<Speed>("normal");
  const timer = useRef<number | null>(null);

  // Reset whenever the filtered set changes.
  useEffect(() => {
    setPlaying(false);
    setIndex(-1);
  }, [checkins]);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => {
    if (!playing) {
      clear();
      return;
    }
    if (index >= checkins.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = window.setTimeout(() => {
      setIndex((i) => i + 1);
    }, STEP_MS[speed]);
    return clear;
  }, [playing, index, speed, checkins.length]);

  const play = useCallback(() => {
    if (!checkins.length) return;
    setIndex((i) => (i >= checkins.length - 1 ? 0 : i < 0 ? 0 : i));
    setPlaying(true);
  }, [checkins.length]);

  const pause = useCallback(() => setPlaying(false), []);

  const stop = useCallback(() => {
    setPlaying(false);
    setIndex(-1);
  }, []);

  const stepTo = useCallback(
    (i: number) => {
      setPlaying(false);
      setIndex(Math.max(-1, Math.min(i, checkins.length - 1)));
    },
    [checkins.length],
  );

  return {
    playing,
    index,
    current: index >= 0 && index < checkins.length ? checkins[index] : null,
    speed,
    play,
    pause,
    stop,
    stepTo,
    setSpeed,
  };
}
