/**
 * Notification Service
 * Centralized notification management with priority queue, persistence, and action callbacks.
 */

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  dismissed: boolean;
  actionLabel?: string;
  actionCallback?: string;
  category?: string;
  metadata?: Record<string, any>;
}

export interface NotificationOptions {
  priority?: NotificationPriority;
  category?: string;
  actionLabel?: string;
  actionCallback?: string;
  duration?: number;
  persistent?: boolean;
  metadata?: Record<string, any>;
}

class NotificationService {
  private static instance: NotificationService;
  private notifications: Notification[] = [];
  private listeners: Array<(notifications: Notification[]) => void> = [];
  private maxNotifications = 100;
  private idCounter = 0;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private generateId(): string {
    return `NOTIF_${Date.now()}_${++this.idCounter}`;
  }

  /**
   * Subscribe to notification changes
   */
  subscribe(listener: (notifications: Notification[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    const active = this.getActive();
    this.listeners.forEach(listener => listener(active));
  }

  /**
   * Add a notification
   */
  add(
    type: NotificationType,
    title: string,
    message: string,
    options: NotificationOptions = {}
  ): Notification {
    const notification: Notification = {
      id: this.generateId(),
      type,
      priority: options.priority || 'medium',
      title,
      message,
      timestamp: new Date().toISOString(),
      dismissed: false,
      category: options.category,
      actionLabel: options.actionLabel,
      actionCallback: options.actionCallback,
      metadata: options.metadata,
    };

    this.notifications.unshift(notification);

    // Trim to max
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    this.notifyListeners();
    return notification;
  }

  /**
   * Convenience methods
   */
  info(title: string, message: string, options?: NotificationOptions): Notification {
    return this.add('info', title, message, { ...options, priority: options?.priority || 'low' });
  }

  success(title: string, message: string, options?: NotificationOptions): Notification {
    return this.add('success', title, message, { ...options, priority: options?.priority || 'medium' });
  }

  warning(title: string, message: string, options?: NotificationOptions): Notification {
    return this.add('warning', title, message, { ...options, priority: options?.priority || 'high' });
  }

  error(title: string, message: string, options?: NotificationOptions): Notification {
    return this.add('error', title, message, { ...options, priority: options?.priority || 'critical' });
  }

  system(title: string, message: string, options?: NotificationOptions): Notification {
    return this.add('system', title, message, { ...options, priority: options?.priority || 'medium' });
  }

  /**
   * Dismiss a notification
   */
  dismiss(id: string): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.dismissed = true;
      this.notifyListeners();
    }
  }

  /**
   * Dismiss all notifications
   */
  dismissAll(): void {
    this.notifications.forEach(n => (n.dismissed = true));
    this.notifyListeners();
  }

  /**
   * Get active (non-dismissed) notifications
   */
  getActive(): Notification[] {
    return this.notifications.filter(n => !n.dismissed);
  }

  /**
   * Get all notifications including dismissed
   */
  getAll(): Notification[] {
    return [...this.notifications];
  }

  /**
   * Get notifications by category
   */
  getByCategory(category: string): Notification[] {
    return this.notifications.filter(n => n.category === category && !n.dismissed);
  }

  /**
   * Get notifications by priority
   */
  getByPriority(priority: NotificationPriority): Notification[] {
    return this.notifications.filter(n => n.priority === priority && !n.dismissed);
  }

  /**
   * Get notification count
   */
  getCount(): { active: number; total: number; byType: Record<NotificationType, number> } {
    const active = this.getActive();
    const byType = active.reduce(
      (acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      },
      {} as Record<NotificationType, number>
    );

    return {
      active: active.length,
      total: this.notifications.length,
      byType,
    };
  }

  /**
   * Clear dismissed notifications
   */
  clearDismissed(): void {
    this.notifications = this.notifications.filter(n => !n.dismissed);
    this.notifyListeners();
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notifications = [];
    this.notifyListeners();
  }
}

export const notificationService = NotificationService.getInstance();
export default NotificationService;
