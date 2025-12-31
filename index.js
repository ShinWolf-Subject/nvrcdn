import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import cors from 'cors';
import mime from 'mime-types';
import schedule from 'node-schedule';
import axios from 'axios';
import requestIp from 'request-ip';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { generateShortId, isValidShortId } from './utils/shortId.js';

// ES Modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Serve static site 
app.use(express.static(path.join(__dirname, 'page')));

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      mediaSrc: ["'self'", "data:", "blob:", "*"]
    }
  }
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestIp.mw());

// Konfigurasi
const IS_SERVERLESS = process.env.VERCEL || false;
const UPLOAD_DIR = IS_SERVERLESS ? '/tmp/uploads' : './uploads';
const PORT = process.env.PORT || 5470;
const MAX_FILE_SIZE = 128 * 1024 * 1024; // 128MB
const FILE_LIFETIME_HOURS = 5; // 5 jam
const BAN_DURATION_HOURS = 3; // 3 jam untuk ban IP

// Pastikan direktori upload ada
await fs.ensureDir(UPLOAD_DIR);

// Store untuk banned IPs
const bannedIPs = new Map();

// Middleware untuk check banned IP
const checkBannedIP = (req, res, next) => {
  const clientIp = requestIp.getClientIp(req);
  
  if (bannedIPs.has(clientIp)) {
    const banInfo = bannedIPs.get(clientIp);
    const now = Date.now();
    
    if (now < banInfo.expiresAt) {
      const remainingTime = Math.ceil((banInfo.expiresAt - now) / 1000 / 60);
      return res.status(429).json({
        error: 'IP Anda dibanned',
        reason: banInfo.reason,
        expiresIn: `${remainingTime} menit`,
        bannedUntil: new Date(banInfo.expiresAt).toISOString()
      });
    } else {
      bannedIPs.delete(clientIp);
    }
  }
  
  next();
};

// Fungsi untuk ban IP
const banIP = (ip, reason = 'Spam request') => {
  const expiresAt = Date.now() + (BAN_DURATION_HOURS * 60 * 60 * 1000);
  bannedIPs.set(ip, {
    reason,
    bannedAt: new Date().toISOString(),
    expiresAt
  });
  
  console.log(`IP ${ip} dibanned karena: ${reason}. Berakhir pada: ${new Date(expiresAt).toISOString()}`);
  
  // Schedule auto unban
  setTimeout(() => {
    if (bannedIPs.has(ip)) {
      bannedIPs.delete(ip);
      console.log(`IP ${ip} secara otomatis di-unban`);
    }
  }, BAN_DURATION_HOURS * 60 * 60 * 1000);
};

// Rate Limiting dan Slow Down untuk spam protection
const uploadLimiter = rateLimit({
  windowMs: 5 * 1000, // 5 detik
  max: 2, // 2 requests per windowMs
  keyGenerator: (req) => requestIp.getClientIp(req),
  handler: (req, res) => {
    const clientIp = requestIp.getClientIp(req);
    banIP(clientIp, 'Rate limit exceeded (2 requests/5s)');
    
    res.status(429).json({
      error: 'Terlalu banyak request',
      message: 'IP Anda dibanned selama 3 jam karena spam request',
      bannedUntil: new Date(Date.now() + (BAN_DURATION_HOURS * 60 * 60 * 1000)).toISOString()
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 menit
  delayAfter: 10, // allow 10 requests per windowMs
  delayMs: (hits) => hits * 100, // add 100ms delay per hit
  maxDelayMs: 5000, // max 5 detik delay
  keyGenerator: (req) => requestIp.getClientIp(req)
});

// Map untuk menyimpan metadata file
const fileMetadata = new Map();
// Map untuk track request per IP
const ipRequestCount = new Map();

// Middleware untuk track spam
const trackRequests = (req, res, next) => {
  const clientIp = requestIp.getClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 menit
  
  if (!ipRequestCount.has(clientIp)) {
    ipRequestCount.set(clientIp, []);
  }
  
  const requests = ipRequestCount.get(clientIp);
  
  // Hapus request yang lebih lama dari 1 menit
  const recentRequests = requests.filter(time => now - time < windowMs);
  recentRequests.push(now);
  
  ipRequestCount.set(clientIp, recentRequests);
  
  // Jika lebih dari 30 request dalam 1 menit, ban IP
  if (recentRequests.length > 30) {
    banIP(clientIp, 'Excessive requests (30+ requests/minute)');
    return res.status(429).json({
      error: 'Terlalu banyak request',
      message: 'IP Anda dibanned selama 3 jam karena excessive requests'
    });
  }
  
  next();
};

// Konfigurasi Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueId = generateShortId();
    const extension = path.extname(file.originalname) || '.bin';
    const filename = `${uniqueId}${extension}`;
    cb(null, filename);
  }
});

