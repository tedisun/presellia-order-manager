import AsyncStorage from '@react-native-async-storage/async-storage';
import { createOrder } from './woocommerce';
import type { CreateOrderPayload } from '@app-types/woocommerce';
import { logger } from './logger';

const OFFLINE_QUEUE_KEY = '@presellia_offline_orders';

export interface OfflineOrder {
  id: string; // unique local ID
  payload: CreateOrderPayload;
  created_at: string;
  error?: string;
}

export const OfflineQueue = {
  /**
   * Récupère la file d'attente complète des commandes hors-ligne
   */
  async getQueue(): Promise<OfflineOrder[]> {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as OfflineOrder[];
    } catch (err) {
      logger.error('offline', `Erreur de lecture de la file d'attente: ${err}`);
      return [];
    }
  },

  /**
   * Retourne le nombre total de commandes en attente
   */
  async getQueueCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },

  /**
   * Ajoute une commande à la file d'attente hors-ligne
   */
  async enqueue(payload: CreateOrderPayload): Promise<OfflineOrder> {
    const queue = await this.getQueue();
    const newOrder: OfflineOrder = {
      id: `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      payload,
      created_at: new Date().toISOString(),
    };
    queue.push(newOrder);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    logger.info('offline', `Commande sauvegardée localement. Taille file d'attente: ${queue.length}`);
    return newOrder;
  },

  /**
   * Retire une commande spécifique de la file d'attente
   */
  async remove(id: string): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
    logger.info('offline', `Commande ${id} retirée. Taille file d'attente: ${filtered.length}`);
  },

  /**
   * Enregistre un message d'erreur de validation pour une commande
   */
  async saveError(id: string, errorMsg: string): Promise<void> {
    const queue = await this.getQueue();
    const updated = queue.map(item => item.id === id ? { ...item, error: errorMsg } : item);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
  },

  /**
   * Force la synchronisation de toutes les commandes de la file d'attente vers WooCommerce
   */
  async syncQueue(): Promise<{
    successCount: number;
    failedCount: number;
    results: { id: string; success: boolean; error?: string }[];
  }> {
    const queue = await this.getQueue();
    if (queue.length === 0) {
      return { successCount: 0, failedCount: 0, results: [] };
    }

    logger.info('offline', `Début de la synchronisation de ${queue.length} commandes...`);
    let successCount = 0;
    let failedCount = 0;
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const item of queue) {
      try {
        logger.info('offline', `Tentative de synchronisation de la commande ${item.id}...`);
        const createdOrder = await createOrder(item.payload);
        logger.info('offline', `Commande synchronisée avec succès! Nouveau ID WooCommerce: ${createdOrder.id}`);
        await this.remove(item.id);
        successCount++;
        results.push({ id: item.id, success: true });
      } catch (err: any) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('offline', `Échec de la synchronisation de ${item.id}: ${errorMsg}`);
        
        const status = err?.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          logger.error('offline', `Rejet permanent de la commande ${item.id} par le serveur.`);
          await this.saveError(item.id, `Erreur validation: ${errorMsg}`);
          failedCount++;
          results.push({ id: item.id, success: false, error: `Erreur validation: ${errorMsg}` });
        } else {
          // Erreur réseau ou serveur temporaire. On s'arrête là pour ne pas bloquer le reste de la file
          failedCount++;
          results.push({ id: item.id, success: false, error: `Erreur réseau: ${errorMsg}` });
          break; 
        }
      }
    }

    return { successCount, failedCount, results };
  }
};
