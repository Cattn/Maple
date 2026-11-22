import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface KeyvalDatabase<T> extends DBSchema {
	keyval: { key: string; value: T };
}

export class IDB {
	public static keyval<T>(name: string) {
		let database: Promise<IDBPDatabase<KeyvalDatabase<T>>> | undefined;

		function open() {
			database ??= openDB<KeyvalDatabase<T>>(name, 1, {
				upgrade(db) {
					db.createObjectStore('keyval');
				},
				blocking(_version, _newVersion, event) {
					(event.target as IDBDatabase).close();
					database = undefined;
				},
				terminated() {
					database = undefined;
				}
			}).catch((error) => {
				database = undefined;
				throw error;
			});
			return database;
		}

		return {
			get: async (key: string) => (await open()).get('keyval', key),
			set: async (key: string, value: T) => (await open()).put('keyval', value, key),
			values: async () => (await open()).getAll('keyval'),
			clear: async () => (await open()).clear('keyval')
		};
	}
}