// Filter file untuk keamanan
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
    // Documents
    'application/pdf', 'text/plain', 'text/markdown', 'text/html',
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/x-tar', 'application/gzip',
    // Media
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac',
    // Code
    'application/javascript', 'text/javascript', 'application/json',
    'text/css', 'text/x-python', 'text/x-java-source', 'text/x-php',
    // Other
    'application/octet-stream'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipe file tidak diizinkan: ${file.mimetype}`), false);
  }
};

// Inisialisasi upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

// Fungsi untuk schedule deletion dengan node-schedule
function scheduleFileDeletion(fileId, filePath) {
  const deletionTime = new Date(Date.now() + (FILE_LIFETIME_HOURS * 60 * 60 * 1000));
  
  const job = schedule.scheduleJob(deletionTime, async () => {
    try {
      await fs.unlink(filePath);
      fileMetadata.delete(fileId);
      console.log(`[${new Date().toISOString()}] File ${fileId} telah dihapus (auto-delete 5 jam)`);
    } catch (err) {
      console.error(`Gagal menghapus file ${fileId}:`, err);
    }
  });
  
  return job;
}

// Helper functions
const getFullUrl = (req) => {
  if (IS_SERVERLESS && req.headers['x-forwarded-host']) {
    return `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers['x-forwarded-host']}`;
  }
  return `${req.protocol}://${req.get('host')}`;
};

