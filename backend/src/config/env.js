import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the backend environment file relative to this module, so startup works
// whether the command is run from the repository root or the backend folder.
const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: resolve(backendRoot, '.env') });
