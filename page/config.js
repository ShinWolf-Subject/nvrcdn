// config.js - Konfigurasi untuk TempUploader

const CONFIG = {
  // API endpoints
  API_BASE_URL: window.location.origin,
  UPLOAD_ENDPOINT: '/upload',
  UPLOAD_URL_ENDPOINT: '/upload-url',
  
  // QR Code
  QR_CODE_SETTINGS: {
    margin: 1,
    size: 1000,
    format: 'png',
    color: '#000000', // Black
    bgcolor: '#FFFFFF', // White
    ecl: 'H' // Error Correction Level High
  },
  
  // QR Code API
  QR_CODE_API: 'https://www.ninetwelvers.my.id/nv/canvas/qrgen',
  // File settings
  MAX_FILE_SIZE: 128 * 1024 * 1024, // 128MB in bytes
  MAX_FILE_SIZE_DISPLAY: '128 MB',
  
  // Display settings
  EXPIRY_TIME_HOURS: 5,
  EXPIRY_TIME_MS: 5 * 60 * 60 * 1000, // 5 hours in milliseconds
  
  // UI settings
  ANIMATION_DURATION: 0.5,
  TOAST_DURATION: 3000,
  
  // File type icons mapping
  FILE_ICONS: {
    // Images
    'image/jpeg': 'image',
    'image/jpg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/svg+xml': 'image',
    'image/webp': 'image',
    'image/bmp': 'image',
    
    // Documents
    'application/pdf': 'picture_as_pdf',
    'application/msword': 'description',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'description',
    'application/vnd.ms-excel': 'table_chart',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'table_chart',
    'application/vnd.ms-powerpoint': 'slideshow',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slideshow',
    'text/plain': 'text_fields',
    'text/html': 'code',
    'text/css': 'code',
    'text/javascript': 'code',
    'application/json': 'code',
    
    // Archives
    'application/zip': 'folder_zip',
    'application/x-zip-compressed': 'folder_zip',
    'application/x-rar-compressed': 'folder_zip',
    'application/x-tar': 'folder_zip',
    'application/x-7z-compressed': 'folder_zip',
    'application/gzip': 'folder_zip',
    
    // Audio
    'audio/mpeg': 'audiotrack',
    'audio/wav': 'audiotrack',
    'audio/ogg': 'audiotrack',
    'audio/aac': 'audiotrack',
    'audio/flac': 'audiotrack',
    
    // Video
    'video/mp4': 'videocam',
    'video/mpeg': 'videocam',
    'video/ogg': 'videocam',
    'video/webm': 'videocam',
    'video/avi': 'videocam',
    'video/x-msvideo': 'videocam',
    'video/quicktime': 'videocam',
    
    // Default
    'default': 'insert_drive_file'
  },
  
  // File type colors mapping
  FILE_COLORS: {
    // Images
    'image': 'bg-pink-100 text-pink-600 border-pink-300',
    
    // Documents
    'description': 'bg-blue-100 text-blue-600 border-blue-300',
    'picture_as_pdf': 'bg-red-100 text-red-600 border-red-300',
    'table_chart': 'bg-green-100 text-green-600 border-green-300',
    'slideshow': 'bg-amber-100 text-amber-600 border-amber-300',
    'text_fields': 'bg-gray-100 text-gray-600 border-gray-300',
    'code': 'bg-purple-100 text-purple-600 border-purple-300',
    
    // Archives
    'folder_zip': 'bg-yellow-100 text-yellow-600 border-yellow-300',
    
    // Audio
    'audiotrack': 'bg-indigo-100 text-indigo-600 border-indigo-300',
    
    // Video
    'videocam': 'bg-cyan-100 text-cyan-600 border-cyan-300',
    
    // Default
    'default': 'bg-gray-100 text-gray-600 border-gray-300'
  },
  
  // Demo data for recent uploads
  DEMO_FILES: [
  {
    name: 'landscape.jpg',
    size: '5.2 MB',
    expiresIn: '2 jam lagi',
    type: 'image/jpeg',
    progress: 66
  },
  {
    name: 'laporan.pdf',
    size: '12.1 MB',
    expiresIn: '3 jam lagi',
    type: 'application/pdf',
    progress: 50
  },
  {
    name: 'presentasi.mp4',
    size: '45.3 MB',
    expiresIn: '4 jam lagi',
    type: 'video/mp4',
    progress: 25
  },
  {
    name: 'data.zip',
    size: '87.6 MB',
    expiresIn: '1 jam lagi',
    type: 'application/zip',
    progress: 20
  }]
};

function generateQRCodeUrl(text) {
  const encodedText = encodeURIComponent(text);
  const { margin, size, format, color, bgcolor, ecl } = CONFIG.QR_CODE_SETTINGS;
  
  return `${CONFIG.QR_CODE_API}?text=${encodedText}&margin=${margin}&size=${size}&format=${format}&color=${encodeURIComponent(color)}&bgcolor=${encodeURIComponent(bgcolor)}&ecl=${ecl}`;
}

// Format file size function
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get file icon based on mime type
function getFileIcon(mimeType) {
  return CONFIG.FILE_ICONS[mimeType] || CONFIG.FILE_ICONS.default;
}

// Get file color class based on mime type
function getFileColorClass(mimeType) {
  const icon = getFileIcon(mimeType);
  return CONFIG.FILE_COLORS[icon] || CONFIG.FILE_COLORS.default;
}

// Generate expiry time (5 hours from now)
function getExpiryTime() {
  const now = new Date();
  const expiry = new Date(now.getTime() + CONFIG.EXPIRY_TIME_MS);
  return expiry.toISOString();
}

// Format expiry time for display
function formatExpiryTime(expiryTime) {
  const now = new Date();
  const expiry = new Date(expiryTime);
  const diffMs = expiry - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 0) {
    return `${diffHours} jam ${diffMinutes} menit`;
  } else {
    return `${diffMinutes} menit`;
  }
}

// Validate file size
function validateFileSize(fileSize) {
  return fileSize <= CONFIG.MAX_FILE_SIZE;
}

// Validate URL
function validateURL(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}
