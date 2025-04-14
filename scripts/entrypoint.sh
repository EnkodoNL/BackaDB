#!/bin/bash
set -e

# Print environment variables (excluding passwords)
echo "Starting DB Backup with configuration:"
echo "DB_TYPE: $DB_TYPE"
echo "DB_HOST: $DB_HOST"
echo "DB_PORT: $DB_PORT"
echo "DB_USER: $DB_USER"
echo "DB_DATABASES: $DB_DATABASES"
echo "BACKUP_SCHEDULE: $BACKUP_SCHEDULE"
echo "STORAGE_TYPE: $STORAGE_TYPE"

# Run immediate backup if requested
if [ "$BACKUP_ON_STARTUP" = "true" ]; then
  echo "Running initial backup on startup..."
  node dist/index.js --run-backup
fi

# Start the application
echo "Starting scheduled backup service..."
exec node dist/index.js