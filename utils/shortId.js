import { v4 as uuidv4 } from 'uuid';

/**
 * Utility untuk generate short ID dari UUID
 * Mengambil 5-8 karakter pertama dari UUID
 */

// Set untuk melacak ID yang sudah digunakan (in-memory cache)
const usedIds = new Set();
const MAX_ATTEMPTS = 50;

/**
 * Generate short ID dari UUID dengan panjang 5-8 karakter
 * @param {number} length - Panjang ID (5-8). Default: random antara 5-8
 * @returns {string} Short ID yang unik
 */
export function generateShortId(length = null) {
  let attempts = 0;
  
  // Tentukan panjang
  let idLength = length;
  if (!idLength || idLength < 5 || idLength > 8) {
    // Random antara 5-8
    idLength = Math.floor(Math.random() * 4) + 5; // 5, 6, 7, atau 8
  }
  
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    
    // Generate UUID
    const uuid = uuidv4();
    
    // Ambil karakter pertama dari setiap section UUID (32 karakter hex)
    // Contoh: "550e8400-e29b-41d4-a716-446655440000"
    // Remove dashes dan ambil substring
    const uuidWithoutDashes = uuid.replace(/-/g, '');
    
    // Ambil substring sepanjang yang diminta
    let shortId = uuidWithoutDashes.substring(0, idLength);
    
    // Ensure alphanumeric dan tidak diawali angka
    if (/^[0-9]/.test(shortId)) {
      // Jika diawali angka, replace dengan huruf
      const letters = 'abcdefghijklmnopqrstuvwxyz';
      shortId = letters[Math.floor(Math.random() * 26)] + shortId.substring(1);
    }
    
    // Check jika ID sudah digunakan
    if (!usedIds.has(shortId)) {
      usedIds.add(shortId);
      
      // Clean up old IDs (opsional, untuk mencegah memory leak)
      if (usedIds.size > 10000) {
        // Reset setelah 10k IDs
        usedIds.clear();
      }
      
      return shortId;
    }
  }
  
  // Fallback: timestamp + random
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 4);
  const fallbackId = (timestamp + randomStr).substring(0, idLength);
  
  // Ensure length dan tambahkan huruf jika perlu
  let finalId = fallbackId.padEnd(idLength, 'x');
  if (/^[0-9]/.test(finalId)) {
    finalId = 'f' + finalId.substring(1);
  }
  
  usedIds.add(finalId);
  return finalId;
}

/**
 * Validate short ID
 * @param {string} id - ID untuk divalidasi
 * @returns {boolean} True jika valid
 */
export function isValidShortId(id) {
  if (!id || typeof id !== 'string') return false;
  
  const length = id.length;
  if (length < 5 || length > 8) return false;
  
  // Alphanumeric, case-sensitive
  return /^[a-zA-Z0-9]{5,8}$/.test(id);
}

/**
 * Generate batch short IDs
 * @param {number} count - Jumlah ID yang ingin digenerate
 * @param {number} length - Panjang per ID
 * @returns {string[]} Array of short IDs
 */
export function generateBatchShortIds(count = 10, length = null) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(generateShortId(length));
  }
  return ids;
}

/**
 * Release short ID (hapus dari cache usedIds)
 * @param {string} id - ID yang akan direlease
 */
export function releaseShortId(id) {
  if (usedIds.has(id)) {
    usedIds.delete(id);
  }
}

/**
 * Get statistics about used IDs
 * @returns {object} Statistics
 */
export function getShortIdStats() {
  const ids = Array.from(usedIds);
  const lengthStats = ids.reduce((stats, id) => {
    const len = id.length;
    stats[len] = (stats[len] || 0) + 1;
    return stats;
  }, {});
  
  return {
    totalUsed: usedIds.size,
    lengthDistribution: lengthStats,
    sampleIds: ids.slice(0, 5) // Sample 5 IDs pertama
  };
}
