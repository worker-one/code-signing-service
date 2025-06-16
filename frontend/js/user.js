/**
 * User functionality for Code Signing Service
 */

const UserModule = (() => {
    // Track the selected file
    let selectedFile = null;
    let impersonatedPageId = null;
    let impersonatedUserDetails = null;

    // Initialize the user page
    const init = async () => {
        console.log('[UserModule] Initializing user page...');
        await setupUserContext();
        setupFileUpload();
        setupEventListeners();
        await loadFileHistory();
        console.log('[UserModule] Initialization complete.');
    };

    // Setup user context (regular user or admin impersonation)
    const setupUserContext = async () => {
        console.log('[UserModule] Setting up user context...');
        const urlParams = new URLSearchParams(window.location.search);
        const pageIdFromUrl = urlParams.get('id');
        const usernameElement = document.getElementById('username');
        const adminViewBanner = document.getElementById('adminViewBanner');

        if (pageIdFromUrl && Auth.isAdmin()) {
            impersonatedPageId = pageIdFromUrl;
            try {
                if (!window.ApiService || !window.ApiService.admin) {
                    console.error("[UserModule] ApiService.admin is not available for impersonation setup.");
                    throw new Error("ApiService not available for admin functions.");
                }
                console.log(`[UserModule] Admin impersonating page ID: ${impersonatedPageId}`);
                impersonatedUserDetails = await window.ApiService.admin.getPage(impersonatedPageId);
                
                if (usernameElement) {
                    usernameElement.textContent = `${impersonatedUserDetails.username} (Admin View)`;
                }
                if (adminViewBanner) {
                    adminViewBanner.innerHTML = `<p><strong>Admin View:</strong> Managing page for user <strong>${impersonatedUserDetails.username}</strong>. Actions are performed on their behalf.</p>`;
                    adminViewBanner.style.display = 'block';
                }
                console.log(`[UserModule] Impersonation setup complete for user: ${impersonatedUserDetails.username}`);
            } catch (error) {
                console.error("[UserModule] Failed to set up admin impersonation:", error);
                showNotification(`Error: Could not load page details for admin view. ${error.message}`, "error");
                impersonatedPageId = null; 
                impersonatedUserDetails = null;
                if (adminViewBanner) adminViewBanner.style.display = 'none';
                if (usernameElement && Auth.getCurrentUser()) {
                     usernameElement.textContent = Auth.getCurrentUser().username; // Fallback to admin's own name
                }
            }
        } else if (Auth.getCurrentUser()) {
            if (usernameElement) {
                usernameElement.textContent = Auth.getCurrentUser().username;
            }
            if (adminViewBanner) adminViewBanner.style.display = 'none';
            console.log(`[UserModule] Regular user context for: ${Auth.getCurrentUser().username}`);
        }
        // If neither, the DOMContentLoaded redirect should handle it.
    };
    
    // Helper to construct API endpoints considering impersonation
    const getApiEndpoint = (basePath, fileId = null) => {
        let url = `/api/v1/user`; // Base for user-specific actions
        let queryParams = '';

        if (impersonatedPageId && Auth.isAdmin()) {
            // Append page_id for backend to identify context when admin is acting
            queryParams = `?page_id=${impersonatedPageId}`;
        }

        url += basePath;
        if (fileId) {
            url += `/${fileId}`;
        }
        url += queryParams;
        return url;
    };

    // Setup drag and drop file upload functionality
    const setupFileUpload = () => {
        console.log('[UserModule] Setting up file upload...');
        const dropArea = document.getElementById('dropArea');
        const fileInput = document.getElementById('fileInput');
        const fileInfo = document.getElementById('fileInfo');
        const signButton = document.getElementById('signButton');

        // Handle file selection change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                selectedFile = e.target.files[0];
                fileInfo.innerHTML = `<p>Selected file: ${selectedFile.name} (${formatFileSize(selectedFile.size)})</p>`;
                signButton.disabled = false;
                console.log(`[UserModule] File selected: ${selectedFile.name} (${selectedFile.size} bytes)`);
            } else {
                resetFileSelection();
            }
        });

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight drop area when file is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlight, false);
        });

        function highlight() {
            dropArea.classList.add('highlight');
        }

        function unhighlight() {
            dropArea.classList.remove('highlight');
        }

        // Handle dropped files
        dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length > 0) {
                selectedFile = files[0];
                fileInput.files = dt.files;
                fileInfo.innerHTML = `<p>Selected file: ${selectedFile.name} (${formatFileSize(selectedFile.size)})</p>`;
                signButton.disabled = false;
                console.log(`[UserModule] File dropped: ${selectedFile.name} (${selectedFile.size} bytes)`);
            }
        }, false);
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Reset file selection
    const resetFileSelection = () => {
        selectedFile = null;
        document.getElementById('fileInfo').innerHTML = '<p>No file selected</p>';
        document.getElementById('signButton').disabled = true;
        console.log('[UserModule] File selection reset.');
    };

    // Setup event listeners
    const setupEventListeners = () => {
        console.log('[UserModule] Setting up event listeners...');
        const uploadForm = document.getElementById('uploadForm');

        if (uploadForm) {
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!selectedFile) {
                    showNotification('Please select a file to sign', 'error');
                    return;
                }

                console.log('[UserModule] Upload form submitted.');
                await uploadAndSignFile();
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('[UserModule] Logout button clicked.');
                Auth.logout();
            });
        }
    };

    // Upload and sign file
    const uploadAndSignFile = async () => {
        const progressSection = document.getElementById('progressSection');
        const progressBar = document.getElementById('progressBar');
        const progressStatus = document.getElementById('progressStatus');
        const signedFileContainer = document.getElementById('signedFileContainer');

        progressSection.style.display = 'block';
        progressBar.style.width = '0%';
        signedFileContainer.style.display = 'none';

        try {
            // Create form data
            const formData = new FormData();
            formData.append('file', selectedFile);

            console.log(`[UserModule] Uploading file: ${selectedFile.name}`);
            const xhr = new XMLHttpRequest();
            xhr.open('POST', getApiEndpoint('/files/upload'));
            xhr.setRequestHeader('Authorization', `Bearer ${Auth.getToken()}`);

            // Track upload progress
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressBar.style.width = percentComplete + '%';

                    if (percentComplete < 100) {
                        progressStatus.textContent = `Uploading: ${Math.round(percentComplete)}%`;
                    } else {
                        progressStatus.textContent = 'Processing file...';
                    }
                }
            };

            xhr.onload = function () {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    progressBar.style.width = '100%';
                    progressStatus.textContent = 'File signed successfully!';
                    console.log('[UserModule] File signed successfully.');

                    // Display download link as a button
                    const downloadLink = document.getElementById('downloadLink');
                    downloadLink.onclick = function(e) {
                        e.preventDefault();
                        downloadSignedFile(response.id, selectedFile ? selectedFile.name : 'signed_file');
                    };
                    downloadLink.style.display = 'inline-block';
                    signedFileContainer.style.display = 'block';

                    // Refresh file history
                    loadFileHistory();

                    // Reset file selection
                    resetFileSelection();
                } else {
                    let errorMsg = 'File signing failed !';
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.detail) {
                            errorMsg = response.detail;
                        }
                    } catch (e) { }

                    progressStatus.textContent = errorMsg;
                    progressBar.style.width = '100%';
                    progressBar.style.backgroundColor = 'var(--danger-color)';
                    console.error(`[UserModule] File signing failed: ${errorMsg}`);
                }
            };

            xhr.onerror = function () {
                progressStatus.textContent = 'Network error occurred';
                progressBar.style.width = '100%';
                progressBar.style.backgroundColor = 'var(--danger-color)';
                console.error('[UserModule] Network error during file upload.');
            };

            xhr.send(formData);
        } catch (error) {
            console.error('[UserModule] Upload error:', error);
            progressStatus.textContent = 'Error: ' + error.message;
            progressBar.style.width = '100%';
            progressBar.style.backgroundColor = 'var(--danger-color)';
        }
    };

    // Load file history from backend
    const loadFileHistory = async () => {
        try {
            console.log('[UserModule] Loading file history...');
            console.log(`/${getApiEndpoint('/files/history')}`)
            const response = await fetch(getApiEndpoint('/files/history'), {
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load file history');
            }

            const files = await response.json();
            renderFileHistory(files);
            console.log('[UserModule] File history loaded.');
        } catch (error) {
            console.error('[UserModule] History error:', error);
        }
    };

    // Render file history table
    const renderFileHistory = (files) => {
        const historyTableBody = document.getElementById('historyTableBody');

        if (!historyTableBody) return;

        historyTableBody.innerHTML = '';

        if (files.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No files have been signed yet</td></tr>';
            return;
        }

        files.forEach(file => {
            const row = document.createElement('tr');

            // Format the date
            const uploadDate = new Date(file.uploaded_at).toLocaleString();

            // Determine status class for styling
            let statusClass = '';
            switch (file.status) {
                case 'pending':
                    statusClass = 'status-pending';
                    break;
                case 'in_progress':
                    statusClass = 'status-pending';
                    break;
                case 'signed':
                    statusClass = 'status-completed';
                    break;
                case 'failed':
                    statusClass = 'status-failed';
                    break;
            }

            // Create action button based on status
            let actionButton = '';
            if (file.status === 'signed') {
                // Use a button to trigger authenticated download
                actionButton = `<button class="btn btn-small btn-primary download-btn" data-file-id="${file.id}" data-file-name="${file.file_name}">Download</button>`;
            } else if (file.status === 'failed') {
                actionButton = '<button class="btn btn-small btn-danger" disabled>Failed</button>';
            } else {
                actionButton = '<button class="btn btn-small" disabled>Pending</button>';
            }

            row.innerHTML = `
                <td>${file.file_name}</td>
                <td>${uploadDate}</td>
                <td><span class="${statusClass}">${file.status}</span></td>
                <td>${actionButton}</td>
            `;

            historyTableBody.appendChild(row);
        });

        // Add event listeners for download buttons
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const fileId = btn.getAttribute('data-file-id');
                const fileName = btn.getAttribute('data-file-name') || 'signed_file';
                console.log(`[UserModule] Download button clicked for file ID: ${fileId}`);
                await downloadSignedFile(fileId, fileName);
            });
        });
    };

    // Download signed file with authentication
    const downloadSignedFile = async (fileId, fileName) => {
        try {
            console.log(`[UserModule] Downloading signed file: ${fileId}`);
            const response = await fetch(getApiEndpoint('/files/download', fileId), {
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });
            if (!response.ok) {
                throw new Error('Download failed');
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            // Create a temporary link to trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = `signed_${fileName}`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);
            console.log(`[UserModule] File downloaded: signed_${fileName}`);
        } catch (err) {
            console.error('[UserModule] Failed to download file:', err);
            alert('Failed to download file: ' + err.message);
        }
    };

    // Show notification
    const showNotification = (message, type = 'success') => {
        // You can implement a toast notification system here
        alert(message);
    };

    // Public API
    return {
        init
    };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageIdFromUrl = urlParams.get('id');

    // Allow access if:
    // 1. A regular user is logged in.
    // 2. An admin is logged in AND a page_id is in the URL (for impersonation).
    if (Auth.getCurrentUser() || (Auth.isAdmin() && pageIdFromUrl)) {
        // If an admin lands here without a page_id, and they are not also a 'user' role,
        // they might be in the wrong place. However, UserModule.init() will try to load
        // their own user context if they have one, or fail gracefully if impersonation setup fails.
        console.log('[UserModule] DOMContentLoaded: Initializing UserModule...');
        await UserModule.init();
    } else {
        // Redirect to login if not authenticated or admin without page_id for impersonation
        console.warn('[UserModule] Not authenticated or missing page_id for impersonation. Redirecting to login.');
        window.location.href = '/index.html';
    }
});