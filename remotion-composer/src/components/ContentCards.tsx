import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface ContentCard {
  title: string;
  description?: string;
  icon?: string;
  accent?: string;
}

interface ContentCardsProps {
  cards: ContentCard[];
  title?: string;
  layout?: "grid" | "stack";
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  cardBackgroundColor?: string;
  accentColor?: string;
  colors?: string[];
}

function computeGrid(
  cardCount: number,
  isPortrait: boolean
): { cols: number; rows: number } {
  if (isPortrait || cardCount <= 1) {
    return { cols: 1, rows: cardCount };
  }
  if (cardCount === 2) return { cols: 2, rows: 1 };
  if (cardCount === 3) return { cols: 3, rows: 1 };
  if (cardCount === 4) return { cols: 2, rows: 2 };
  return { cols: 3, rows: 2 };
}

export const ContentCards: React.FC<ContentCardsProps> = ({
  cards,
  title,
  layout,
  fontFamily = "Inter, system-ui, sans-serif",
  textColor = "#1F2937",
  backgroundColor = "#FFFFFF",
  cardBackgroundColor = "#F9FAFB",
  accentColor = "#2563EB",
  colors = ["#2563EB", "#F59E0B", "#10B981", "#EC4899", "#06B6D4"],
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width: videoWidth, height: videoHeight } = useVideoConfig();
  const isPortrait = videoHeight > videoWidth;

  if (cards.length === 0) {
    return <AbsoluteFill style={{ background: backgroundColor }} />;
  }

  const effectiveLayout = layout ?? (isPortrait ? "stack" : "grid");

  const padding = isPortrait ? 50 : 80;
  const cardGap = isPortrait ? 20 : 24;
  const titleHeight = title ? (isPortrait ? 100 : 120) : 0;
  const gridTop = (isPortrait ? 50 : 60) + titleHeight;
  const gridWidth = videoWidth - padding * 2;
  const gridHeight = videoHeight - gridTop - (isPortrait ? 50 : 60);

  const { cols, rows } = effectiveLayout === "stack"
    ? { cols: 1, rows: cards.length }
    : computeGrid(cards.length, isPortrait);

  const cardWidth = (gridWidth - cardGap * (cols - 1)) / cols;
  const cardHeight = Math.min(
    (gridHeight - cardGap * (rows - 1)) / rows,
    isPortrait ? 260 : 300
  );

  const totalGridHeight = rows * cardHeight + (rows - 1) * cardGap;
  const gridTopOffset = gridTop + (gridHeight - totalGridHeight) / 2;

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        fontFamily,
      }}
    >
      {title && (
        <div
          style={{
            position: "absolute",
            top: isPortrait ? 50 : 60,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: isPortrait ? 40 : 48,
            fontWeight: 700,
            color: textColor,
            fontFamily,
            opacity:
              spring({ frame, fps, config: { damping: 20 } }) * fadeOut,
          }}
        >
          {title}
        </div>
      )}

      {cards.map((card, idx) => {
        const accent = card.accent || colors[idx % colors.length];
        const staggerDelay = idx * 4;

        const entrance = spring({
          frame: frame - staggerDelay,
          fps,
          config: { damping: 14, stiffness: 100 },
        });
        const slideY = interpolate(entrance, [0, 1], [40, 0]);
        const cardOpacity = entrance;

        let left: number;
        let top: number;

        if (effectiveLayout === "stack") {
          left = padding;
          top = gridTopOffset + idx * (cardHeight + cardGap);
        } else {
          const row = Math.floor(idx / cols);
          const colInRow = idx % cols;
          const itemsInRow = row === rows - 1
            ? cards.length - cols * (rows - 1)
            : cols;
          const rowWidth = itemsInRow * cardWidth + (itemsInRow - 1) * cardGap;
          const rowLeft = padding + (gridWidth - rowWidth) / 2;
          left = rowLeft + colInRow * (cardWidth + cardGap);
          top = gridTopOffset + row * (cardHeight + cardGap);
        }

        return (
          <div
            key={card.title}
            style={{
              position: "absolute",
              left,
              top,
              width: effectiveLayout === "stack" ? gridWidth : cardWidth,
              height: cardHeight,
              backgroundColor: cardBackgroundColor,
              borderRadius: 12,
              borderLeft: `4px solid ${accent}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: effectiveLayout === "stack" ? "flex-start" : "center",
              padding: effectiveLayout === "stack" ? "24px 32px" : 24,
              opacity: cardOpacity * fadeOut,
              transform: `translateY(${slideY}px)`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            {card.icon && (
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {card.icon}
              </div>
            )}

            <div
              style={{
                fontSize: effectiveLayout === "stack" ? 28 : 24,
                fontWeight: 700,
                color: textColor,
                fontFamily,
                lineHeight: 1.2,
                textAlign: effectiveLayout === "stack" ? "left" : "center",
              }}
            >
              {card.title}
            </div>

            {card.description && (
              <div
                style={{
                  fontSize: effectiveLayout === "stack" ? 20 : 17,
                  fontWeight: 400,
                  color: textColor,
                  fontFamily,
                  marginTop: 8,
                  opacity: 0.7,
                  lineHeight: 1.4,
                  textAlign: effectiveLayout === "stack" ? "left" : "center",
                }}
              >
                {card.description}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
