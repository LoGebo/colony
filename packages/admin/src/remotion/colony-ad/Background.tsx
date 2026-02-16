import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  random,
  Easing,
} from 'remotion';

// Reduced particle count for Apple-style subtlety
const PARTICLE_COUNT = 12;
const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x: random(`x-${i}`) * 100,
  y: random(`y-${i}`) * 120 - 10,
  size: 2 + random(`size-${i}`) * 5,
  speed: 0.08 + random(`speed-${i}`) * 0.15,
  delay: random(`delay-${i}`) * 200,
  baseOpacity: 0.03 + random(`op-${i}`) * 0.07,
  hueShift: random(`hue-${i}`) * 30 - 15,
}));

export const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();

  const hue1 = interpolate(frame, [0, 240, 480, 720], [230, 245, 255, 240], {
    extrapolateRight: 'clamp',
  });
  const hue2 = interpolate(frame, [0, 240, 480, 720], [250, 260, 270, 255], {
    extrapolateRight: 'clamp',
  });

  const intensity = interpolate(
    frame,
    [0, 60, 300, 600, 680, 720],
    [0, 0.06, 0.05, 0.08, 0.03, 0],
    { extrapolateRight: 'clamp' }
  );

  const d1X = 40 + Math.sin(frame * 0.005) * 12;
  const d1Y = 30 + Math.cos(frame * 0.004) * 8;
  const d2X = 60 + Math.sin(frame * 0.006 + 2) * 12;
  const d2Y = 70 + Math.cos(frame * 0.004 + 1) * 10;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at ${d1X}% ${d1Y}%, hsla(${hue1}, 50%, 14%, ${intensity}) 0%, transparent 50%),
            radial-gradient(ellipse 70% 45% at ${d2X}% ${d2Y}%, hsla(${hue2}, 40%, 10%, ${intensity * 0.6}) 0%, transparent 40%)
          `,
        }}
      />
      {particles.map((p, i) => {
        const t = frame - p.delay;
        const yDrift = t * p.speed * 0.08;
        const currentY = ((p.y - yDrift) % 130 + 130) % 130 - 15;
        const sway = Math.sin(t * 0.01 + i * 1.5) * 8;
        const pOpacity = interpolate(
          frame,
          [0, 60, 640, 720],
          [0, p.baseOpacity, p.baseOpacity, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        if (pOpacity <= 0) return null;
        const hue = hue1 + p.hueShift;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `calc(${p.x}% + ${sway}px)`,
              top: `${currentY}%`,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, hsla(${hue}, 45%, 60%, ${pOpacity}) 0%, transparent 70%)`,
              filter: `blur(${p.size * 0.5}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Soft radial light that grows from center — Beat 2 portal effect */
export const GlowPortal: React.FC<{
  startFrame: number;
  endFrame: number;
}> = ({ startFrame, endFrame }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const scale = interpolate(progress, [0, 1], [0.1, 2.5]);
  const opacity = interpolate(
    progress,
    [0, 0.3, 0.7, 1],
    [0, 0.35, 0.25, 0]
  );

  if (opacity <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(99,102,241,${opacity}) 0%, rgba(79,82,221,${opacity * 0.5}) 30%, transparent 70%)`,
          transform: `scale(${scale})`,
          filter: 'blur(60px)',
        }}
      />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(ellipse 65% 55% at 50% 50%, transparent 0%, rgba(0,0,0,0.55) 100%)',
      pointerEvents: 'none',
    }}
  />
);

export const ColorWash: React.FC<{
  hue: number;
  opacity: number;
}> = ({ hue, opacity }) => {
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 80% 60% at 50% 50%, hsla(${hue}, 70%, 30%, ${opacity}) 0%, transparent 70%)`,
        pointerEvents: 'none',
        filter: 'blur(40px)',
      }}
    />
  );
};