const formatFileSize = (bytes) => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} bytes`;
};

// ============================================
// ENDPOINT: /upload (Upload file biasa)
// ============================================
app.post('/upload', checkBannedIP, trackRequests, uploadLimiter, speedLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Tidak ada file yang diupload',
        allowedTypes: [
          'Images (JPEG, PNG, GIF, WebP, SVG, BMP)',
          'Documents (PDF, TXT, DOC, DOCX, XLS, XLSX, PPT, PPTX)',
          'Archives (ZIP, RAR, 7Z, TAR, GZ)',
          'Media (MP4, WebM, MP3, WAV, AAC)',
          'Code (JS, JSON, CSS, Python, Java, PHP)'
        ],
        maxSize: '128MB'
      });
    }

    const clientIp = requestIp.getClientIp(req);
    const fileId = path.parse(req.file.filename).name;
    const fileExtension = path.extname(req.file.filename).substring(1) || 'bin';
    const baseUrl = getFullUrl(req);
    
    // Simpan metadata
    const metadata = {
      id: fileId,
      originalName: req.file.originalname,
      filename: req.file.filename,
      extension: fileExtension,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (FILE_LIFETIME_HOURS * 60 * 60 * 1000)).toISOString(),
      path: req.file.path,
      uploadedBy: clientIp,
      accessUrl: `${baseUrl}/ac/${fileId}.${fileExtension}`
    };

    fileMetadata.set(fileId, metadata);

    // Schedule auto deletion
    const job = scheduleFileDeletion(fileId, req.file.path);
    metadata.deletionJob = job;

    res.status(200).json({
      success: true,
      message: 'File berhasil diupload',
      data: {
        fileId: fileId,
        originalName: metadata.originalName,
        size: metadata.size,
        formattedSize: formatFileSize(metadata.size),
        mimeType: metadata.mimetype,
        accessUrl: metadata.accessUrl,
        expiresAt: metadata.expiresAt,
        expiresIn: `${FILE_LIFETIME_HOURS} jam`,
        deleteUrl: `${baseUrl}/delete/${fileId}`,
        infoUrl: `${baseUrl}/info/${fileId}`
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File terlalu besar',
        maxSize: '128MB',
        yourSize: formatFileSize(error.limit)
      });
    }

    res.status(500).json({
      error: 'Terjadi kesalahan saat mengupload file',
      details: error.message
    });
  }
});

// ============================================
// ENDPOINT: /upload-url (Upload via URL)
// ============================================
app.post('/upload-url', checkBannedIP, trackRequests, uploadLimiter, speedLimiter, async (req, res) => {
  try {
    const { url, filename } = req.body;
    const clientIp = requestIp.getClientIp(req);
    
    if (!url) {
      return res.status(400).json({
        error: 'URL diperlukan',
        example: {
          url: 'https://example.com/file.jpg',
          filename: 'optional-custom-filename.jpg'
        }
      });
    }

    // Validasi URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'URL tidak valid' });
    }

    // Download file dari URL
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      maxContentLength: MAX_FILE_SIZE,
      timeout: 30000 // 30 detik timeout
    });

    // Dapatkan filename dari URL atau dari request
    const originalName = filename || path.basename(new URL(url).pathname) || 'downloaded-file';
    const fileId = generateShortId();
    const extension = path.extname(originalName) || '.bin';
    const filenameWithId = `${fileId}${extension}`;
    const fileExtension = extension.substring(1) || 'bin';
    const filePath = path.join(UPLOAD_DIR, filenameWithId);
    
    // Stream file ke disk
    const writer = createWriteStream(filePath);
    await pipeline(response.data, writer);

    // Dapatkan file stats
    const stats = await fs.stat(filePath);
    
    if (stats.size > MAX_FILE_SIZE) {
      await fs.unlink(filePath);
      return res.status(413).json({
        error: 'File dari URL terlalu besar',
        maxSize: '128MB',
        actualSize: formatFileSize(stats.size)
      });
    }

    const baseUrl = getFullUrl(req);
    
    // Simpan metadata
    const metadata = {
      id: fileId,
      originalName: originalName,
      filename: filenameWithId,
      extension: fileExtension,
      size: stats.size,
      mimetype: response.headers['content-type'] || mime.lookup(originalName) || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (FILE_LIFETIME_HOURS * 60 * 60 * 1000)).toISOString(),
      path: filePath,
      uploadedBy: clientIp,
      sourceUrl: url,
      accessUrl: `${baseUrl}/ac/${fileId}.${fileExtension}`
    };

    fileMetadata.set(fileId, metadata);

    // Schedule auto deletion
    const job = scheduleFileDeletion(fileId, filePath);
    metadata.deletionJob = job;

    res.status(200).json({
      success: true,
      message: 'File berhasil diupload dari URL',
      data: {
        fileId: fileId,
        originalName: metadata.originalName,
        size: metadata.size,
        formattedSize: formatFileSize(metadata.size),
        mimeType: metadata.mimetype,
        accessUrl: metadata.accessUrl,
        expiresAt: metadata.expiresAt,
        expiresIn: `${FILE_LIFETIME_HOURS} jam`,
        deleteUrl: `${baseUrl}/delete/${fileId}`,
        infoUrl: `${baseUrl}/info/${fileId}`
      }
    });

  } catch (error) {
    console.error('Upload URL error:', error);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(400).json({ error: 'Tidak dapat mengakses URL' });
    }
    
    if (error.response?.status === 404) {
      return res.status(400).json({ error: 'File tidak ditemukan di URL tersebut' });
    }
    
    if (error.message.includes('maxContentLength')) {
      return res.status(413).json({ 
        error: 'File dari URL terlalu besar',
        maxSize: '128MB' 
      });
    }

    res.status(500).json({
      error: 'Terjadi kesalahan saat mengupload dari URL',
      details: error.message
    });
  }
});

// ============================================
// ENDPOINT: /ac/:fileId.ext (URL Akses File)
// ============================================
app.get('/ac/:fileId.:ext', async (req, res) => {
  try {
    const { fileId, ext } = req.params;
    const metadata = fileMetadata.get(fileId);

    if (!metadata) {
      return res.status(404).json({ error: 'File tidak ditemukan' });
    }

    // Validasi extension match
    if (metadata.extension !== ext && ext !== 'bin') {
      return res.status(404).json({ 
        error: 'File extension tidak sesuai',
        correctUrl: `/ac/${fileId}.${metadata.extension}`
      });
    }

    const fileExists = await fs.pathExists(metadata.path);
    
    if (!fileExists) {
      fileMetadata.delete(fileId);
      if (metadata.deletionJob) {
        metadata.deletionJob.cancel();
      }
      return res.status(404).json({ error: 'File telah dihapus' });
    }

    // Set headers berdasarkan tipe file
    const mimeType = mime.lookup(metadata.originalName) || 'application/octet-stream';
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(metadata.originalName)}"`);
    res.setHeader('Content-Length', metadata.size);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Last-Modified', new Date(metadata.uploadedAt).toUTCString());
    res.setHeader('X-File-ID', fileId);
    res.setHeader('X-File-Name', metadata.originalName);
    res.setHeader('X-Expires-At', metadata.expiresAt);

    // Handle range requests untuk media files
    const range = req.headers.range;
    if (range && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) {
      const fileSize = metadata.size;
      const CHUNK_SIZE = 10 ** 6; // 1MB
      const start = Number(range.replace(/\D/g, ''));
      const end = Math.min(start + CHUNK_SIZE, fileSize - 1);
      const contentLength = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': contentLength,
        'Content-Type': mimeType,
      });

      const fileStream = createReadStream(metadata.path, { start, end });
      await pipeline(fileStream, res);
    } else {
      const fileStream = createReadStream(metadata.path);
      await pipeline(fileStream, res);
    }

  } catch (error) {
    if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
      // Client menutup koneksi, tidak perlu log error
      return;
    }
    console.error('File access error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat mengakses file' });
  }
});

