import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Sequence,
  Easing,
  spring,
  useVideoConfig,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/PlusJakartaSans';
import { AnimatedBackground, Vignette, ColorWash, GlowPortal } from './Background';
import { LightSweep, RadialFlash } from './Effects';
import { PhoneDevice } from './Phone';
import { CinematicText, FeatureLabel, BrandReveal } from './Typography';

const { fontFamily } = loadFont();

// ── Shared phone constants ──
const PHONE_SCALE = 1.2;
const PHONE_Y = -50;

// ── Smooth continuous motion helpers (global frame for seamless beat transitions) ──
// PREMIUM MOTION: layered sinusoids for organic, living feel

// Y-axis rotation: dual-frequency oscillation for organic feel
const getPhoneTiltY = (localFrame: number, beatOffset: number) => {
  const g = localFrame + beatOffset;
  return 5 + Math.sin(g * 0.013) * 7 + Math.sin(g * 0.031) * 2;
};

// X-axis rotation: forward/back tilt with secondary wobble
const getPhoneTiltX = (localFrame: number, beatOffset: number) => {
  const g = localFrame + beatOffset;
  return Math.sin(g * 0.019 + 1.5) * 3.5 + Math.sin(g * 0.041) * 1;
};

// Vertical bob: two-layer float
const getPhoneBob = (localFrame: number, beatOffset: number) => {
  const g = localFrame + beatOffset;
  return Math.sin(g * 0.026) * 10 + Math.sin(g * 0.053) * 3;
};

// Lateral drift: slow sway + micro-drift
const getPhoneDriftX = (localFrame: number, beatOffset: number) => {
  const g = localFrame + beatOffset;
  return Math.sin(g * 0.011 + 0.7) * 14 + Math.sin(g * 0.037) * 4;
};

// Scale breathing: visible pulse
const getPhoneBreathing = (localFrame: number, beatOffset: number) => {
  const g = localFrame + beatOffset;
  return Math.sin(g * 0.021) * 0.025 + Math.sin(g * 0.047) * 0.008;
};

// ── Feature config (Beat 3) ──
const FEATURES = [
  { word: 'Pagos.', screen: 'screens/billing.png', hue: 230 },
  { word: 'Visitas.', screen: 'screens/visitors.png', hue: 170 },
  { word: 'Comunidad.', screen: 'screens/social.png', hue: 280 },
];
const FEAT_DUR = 72;

export const ColonyAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#050508', fontFamily }}>
      <AnimatedBackground />

      {/* BEAT 1: TENSION (0-168) */}
      <Sequence from={0} durationInFrames={168}>
        <Beat1Tension />
      </Sequence>

      {/* BEAT 2: THE REVEAL (168-336) */}
      <Sequence from={168} durationInFrames={168}>
        <Beat2Reveal />
      </Sequence>

      {/* BEAT 3: FEATURE SHOWCASE (336-552) */}
      <Sequence from={336} durationInFrames={216}>
        <Beat3Features />
      </Sequence>

      {/* BEAT 4: CRESCENDO (552-720) */}
      <Sequence from={552} durationInFrames={168}>
        <Beat4Crescendo />
      </Sequence>

      {/* Light sweeps */}
      <LightSweep trigger={162} duration={30} vertical />
      <LightSweep trigger={546} duration={32} vertical />

      <Vignette />
    </AbsoluteFill>
  );
};

// ── BEAT 1 ──

const Beat1Tension: React.FC = () => (
  <AbsoluteFill>
    <CinematicText
      lines={[
        { text: 'Colony.', delay: 24 },
        { text: 'Todo.', delay: 58 },
        { text: 'Una sola app.', delay: 92 },
      ]}
      fadeOutStart={135}
      fadeOutEnd={165}
    />
  </AbsoluteFill>
);

// ── BEAT 2: Phone emerges, settles with smooth rotation ──

