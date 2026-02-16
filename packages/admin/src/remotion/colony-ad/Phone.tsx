import React from 'react';
import {
  useCurrentFrame,
  interpolate,
  Img,
  staticFile,
  Easing,
} from 'remotion';

export const PHONE_W = 380;
export const PHONE_H = 780;
const BEZEL = 12;
const BORDER_R = 54;

interface PhoneProps {
  screenSrc: string;
  /** Second screen for crossfade transition (0 = show screenSrc, 1 = show screenTransitionSrc) */
  screenTransitionSrc?: string;
  screenTransitionProgress?: number;
  scale?: number;
  rotateY?: number;
  rotateX?: number;
  translateX?: number;
  translateY?: number;
  opacity?: number;
  glowHue?: number;
  glowOpacity?: number;
  showReflection?: boolean;
  showGlare?: boolean;
  screenZoom?: number;
  screenOffsetY?: number;
}

export const PhoneDevice: React.FC<PhoneProps> = ({
  screenSrc,
  screenTransitionSrc,
  screenTransitionProgress = 0,
  scale = 1,
  rotateY = 0,
  rotateX = 0,
  translateX = 0,
  translateY = 0,
  opacity = 1,
  glowHue = 240,
  glowOpacity = 0,
  showReflection = false,
  showGlare = false,
  screenZoom = 1,
  screenOffsetY = 0,
}) => {
  const frame = useCurrentFrame();
  const glarePos = showGlare
    ? interpolate(frame, [0, 300], [-30, 130], { extrapolateRight: 'clamp' })
    : 0;

  if (opacity <= 0) return null;

  const screenW = PHONE_W - BEZEL * 2;
  const screenH = PHONE_H - BEZEL * 2;
  const screenBR = BORDER_R - BEZEL;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) perspective(1000px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(${scale})`,
        opacity,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Ambient glow */}
      {glowOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: PHONE_W * 1.8,
            height: PHONE_H * 1.3,
            borderRadius: '50%',
            background: `radial-gradient(ellipse, hsla(${glowHue}, 70%, 40%, ${glowOpacity}) 0%, transparent 60%)`,
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Phone body */}
      <div
        style={{
          width: PHONE_W,
          height: PHONE_H,
          borderRadius: BORDER_R,
          background: 'linear-gradient(145deg, #2c2c30 0%, #1c1c1f 45%, #101012 100%)',
          boxShadow: `
            0 25px 80px rgba(0,0,0,0.6),
            0 8px 25px rgba(0,0,0,0.4),
            inset 0 0.5px 0 rgba(255,255,255,0.1),
            inset 0 -0.5px 0 rgba(255,255,255,0.04)
          `,
          padding: BEZEL,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Side buttons */}
        <div style={{ position: 'absolute', right: -2.5, top: 140, width: 3, height: 28, borderRadius: 1, background: 'linear-gradient(to bottom, #3a3a3e, #2a2a2e)' }} />
        <div style={{ position: 'absolute', right: -2.5, top: 185, width: 3, height: 52, borderRadius: 1, background: 'linear-gradient(to bottom, #3a3a3e, #2a2a2e)' }} />
        <div style={{ position: 'absolute', left: -2.5, top: 155, width: 3, height: 28, borderRadius: 1, background: 'linear-gradient(to bottom, #3a3a3e, #2a2a2e)' }} />
        <div style={{ position: 'absolute', left: -2.5, top: 200, width: 3, height: 28, borderRadius: 1, background: 'linear-gradient(to bottom, #3a3a3e, #2a2a2e)' }} />

        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute',
            top: BEZEL + 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 110,
            height: 30,
            borderRadius: 20,
            backgroundColor: '#000',
            zIndex: 10,
          }}
        />

        {/* Screen */}
        <div
          style={{
            width: screenW,
            height: screenH,
            borderRadius: screenBR,
            overflow: 'hidden',
            background: '#000',
            position: 'relative',
          }}
        >
          {/* Primary screen */}
          <Img
            src={staticFile(screenSrc)}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `center ${screenOffsetY}px`,
              transform: `scale(${screenZoom})`,
              transformOrigin: 'top center',
              opacity: screenTransitionSrc ? 1 - screenTransitionProgress : 1,
            }}
          />

          {/* Transition screen (crossfade) */}
          {screenTransitionSrc && screenTransitionProgress > 0 && (
            <Img
              src={staticFile(screenTransitionSrc)}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: `center ${screenOffsetY}px`,
                transform: `scale(${screenZoom})`,
                transformOrigin: 'top center',
                opacity: screenTransitionProgress,
              }}
            />
          )}
        </div>

        {/* Glare */}
        {showGlare && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: BORDER_R,
              background: `linear-gradient(115deg, transparent ${glarePos - 15}%, rgba(255,255,255,0.06) ${glarePos}%, transparent ${glarePos + 15}%)`,
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />
        )}
      </div>

      {/* Reflection */}
      {showReflection && (
        <div
          style={{
            width: PHONE_W,
            height: PHONE_H * 0.25,
            marginTop: 12,
            borderRadius: BORDER_R,
            background: 'linear-gradient(145deg, #2c2c30 0%, #1c1c1f 45%, #101012 100%)',
            transform: 'scaleY(-1)',
            opacity: 0.1,
            filter: 'blur(8px)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 50%)',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 50%)',
          }}
        />
      )}
    </div>
  );
};
