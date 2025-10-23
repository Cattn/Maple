import { browser } from '$app/environment';

export class Settings {
	private type: string;
	constructor(type: string) {
		this.type = type;
	}

	get(key: string) {
		let value;
		if (browser) {
			value = localStorage.getItem(`${this.type}.${key}`);
		}
		if (value) {
			return JSON.parse(value);
		} else {
			return null;
		}
	}

	set(key: string, value: any) {
		if (browser) {
			localStorage.setItem(`${this.type}.${key}`, JSON.stringify(value));
		}
	}
}