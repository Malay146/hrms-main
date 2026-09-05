import { NotificationsClient } from "@/components/notifications/notifications-client";
import {
  getNotificationPreferences,
  listMyNotifications,
} from "@/lib/actions/notifications";

export default async function EmployeeNotificationsPage() {
  const [list, prefs] = await Promise.all([listMyNotifications(), getNotificationPreferences()]);
  return (
    <NotificationsClient
      title="My Notifications"
      subtitle="View, filter, and manage your personal notifications and updates."
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
      showRecruitmentEmail={false}
      canAnnounce={false}
    />
  );
}
