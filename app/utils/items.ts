"use client";

export function createItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function transactionKey(item: {
  id?: string;
  title: string;
  category: string;
  amount: number;
  type: string;
  date: string;
  note: string;
}) {
  return item.id ?? [item.title, item.category, item.amount, item.type, item.date, item.note].join("|");
}

export function taskKey(item: {
  id?: string;
  title: string;
  time: string;
  category: string;
  priority: string;
  status: string;
  date: string;
}) {
  return item.id ?? [item.title, item.time, item.category, item.priority, item.status, item.date].join("|");
}

export function errorKey(item: {
  id?: string;
  title: string;
  reason: string;
  time: string;
  repeat: string;
  category: string;
  date: string;
}) {
  return item.id ?? [item.title, item.reason, item.time, item.repeat, item.category, item.date].join("|");
}

export function habitKey(item: {
  id?: string;
  title: string;
  value: number;
  category?: string;
  date?: string;
}) {
  return item.id ?? [item.title, item.value, item.category ?? "", item.date ?? ""].join("|");
}
