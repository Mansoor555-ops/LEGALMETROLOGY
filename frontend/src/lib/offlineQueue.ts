/**
 * Offline Capture Queue using IndexedDB
 * Stores unsynced inspection photos and form data locally when offline,
 * surviving browser reloads and automatically syncing when network connectivity returns.
 */

const DB_NAME = 'LegalMetrologyOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_inspections';

export interface OfflineInspectionItem {
  localId: string;
  timestamp: string;
  formData: {
    shop_name: string;
    location: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    category: string;
    net_quantity?: string;
    barcode_code?: string;
  };
  imageBlobs: { name: string; type: string; data: ArrayBuffer }[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject('IndexedDB not supported in this environment');
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveInspectionOffline(
  formData: OfflineInspectionItem['formData'],
  files: File[]
): Promise<string> {
  const db = await openDB();
  const localId = `OFFLINE-${Date.now()}`;

  const imageBlobs = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      data: await file.arrayBuffer()
    }))
  );

  const item: OfflineInspectionItem = {
    localId,
    timestamp: new Date().toISOString(),
    formData,
    imageBlobs
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(item);

    req.onsuccess = () => resolve(localId);
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineInspections(): Promise<OfflineInspectionItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeOfflineInspection(localId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(localId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function syncOfflineQueue(submitApiCall: (formData: FormData) => Promise<any>): Promise<number> {
  const items = await getOfflineInspections();
  let syncedCount = 0;

  for (const item of items) {
    try {
      const payload = new FormData();
      Object.entries(item.formData).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          payload.append(k, String(v));
        }
      });

      item.imageBlobs.forEach((img, idx) => {
        const file = new File([img.data], img.name || `photo_${idx + 1}.jpg`, { type: img.type || 'image/jpeg' });
        payload.append('images', file);
      });

      const res = await submitApiCall(payload);
      if (res && res.success) {
        await removeOfflineInspection(item.localId);
        syncedCount++;
      }
    } catch (err) {
      console.warn(`Offline sync failed for ${item.localId}:`, err);
    }
  }

  return syncedCount;
}
