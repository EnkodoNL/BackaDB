# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of this project seriously. If you believe you have found a security vulnerability, please follow these steps:

1. **Do not disclose the vulnerability publicly**
2. **Email the details to security@example.com**

   - Provide a detailed description of the vulnerability
   - Include steps to reproduce the issue
   - Attach any proof-of-concept code if applicable
   - Let us know how you'd like to be credited (or if you prefer to remain anonymous)

3. **Allow time for response**
   - We will acknowledge receipt of your report within 48 hours
   - We will provide an estimated timeline for a fix
   - We will keep you updated on our progress

## Security Considerations

When using this project, please consider the following security aspects:

1. **Database Credentials**: The application requires database credentials to perform backups. These should be kept secure and provided via environment variables or a secure secrets management system.

2. **Encryption Passwords**: If you enable backup encryption, ensure you store the encryption password securely and have a process for recovery.

3. **Storage Provider Credentials**: Credentials for cloud storage providers should be kept secure and rotated regularly.

4. **HTTP Endpoint Token**: The token for the health check endpoint should be kept secret to prevent unauthorized access to backup status information.

5. **Container Security**: Follow Docker security best practices when deploying the container.

## Security Updates

We will announce security updates through:

1. GitHub Security Advisories
2. Release notes
3. Notifications to users who have starred or watched the repository

## Security Best Practices

When deploying this application, consider the following best practices:

1. Run the container with the least privileges necessary
2. Keep the container and its dependencies updated
3. Use a read-only database user for backups when possible
4. Encrypt sensitive backups
5. Regularly test backup restoration
6. Monitor the backup process and set up alerts for failures
