"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseCameraOptions {
  autoStart?: boolean;
  facingMode?: string;
  width?: number;
  height?: number;
}

export function useCamera(options: UseCameraOptions = {}) {
  const { autoStart = true, facingMode = 'environment', width = 1920, height = 1080 } = options;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraSupported, setIsCameraSupported] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [torchSupported, setTorchSupported] = useState<boolean>(false);

  const activeStreamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
      setStream(null);
    }
  }, []);

  const setTorch = useCallback(async (enable: boolean) => {
    if (activeStreamRef.current) {
      try {
        const track = activeStreamRef.current.getVideoTracks()[0];
        if (track && 'applyConstraints' in track) {
          const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
          if (capabilities && (capabilities.torch || 'torch' in capabilities)) {
            await track.applyConstraints({ advanced: [{ torch: enable } as any] });
            setTorchActive(enable);
          }
        }
      } catch (e) {
        console.warn('Torch toggle note:', e);
      }
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);

    if (typeof window === 'undefined') return null;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsCameraSupported(false);
      const isSecureContext = window.isSecureContext;
      if (!isSecureContext) {
        setCameraError('Live video streaming requires HTTPS or localhost. Click "Open Camera / Snap Photos" to use your device native camera.');
      } else {
        setCameraError('Camera API unsupported in this browser environment.');
      }
      return null;
    }

    try {
      let mediaStream: MediaStream;

      // 1. Try preferred facingMode and resolution constraints
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: width, min: 320 },
            height: { ideal: height, min: 240 }
          },
          audio: false
        };
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (primaryErr: any) {
        // 2. Fallback to basic video constraint if environment/resolution constraint fails (e.g. desktop laptops with single front webcam)
        console.warn('Preferred camera constraints failed, attempting basic video fallback:', primaryErr);
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (secondaryErr: any) {
          throw secondaryErr;
        }
      }

      activeStreamRef.current = mediaStream;
      setStream(mediaStream);
      setIsCameraSupported(true);

      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities && (capabilities.torch || 'torch' in capabilities)) {
          setTorchSupported(true);
        }
      }

      return mediaStream;
    } catch (err: any) {
      console.warn('useCamera stream initialization note:', err);
      setIsCameraSupported(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied. Please click the site settings/lock icon in your address bar and allow camera access.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera device found. Please attach a camera or use file upload.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is currently in use by another app or browser tab. Please close other camera apps and retry.');
      } else {
        setCameraError(`Camera error (${err.name || 'Unavailable'}): ${err.message || 'Stream initialization failed.'}`);
      }
      return null;
    }
  }, [facingMode, width, height, stopCamera]);

  useEffect(() => {
    if (autoStart) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [autoStart, startCamera, stopCamera]);

  return {
    stream,
    isCameraSupported,
    cameraError,
    startCamera,
    stopCamera,
    torchSupported,
    torchActive,
    setTorch
  };
}
