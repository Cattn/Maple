import { parseArgs } from 'node:util';
import { createMaple } from './app.js';
import { loadConfig, loadEnv } from './config.js';
import { openDatabase } from './storage/sqlite.js';

process.on('uncaughtException', (error) => {
	console.error('[ERROR] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
	console.error('[ERROR] Unhandled Rejection:', reason);
});

try {
	loadEnv();
	const { values } = parseArgs({ options: { dev: { type: 'boolean', default: false } } });
	const config = loadConfig(process.env, values.dev);
	if (!config.email) {
		console.warn('[WARN] Email delivery is disabled; verification and reset emails will fail.');
	}
	const { server } = createMaple(config, openDatabase(config.databasePath));
	server.listen(config.port, () => {
		console.log(`[DONE] Server is running on port ${config.port}`);
	});
} catch (error) {
	console.error('[FATAL] Error during server startup:', error);
	process.exit(1);
}
