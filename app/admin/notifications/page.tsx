import { NotificationsClient } from "@/components/notifications/notifications-client";
import {
  getNotificationPreferences,
  listMyNotifications,
} from "@/lib/actions/notifications";
import { isStaffRole } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";

export default async function NotificationsPage() {
  const [user, list, prefs] = await Promise.all([
    getCurrentUser(),
    listMyNotifications(),
    getNotificationPreferences(),
  ]);
  return (
    <NotificationsClient
      title="Notifications"
      subtitle="View, filter, and manage all your notifications and announcements."
      initialItems={list.ok ? list.data.items : []}
      initialAnnouncements={list.ok ? list.data.announcements : []}
      initialPreferences={
        prefs.ok
          ? prefs.data
          : {
              emailLeave: true,
              emailRecruitment: true,
              emailPerformance: false,
              emailPayroll: true,
              inApp: true,
              sounds: false,
            }
      }
      showRecruitmentEmail
      canAnnounce={isStaffRole(user?.role)}
    />
  );
}
