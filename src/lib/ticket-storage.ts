import type { Ticket } from "./tickets";

export interface DatasetMetadata {
  filename: string;
  importedAt: string;
  count: number;
}

const DB_NAME = "pulso_support_db";
const STORE_NAME = "tickets_store";
const KEY_DATASET = "active_dataset";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") {
      return reject(new Error("IndexedDB não disponível no ambiente atual"));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Salva a base de tickets importada no IndexedDB do navegador.
 * Fica 100% restrito localmente ao navegador do usuário.
 */
export async function saveImportedTickets(tickets: Ticket[], filename: string): Promise<void> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    const metadata: DatasetMetadata = {
      filename,
      importedAt: new Date().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      count: tickets.length,
    };
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ tickets, metadata }, KEY_DATASET);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    throw new Error("Não foi possível salvar a nova base no navegador. A base anterior foi mantida.");
  }
}

/**
 * Recupera os tickets previamente importados pelo usuário.
 */
export async function getSavedImportedTickets(): Promise<{
  tickets: Ticket[];
  metadata: DatasetMetadata;
} | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY_DATASET);
    return await new Promise((resolve) => {
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.tickets) && req.result.tickets.length > 0) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (error) {
    console.warn("Erro ao ler do IndexedDB:", error);
    return null;
  }
}

/**
 * Limpa a base importada para restaurar a base padrão.
 */
export async function clearImportedTickets(): Promise<void> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(KEY_DATASET);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn("Erro ao limpar IndexedDB:", error);
  }
}
