# Contributing to BackaDB

Thank you for considering contributing to this project! Here are some guidelines to help you get started.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project.

## How to Contribute

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes
4. Run tests to ensure your changes don't break existing functionality
5. Submit a pull request

## Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the TypeScript code:
   ```bash
   npm run build
   ```
4. Run tests:
   ```bash
   npm test
   ```

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the version number in package.json following [Semantic Versioning](https://semver.org/)
3. The pull request will be merged once it has been reviewed and approved

## Coding Standards

- Follow the ESLint configuration provided in the project
- Write tests for new features
- Keep the code modular and maintainable
- Document your code with comments

## Adding Support for New Database Types

To add support for a new database type:

1. Create a new file in `src/db/implementations/` for the database connector
2. Implement the `DatabaseConnector` interface
3. Update the `connector-factory.ts` file to include the new database type
4. Add tests for the new connector
5. Update documentation

## Adding Support for New Storage Providers

To add support for a new storage provider:

1. Create a new file in `src/storage/` for the storage provider
2. Implement the `StorageProvider` interface
3. Update the `provider-factory.ts` file to include the new storage provider
4. Add tests for the new provider
5. Update documentation

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT License.
