# Use an official Python image
FROM python:3.11-slim

# Install required system packages, Java, and Azure CLI dependencies
RUN apt-get update && apt-get install -y \
    wget \
    sudo \
    openjdk-17-jre-headless \
    curl \
    apt-transport-https \
    lsb-release \
    gnupg \
    && curl -sL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/microsoft.gpg > /dev/null \
    && AZ_REPO=$(lsb_release -cs) \
    && echo "deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ $AZ_REPO main" | tee /etc/apt/sources.list.d/azure-cli.list \
    && apt-get update && apt-get install -y azure-cli \
    && rm -rf /var/lib/apt/lists/*

    
# Set the working directory
WORKDIR /app

# Download and install JSign
RUN wget https://github.com/ebourg/jsign/releases/download/7.1/jsign_7.1_all.deb \
    && sudo dpkg -i jsign_7.1_all.deb \
    && rm jsign_7.1_all.deb

# Copy dependency files
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY ./ .

# Expose the port for Uvicorn (HTTPS)
EXPOSE 8000

# Run the FastAPI app with SSL
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--ssl-keyfile", "/etc/letsencrypt/live/signspace.cloud/privkey.pem", \
     "--ssl-certfile", "/etc/letsencrypt/live/signspace.cloud/fullchain.pem"]