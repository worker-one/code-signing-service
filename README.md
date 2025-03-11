## **Application Overview**  
We are developing a **web service for code signing** that utilizes **Azure Trusted Signing** (formerly Azure Code Signing). The service includes an **Admin Panel** for managing signing pages and a **User Page** for file uploads and signing operations.

---

## **Core Functionalities**

### **1. Admin Panel**  
The **Admin Panel** is a secured interface accessible via login credentials. Its primary role is to manage and create new user pages for code signing.  

#### **Key Features**  
- **Authentication**:  
  - Admins must log in using a **username and password**.  
  - Authentication will be handled securely, ensuring protection against common vulnerabilities (e.g., SQL injection, brute force).  

- **Create User Pages**:  
  Admins can create new user pages by entering the following details:  
  - **Azure Trusted Signing Account Credentials**:  
    - Required fields include `account_uri`, `account_key`, and other necessary credentials for authentication with Azure.  
  - **User Login and Password**:  
    - These credentials will secure the user’s individual signing page.  
  - **Page Address (URL)**:  
    - By default, the URL will be set to the `account_uri` value from Azure credentials, but it can be customized if needed.  

- **Manage Existing Pages**:  
  - View and manage all created pages.  
  - Edit user credentials and page addresses.  
  - Delete user pages if required.  

---

### **2. User Page**  
Each **User Page** is dynamically generated via the Admin Panel and protected by a unique login and password. This interface allows users to upload files for code signing and download the signed output.

#### **Key Features**  
- **Authentication**:  
  - Users must log in with their assigned credentials to access their dedicated page.  

- **File Upload for Signing**:  
  - Users can upload files for signing with Azure Trusted Signing.  
  - Validation will be performed on file types and sizes (as per Azure's limitations).  

- **Signing Process**:  
  - Once a file is uploaded, the system automatically initiates the signing process using Azure Trusted Signing.  
  - A **progress bar** will visually indicate the file upload and signing status.  

- **Download Signed Files**:  
  - After signing is complete, a **"Download"** button will allow users to download their signed file.  

- **File History Log**:  
  - The page will display a list of all previously uploaded and signed files.  
  - Information for each file will include:  
    - File Name  
    - Upload Date and Time  
    - Signing Status (e.g., pending, completed, failed)  
    - Download Link (if signing is successful)  

---

## **Technology Stack**

### **1. Front-end**  
The interface will be designed using:  
- **HTML** for markup structure.  
- **CSS** for styling and layout.  
- **JavaScript** for interactive elements such as the progress bar and file upload handling.  

#### **Front-End Features**  
- Responsive design for accessibility on multiple devices.  
- Form validations for user inputs.  
- Real-time feedback for file uploads and signing status.  

---

### **2. Back-end**  
The server-side logic will be implemented using:  
- **Python** with **FastAPI** for building a high-performance web API.  
- **SQLAlchemy** for ORM (Object-Relational Mapping) to interact with the database.  
- **Pydantic** for data validation and serialization.  
- **Azure SDK** for communication with Azure

#### **Database Models**  
The system will have the following database tables:  

1. **Users Table**  
   - `id` (Primary Key)  
   - `username` (Unique, required)  
   - `password_hash` (Stored securely using hashing algorithms)  
   - `role` (Admin/User for future scalability)  
   - `created_at` (Timestamp)  

2. **Pages Table**  
   - `id` (Primary Key)  
   - `user_id` (Foreign key linked to `users.id`)  
   - `page_url` (Unique URL for the user page)  
   - `azure_account_uri` (URI from Azure Trusted Signing)  
   - `azure_account_key` (Securely stored credential)  
   - `created_at` (Timestamp)  
   - `updated_at` (Timestamp for last modifications)  

3. **Files Table**  
   - `id` (Primary Key)  
   - `user_id` (Foreign key linked to `users.id`)  
   - `file_name` (Original name of the uploaded file)  
   - `file_path` (Server path where the file is stored)  
   - `status` (Enum: pending, in_progress, signed, failed)  
   - `signed_file_path` (Path to the signed file)  
   - `uploaded_at` (Timestamp)  
   - `signed_at` (Timestamp when signing was completed)  

---

## **API Endpoints**  
Here’s a simplified overview of essential API routes:  

- **Authentication**  
  - `POST /api/login` - Authenticate user and return a token.  

- **Admin Panel**  
  - `POST /api/pages` - Create a new user page.  
  - `GET /api/pages` - Retrieve all created pages.  
  - `PUT /api/pages/{id}` - Update a specific page's details.  
  - `DELETE /api/pages/{id}` - Delete a page.  

- **User Page**  
  - `POST /api/files/upload` - Upload a file for signing.  
  - `GET /api/files/history` - Retrieve the history of signed files.  
  - `GET /api/files/download/{file_id}` - Download a signed file.  
