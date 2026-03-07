import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { JDStructure } from './jdParser';

const DB_NAME = 'cv-analyzer-jd-cache';
const JD_STORE = 'job-descriptions';
const ENCRYPTION_STORE = 'encryption-keys';

interface JDCacheDB extends DBSchema {
    'job-descriptions': {
        key: number;
        value: {
            id?: number;
            fileHash: string;
            fileName: string;
            rawText: string;
            structured: JDStructure;
            uploadedAt: number;
            lastUsed: number;
            usageCount: number;
        };
        indexes: {
            'by-hash': string;
            'by-date': number;
            'by-position': string;
        };
    };
    'encryption-keys': {
        key: string;
        value: {
            keyId: string;
            key: CryptoKey;
        };
    };
}

// Generate SHA-256 hash of a file
export async function hashFile(file: File | Blob): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

let dbInstance: IDBPDatabase<JDCacheDB> | null = null;

export async function initJDDatabase() {
    if (!dbInstance) {
        dbInstance = await openDB<JDCacheDB>(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(JD_STORE)) {
                    const jdStore = db.createObjectStore(JD_STORE, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    jdStore.createIndex('by-hash', 'fileHash', { unique: true });
                    jdStore.createIndex('by-date', 'uploadedAt');
                    jdStore.createIndex('by-position', 'structured.positionTitle');
                }
                if (!db.objectStoreNames.contains(ENCRYPTION_STORE)) {
                    db.createObjectStore(ENCRYPTION_STORE, { keyPath: 'keyId' });
                }
            }
        });
    }
    return dbInstance;
}

// --- Web Crypto Encryption Wrappers ---
async function getOrCreateKey(): Promise<CryptoKey> {
    const db = await initJDDatabase();
    const keyEntry = await db.get(ENCRYPTION_STORE, 'master-key');
    if (keyEntry) {
        return keyEntry.key;
    }

    const newKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    await db.put(ENCRYPTION_STORE, { keyId: 'master-key', key: newKey });
    return newKey;
}

/** ArrayBuffer to Base64 String */
function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/** Base64 String to ArrayBuffer */
function base64ToBuffer(base64: string): ArrayBuffer {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

// Simple wrapper around the text. Real application would encrypt structured data too.
async function encryptText(text: string): Promise<string> {
    const key = await getOrCreateKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    // Pack IV + Encrypted Data
    const combined = new Uint8Array(iv.length + encryptedBuf.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedBuf), iv.length);

    return bufferToBase64(combined.buffer);
}

async function decryptText(encryptedBase64: string): Promise<string> {
    try {
        const key = await getOrCreateKey();
        const combinedBuf = base64ToBuffer(encryptedBase64);
        const combined = new Uint8Array(combinedBuf);

        const iv = combined.slice(0, 12);
        const data = combined.slice(12);

        const decryptedBuf = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuf);
    } catch (err) {
        console.error("Decryption failed", err);
        return "[Encrypted text could not be deciphered]";
    }
}

export async function cacheJD(fileHash: string, fileName: string, rawText: string, structured: JDStructure) {
    const db = await initJDDatabase();

    // Encrypt the raw text so we aren't storing sensitive JD info in plaintext IDB
    const encryptedText = await encryptText(rawText);

    const jdEntry = {
        fileHash,
        fileName,
        rawText: encryptedText, // Store encrypted
        structured,
        uploadedAt: Date.now(),
        lastUsed: Date.now(),
        usageCount: 1
    };

    const existing = await db.getFromIndex(JD_STORE, 'by-hash', fileHash);

    if (existing) {
        await db.put(JD_STORE, {
            ...existing,
            lastUsed: Date.now(),
            usageCount: existing.usageCount + 1
        });
        return existing.id;
    } else {
        return await db.add(JD_STORE, jdEntry);
    }
}

export async function getJDFromCache(fileHash: string) {
    const db = await initJDDatabase();
    const existing = await db.getFromIndex(JD_STORE, 'by-hash', fileHash);

    if (existing) {
        // Decrypt
        const plainText = await decryptText(existing.rawText);
        return {
            ...existing,
            rawText: plainText
        };
    }
    return null;
}

export async function getRecentJDs(limit = 10) {
    const db = await initJDDatabase();
    const tx = db.transaction(JD_STORE, 'readonly');
    const index = tx.store.index('by-date');

    let jds = await index.getAll();
    jds = jds.sort((a, b) => b.uploadedAt - a.uploadedAt).slice(0, limit);

    // Decrypt each for preview
    return Promise.all(jds.map(async (jd) => {
        const plainText = await decryptText(jd.rawText);
        return {
            ...jd,
            rawText: plainText
        };
    }));
}
