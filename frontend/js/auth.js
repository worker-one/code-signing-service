/**
 * Authentication module for Code Signing Service
 */

const Auth = (() => {
    // Store the current authenticated user
    let currentUser = null;
    
    // Check if there's a stored session on page load
    const initAuth = () => {
        const storedUser = localStorage.getItem('currentUser');
        const storedToken = localStorage.getItem('accessToken');
        
        if (storedUser && storedToken) {
            try {
                currentUser = JSON.parse(storedUser);
                updateUIForAuthenticatedUser();
                // Redirect if on login page but already authenticated
                if (window.location.pathname === '/index.html' || window.location.pathname === '/') {
                    redirectBasedOnRole();
                }
            } catch (e) {
                console.error('Failed to parse stored user data');
                localStorage.removeItem('currentUser');
                localStorage.removeItem('accessToken');
            }
        } else {
            updateUIForGuest();
        }
    };
    
    // Login handler
    const login = async (username, password) => {
        try {
            // Create form data for the API request
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            
            // Make an actual API call to the backend
            const response = await fetch('http://78.153.149.221:8000/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });
            
            // Parse the response
            const data = await response.json();
            
            if (response.ok) {
                // Store the token
                localStorage.setItem('accessToken', data.access_token);
                
                // Get user info using the token
                const userInfo = await getUserInfo(data.access_token);
                
                currentUser = {
                    id: userInfo.id,
                    username: userInfo.username,
                    name: userInfo.username, // Adjust if your API returns a separate name field
                    role: userInfo.role
                };
                
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                updateUIForAuthenticatedUser();
                
                // Redirect based on user role
                redirectBasedOnRole();
                return true;
            } else {
                throw new Error(data.detail || 'Authentication failed');
            }
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    };
    
    const getUserInfo = async (token) => {
        try {
            // Replace process.env.API_URL with a direct reference or window variable
            const API_URL = window.API_URL || 'http://78.153.149.221:8000';
            console.log('Sending request to:', `${API_URL}/api/users/me`);
            const response = await fetch(`${API_URL}/api/users/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                // Add timeout of 5 seconds
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            if (error.name === 'TypeError') {
                throw new Error('Network error - please check your connection');
            }
            console.error('Error fetching user info:', error);
            throw error;
        }
    };
    
    // Redirect user based on role
    const redirectBasedOnRole = () => {
        if (isAdmin()) {
            window.location.href = '/admin/index.html';
        } else {
            window.location.href = '/user/index.html';
        }
    };
    
    // Logout handler
    const logout = () => {
        currentUser = null;
        localStorage.removeItem('currentUser');
        localStorage.removeItem('accessToken');
        updateUIForGuest();
        window.location.href = '/index.html';
    };
    
    // Get current user info
    const getCurrentUser = () => currentUser;
    
    // Get auth token
    const getToken = () => localStorage.getItem('accessToken');
    
    // Check if user has admin role
    const isAdmin = () => currentUser && currentUser.role === 'admin';
    
    // Update UI elements based on authentication state
    const updateUIForAuthenticatedUser = () => {
        const loginElements = document.querySelectorAll('.login-required');
        const guestElements = document.querySelectorAll('.guest-only');
        const adminElements = document.querySelectorAll('.admin-only');
        
        loginElements.forEach(el => el.classList.remove('hidden'));
        guestElements.forEach(el => el.classList.add('hidden'));
        
        if (isAdmin()) {
            adminElements.forEach(el => el.classList.remove('hidden'));
        } else {
            adminElements.forEach(el => el.classList.add('hidden'));
        }
        
        // Update user info display if element exists
        const userInfoElement = document.getElementById('username');
        if (userInfoElement && currentUser) {
            userInfoElement.textContent = currentUser.username;
        }
    };
    
    // Update UI for non-authenticated users
    const updateUIForGuest = () => {
        const loginElements = document.querySelectorAll('.login-required');
        const guestElements = document.querySelectorAll('.guest-only');
        const adminElements = document.querySelectorAll('.admin-only');
        
        loginElements.forEach(el => el.classList.add('hidden'));
        guestElements.forEach(el => el.classList.remove('hidden'));
        adminElements.forEach(el => el.classList.add('hidden'));
    };
    
    // Public API
    return {
        initAuth,
        login,
        logout,
        getCurrentUser,
        getToken,
        isAdmin
    };
})();

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    Auth.initAuth();
    
    // Set up event listeners for login forms
    const adminLoginForm = document.getElementById('adminLoginForm');
    const userLoginForm = document.getElementById('userLoginForm');
    
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent the form from submitting normally
            const username = document.getElementById('adminUsername').value;
            const password = document.getElementById('adminPassword').value;
            
            // For debugging
            console.log('Admin login attempt:', username);
            
            // Show loading state
            const submitButton = adminLoginForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerText = 'Logging in...';
            }
            
            // Call the login method
            Auth.login(username, password).then(success => {
                if (success) {
                    console.log('Login successful, redirecting...');
                } else {
                    console.log('Login failed');
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.innerText = 'Login';
                    }
                    
                    // Show error message
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'alert alert-danger mt-3';
                    errorMsg.textContent = 'Invalid username or password';
                    adminLoginForm.appendChild(errorMsg);
                    
                    // Remove error message after 3 seconds
                    setTimeout(() => {
                        adminLoginForm.removeChild(errorMsg);
                    }, 3000);
                }
            });
        });
    }
    
    if (userLoginForm) {
        userLoginForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent the form from submitting normally
            // const pageUrl = document.getElementById('userPageUrl').value;
            const username = document.getElementById('userUsername').value;
            const password = document.getElementById('userPassword').value;
            
            // For debugging
            console.log('User login attempt:', username);
            
            // Show loading state
            const submitButton = userLoginForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerText = 'Logging in...';
            }
            
            // Call the login method
            Auth.login(username, password).then(success => {
                if (success) {
                    console.log('Login successful, redirecting...');
                } else {
                    console.log('Login failed');
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.innerText = 'Login';
                    }
                    
                    // Show error message
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'alert alert-danger mt-3';
                    errorMsg.textContent = 'Invalid username or password';
                    userLoginForm.appendChild(errorMsg);
                    
                    // Remove error message after 3 seconds
                    setTimeout(() => {
                        userLoginForm.removeChild(errorMsg);
                    }, 3000);
                }
            });
        });
    }
    
    // Add logout button handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Auth.logout();
        });
    }
});