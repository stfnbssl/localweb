// CRITICO: questo modulo deve essere importato per primo in index.ts.
// Carica le variabili da server/.env prima che gli altri moduli leggano process.env.
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
