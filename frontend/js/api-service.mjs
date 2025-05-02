/**
 * API Service for Code Signing Service
 * Handles all communication with the backend API
 */

const ApiService = (() => {
    // Base URL for API endpoints
    const API_BASE_URL = 'http://78.153.149.221:8000/api';

    // Get authentication token (assuming stored in localStorage)
    const getAuthToken = () => {
        return localStorage.getItem('accessToken');
    };

    // Make API request with proper headers
    const apiRequest = async (endpoint, method = 'GET', data = null) => {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        };

        const options = {
            method,
            headers,
            credentials: 'include'
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `API request failed with status ${response.status}`);
        }

        return response.json();
    };

    // Admin API endpoints
    const adminApi = {
        // Get all pages
        getPages: (skip = 0, limit = 100) => {
            return apiRequest(`/admin/pages?skip=${skip}&limit=${limit}`);
        },

        // Get page by ID
        getPage: (pageId) => {
            return apiRequest(`/admin/pages/${pageId}`);
        },

        // Create new page
        createPage: (pageData) => {
            return apiRequest('/admin/pages', 'POST', pageData);
        },

        // Update existing page
        updatePage: (pageId, pageData) => {
            return apiRequest(`/admin/pages/${pageId}`, 'PUT', pageData);
        },

        // Delete page
        deletePage: (pageId) => {
            return apiRequest(`/admin/pages/${pageId}`, 'DELETE');
        },

        // Create new user
        createUser: (userData) => {
            return apiRequest('/admin/users', 'POST', userData);
        },

        // Get pages count
        getPagesCount: () => {
            return apiRequest('/admin/pages/count', 'POST');
        },

        // Get signed files count
        getSignedFilesCount: () => {
            return apiRequest('/admin/files_signed/count', 'POST');
        }
    };

    return {
        admin: adminApi
    };
})();

// Export for use in other modules
window.ApiService = ApiService;