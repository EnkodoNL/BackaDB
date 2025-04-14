# Build stage
FROM node:18-slim AS build

# Set working directory
WORKDIR /app

# Copy all project files
COPY . .

# Install all dependencies (including dev dependencies) but skip the prepare script
RUN npm ci --ignore-scripts

# Build the application with explicit reference to tsconfig.json
RUN npx tsc -p ./tsconfig.json

# Production stage
FROM node:18-slim

# Set working directory
WORKDIR /app

# Install MariaDB client and other dependencies
RUN apt-get update && apt-get install -y \
    mariadb-client \
    curl \
    gnupg \
    lsb-release \
    ca-certificates \
    --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies (skip scripts to avoid prepare script)
RUN npm ci --omit=dev --ignore-scripts

# Copy built application from build stage
COPY --from=build /app/dist/ ./dist/
COPY scripts/ ./scripts/

# Make scripts executable
RUN chmod +x ./scripts/*.sh

# Set environment variables
ENV NODE_ENV=production

# Expose port for health check endpoint
EXPOSE 8080

# Set entrypoint
ENTRYPOINT ["./scripts/entrypoint.sh"]