// ============================================
// ENDPOINT: /info/:fileId (Info File)
// ============================================
app.get('/info/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const metadata = fileMetadata.get(fileId);

    if (!metadata) {
      return res.status(404).json({ error: 'File tidak ditemukan' });
    }

    const fileExists = await fs.pathExists(metadata.path);
    
    if (!fileExists) {
      fileMetadata.delete(fileId);
      if (metadata.deletionJob) {
        metadata.deletionJob.cancel();
      }
      return res.status(404).json({ error: 'File telah dihapus' });
    }

    res.json({
      fileId: metadata.id,
      originalName: metadata.originalName,
      size: metadata.size,
      formattedSize: formatFileSize(metadata.size),
      mimeType: metadata.mimetype,
      extension: metadata.extension,
      uploadedAt: metadata.uploadedAt,
      expiresAt: metadata.expiresAt,
      uploadedBy: metadata.uploadedBy,
      sourceUrl: metadata.sourceUrl,
      accessUrl: metadata.accessUrl,
      timeRemaining: Math.max(0, new Date(metadata.expiresAt) - new Date()),
      timeRemainingFormatted: formatTimeRemaining(new Date(metadata.expiresAt))
    });

  } catch (error) {
    console.error('Info error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ENDPOINT: /delete/:fileId (Hapus File)
// ============================================
app.delete('/delete/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    const metadata = fileMetadata.get(fileId);

    if (!metadata) {
      return res.status(404).json({ error: 'File tidak ditemukan' });
    }

    // Hapus job schedule jika ada
    if (metadata.deletionJob) {
      metadata.deletionJob.cancel();
    }

    // Hapus file dari disk
    await fs.unlink(metadata.path);
    fileMetadata.delete(fileId);

    res.json({
      success: true,
      message: 'File berhasil dihapus',
      fileId: fileId,
      deletedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ENDPOINT: /stats (Statistics)
// ============================================
app.get('/stats', (req, res) => {
  const files = Array.from(fileMetadata.values());
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  
  // Hitung files per type
  const filesByType = {};
  files.forEach(file => {
    const type = file.mimetype.split('/')[0];
    filesByType[type] = (filesByType[type] || 0) + 1;
  });

  res.json({
    totalFiles: files.length,
    totalSize: totalSize,
    totalSizeFormatted: formatFileSize(totalSize),
    filesByType: filesByType,
    uploadDir: '/nv/assets/',
    maxFileSize: formatFileSize(MAX_FILE_SIZE),
    fileLifetime: `${FILE_LIFETIME_HOURS} jam`,
    bannedIPs: bannedIPs.size,
    serverless: IS_SERVERLESS
  });
});

// ============================================
// ENDPOINT: /banlist (Lihat IP yang dibanned)
// ============================================
app.get('/banlist', (req, res) => {
  const banList = Array.from(bannedIPs.entries()).map(([ip, info]) => ({
    ip,
    reason: info.reason,
    bannedAt: info.bannedAt,
    expiresAt: new Date(info.expiresAt).toISOString(),
    expiresIn: formatTimeRemaining(new Date(info.expiresAt))
  }));

  res.json({
    totalBanned: banList.length,
    bans: banList
  });
});

// ============================================
// ENDPOINT: /unban/:ip (Unban IP)
// ============================================
app.post('/unban/:ip', (req, res) => {
  const ip = req.params.ip;
  
  if (bannedIPs.has(ip)) {
    bannedIPs.delete(ip);
    res.json({
      success: true,
      message: `IP ${ip} berhasil di-unban`
    });
  } else {
    res.status(404).json({
      error: 'IP tidak ditemukan dalam ban list'
    });
  }
});

// ============================================
// ENDPOINT: / (Root)
// ============================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'page', 'index.html'));
});

/*
app.get('/', (req, res) => {
  res.json({
    service: 'Temporary File Hosting',
    version: '1.0.0',
    description: 'API untuk hosting file temporary dengan fitur lengkap',
    endpoints: {
      uploadFile: 'POST /upload',
      uploadFromUrl: 'POST /upload-url',
      accessFile: 'GET /ac/:fileId.:ext',
      fileInfo: 'GET /info/:fileId',
      deleteFile: 'DELETE /delete/:fileId',
      statistics: 'GET /stats',
    },
    limits: {
      maxFileSize: '128MB',
      rateLimit: '2 requests per 5 seconds',
      fileLifetime: '5 hours',
      banDuration: '3 hours for spam',
      uploadTimeout: '30 seconds'
    },
    features: [
      'Auto-delete setelah 5 jam',
      'Upload via file dan URL',
      'IP banning untuk spam',
      'Range request support untuk media',
    ],
    creator: '@NvLabs'
  });
});
*/

// ============================================
// Helper Functions
// ============================================
function formatTimeRemaining(expiryDate) {
  const now = new Date();
  const diff = expiryDate - now;
  
  if (diff <= 0) return 'Expired';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return `${hours} jam, ${minutes} menit, ${seconds} detik`;
}

// ============================================
// Error Handlers
// ============================================
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File terlalu besar',
        maxSize: '128MB',
        limit: formatFileSize(err.limit)
      });
    }
    
    return res.status(400).json({
      error: 'Upload error',
      code: err.code,
      message: err.message
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint tidak ditemukan',
    availableEndpoints: [
      'GET /',
      'POST /upload',
      'POST /upload-url',
      'GET /ac/:fileId.:ext',
      'GET /info/:fileId',
      'DELETE /delete/:fileId',
      'GET /stats',
    ]
  });
});

