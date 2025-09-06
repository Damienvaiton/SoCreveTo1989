import db from "../db.js";

export interface User {
	id: string;
	discordId?: string;
	experience?: number;
	level?: number;
}

// Ajouter un utilisateur si il n'existe pas déjà
export function addUser(
	id: string,
	discordId?: string,
	experience: number = 0,
	level: number = 1
): void {
	db.prepare("INSERT OR IGNORE INTO users (id, discordId) VALUES (?, ?)").run(
		id,
		discordId
	);
}

// Récupérer un utilisateur par son IDDiscord
export function getUserByDiscordId(discordId: string): User | undefined {
	return db.prepare("SELECT * FROM users WHERE discordId = ?").get(discordId);
}

// Get id from dicordId
export function getIdByDiscordId(discordId: string): string | undefined {
	const row = db
		.prepare("SELECT id FROM users WHERE discordId = ?")
		.get(discordId);
	return row ? row.id : undefined;
}

// Set the value of experience for a user by their discordId
export function setExperienceByDiscordId(
	discordId: string,
	experience: number
): void {
	db.prepare("UPDATE users SET experience = ? WHERE discordId = ?").run(
		experience,
		discordId
	);
}

// Add a level to a user by their discordId
export function addLevelByDiscordId(discordId: string): void {
	var currentLevel = getUserByDiscordId(discordId)?.level || -1;
	if (currentLevel === -1) return addUser(discordId, discordId);
	db.prepare("UPDATE users SET level = ? WHERE discordId = ?").run(
		currentLevel + 1,
		discordId
	);
}
