import { AbsoluteFill, spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface TextCardProps {
  text: string;
  subtitle?: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  accentColor?: string;
  fontFamily?: string;
  isCta?: boolean;
}

export const TextCard: React.FC<TextCardProps> = ({
  text,
  subtitle,
  fontSize = 64,
  color = "#FFFFFF",
  backgroundColor = "#1F2937",
  accentColor,
  fontFamily = "Inter, system-ui, sans-serif",
  isCta = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = spring({ frame, fps, config: { damping: 20 } });
  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 0.95,
    to: 1,
  });

  // CTA button animation (delayed)
  const btnSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  // CTA button pulse
  const pulse = isCta
    ? 1 + Math.sin(frame / (fps * 0.4)) * 0.02
    : 1;

  if (isCta && subtitle) {
    // CTA layout: large URL + subtitle + animated button
    return (
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          background: backgroundColor,
        }}
      >
        <div
          style={{
            opacity,
            transform: `scale(${scale})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* Main CTA text (URL) */}
          <div
            style={{
              fontSize: Math.round(fontSize * 1.1),
              color: accentColor || color,
              fontFamily,
              fontWeight: 800,
              textAlign: "center",
              letterSpacing: "-0.02em",
            }}
          >
            {text}
          </div>

          {/* Animated underline */}
          <div
            style={{
              height: 3,
              backgroundColor: accentColor || color,
              borderRadius: 2,
              width: interpolate(
                spring({ frame: frame - 8, fps, config: { damping: 15, stiffness: 60 } }),
                [0, 1],
                [0, 300]
              ),
            }}
          />

          {/* Subtitle / CTA description */}
          <div
            style={{
              opacity: btnSpring,
              transform: `translateY(${interpolate(btnSpring, [0, 1], [15, 0])}px) scale(${pulse})`,
              fontSize: 28,
              color,
              fontFamily,
              fontWeight: 500,
              textAlign: "center",
              maxWidth: "80%",
              lineHeight: 1.4,
              padding: "16px 40px",
              borderRadius: 12,
              background: accentColor ? `${accentColor}18` : "rgba(255,255,255,0.08)",
            }}
          >
            {subtitle}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: backgroundColor,
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize,
            color,
            fontFamily,
            fontWeight: 700,
            textAlign: "center",
            maxWidth: "80%",
            lineHeight: 1.3,
          }}
        >
          {text}
        </div>
        {subtitle && (
          <div
            style={{
              opacity: btnSpring * 0.75,
              fontSize: Math.round(fontSize * 0.45),
              color,
              fontFamily,
              fontWeight: 400,
              textAlign: "center",
              maxWidth: "75%",
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
