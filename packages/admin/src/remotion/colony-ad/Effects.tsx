import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from 'remotion';

export const LightSweep: React.FC<{
  trigger: number;
  duration?: number;
  vertical?: boolean;
}> = ({ trigger, duration = 28, vertical = false }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [trigger, trigger + duration],
    [-20, 120],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) }
  );
  const opacity = interpolate(
    frame,
    [trigger, trigger + 5, trigger + duration - 5, trigger + duration],
    [0, 0.15, 0.15, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          ...(vertical
            ? { left: 0, top: `${progress}%`, width: '100%', height: '4%' }
            : { left: `${progress}%`, top: 0, width: '5%', height: '100%' }),
          background: vertical
            ? `linear-gradient(180deg, transparent, rgba(255,255,255,${opacity * 0.5}), transparent)`
            : `linear-gradient(90deg, transparent, rgba(255,255,255,${opacity * 0.5}), transparent)`,
          filter: 'blur(20px)',
          transform: vertical ? 'skewY(-5deg)' : 'skewX(-10deg)',
        }}
      />
    </AbsoluteFill>
  );
};

export const PulseRing: React.FC<{ delay?: number; maxScale?: number; color?: string }> = ({
  delay = 0,
  maxScale = 3,
  color = '99,102,241',
}) => {
  const frame = useCurrentFrame();
  const t = frame - delay;
  const scale = interpolate(t, [0, 50], [0.2, maxScale], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(t, [0, 10, 35, 50], [0, 0.3, 0.08, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
      <div
        style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          border: `1.5px solid rgba(${color},${opacity})`,
          transform: `scale(${scale})`,
          boxShadow: `0 0 50px rgba(${color},${opacity * 0.3})`,
        }}
      />
    </AbsoluteFill>
  );
};

/** White radial pulse — Beat 4 transition flash */
export const RadialFlash: React.FC<{
  trigger: number;
  duration?: number;
}> = ({ trigger, duration = 24 }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [trigger, trigger + duration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const opacity = interpolate(
    progress,
    [0, 0.15, 1],
    [0, 0.25, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const scale = interpolate(
    progress,
    [0, 1],
    [0.3, 3],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
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
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,255,255,${opacity}) 0%, rgba(200,200,255,${opacity * 0.4}) 40%, transparent 70%)`,
          transform: `scale(${scale})`,
          filter: 'blur(40px)',
        }}
      />
    </AbsoluteFill>
  );
};
