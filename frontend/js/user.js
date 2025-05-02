/**
 * User functionality for Code Signing Service
 */

const UserModule = (() => {
    // Track the selected file
    let selectedFile = null;
    
    // Initialize the user page
    const init = async () => {
        setupFileUpload();
        setupEventListeners();
        loadFileHistory();
    };
    
    // Setup drag and drop file upload functionality
    const setupFileUpload = () => {
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
    };
    
    // Setup event listeners
    const setupEventListeners = () => {
        const uploadForm = document.getElementById('uploadForm');
        
        if (uploadForm) {
            uploadForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                if (!selectedFile) {
                    showNotification('Please select a file to sign', 'error');
                    return;
                }
                
                await uploadAndSignFile();
            });
        }
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
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
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'http://78.153.149.221:8000/api/user/files/upload');
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
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    progressBar.style.width = '100%';
                    progressStatus.textContent = 'File signed successfully!';
                    
                    // Display download link
                    const downloadLink = document.getElementById('downloadLink');
                    downloadLink.href = `http://78.153.149.221:8000/api/user/files/download/${response.id}`;
                    signedFileContainer.style.display = 'block';
                    
                    // Refresh file history
                    loadFileHistory();
                    
                    // Reset file selection
                    resetFileSelection();
                } else {
                    let errorMsg = 'File signing failed';
                    try {
                        const response = JSON.parse(xhr.responseText);
                        if (response.detail) {
                            errorMsg = response.detail;
                        }
                    } catch (e) {}
                    
                    progressStatus.textContent = errorMsg;
                    progressBar.style.width = '100%';
                    progressBar.style.backgroundColor = 'var(--danger-color)';
                }
            };
            
            xhr.onerror = function() {
                progressStatus.textContent = 'Network error occurred';
                progressBar.style.width = '100%';
                progressBar.style.backgroundColor = 'var(--danger-color)';
            };
            
            xhr.send(formData);
        } catch (error) {
            console.error('Upload error:', error);
            progressStatus.textContent = 'Error: ' + error.message;
            progressBar.style.width = '100%';
            progressBar.style.backgroundColor = 'var(--danger-color)';
        }
    };
    
    // Load file history from backend
    const loadFileHistory = async () => {
        try {
            const response = await fetch('http://78.153.149.221:8000/api/user/files/history', {
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load file history');
            }
            
            const files = await response.json();
            renderFileHistory(files);
        } catch (error) {
            console.error('History error:', error);
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
                actionButton = `<a href="http://78.153.149.221:8000/api/user/files/download/${file.id}" class="btn btn-small btn-primary">Download</a>`;
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
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    if (Auth.getCurrentUser()) {
        // Update username in header
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            usernameElement.textContent = Auth.getCurrentUser().username;
        }
        
        // Initialize user module
        UserModule.init();
    } else {
        // Redirect to login if not authenticated
        window.location.href = '/index.html';
    }
});