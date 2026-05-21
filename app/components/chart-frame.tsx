"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  queueMicrotask(onStoreChange);
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function ChartFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  return <div className={`min-w-0 overflow-hidden ${className}`}>{mounted ? children : null}</div>;
}
