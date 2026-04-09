import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface HeroTitleProps {
  title: string;
  subtitle?: string;
  accentColor?: string;
  textColor?: string;
  subtitleColor?: string;
  underlineColor?: string;
  fontFamily?: string;
  backgroundColor?: string;
}

export const HeroTitle: React.FC<HeroTitleProps> = ({
  title,
  subtitle,
  accentColor = "#4F46E5",
  textColor = "#1e293b",
  subtitleColor,
  underlineColor,
  fontFamily = "Plus Jakarta Sans, Inter, system-ui, sans-serif",
  backgroundColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const resolvedSubtitleColor = subtitleColor || accentColor;
  const resolvedUnderlineColor = underlineColor || accentColor;

  // Split title into words to accent the first word
  const words = title.split(" ");
  const firstWord = words[0] || "";
  const restWords = words.slice(1).join(" ");

  // Word-level spring for first word
  const firstWordSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // Rest of title spring (slightly delayed)
  const restSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        background: backgroundColor || "transparent",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "85%", padding: "0 40px" }}>
        {/* Main title — first word accented, rest in textColor */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            fontFamily,
            lineHeight: 1.2,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "0 0.3em",
          }}
        >
          <span
            style={{
              display: "inline-block",
              opacity: firstWordSpring,
              transform: `translateY(${interpolate(firstWordSpring, [0, 1], [30, 0])}px)`,
              color: accentColor,
            }}
          >
            {firstWord}
          </span>
          {restWords && (
            <span
              style={{
                display: "inline-block",
                opacity: restSpring,
                transform: `translateY(${interpolate(restSpring, [0, 1], [20, 0])}px)`,
                color: textColor,
              }}
            >
              {restWords}
            </span>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              marginTop: 20,
              opacity: spring({
                frame: frame - 18,
                fps,
                config: { damping: 20 },
              }),
              fontSize: 28,
              fontWeight: 500,
              color: resolvedSubtitleColor,
              fontFamily,
              letterSpacing: "0.02em",
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Animated underline */}
        <div
          style={{
            margin: "24px auto 0",
            height: 3,
            backgroundColor: resolvedUnderlineColor,
            borderRadius: 2,
            width: interpolate(
              spring({
                frame: frame - 15,
                fps,
                config: { damping: 15, stiffness: 60 },
              }),
              [0, 1],
              [0, 400]
            ),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