// ============================================
// Cleanup dan Startup
// ============================================
// Cleanup job setiap jam untuk menghapus metadata expired
schedule.scheduleJob('0 * * * *', () => {
  const now = new Date();
  let deletedCount = 0;
  
  for (const [fileId, metadata] of fileMetadata.entries()) {
    if (new Date(metadata.expiresAt) < now) {
      fileMetadata.delete(fileId);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`[Cleanup] ${deletedCount} expired metadata dihapus`);
  }
});

// Cleanup banned IPs setiap jam
schedule.scheduleJob('0 * * * *', () => {
  const now = Date.now();
  let unbannedCount = 0;
  
  for (const [ip, banInfo] of bannedIPs.entries()) {
    if (now > banInfo.expiresAt) {
      bannedIPs.delete(ip);
      unbannedCount++;
    }
  }
  
  if (unbannedCount > 0) {
    console.log(`[Ban Cleanup] ${unbannedCount} IP di-unban secara otomatis`);
  }
});

// Startup message
if (!IS_SERVERLESS) {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║      Temporary File Hosting - Server Ready           ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                            ║
║  Upload Dir: ${UPLOAD_DIR}                                ║
║  Max File Size: ${formatFileSize(MAX_FILE_SIZE)}          ║
║  File Lifetime: ${FILE_LIFETIME_HOURS} jam                 ║
║  Ban Duration: ${BAN_DURATION_HOURS} jam                   ║
║  Serverless: ${IS_SERVERLESS ? 'Yes (Vercel)' : 'No'}      ║
╚═══════════════════════════════════════════════════════════╝

📁 Endpoints:
   POST /upload      - Upload file (max 128MB)
   POST /upload-url  - Upload dari URL
   GET  /ac/:id.:ext - Akses file langsung
   GET  /info/:id    - Info file
   DELETE /delete/:id- Hapus file
   GET  /stats       - Statistics
   
🔒 Security:
   • Rate limit: 2 reqs/5s
   • IP ban: 3 jam untuk spam
   • File auto-delete: 5 jam
   • File type validation

🚀 Ready for Vercel deployment!
    `);
  });
}

// Export untuk Vercel
export default app;
