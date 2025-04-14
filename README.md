# BackaDB

A generic solution for backing up databases with support for multiple storage providers.

## Features

- Backup databases from various database management systems (initially supporting MariaDB/MySQL)
- Support for multiple storage providers:
  - Local filesystem
  - AWS S3/Minio (S3 compatible)
  - Google Drive
  - NextCloud
- SQL dumps with password encryption
- Flexible backup retention policies
- HTTP endpoint for monitoring with Uptime Kuma
- Configurable scheduling
- Designed for easy deployment on CapRover

## Quick Start

### Using Docker Compose

1. Clone this repository
2. Configure the environment variables in `docker-compose.yml`
3. Run the following command:

```bash
docker-compose up -d
```

### Using Docker

```bash
docker run -d \
  --name backadb \
  -e DB_TYPE=mariadb \
  -e DB_HOST=your-db-host \
  -e DB_PORT=3306 \
  -e DB_USER=root \
  -e DB_PASSWORD=your-password \
  -e DB_DATABASES=all \
  -e BACKUP_SCHEDULE="0 1 * * *" \
  -e STORAGE_TYPE=local \
  -e STORAGE_PATH=/backups \
  -v /path/to/backups:/backups \
  -p 8080:8080 \
  ghcr.io/enkodonl/backadb:latest
```

## Configuration

The Docker image is configured using environment variables:

### Database Connection

```
DB_TYPE=mariadb  # mariadb, mysql
DB_HOST=localhost
DB_PORT=3306  # default port for the selected DB_TYPE
DB_USER=root
DB_PASSWORD=password
DB_DATABASES=all  # comma-separated list or "all"
DB_PARAMS=  # additional database-specific parameters
```

### Backup Configuration

```
BACKUP_SCHEDULE="0 1 * * *"  # cron format, default: 1:00 AM daily
BACKUP_FORMAT=sql
BACKUP_ENCRYPT=false
BACKUP_ENCRYPT_PASSWORD=
BACKUP_ON_STARTUP=false  # run a backup when the container starts
```

### Storage Configuration

```
STORAGE_TYPE=local  # local, s3, gdrive, nextcloud
STORAGE_PATH=/backups  # for local storage
```

### S3/Minio Configuration

```
S3_BUCKET=
S3_REGION=
S3_ENDPOINT=  # custom endpoint for Minio
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_SUBDIRECTORY=  # optional subdirectory within the bucket
```

### Google Drive Configuration

```
GDRIVE_CLIENT_ID=
GDRIVE_CLIENT_SECRET=
GDRIVE_REFRESH_TOKEN=
GDRIVE_FOLDER_ID=
```

### NextCloud Configuration

```
NEXTCLOUD_URL=
NEXTCLOUD_USERNAME=
NEXTCLOUD_PASSWORD=
NEXTCLOUD_FOLDER=
```

### Retention Policy

```
RETENTION_STRATEGY=count  # count or time
RETENTION_COUNT=7  # keep last 7 backups
RETENTION_DAYS=30  # keep backups for 30 days
RETENTION_DAILY=7  # keep 7 daily backups
RETENTION_WEEKLY=4  # keep 4 weekly backups
RETENTION_MONTHLY=3  # keep 3 monthly backups
```

### Notification Configuration

```
NOTIFICATION_HTTP=true
NOTIFICATION_HTTP_PORT=8080
NOTIFICATION_HTTP_PATH=/health
NOTIFICATION_HTTP_TOKEN=  # random token for security
```

## Health Check

The application provides an HTTP endpoint for monitoring the backup status. You can use this endpoint with Uptime Kuma or any other monitoring tool.

```
http://your-host:8080/health?token=your-token
```

The endpoint returns:

- `200 OK` if the backup system is healthy
- `404 Not Found` if no backup has been performed yet
- `500 Internal Server Error` if the last backup failed or is too old

## Development

### Prerequisites

- Node.js 18 or later
- npm or yarn
- Docker (for building and testing)

### Building the Project

```bash
# Install dependencies
npm install

# Build the TypeScript code
npm run build

# Build the Docker image
docker build -t backadb .
```

### Testing

```bash
# Run unit tests
npm test

# Run the application locally
npm run dev

# Test with Docker Compose
docker-compose up
```

## Publishing to GitHub Container Registry

This repository includes a GitHub Actions workflow that automatically builds and publishes the Docker image to GitHub Container Registry (ghcr.io) when you push changes to the main branch or create a new tag.

### Manual Publishing

If you want to publish the image manually:

1. Log in to GitHub Container Registry:

   ```bash
   echo $GITHUB_TOKEN | docker login ghcr.io -u EnkodoNL --password-stdin
   ```

2. Build the image with the correct tag:

   ```bash
   docker build -t ghcr.io/EnkodoNL/backadb:latest .
   ```

3. Push the image:
   ```bash
   docker push ghcr.io/EnkodoNL/backadb:latest
   ```

### Using the Published Image

Once published, you can use the image in your Docker Compose file or Docker run command:

```yaml
# docker-compose.yml
services:
  backadb:
    image: ghcr.io/EnkodoNL/backadb:latest
    # ... rest of your configuration
```

Or with Docker run:

```bash
docker run ghcr.io/EnkodoNL/backadb:latest
```

## License

This project is licensed under the **Business Source License 1.1 (BSL 1.1)**.

### Summary

- ✅ **Free for Personal and Small-Scale Use**  
  You may use, modify, and distribute this software for **personal projects**, **freelance work**, or in companies with **fewer than 2 full-time employees** and **less than €100,000 annual revenue**.

- 🚫 **Commercial or Cloud Use Requires a License**  
  You may **not** use this software in:
  - Commercial products or services
  - SaaS or hosting environments
  - Cloud-based infrastructure
  - Organizations exceeding the small-scale limits above

> “Commercial use” includes direct or indirect revenue-generating activities, use in production environments by businesses, or integration in commercial offerings. See [`LICENSE_USAGE.md`](LICENSE_USAGE.md) for full details.

This project will **not automatically become open source** at a future date.

---

### Need a commercial license?

Please contact: **Sebastiaan Pasma**  
📧 [sebastiaan@enkodo.app](mailto:sebastiaan@enkodo.app)  
🌐 [enkodo.app](https://enkodo.app)

---

Full license text: [`LICENSE`](LICENSE)  
License usage policy: [`LICENSE_USAGE.md`](LICENSE_USAGE.md)

### Commercial Licensing

For information about obtaining a commercial license, please contact sebastiaan@enkodo.app or visit [enkodo.app](https://enkodo.app).
