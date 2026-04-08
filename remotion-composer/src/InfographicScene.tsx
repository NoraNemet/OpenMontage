// remotion-composer/src/InfographicScene.tsx
import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export interface InfographicSceneProps {
  /** Path or URL to pre-rendered infographic PNG */
  imageUrl: string;
  /** Entrance animation style */
  animationStyle?: 'fade-in' | 'slide-up' | 'zoom-in';
  /** Total duration of this scene in frames (passed by Sequence) */
  durationInFrames: number;
  /** Optional overlay text shown below the image */
  overlayText?: string;
}

export const InfographicScene: React.FC<InfographicSceneProps> = ({
  imageUrl,
  animationStyle = 'fade-in',
  durationInFrames,
  overlayText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springConfig = { fps, damping: 18, stiffness: 120, mass: 1 };
  const progress = spring({ frame, ...springConfig });

  const opacity = interpolate(progress, [0, 1], [0, 1]);

  const translateY =
    animationStyle === 'slide-up'
      ? interpolate(progress, [0, 1], [40, 0])
      : 0;

  const scale =
    animationStyle === 'zoom-in'
      ? interpolate(progress, [0, 1], [0.92, 1])
      : 1;

  // Fade out last 0.5s
  const fadeOutStart = durationInFrames - Math.round(fps * 0.5);
  const exitOpacity =
    frame >= fadeOutStart
      ? interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
          extrapolateRight: 'clamp',
        })
      : 1;

  const finalOpacity = opacity * exitOpacity;

  return (
    <AbsoluteFill style={{ backgroundColor: '#ffffff' }}>
      <AbsoluteFill
        style={{
          opacity: finalOpacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: overlayText ? '0 0 80px 0' : 0,
        }}
      >
        <Img
          src={imageUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </AbsoluteFill>

      {overlayText && (
        <AbsoluteFill
          style={{
            opacity: finalOpacity,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 40,
          }}
        >
          <div
            style={{
              background: 'rgba(79,70,229,0.92)',
              color: '#ffffff',
              fontSize: 28,
              fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
              fontWeight: 600,
              padding: '12px 32px',
              borderRadius: 8,
              maxWidth: '80%',
              textAlign: 'center',
            }}
          >
            {overlayText}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
