export * from "./notifications";
export * from "./permissions";

export const formatDuration = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0秒";
  }

  const roundedSeconds = Math.round(totalSeconds);

  if (roundedSeconds < 60) {
    return `${roundedSeconds}秒`;
  }

  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;

  if (seconds === 0) {
    return `${minutes}分`;
  }

  return `${minutes}分${seconds}秒`;
};
