// success.js - Logika untuk halaman sukses (dengan QR Code otomatis)

$(document).ready(function() {
    // Ambil data upload dari localStorage
    let uploadData = null;
    let qrCodeImage = null;
    
    try {
        const savedData = localStorage.getItem('lastUploadResult');
        if (savedData) {
            uploadData = JSON.parse(savedData);
        }
    } catch (e) {
        console.error('Error parsing upload data:', e);
    }
    
    // Jika tidak ada data, gunakan data demo
    if (!uploadData) {
        uploadData = {
            originalName: 'contoh-file.jpg',
            formattedSize: '12.5 MB',
            mimeType: 'image/jpeg',
            expiresAt: new Date(Date.now() + CONFIG.EXPIRY_TIME_MS).toISOString(),
            expiresIn: '5 jam',
            accessUrl: 'https://nvcdn.vercel.app/ac/g721c3.jpg',
            deleteUrl: 'https://nvcdn.vercel.app/delete/g721c3.jpg', // Contoh dengan ekstensi
            infoUrl: 'https://nvcdn.vercel.app/info/g721c3'
        };
    }
    
    // Toggle dark mode untuk halaman sukses
    function initDarkMode() {
        const savedTheme = localStorage.getItem('themeMode');
        if (savedTheme === 'dark') {
            $('body').addClass('dark-mode');
        }
    }
    
    // Inisialisasi halaman dengan data
    function initPage() {
        // Update informasi file
        $('#successFileName').text(uploadData.originalName);
        $('#successFileSize').text(uploadData.formattedSize);
        $('#successFileType').text(uploadData.mimeType.split('/')[1] || 'file');
        $('#successFileExpires').text(uploadData.expiresIn);
        
        // Update URLs
        $('#successAccessUrl').val(uploadData.accessUrl);
        $('#successDeleteUrl').val(uploadData.deleteUrl);
        $('#successInfoUrl').val(uploadData.infoUrl || 'https://nvcdn.vercel.app/info/' + uploadData.fileId);
        
        // Update link buka file
        $('#successOpenAccessUrl').attr('href', uploadData.accessUrl);
        
        // Update icon berdasarkan tipe file
        const icon = getFileIcon(uploadData.mimeType);
        $('#successFileIcon').text(icon);
        
        // Hitung dan mulai countdown
        startCountdown(uploadData.expiresAt);
        
        // Generate QR Code secara otomatis
        generateQRCode();
    }
    
    // Countdown timer
    function startCountdown(expiryTime) {
        const expiryDate = new Date(expiryTime);
        const totalDuration = CONFIG.EXPIRY_TIME_MS; // 5 jam dalam ms
        
        function updateCountdown() {
            const now = new Date();
            const timeLeft = expiryDate - now;
            
            if (timeLeft <= 0) {
                // Waktu habis
                $('#countdownHours').text('00');
                $('#countdownMinutes').text('00');
                $('#countdownSeconds').text('00');
                $('#countdownBar').css('width', '0%');
                return;
            }
            
            // Hitung jam, menit, detik
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            
            // Update tampilan
            $('#countdownHours').text(hours.toString().padStart(2, '0'));
            $('#countdownMinutes').text(minutes.toString().padStart(2, '0'));
            $('#countdownSeconds').text(seconds.toString().padStart(2, '0'));
            
            // Update progress bar
            const progressPercent = (timeLeft / totalDuration) * 100;
            $('#countdownBar').css('width', progressPercent + '%');
            
            // Update warna progress bar berdasarkan waktu tersisa
            if (progressPercent < 20) {
                $('#countdownBar').removeClass('bg-gradient-to-r from-purple-400 to-pink-400')
                                  .addClass('bg-gradient-to-r from-red-400 to-orange-400');
            } else if (progressPercent < 50) {
                $('#countdownBar').removeClass('bg-gradient-to-r from-purple-400 to-pink-400')
                                  .addClass('bg-gradient-to-r from-yellow-400 to-orange-400');
            }
        }
        
        // Update setiap detik
        updateCountdown();
        const countdownInterval = setInterval(updateCountdown, 1000);
    }
    
    // Generate QR Code menggunakan API dengan pengaturan tetap
    function generateQRCode() {
        const accessUrl = uploadData.accessUrl;
        
        // Pengaturan tetap sesuai permintaan
        const settings = {
            margin: 1,
            size: 1000,
            format: 'png',
            color: '#000000', // Hitam
            bgcolor: '#FFFFFF', // Putih
            ecl: 'H' // Error Correction Level High
        };
        
        // Encode URL untuk QR Code
        const encodedUrl = encodeURIComponent(accessUrl);
        
        // Buat URL API untuk generate QR Code dengan pengaturan tetap
        const qrApiUrl = `https://www.ninetwelvers.my.id/nv/canvas/qrgen?text=${encodedUrl}&margin=${settings.margin}&size=${settings.size}&format=${settings.format}&color=${encodeURIComponent(settings.color)}&bgcolor=${encodeURIComponent(settings.bgcolor)}&ecl=${settings.ecl}`;
        
        // Buat elemen image untuk QR Code
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Untuk bisa download
        
        img.onload = function() {
            // QR Code berhasil dimuat
            qrCodeImage = img;
            
            // Tampilkan QR Code
            $('#qrCodeContainer').html('');
            $('#qrCodeContainer').append(img);
            img.className = 'w-full h-full object-contain';
            
            // Tambahkan border glow effect
            $('#qrCodeContainer').addClass('pulse-glow');
            
            // Setup download button
            setupDownloadButton();
            
            console.log('QR Code berhasil dibuat dengan pengaturan:');
            console.log('- Size:', settings.size);
            console.log('- Margin:', settings.margin);
            console.log('- Color:', settings.color);
            console.log('- Background:', settings.bgcolor);
            console.log('- Error Correction:', settings.ecl);
        };
        
        img.onerror = function() {
            // Jika gagal load QR Code
            $('#qrCodeContainer').html(`
                <div class="text-center text-red-600 p-4">
                    <span class="material-icons text-4xl mb-3">error_outline</span>
                    <p class="font-bold text-lg">Gagal membuat QR Code</p>
                    <p class="text-sm mt-2">Silakan gunakan link manual di atas</p>
                    <button onclick="generateQRCode()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg border-2 border-black">
                        Coba Lagi
                    </button>
                </div>
            `);
            
            console.error('Gagal memuat QR Code dari URL:', qrApiUrl);
        };
        
        // Load QR Code image dengan timestamp untuk hindari cache
        img.src = qrApiUrl + '&t=' + new Date().getTime();
    }
    
    // Setup download button untuk QR Code
    function setupDownloadButton() {
        $('#downloadQR').off('click').on('click', function() {
            if (!qrCodeImage) {
                showSuccessToast('QR Code belum siap', 'error');
                return;
            }
            
            // Buat canvas untuk download
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set ukuran canvas (kecilkan untuk download)
            canvas.width = 500; // Ukuran download lebih kecil
            canvas.height = 500;
            
            // Gambar QR Code ke canvas dengan skala
            ctx.drawImage(qrCodeImage, 0, 0, 500, 500);
            
            // Buat link download
            const link = document.createElement('a');
            const fileName = uploadData.originalName.replace(/\.[^/.]+$/, ""); // Hapus ekstensi
            link.download = `qr-${fileName}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            // Tampilkan toast
            showSuccessToast('QR Code berhasil diunduh', 'success');
            
            // Log
            console.log('QR Code diunduh:', link.download);
        });
    }
    
    // Copy URL to clipboard
    $(document).on('click', '#successCopyAccessUrl', function() {
        copyToClipboard($('#successAccessUrl').val());
        showSuccessToast('URL akses berhasil disalin', 'success');
    });
    
    $(document).on('click', '#successCopyDeleteUrl', function() {
        copyToClipboard($('#successDeleteUrl').val());
        showSuccessToast('URL hapus berhasil disalin', 'success');
    });
    
    $(document).on('click', '#successCopyInfoUrl', function() {
        copyToClipboard($('#successInfoUrl').val());
        showSuccessToast('URL info berhasil disalin', 'success');
    });
    
    // Delete file button - menggunakan DELETE method
    $('#successDeleteFile').click(function() {
        if (confirm('Apakah Anda yakin ingin menghapus file ini? Tindakan ini tidak dapat dibatalkan.\n\nFile akan dihapus permanen dari server.')) {
            // Tampilkan loading
            const deleteButton = $(this);
            deleteButton.html('<span class="material-icons mr-2">delete_forever</span>Menghapus...');
            deleteButton.prop('disabled', true);
            
            // Ambil delete URL
            const deleteUrl = uploadData.deleteUrl;
            
            console.log('Mengirim DELETE request ke:', deleteUrl);
            
            // Kirim request DELETE
            $.ajax({
                url: deleteUrl,
                type: 'DELETE',
                success: function(response) {
                    console.log('Response DELETE:', response);
                    
                    if (response.success) {
                        showSuccessToast('File berhasil dihapus permanen', 'success');
                        
                        // Update UI
                        setTimeout(() => {
                            deleteButton.html('<span class="material-icons mr-2">check_circle</span>Terhapus');
                            deleteButton.removeClass('bg-amber-500').addClass('bg-gray-400');
                            deleteButton.prop('disabled', true);
                            
                            // Update tombol copy delete URL
                            $('#successCopyDeleteUrl').prop('disabled', true)
                                .removeClass('bg-amber-500')
                                .addClass('bg-gray-400')
                                .html('<span class="material-icons">block</span>');
                            
                            // Update QR Code jika masih ada
                            if (qrCodeImage) {
                                $('#qrCodeContainer').html(`
                                    <div class="text-center p-4">
                                        <span class="material-icons text-4xl text-red-500 mb-3">block</span>
                                        <p class="font-bold">File Telah Dihapus</p>
                                        <p class="text-sm text-gray-600">QR Code tidak lagi valid</p>
                                    </div>
                                `);
                                $('#qrCodeContainer').removeClass('pulse-glow');
                            }
                            
                            // Update info file
                            $('#successFileExpires').html('<span class="text-red-600 font-bold">DIHAPUS</span>');
                            $('#countdownHours').text('00');
                            $('#countdownMinutes').text('00');
                            $('#countdownSeconds').text('00');
                            $('#countdownBar').css('width', '0%');
                            
                        }, 1000);
                    } else {
                        showSuccessToast('Gagal menghapus file: ' + (response.message || 'Unknown error'), 'error');
                        deleteButton.html('<span class="material-icons mr-2">delete_forever</span>Hapus Sekarang');
                        deleteButton.prop('disabled', false);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('DELETE Error:', xhr, status, error);
                    
                    // Coba format error response
                    let errorMessage = 'Gagal menghapus file';
                    
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMessage += ': ' + xhr.responseJSON.message;
                    } else if (xhr.statusText) {
                        errorMessage += ': ' + xhr.statusText;
                    }
                    
                    showSuccessToast(errorMessage, 'error');
                    deleteButton.html('<span class="material-icons mr-2">delete_forever</span>Hapus Sekarang');
                    deleteButton.prop('disabled', false);
                    
                    // Fallback: coba dengan GET jika DELETE gagal (untuk kompatibilitas)
                    console.log('Mencoba fallback ke GET method...');
                    setTimeout(function() {
                        $.ajax({
                            url: deleteUrl,
                            type: 'GET',
                            success: function(fallbackResponse) {
                                if (fallbackResponse.success) {
                                    showSuccessToast('File berhasil dihapus (menggunakan GET)', 'success');
                                    deleteButton.html('<span class="material-icons mr-2">check_circle</span>Terhapus');
                                    deleteButton.removeClass('bg-amber-500').addClass('bg-gray-400');
                                    deleteButton.prop('disabled', true);
                                }
                            }
                        });
                    }, 1000);
                }
            });
        }
    });
    
    // Toast notification untuk halaman sukses
    function showSuccessToast(message, type = 'success') {
        const toast = $('#successToast');
        const toastIcon = $('#successToastIcon');
        const toastMessage = $('#successToastMessage');
        
        // Set icon berdasarkan tipe
        const icons = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };
        
        toastIcon.text(icons[type] || 'info');
        toastMessage.text(message);
        
        // Set warna berdasarkan tipe
        toast.removeClass('bg-black bg-red-600 bg-yellow-600 bg-blue-600');
        
        switch(type) {
            case 'error':
                toast.addClass('bg-red-600');
                break;
            case 'warning':
                toast.addClass('bg-yellow-600');
                break;
            case 'info':
                toast.addClass('bg-blue-600');
                break;
            default:
                toast.addClass('bg-black');
        }
        
        // Tampilkan toast dengan animasi
        toast.removeClass('hidden').addClass('animate-slide-up');
        
        // Sembunyikan setelah beberapa detik
        setTimeout(() => {
            toast.removeClass('animate-slide-up');
            setTimeout(() => {
                toast.addClass('hidden');
            }, 300);
        }, CONFIG.TOAST_DURATION);
    }
    
    // Copy to clipboard utility
    function copyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
    
    // Inisialisasi halaman
    initDarkMode();
    initPage();
});
