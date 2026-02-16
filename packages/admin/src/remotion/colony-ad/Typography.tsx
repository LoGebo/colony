import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from 'remotion';

const FONT =
  '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif';

// ─── Beat 1: Cinematic line-by-line reveal ───
// Each line fades in with blur, all hold, then all fade out together

export const CinematicText: React.FC<{
  lines: { text: string; delay: number }[];
  fadeOutStart: number;
  fadeOutEnd: number;
}> = ({ lines, fadeOutStart, fadeOutEnd }) => {
  const frame = useCurrentFrame();

  const containerFadeOut = interpolate(frame, [fadeOutStart, fadeOutEnd], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        opacity: containerFadeOut,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {lines.map((line, i) => {
          const revealDur = 22;
          const start = line.delay;

          const opacity = interpolate(
            frame,
            [start, start + revealDur],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          const y = interpolate(
            frame,
            [start, start + revealDur],
            [18, 0],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            }
          );

          const blur = interpolate(
            frame,
            [start, start + revealDur],
            [12, 0],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            }
          );

          return (
            <div
              key={i}
              style={{
                fontFamily: FONT,
                fontSize: 76,
                fontWeight: 700,
                color: '#ffffff',
                opacity,
                transform: `translateY(${y}px)`,
                filter: `blur(${blur}px)`,
                letterSpacing: -2,
                lineHeight: 1.15,
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Beat 3: Feature label below phone ───
// Clean minimal label that fades in/out below the phone

export const FeatureLabel: React.FC<{
  word: string;
  accentHue: number;
}> = ({ word, accentHue }) => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const fadeOut = interpolate(frame, [52, 68], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const y = interpolate(frame, [6, 22], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const blur = interpolate(frame, [6, 22], [6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Subtle accent line
  const lineWidth = interpolate(frame, [12, 28], [0, 50], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 280,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          opacity,
          transform: `translateY(${y}px)`,
          filter: `blur(${blur}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 56,
            fontWeight: 600,
            color: '#ffffff',
            letterSpacing: -1,
          }}
        >
          {word}
        </div>
        <div
          style={{
            width: lineWidth,
            height: 2,
            background: `linear-gradient(90deg, transparent, hsla(${accentHue}, 60%, 55%, ${opacity * 0.6}), transparent)`,
            borderRadius: 2,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ─── Beat 4: Brand reveal "Colony." ───

export const BrandReveal: React.FC = () => {
  const frame = useCurrentFrame();

  // "Colony." text
  const textOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const textScale = interpolate(frame, [0, 30], [0.85, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const letterSpacing = interpolate(frame, [0, 30], [18, -1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const textBlur = interpolate(frame, [0, 24], [14, 0], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Glow behind text
  const glowOpacity = interpolate(frame, [0, 30, 80], [0, 0.18, 0.06], {
    extrapolateRight: 'clamp',
  });
  const glowScale = interpolate(frame, [0, 30], [0.3, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Subtitle: "Tu comunidad. Una app."
  const subOpacity = interpolate(frame, [36, 54], [0, 0.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subY = interpolate(frame, [36, 54], [14, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const subBlur = interpolate(frame, [36, 54], [6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Hold then fade to black
  const endFade = interpolate(frame, [120, 145], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      {/* Glow */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 300,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, rgba(99,102,241,${glowOpacity * endFade}) 0%, transparent 65%)`,
          filter: 'blur(50px)',
          transform: `scale(${glowScale})`,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          opacity: endFade,
        }}
      >
        <div
          style={{
            fontFamily: FONT,
            fontSize: 120,
            fontWeight: 600,
            color: '#ffffff',
            opacity: textOpacity,
            transform: `scale(${textScale})`,
            letterSpacing,
            filter: `blur(${textBlur}px)`,
          }}
        >
          Colony.
        </div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 18,
            fontWeight: 400,
            color: '#ffffff',
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
            filter: `blur(${subBlur}px)`,
            letterSpacing: 4,
            textTransform: 'uppercase',
          }}
        >
          Tu comunidad. Una app.
        </div>
      </div>
    </AbsoluteFill>
  );
};
