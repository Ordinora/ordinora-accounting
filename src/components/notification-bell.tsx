"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import {
  loadClientNotifications,
  loadStaffNotifications,
  markAllClientNotificationsRead,
  markAllStaffNotificationsRead,
  markClientNotificationRead,
  markStaffNotificationRead,
} from "@/app/notifications/actions";

type NotificationItem = { id: string; type: string; title: string; body: string; linkPath: string; isRead: boolean; createdAt: string };

export function NotificationBell({ audience }: { audience: "staff" | "client" }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const unread = items.filter((item) => !item.isRead).length;

  useEffect(() => {
    startTransition(async () => {
      try { setItems(audience === "staff" ? await loadStaffNotifications() : await loadClientNotifications()); }
      catch (error) { console.error("Notifications could not be loaded.", error); }
      finally { setLoading(false); }
    });
  }, [audience]);

  async function markOne(id: string) {
    if (audience === "staff") await markStaffNotificationRead(id);
    else await markClientNotificationRead(id);
    setItems((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
  }

  async function markAll() {
    if (audience === "staff") await markAllStaffNotificationsRead();
    else await markAllClientNotificationsRead();
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
  }

  async function openNotification(event: React.MouseEvent<HTMLAnchorElement>, item: NotificationItem) {
    event.preventDefault();
    setOpen(false);
    if (!item.isRead) await markOne(item.id);
    router.push(item.linkPath);
  }

  return (
    <div className="notification-wrap">
      <button type="button" className="notification-button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Bell size={18} />
        {unread > 0 && <span className="notification-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <section className="notification-menu" aria-label="Notifications">
          <header><div><strong>Notifications</strong><small>{unread ? `${unread} unread` : "You are up to date"}</small></div>{unread > 0 && <button type="button" onClick={() => void markAll()}><CheckCheck size={15}/>Mark all read</button>}</header>
          <div className="notification-list">
            {items.map((item) => (
              <Link className={item.isRead ? "" : "unread"} href={item.linkPath} key={item.id} onClick={(event) => void openNotification(event, item)}>
                <span className="notification-dot" />
                <span><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString("en-BN")}</small></span>
              </Link>
            ))}
            {!items.length && <p className="notification-empty">{loading ? "Loading notifications…" : "No notifications yet."}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
