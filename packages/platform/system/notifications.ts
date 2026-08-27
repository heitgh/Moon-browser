import type { Notification, NotificationPlatform, NotificationRequest } from "../interfaces/notification-platform.js";
export class NotificationService {
  constructor(readonly platform: NotificationPlatform) {}
  async show(request: NotificationRequest): Promise<Notification> { if (!(await this.platform.hasPermission()) && !(await this.platform.requestPermission())) throw new Error("Notification permission was denied"); return this.platform.show(request); }
  close(id: string) { return this.platform.close(id); }
  markAsRead(id: string) { return this.platform.markAsRead(id); }
  list(unreadOnly = false) { return this.platform.list({ unreadOnly }); }
  clear() { return this.platform.clear(); }
}
