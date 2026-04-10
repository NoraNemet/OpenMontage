import React from "react";

interface FittedTextProps {
  x: number;
  y: number;
  maxWidth: number;
  fontSize?: number;
  minFontSize?: number;
  rotateIfNeeded?: boolean;
  textAnchor?: "start" | "middle" | "end";
  fill?: string;
  fontFamily?: string;
  fontWeight?: number;
  opacity?: number;
  dominantBaseline?: "auto" | "middle" | "hanging" | "central" | "alphabetic" | "ideographic" | "mathematical" | "text-after-edge" | "text-before-edge" | "inherit";
  children: string;
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}

export const FittedText: React.FC<FittedTextProps> = ({
  x,
  y,
  maxWidth,
  fontSize = 20,
  minFontSize = 12,
  rotateIfNeeded = true,
  textAnchor = "middle",
  fill,
  fontFamily,
  fontWeight,
  opacity,
  dominantBaseline,
  children,
}) => {
  const text = children;
  const naturalWidth = estimateTextWidth(text, fontSize);

  // Case 1: Fits naturally
  if (naturalWidth <= maxWidth) {
    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill={fill}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontSize={fontSize}
        opacity={opacity}
        dominantBaseline={dominantBaseline}
      >
        {text}
      </text>
    );
  }

  // Case 2: Use SVG textLength compression (ratio >= 50%)
  const compressionRatio = maxWidth / naturalWidth;
  if (compressionRatio >= 0.5) {
    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill={fill}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontSize={fontSize}
        opacity={opacity}
        dominantBaseline={dominantBaseline}
        textLength={maxWidth}
        lengthAdjust="spacingAndGlyphs"
      >
        {text}
      </text>
    );
  }

  // Case 3: Reduce fontSize
  const scaledFontSize = Math.max(
    minFontSize,
    Math.floor(fontSize * (maxWidth / naturalWidth))
  );
  const scaledWidth = estimateTextWidth(text, scaledFontSize);

  if (scaledWidth <= maxWidth) {
    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        fill={fill}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontSize={scaledFontSize}
        opacity={opacity}
        dominantBaseline={dominantBaseline}
      >
        {text}
      </text>
    );
  }

  // Case 4: Rotate -45° (if enabled)
  if (rotateIfNeeded) {
    return (
      <text
        x={x}
        y={y}
        textAnchor="end"
        fill={fill}
        fontFamily={fontFamily}
        fontWeight={fontWeight}
        fontSize={scaledFontSize}
        opacity={opacity}
        dominantBaseline={dominantBaseline}
        transform={`rotate(-45, ${x}, ${y})`}
      >
        {text}
      </text>
    );
  }

  // Case 5: Truncate with ellipsis
  const avgCharWidth = scaledFontSize * 0.6;
  const maxChars = Math.max(3, Math.floor(maxWidth / avgCharWidth) - 1);
  const truncated = text.length > maxChars ? text.slice(0, maxChars) + "\u2026" : text;

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill={fill}
      fontFamily={fontFamily}
      fontWeight={fontWeight}
      fontSize={scaledFontSize}
      opacity={opacity}
      dominantBaseline={dominantBaseline}
    >
      {truncated}
    </text>
  );
};
