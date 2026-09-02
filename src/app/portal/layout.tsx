import { PortalNotificationDock } from "@/components/portal-notification-dock";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<PortalNotificationDock /></>;
}
