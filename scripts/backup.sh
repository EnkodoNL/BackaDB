#!/bin/bash
set -e

# This script performs the actual database backup
# It is called by the main application

# Parameters
DB_TYPE=$1
DB_HOST=$2
DB_PORT=$3
DB_USER=$4
DB_PASSWORD=$5
DB_NAME=$6
OUTPUT_FILE=$7
ADDITIONAL_PARAMS=$8

echo "Starting backup of $DB_NAME to $OUTPUT_FILE"

case "$DB_TYPE" in
  "mariadb"|"mysql")
    # MariaDB/MySQL backup
    MYSQL_PWD="$DB_PASSWORD" mysqldump \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      --single-transaction \
      --quick \
      --lock-tables=false \
      $ADDITIONAL_PARAMS \
      "$DB_NAME" > "$OUTPUT_FILE"
    ;;
  *)
    echo "Unsupported database type: $DB_TYPE"
    exit 1
    ;;
esac

# Check if backup was successful
if [ $? -eq 0 ]; then
  echo "Backup of $DB_NAME completed successfully"
  exit 0
else
  echo "Backup of $DB_NAME failed"
  exit 1
fi