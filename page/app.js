// app.js - Logika utama untuk halaman upload (tanpa GSAP)

$(document).ready(function() {
    // Inisialisasi variabel
    let selectedFile = null;
    let uploadResult = null;
    
    // Toggle dark/light mode yang lebih komprehensif
    $('#themeToggle').click(function() {
        $('body').toggleClass('dark-mode');
        const isDark = $('body').hasClass('dark-mode');
        
        // Update teks tombol
        $(this).html(isDark ? 
            '<span class="material-icons mr-2">light_mode</span>Mode Terang' : 
            '<span class="material-icons mr-2">dark_mode</span>Mode Gelap'
        );
        
        // Update tombol itu sendiri
        if (isDark) {
            $(this).removeClass('bg-black text-white').addClass('bg-gray-200 text-gray-800');
        } else {
            $(this).removeClass('bg-gray-200 text-gray-800').addClass('bg-black text-white');
        }
        
        // Simpan preferensi di localStorage
        localStorage.setItem('themeMode', isDark ? 'dark' : 'light');
    });
    
    // Load tema dari localStorage
    const savedTheme = localStorage.getItem('themeMode');
    if (savedTheme === 'dark') {
        $('body').addClass('dark-mode');
        $('#themeToggle').html('<span class="material-icons mr-2">light_mode</span>Mode Terang');
        $('#themeToggle').removeClass('bg-black text-white').addClass('bg-gray-200 text-gray-800');
    }
    
    // Handle file selection
    $('#fileInput').change(function(e) {
        if (e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });
    
    // Handle drag and drop
    const dropArea = $('#dropArea')[0];
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        $('#dropArea').addClass('dragover');
    }
    
    function unhighlight() {
        $('#dropArea').removeClass('dragover');
    }
    
    dropArea.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    }
    
    // Handle file selection
    function handleFileSelect(file) {
        // Validasi ukuran file
        if (!validateFileSize(file.size)) {
            showToast('Ukuran file terlalu besar. Maksimal ' + CONFIG.MAX_FILE_SIZE_DISPLAY, 'error');
            return;
        }
        
        selectedFile = file;
        
        // Tampilkan preview file
        $('#fileName').text(file.name);
        $('#fileSize').text(formatFileSize(file.size));
        
        // Set icon berdasarkan tipe file
        const icon = getFileIcon(file.type);
        $('#iconText').text(icon);
        $('#fileIcon').removeClass().addClass('w-12 h-12 border-2 border-black rounded-lg flex items-center justify-center ' + getFileColorClass(file.type));
        
        // Tampilkan preview dengan animasi CSS
        $('#filePreview').removeClass('hidden').addClass('animate-slide-up');
        
        // Scroll ke preview
        $('html, body').animate({
            scrollTop: $('#filePreview').offset().top - 100
        }, 500);
    }
    
    // Remove selected file
    $('#removeFile').click(function() {
        selectedFile = null;
        $('#fileInput').val('');
        $('#filePreview').addClass('hidden').removeClass('animate-slide-up');
    });
    
    // Upload file
    $('#uploadBtn').click(function() {
        if (!selectedFile) {
            showToast('Pilih file terlebih dahulu', 'warning');
            return;
        }
        
        uploadFile(selectedFile);
    });
    
    // Upload from URL
    $('#uploadUrlBtn').click(function() {
        const url = $('#urlInput').val().trim();
        
        if (!url) {
            showToast('Masukkan URL file', 'warning');
            return;
        }
        
        if (!validateURL(url)) {
            showToast('URL tidak valid', 'error');
            return;
        }
        
        uploadFromURL(url);
    });
    
    // Upload file function
    function uploadFile(file) {
        // Tampilkan loading
        showLoading('Mengupload file...');
        
        // Tampilkan progress bar
        $('#progressSection').removeClass('hidden');
        $('#resultSection').addClass('hidden');
        $('#uploadResult').removeClass('hidden');
        
        // Scroll ke hasil upload
        $('html, body').animate({
            scrollTop: $('#uploadResult').offset().top - 50
        }, 500);
        
        // Simulasi progress (dalam implementasi nyata, ini akan diganti dengan progress upload sebenarnya)
        simulateProgress();
        
        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);
        
        // Kirim request ke API
        $.ajax({
            url: CONFIG.API_BASE_URL + CONFIG.UPLOAD_ENDPOINT,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    // Simpan hasil upload
                    uploadResult = response.data;
                    
                    // Update UI dengan hasil
                    updateUploadResult(response.data);
                    
                    // Redirect otomatis ke success.html setelah 3 detik
                    setTimeout(() => {
                        // Simpan data ke localStorage untuk digunakan di halaman success
                        localStorage.setItem('lastUploadResult', JSON.stringify(response.data));
                        window.location.href = 'success.html';
                    }, 3000);
                } else {
                    showToast('Upload gagal: ' + (response.message || 'Terjadi kesalahan'), 'error');
                }
            },
            error: function(xhr, status, error) {
                showToast('Upload gagal: ' + (xhr.responseJSON?.message || error), 'error');
            },
            complete: function() {
                hideLoading();
            }
        });
    }
    
    // Upload from URL function
    function uploadFromURL(url) {
        // Tampilkan loading
        showLoading('Mengupload dari URL...');
        
        // Tampilkan progress bar
        $('#progressSection').removeClass('hidden');
        $('#resultSection').addClass('hidden');
        $('#uploadResult').removeClass('hidden');
        
        // Scroll ke hasil upload
        $('html, body').animate({
            scrollTop: $('#uploadResult').offset().top - 50
        }, 500);
        
        // Simulasi progress
        simulateProgress();
        
        // Kirim request ke API
        $.ajax({
            url: CONFIG.API_BASE_URL + CONFIG.UPLOAD_URL_ENDPOINT,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ url: url }),
            success: function(response) {
                if (response.success) {
                    // Simpan hasil upload
                    uploadResult = response.data;
                    
                    // Update UI dengan hasil
                    updateUploadResult(response.data);
                    
                    // Redirect otomatis ke success.html setelah 3 detik
                    setTimeout(() => {
                        // Simpan data ke localStorage untuk digunakan di halaman success
                        localStorage.setItem('lastUploadResult', JSON.stringify(response.data));
                        window.location.href = 'success.html';
                    }, 3000);
                } else {
                    showToast('Upload gagal: ' + (response.message || 'Terjadi kesalahan'), 'error');
                }
            },
            error: function(xhr, status, error) {
                showToast('Upload gagal: ' + (xhr.responseJSON?.message || error), 'error');
            },
            complete: function() {
                hideLoading();
            }
        });
    }
    
    // Update UI dengan hasil upload
    function updateUploadResult(data) {
        // Sembunyikan progress, tampilkan hasil
        $('#progressSection').addClass('hidden');
        $('#resultSection').removeClass('hidden').addClass('animate-fade-in');
        
        // Update data hasil upload
        $('#accessUrl').val(data.accessUrl);
        $('#deleteUrl').val(data.deleteUrl);
        
        $('#infoFileName').text(data.originalName);
        $('#infoFileSize').text(data.formattedSize);
        $('#infoFileType').text(data.mimeType);
        $('#infoFileExpires').text(data.expiresIn);
        
        // Set link buka file
        $('#openAccessUrl').attr('href', data.accessUrl);
    }
    
    // Simulasi progress bar (untuk demo)
    function simulateProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 10 + 5;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
            }
            
            $('#progressBar').css('width', progress + '%');
            $('#progressPercent').text(Math.round(progress) + '%');
        }, 200);
    }
    
    // Copy URL to clipboard
    $(document).on('click', '#copyAccessUrl, #copyDeleteUrl', function() {
        const url = $(this).attr('id') === 'copyAccessUrl' ? $('#accessUrl').val() : $('#deleteUrl').val();
        copyToClipboard(url);
        showToast('URL berhasil disalin ke clipboard', 'success');
    });
    
    // Upload another file
    $('#uploadAnother').click(function() {
        // Reset form
        selectedFile = null;
        $('#fileInput').val('');
        $('#filePreview').addClass('hidden').removeClass('animate-slide-up');
        $('#urlInput').val('');
        $('#uploadResult').addClass('hidden');
        $('#resultSection').removeClass('animate-fade-in');
        
        // Scroll ke atas
        $('html, body').animate({
            scrollTop: 0
        }, 500);
    });
    
    // View success page
    $('#viewSuccessPage').click(function() {
        if (uploadResult) {
            localStorage.setItem('lastUploadResult', JSON.stringify(uploadResult));
            window.location.href = 'success.html';
        }
    });
    
    // Loading overlay functions
    function showLoading(message) {
        $('#loadingText').text(message || 'Mohon tunggu...');
        $('#loadingOverlay').removeClass('hidden');
    }
    
    function hideLoading() {
        $('#loadingOverlay').addClass('hidden');
    }
    
    // Toast notification
    function showToast(message, type = 'success') {
        const toast = $('#toast');
        const toastIcon = $('#toastIcon');
        const toastMessage = $('#toastMessage');
        
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
    
    // Demo: Inisialisasi contoh file terupload
    function initDemoFiles() {
        // Tambahkan kelas animasi ke demo items
        setTimeout(() => {
            $('.demo-item').each(function(index) {
                $(this).css('animation-delay', (index * 0.1) + 's');
                $(this).addClass('animate-fade-in');
            });
        }, 500);
    }
    
    // Jalankan inisialisasi
    setTimeout(() => {
        initDemoFiles();
    }, 100);
});