const Beat2Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneSpring = spring({
    frame: Math.max(0, frame - 48),
    fps,
    config: { damping: 16, stiffness: 70, mass: 0.9 },
  });

  const phoneOpacity = interpolate(frame, [48, 72], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const phoneScale = interpolate(phoneSpring, [0, 1], [1.6, PHONE_SCALE]);

  // Motion fades in earlier and faster
  const motionIntro = interpolate(frame, [54, 96], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const phoneRotY = getPhoneTiltY(frame, 168) * motionIntro;
  const phoneRotX = getPhoneTiltX(frame, 168) * motionIntro;
  const driftX = getPhoneDriftX(frame, 168) * motionIntro;
  const breathing = getPhoneBreathing(frame, 168) * motionIntro;

  // Blur clears
  const phoneBlur = interpolate(frame, [48, 84], [6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Bob fades in gradually
  const bobIntro = interpolate(frame, [60, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bob = getPhoneBob(frame, 168) * bobIntro;

  // Y settles
  const phoneY = interpolate(frame, [48, 110], [60, PHONE_Y], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const glowOpacity = interpolate(frame, [48, 90, 168], [0, 0.28, 0.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Crossfade screen at end: home → billing for seamless Beat 3 start
  const screenCrossfade = interpolate(frame, [148, 168], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // "Todo en un lugar." label — appears after phone settles, fades before crossfade
  const labelFadeIn = interpolate(frame, [90, 110], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const labelFadeOut = interpolate(frame, [138, 154], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelOpacity = Math.min(labelFadeIn, labelFadeOut);
  const labelY = interpolate(frame, [90, 110], [14, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const labelBlur = interpolate(frame, [90, 110], [8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <GlowPortal startFrame={0} endFrame={72} />

      {phoneOpacity > 0 && (
        <AbsoluteFill
          style={{
            opacity: phoneOpacity,
            filter: phoneBlur > 0.1 ? `blur(${phoneBlur}px)` : undefined,
          }}
        >
          <PhoneDevice
            screenSrc="screens/home.png"
            screenTransitionSrc={screenCrossfade > 0 ? FEATURES[0].screen : undefined}
            screenTransitionProgress={screenCrossfade}
            scale={phoneScale + breathing}
            rotateY={phoneRotY}
            rotateX={phoneRotX}
            translateX={driftX}
            translateY={phoneY + bob}
            glowHue={245}
            glowOpacity={glowOpacity}
            showGlare
          />
        </AbsoluteFill>
      )}

      {/* Subtle label during home screen reveal */}
      {labelOpacity > 0 && (
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
              gap: 10,
              opacity: labelOpacity,
              transform: `translateY(${labelY}px)`,
              filter: `blur(${labelBlur}px)`,
            }}
          >
            <div
              style={{
                fontFamily,
                fontSize: 42,
                fontWeight: 500,
                color: '#ffffff',
                letterSpacing: -0.5,
                opacity: 0.85,
              }}
            >
              Todo en un lugar.
            </div>
            <div
              style={{
                width: interpolate(frame, [96, 116], [0, 40], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.out(Easing.cubic),
                }),
                height: 1.5,
                background: `linear-gradient(90deg, transparent, rgba(99,102,241,${labelOpacity * 0.5}), transparent)`,
                borderRadius: 2,
              }}
            />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// ── BEAT 3: Features — seamless continuation ──

const Beat3Features: React.FC = () => {
  const frame = useCurrentFrame();

  const bob = getPhoneBob(frame, 336);
  const phoneRotY = getPhoneTiltY(frame, 336);
  const phoneRotX = getPhoneTiltX(frame, 336);
  const driftX = getPhoneDriftX(frame, 336);
  const breathing = getPhoneBreathing(frame, 336);

  const featureIndex = Math.min(
    Math.floor(frame / FEAT_DUR),
    FEATURES.length - 1
  );
  const featureLocalFrame = frame - featureIndex * FEAT_DUR;

  const currentFeature = FEATURES[featureIndex];
  const nextFeature = FEATURES[Math.min(featureIndex + 1, FEATURES.length - 1)];

  const crossfadeProgress =
    featureIndex < FEATURES.length - 1
      ? interpolate(featureLocalFrame, [FEAT_DUR - 18, FEAT_DUR], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.cubic),
        })
      : 0;

  const accentHue = interpolate(
    frame,
    FEATURES.map((_, i) => i * FEAT_DUR),
    FEATURES.map((f) => f.hue),
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill>
      <ColorWash hue={accentHue} opacity={0.05} />

      <AbsoluteFill>
        <PhoneDevice
          screenSrc={currentFeature.screen}
          screenTransitionSrc={crossfadeProgress > 0 ? nextFeature.screen : undefined}
          screenTransitionProgress={crossfadeProgress}
          scale={PHONE_SCALE + breathing}
          rotateY={phoneRotY}
          rotateX={phoneRotX}
          translateX={driftX}
          translateY={PHONE_Y + bob}
          glowHue={accentHue}
          glowOpacity={0.2}
          showGlare
        />
      </AbsoluteFill>

      {FEATURES.map((feat, i) => (
        <Sequence key={feat.word} from={i * FEAT_DUR} durationInFrames={FEAT_DUR}>
          <FeatureLabel word={feat.word} accentHue={feat.hue} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// ── BEAT 4: Crescendo ──

const Beat4Crescendo: React.FC = () => {
  const frame = useCurrentFrame();

  // Rotation smoothly goes to 0
  const baseTiltY = getPhoneTiltY(frame, 552);
  const phoneRotY = interpolate(frame, [0, 36], [baseTiltY, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const phoneScale = interpolate(frame, [0, 36], [PHONE_SCALE, 0.65], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const bob = getPhoneBob(frame, 552);
  const baseTiltX = getPhoneTiltX(frame, 552);
  const phoneRotX = interpolate(frame, [0, 36], [baseTiltX, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const driftX = interpolate(frame, [0, 36], [getPhoneDriftX(frame, 552), 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const phoneY = interpolate(frame, [0, 36], [PHONE_Y + bob, -220], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const phoneOpacity = interpolate(frame, [20, 44], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      {phoneOpacity > 0 && (
        <AbsoluteFill style={{ opacity: phoneOpacity }}>
          <PhoneDevice
            screenSrc="screens/social.png"
            scale={phoneScale}
            rotateY={phoneRotY}
            rotateX={phoneRotX}
            translateX={driftX}
            translateY={phoneY}
            glowHue={260}
            glowOpacity={0.15}
            showGlare
          />
        </AbsoluteFill>
      )}

      <RadialFlash trigger={34} duration={28} />

      <Sequence from={46} durationInFrames={122}>
        <BrandReveal />
      </Sequence>
    </AbsoluteFill>
  );
};
