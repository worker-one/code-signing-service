/**
 * Admin functionality for Code Signing Service
 */

const apiService = window.ApiService || {};
if (!apiService.admin) {
  console.error('ApiService.admin is not available');
  // Handle missing admin methods (e.g., redirect or show error)
}

console.log('ApiService:', apiService); // Check if this exists
console.log('apiService.admin:', apiService?.admin); // Check if admin exists

const AdminPanel = (() => {
    // Store list of signing pages
    let signingPages = [];
    
    // Initialize admin panel
    const initAdminPanel = async () => {
        // Check if user is admin
        if (!Auth.isAdmin()) {
            window.location.href = '/index.html';
            return;
        }
        
        document.getElementById('admin-container').style.display = 'block';

        if (isAdminDashboard()) {
            await loadDashboardData();
        } else {
            await loadSigningPages();
        }
        setupEventListeners();
    };

    // Check if current page is admin dashboard
    const isAdminDashboard = () => {
        const path = window.location.pathname;
        return path.endsWith('/admin/') || path.endsWith('/admin/index.html');
    };

    // Load dashboard data
    const loadDashboardData = async () => {
        try {
            // Load pages count
            const pagesCountElement = document.getElementById('pagesCount');
            if (pagesCountElement) {
                const pagesCountResponse = await apiService.admin.getPagesCount();
                pagesCountElement.textContent = pagesCountResponse.count;
            }

            // Load signed files count
            const filesCountElement = document.getElementById('filesCount');
            if (filesCountElement) {
                const filesCountResponse = await apiService.admin.getSignedFilesCount();
                filesCountElement.textContent = filesCountResponse.count;
            }

            // You could also load recent activity data here if needed
            await loadRecentActivity();

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            showNotification('Failed to load dashboard data', 'error');
        }
    };

    // Load recent activity
    const loadRecentActivity = async () => {
        const activityTableBody = document.getElementById('activityTableBody');
        if (!activityTableBody) return;

        try {
            // This is a placeholder. You would need to implement an API endpoint for recent activity
            // For now, I'll just show the most recent files or pages as activity
            
            // Get some pages data to populate activity
            const pages = await apiService.admin.getPages(0, 5);
            
            if (pages.length === 0) {
                activityTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No recent activity</td></tr>';
                return;
            }
            
            activityTableBody.innerHTML = '';
            pages.forEach(page => {
                const row = document.createElement('tr');
                const createdDate = new Date(page.created_at);
                const utcDate = createdDate.toISOString();
                row.innerHTML = `
                    <td>Page Created</td>
                    <td>${page.page_url}</td>
                    <td>${utcDate} UTC</td>
                `;
                activityTableBody.appendChild(row);
            });
            
        } catch (error) {
            console.error('Failed to load recent activity:', error);
            activityTableBody.innerHTML = '<tr><td colspan="3" class="text-center">Failed to load activity</td></tr>';
        }
    };
    
    // Load signing pages from backend
    const loadSigningPages = async () => {
        try {
            console.log('Loading signing pages...');
            // Make real API call
            const response = await apiService.admin.getPages();
            console.log('API response:', response);

            signingPages = response.map(page => {
                // Format the date to show only year, month, and day
                const createdDate = new Date(page.created_at);
                const formattedDate = createdDate.toISOString().split('T')[0]; // Gets YYYY-MM-DD format

                return {
                    id: page.id,
                    title: page.username,
                    accountName: page.azure_account_name,
                    certificateName: page.azure_certificate_name,
                    createdAt: formattedDate,
                    status: page.status || 'active' // Use API status, default to 'active'
                };
            });
            console.log('Transformed signing pages:', signingPages);

            renderSigningPages();
            console.log('Pages rendered successfully');
        } catch (error) {
            console.error('Failed to load signing pages:', error);
            showNotification('Failed to load signing pages', 'error');
        }
    };
    
    // Render signing pages in the UI
    const renderSigningPages = () => {
        console.log('Starting renderSigningPages...');
        const pagesTableBody = document.getElementById('pagesTableBody');
        if (!pagesTableBody) {
            console.warn('Pages table body element not found');
            return;
        }
        
        console.log('Clearing existing content...');
        pagesTableBody.innerHTML = '';
        
        if (signingPages.length === 0) {
            console.log('No signing pages to display');
            pagesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No signing pages found</td></tr>';
            return;
        }
        
        console.log(`Rendering ${signingPages.length} signing pages...`);
        signingPages.forEach(page => {
            console.log('Rendering page:', page);

            // Status label
            let statusLabel = '';
            if (page.status === 'active') {
                statusLabel = '<span style="background:#ccc;color:#333;padding:2px 8px;border-radius:12px;font-size:0.9em;">Active</span>';
            } else if (page.status === 'suspended') {
                statusLabel = '<span style="background:#f44336;color:#fff;padding:2px 8px;border-radius:12px;font-size:0.9em;">Suspended</span>';
            } else {
                statusLabel = `<span style="background:#eee;color:#333;padding:2px 8px;border-radius:12px;font-size:0.9em;">${page.status}</span>`;
            }

            // Use a fixed width for all buttons for consistency
            const buttonStyle = 'min-width: 70px; margin-right: 4px;';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${page.title}</td>
                <td>${page.accountName || 'N/A'}</td>
                <td>${page.certificateName || 'N/A'}</td>
                <td>${page.createdAt}</td>
                <td>${statusLabel}</td>
                <td>
                    <button class="btn btn-sm btn-secondary view-page" data-id="${page.id}" style="${buttonStyle}">View</button>
                    <button class="btn btn-sm btn-primary edit-page" data-id="${page.id}" style="${buttonStyle}">Edit</button>
                    <button class="btn btn-sm btn-danger delete-page" data-id="${page.id}" style="${buttonStyle}">Delete</button>
                </td>
            `;
            pagesTableBody.appendChild(row);
        });
        console.log('Finished rendering signing pages');
    };
    
    // Create new signing page
    const createSigningPage = async (pageData) => {
        try {
            let userId = pageData.userId || 1; // Default to 1 if user creation is skipped

            // First, create the user if username and password are provided
            if (pageData.userUsername && pageData.userPassword) {
                const userResponse = await apiService.admin.createUser({
                    username: pageData.userUsername,
                    password: pageData.userPassword,
                    role: "user"
                });

                // Assuming the API returns the created user's ID
                userId = userResponse?.id || userId;
            }

            // Prepare the signing page data
            // Generate a random suffix for the page URL
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            
            const apiPageData = {
                user_id: userId,
                username: pageData.userUsername,
                page_url: `${pageData.title}-${randomSuffix}`,
                account_uri: pageData.accountUri, // Add account_uri
                azure_account_name: pageData.accountName,
                azure_certificate_name: pageData.certificateName,
                azure_tenant_id: pageData.tenantId,
                azure_client_id: pageData.clientId,
                azure_client_secret: pageData.clientSecret
            };

            console.log(apiPageData);

            // Create the signing page
            await apiService.admin.createPage(apiPageData);

            showNotification('Signing page created successfully');
            await loadSigningPages();
            return true;
        } catch (error) {
            console.error('Create page error:', error);
            showNotification(error.message, 'error');
            return false;
        }
    };
    // Update existing signing page
    const updateSigningPage = async (pageId, pageData) => {
        try {
            // Transform form data to match API schema
            const apiPageData = {
                page_url: pageData.title || pageData.pageAddress,
                azure_account_name: pageData.accountName,
                azure_certificate_name: pageData.certificateName,
                account_uri: pageData.accountUri,
                azure_tenant_id: pageData.tenantId,
                azure_client_id: pageData.clientId,
                azure_client_secret: pageData.clientSecret
            };
            
            await apiService.admin.updatePage(pageId, apiPageData);
            
            showNotification('Signing page updated successfully');
            await loadSigningPages();
            return true;
        } catch (error) {
            console.error('Update page error:', error);
            showNotification(error.message, 'error');
            return false;
        }
    };
    
    // Delete signing page
    const deleteSigningPage = async (pageId) => {
        if (!confirm('Are you sure you want to delete this signing page?')) {
            return false;
        }
        
        try {
            await apiService.admin.deletePage(pageId);
            
            showNotification('Signing page deleted successfully');
            await loadSigningPages();
            return true;
        } catch (error) {
            console.error('Delete page error:', error);
            showNotification(error.message, 'error');
            return false;
        }
    };
    
    // Setup event listeners for admin panel
    const setupEventListeners = () => {
        // Create page form submission
        const createPageForm = document.getElementById('createPageForm');
        if (createPageForm) {
            createPageForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(createPageForm);
                const pageData = {
                    tenantId: formData.get('tenantId')?.trim() || '',
                    clientId: formData.get('clientId')?.trim() || '',
                    clientSecret: formData.get('clientSecret')?.trim() || '',
                    accountName: formData.get('accountName')?.trim() || '',
                    certificateName: formData.get('certificateName')?.trim() || '',
                    accountUri: formData.get('accountUri')?.trim() || '', // Get accountUri from form
                    additionalCredentials: formData.get('additionalCredentials')?.trim() || '',
                    userUsername: formData.get('userUsername')?.trim() || '',
                    userPassword: formData.get('userPassword')?.trim() || '',
                    pageAddress: (formData.get('pageAddress') || formData.get('accountName'))?.trim() || ''
                };
                
                const success = await createSigningPage(pageData);
                if (success && window.location.pathname.includes('create-page.html')) {
                    window.location.href = '/admin/manage-page.html';
                }
            });

            // Generate strong password button
            const generatePasswordBtn = document.getElementById('generatePasswordBtn');
            if (generatePasswordBtn) {
                generatePasswordBtn.addEventListener('click', () => {
                    const password = generateStrongPassword();
                    const passwordField = document.getElementById('userPassword');
                    const passwordDisplay = document.getElementById('passwordDisplay'); // New element to display the password
                    
                    passwordField.value = password;  // Set password in the input field
                    
                    // Create or update password display element
                    if (!passwordDisplay) {
                        const newPasswordDisplay = document.createElement('span');
                        newPasswordDisplay.id = 'passwordDisplay';
                        newPasswordDisplay.textContent = `Generated Password: ${password}`;
                        passwordField.parentElement.appendChild(newPasswordDisplay);
                    } else {
                        passwordDisplay.textContent = `Generated Password: ${password}`;
                    }

                    // Hide the password display after 10 seconds
                    setTimeout(() => {
                        if (passwordDisplay) {
                            passwordDisplay.style.display = 'none';
                        }
                    }, 10000); // 10000 milliseconds = 10 seconds
                });
            }

        }
        
        // Event delegation for page actions (edit, delete, view)
        const pagesContainer = document.getElementById('signing-pages-list');
        if (pagesContainer) {
            pagesContainer.addEventListener('click', async (e) => {
                const target = e.target;
                const pageId = target.dataset.id;
                
                if (!pageId) return;
                
                if (target.classList.contains('delete-page')) {
                    await deleteSigningPage(pageId);
                } else if (target.classList.contains('edit-page')) {
                    window.location.href = `/admin/create-page.html?id=${pageId}`;
                } else if (target.classList.contains('view-page')) {
                    window.open(`/user/index.html?id=${pageId}`, '_blank');
                }
            });
        }

        // Event delegation for page actions (edit, delete, view)
        const pagesTableBody = document.getElementById('pagesTableBody');
        if (pagesTableBody) {
            pagesTableBody.addEventListener('click', async (e) => {
                const target = e.target;
                if (!target.classList.contains('edit-page') && 
                    !target.classList.contains('delete-page') && 
                    !target.classList.contains('view-page')) {
                    return;
                }
                
                const pageId = target.dataset.id;
                if (!pageId) return;
                
                if (target.classList.contains('delete-page')) {
                    await deleteSigningPage(pageId);
                } else if (target.classList.contains('edit-page')) {
                    // Open edit modal instead of redirecting
                    openEditModal(pageId);
                } else if (target.classList.contains('view-page')) {
                    window.open(`/user/index.html?id=${pageId}`, '_blank');
                }
            });

            // Search functionality
            const searchInput = document.getElementById('pageSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    const searchTerm = searchInput.value.toLowerCase();
                    const filteredPages = signingPages.filter(page => 
                        page.title.toLowerCase().includes(searchTerm) || 
                        (page.userUsername && page.userUsername.toLowerCase().includes(searchTerm))
                    );
                    renderFilteredPages(filteredPages);
                });
            }
            
            // Modal functionality
            const modal = document.getElementById('editPageModal');
            const closeBtn = modal?.querySelector('.close');
            const cancelBtn = document.getElementById('cancelEditBtn');
            const editForm = document.getElementById('editPageForm');
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            if (editForm) {
                editForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const pageId = document.getElementById('editPageId').value;
                    
                    const formData = new FormData(editForm);
                    const pageData = {
                        accountName: formData.get('azureAccountName'),
                        certificateName: formData.get('azureCertificateName'),
                        accountUri: formData.get('accountUri'),
                        tenantId: formData.get('azureTenantId'),
                        clientId: formData.get('azureClientId'),
                        clientSecret: formData.get('azureClientSecret'),
                        additionalCredentials: formData.get('additionalCredentials'),
                        userUsername: formData.get('userUsername'),
                        userPassword: formData.get('userPassword'),
                        pageAddress: formData.get('pageAddress')
                    };

                    console.log('Updating page with data:', pageData);
                    
                    const success = await updateSigningPage(pageId, pageData);
                    if (success) {
                        modal.style.display = 'none';
                    }
                });
            }
            
            // Generate password in edit form
            const editGeneratePasswordBtn = document.getElementById('editGeneratePasswordBtn');
            if (editGeneratePasswordBtn) {
                editGeneratePasswordBtn.addEventListener('click', () => {
                    const password = generateStrongPassword();
                    document.getElementById('editUserPassword').value = password;
                });
            }
        }
    };
 
    // Generate a strong password
    const generateStrongPassword = () => {
        const length = 12;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-+=";
        let password = "";
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    };
    
    // Show notification
    const showNotification = (message, type = 'success') => {
        const notificationEl = document.getElementById('notification');
        if (!notificationEl) {
            // Create notification element if it doesn't exist
            const newNotification = document.createElement('div');
            newNotification.id = 'notification';
            newNotification.className = `alert alert-${type}`;
            newNotification.textContent = message;
            document.body.appendChild(newNotification);
            
            setTimeout(() => {
                document.body.removeChild(newNotification);
            }, 3000);
            return;
        }
        
        notificationEl.textContent = message;
        notificationEl.className = `alert alert-${type}`;
        notificationEl.classList.remove('hidden');

        alert(message)
        
        setTimeout(() => {
            notificationEl.classList.add('hidden');
        }, 3000);
    };

    // Function to open the edit modal and populate it with page data
    const openEditModal = async (pageId) => {
        try {
            const page = await apiService.admin.getPage(pageId);

            document.getElementById('editPageId').value = pageId;
            document.getElementById('editAzureAccountName').value = page.azure_account_name || '';
            document.getElementById('editAzureCertificateName').value = page.azure_certificate_name || '';
            document.getElementById('editAccountUri').value = page.account_uri || '';
            document.getElementById('editAzureTenantId').value = page.azure_tenant_id || '';
            document.getElementById('editAzureClientId').value = page.azure_client_id || '';
            // Do not populate client secret for security
            document.getElementById('editAzureClientSecret').value = '';
            document.getElementById('editUserUsername').value = page.username || '';
            // Do not populate password for security
            document.getElementById('editUserPassword').value = '';
            document.getElementById('editPageAddress').value = page.page_url || '';

            const modal = document.getElementById('editPageModal');
            modal.style.display = 'block';
        } catch (error) {
            console.error('Failed to get page details:', error);
            showNotification('Failed to load page details', 'error');
        }
    };

    // Function to render filtered pages
    const renderFilteredPages = (filteredPages) => {
        const pagesTableBody = document.getElementById('pagesTableBody');
        if (!pagesTableBody) return;

        pagesTableBody.innerHTML = '';

        if (filteredPages.length === 0) {
            pagesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No matching pages found</td></tr>';
            return;
        }

        filteredPages.forEach(page => {
            // Status label
            let statusLabel = '';
            if (page.status === 'active') {
                statusLabel = '<span style="background:#ccc;color:#333;padding:2px 8px;border-radius:12px;font-size:0.9em;">Active</span>';
            } else if (page.status === 'suspended') {
                statusLabel = '<span style="background:#f44336;color:#fff;padding:2px 8px;border-radius:12px;font-size:0.9em;">Suspended</span>';
            } else {
                statusLabel = `<span style="background:#eee;color:#333;padding:2px 8px;border-radius:12px;font-size:0.9em;">${page.status}</span>`;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${page.title}</td>
                <td>${page.userUsername || 'N/A'}</td>
                <td>${page.accountName || 'N/A'}</td>
                <td>${page.createdAt}</td>
                <td>${statusLabel}</td>
                <td>
                    <a class="btn btn-sm btn-primary" href="/admin/edit_page.html?id=${page.id}">Edit</a>
                    <button class="btn btn-sm btn-danger delete-page" data-id="${page.id}">Delete</button>
                    <button class="btn btn-sm btn-secondary view-page" data-id="${page.id}">View</button>
                </td>
            `;
            pagesTableBody.appendChild(row);
        });
    };
    
    // Public API
    return {
        initAdminPanel,
        createSigningPage,
        updateSigningPage,
        deleteSigningPage,
        openEditModal,
        renderFilteredPages,
        showNotification,
        loadDashboardData  // Add the new method to the public API
    };
})();

// Initialize admin panel on page load
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on an admin page
    if (window.location.pathname.includes('/admin/')) {
        AdminPanel.initAdminPanel();
    }
});