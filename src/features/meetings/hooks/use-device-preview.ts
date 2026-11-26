'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type DevicePreview = {
  video: RefObject<HTMLVideoElement | null>;
  /** 0 to 1: how loud the microphone hears the room. */
  level: number;
  status: 'starting' | 'ready' | 'blocked';
  /** The camera and microphone in use, as the device names them. */
  devices: string | null;
  /** Lets go of the camera and microphone (before the call takes them). */
  stop: () => void;
};

/**
 * The camera's picture and the microphone's level before a Réunion
 * (`Mon espace v2 · 2 Salle d'attente`), while `active`. Nothing is sent
 * anywhere; the tracks stop when it ends or `stop` is called.
 */
export function useDevicePreview(active: boolean): DevicePreview {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState<DevicePreview['status']>('starting');
  const [devices, setDevices] = useState<string | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let context: AudioContext | null = null;
    let cancelled = false;
    // No camera API (an old browser, a page not served over HTTPS): « blocked », like a refusal.
    (navigator.mediaDevices?.getUserMedia ? navigator.mediaDevices.getUserMedia({ video: true, audio: true }) : Promise.reject(new Error('no media devices')))
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop());
        stream.current = media;
        if (video.current) video.current.srcObject = media;
        setDevices(
          media
            .getTracks()
            .map((track) => track.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)$/i, ''))
            .filter(Boolean)
            .join(' · ') || null,
        );
        setStatus('ready');
        context = new AudioContext();
        const analyser = context.createAnalyser();
        context.createMediaStreamSource(media).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          const peak = data.reduce((max, v) => Math.max(max, Math.abs(v - 128)), 0);
          setLevel(Math.min(1, peak / 48));
          frame = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => !cancelled && setStatus('blocked'));
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      void context?.close();
      stop();
    };
  }, [active, stop]);

  return { video, level, status, devices, stop };
}
