import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const capitalize = (str = "") =>
  str.charAt(0).toUpperCase() + str.slice(1);

export type TimeAgoTranslation = {
  key: "just_now" | "minutes_ago" | "hours_ago" | "days_ago";
  values?: Record<string, string | number | Date>;
};

export function formatTimeAgo(date: Date): TimeAgoTranslation {
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return { key: "just_now" }; // no values needed
  }

  if (diffMin < 60) {
    return {
      key: "minutes_ago",
      values: { count: diffMin },
    };
  }

  if (diffHr < 24) {
    return {
      key: "hours_ago",
      values: { count: diffHr },
    };
  }

  return {
    key: "days_ago",
    values: { count: diffDay },
  };
}

/* 
    —— helper to format numbers like "35 k", "5 M", "5 T" —— 
*/
export const formatCount = (value: number): string => {
  if (value < 1000) return value.toString();
  if (value < 1_000_000) return `${(value / 1_000).toFixed(0)} k`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(0)} M`;
  if (value < 1_000_000_000_000)
    return `${(value / 1_000_000_000).toFixed(0)} B`;
  return `${(value / 1_000_000_000_000).toFixed(0)} T`;
};
