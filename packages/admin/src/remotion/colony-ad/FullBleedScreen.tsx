import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Img,
  staticFile,
  Easing,
} from 'remotion';

/**
 * Shows a screenshot filling the ENTIRE frame (1080x1920) —
 * like you're inside the app. With Ken Burns zoom + scroll sim.
 */
export const FullBleedScreen: React.FC<{
  src: string;
  scrollAmount?: number;
  zoomFrom?: number;
  zoomTo?: number;
}> = ({ src, scrollAmount = 40, zoomFrom = 1.05, zoomTo = 1.15 }) => {
  const frame = useCurrentFrame();

  const zoom = interpolate(frame, [0, 120], [zoomFrom, zoomTo], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scrollY = interpolate(frame, [0, 120], [0, -scrollAmount], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '110%',
          objectFit: 'cover',
          objectPosition: 'top center',
          transform: `scale(${zoom}) translateY(${scrollY}px)`,
          transformOrigin: 'center top',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Animated transition: full-bleed UI zooms OUT to reveal it's inside a phone.
 * The `progress` prop goes from 0 (full-bleed) to 1 (phone-sized).
 */
export const ZoomReveal: React.FC<{
  src: string;
  progress: number;
  phoneWidth: number;
  phoneHeight: number;
}> = ({ src, progress, phoneWidth, phoneHeight }) => {
  // At progress=0: fills 1080x1920. At progress=1: shrinks to phone screen size
  const screenW = 1080;
  const screenH = 1920;

  const targetW = phoneWidth - 24; // bezel
  const targetH = phoneHeight - 24;

  const currentW = interpolate(progress, [0, 1], [screenW, targetW], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const currentH = interpolate(progress, [0, 1], [screenH, targetH], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const borderRadius = interpolate(progress, [0, 1], [0, 44], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: currentW,
        height: currentH,
        borderRadius,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'top center',
        }}
      />
    </div>
  );
};
