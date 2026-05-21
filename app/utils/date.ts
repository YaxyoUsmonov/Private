"use client";

const dateFormatter = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "short",
});

export function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function normalizeDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

export function isSameDate(value: string | null | undefined, selectedDate: string) {
  return normalizeDate(value) === selectedDate;
}

export function shortDateLabel(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}
