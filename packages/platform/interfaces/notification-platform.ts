export type NotificationType =
  | "default"
  | "success"
  | "info"
  | "warning"
  | "error";

export type NotificationPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";

export interface NotificationAction {
  readonly id: string;
  readonly label: string;
}

export interface NotificationRequest {
  readonly id?: string;
  readonly title: string;
  readonly body?: string;
  readonly type?: NotificationType;
  readonly priority?: NotificationPriority;
  readonly icon?: string;
  readonly silent?: boolean;
  readonly persistent?: boolean;
  readonly actions?: readonly NotificationAction[];

  readonly source?: {
    readonly type: "moon" | "extension" | "plugin" | "system";
    readonly id?: string;
  };
}

export interface Notification {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly type: NotificationType;
  readonly priority: NotificationPriority;
  readonly createdAt: number;
  readonly read: boolean;
  readonly persistent: boolean;
}

export interface NotificationPlatform {
  show(
    request: NotificationRequest
  ): Promise<Notification>;

  close(
    notificationId: string
  ): Promise<void>;

  markAsRead(
    notificationId: string
  ): Promise<void>;

  get(
    notificationId: string
  ): Promise<Notification | null>;

  list(
    options?: {
      readonly unreadOnly?: boolean;
      readonly limit?: number;
    }
  ): Promise<readonly Notification[]>;

  clear(): Promise<void>;

  requestPermission(): Promise<boolean>;

  hasPermission(): Promise<boolean>;

  shutdown(): Promise<void>;
}