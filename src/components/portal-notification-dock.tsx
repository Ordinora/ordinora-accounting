"use client";

import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/notification-bell";

export function PortalNotificationDock() {
  const pathname = usePathname();
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".portal-header");
    const actionGroup = header?.lastElementChild;
    const target = actionGroup instanceof HTMLDivElement ? actionGroup : header;
    const frame = requestAnimationFrame(() => setHeaderTarget(target ?? null));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  if (pathname.startsWith("/portal/login") || !headerTarget) return null;
  return createPortal(<NotificationBell audience="client" />, headerTarget);
}
