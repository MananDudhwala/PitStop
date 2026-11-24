import { SyncQueueItem } from '@/types';
import { getDatabase } from './db';

export class SyncQueue {
  static async enqueue(action: SyncQueueItem['action'], payload: unknown): Promise<string> {
    const db = await getDatabase();
    const id = `sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const item: SyncQueueItem = {
      id,
      action,
      payload,
      createdAt: Date.now(),
      retryCount: 0,
    };
    await db.put('sync-queue', item);
    return id;
  }

  static async getPendingItems(): Promise<SyncQueueItem[]> {
    const db = await getDatabase();
    return db.getAll('sync-queue');
  }

  static async removeItem(id: string): Promise<void> {
    const db = await getDatabase();
    await db.delete('sync-queue', id);
  }

  static async processQueue(
    handler: (item: SyncQueueItem) => Promise<boolean>
  ): Promise<{ succeeded: number; failed: number }> {
    const items = await this.getPendingItems();
    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const ok = await handler(item);
        if (ok) {
          await this.removeItem(item.id);
          succeeded++;
        } else {
          item.retryCount++;
          const db = await getDatabase();
          await db.put('sync-queue', item);
          failed++;
        }
      } catch (err) {
        item.retryCount++;
        const db = await getDatabase();
        await db.put('sync-queue', item);
        failed++;
      }
    }

    return { succeeded, failed };
  }
}
