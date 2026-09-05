export function lineHours(startMin: number, endMin: number, breakMin: number) {
  const raw = (endMin - startMin - breakMin) / 60;
  return Math.round(raw * 100) / 100;
}

export function weeklyHours(
  lines: { startMin: number; endMin: number; breakMin: number }[],
) {
  return (
    Math.round(
      lines.reduce(
        (sum, line) => sum + lineHours(line.startMin, line.endMin, line.breakMin),
        0,
      ) * 100,
    ) / 100
  );
}

export function daysPerWeek(lines: { weekday: number }[]) {
  return new Set(lines.map((line) => line.weekday)).size;
}
