#!/bin/bash

# Define directories and files
mkdir -p admin user css js

touch index.html

# Admin files
touch admin/index.html

touch admin/create-page.html

touch admin/manage-pages.html

# User files
touch user/index.html

# CSS files
touch css/styles.css

touch css/admin.css

touch css/user.css

# JS files
touch js/auth.js

touch js/admin.js

touch js/user.js

echo "Project structure generated successfully."
