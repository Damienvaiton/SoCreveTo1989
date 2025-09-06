import { Client, Collection, GatewayIntentBits, Events } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";


// Equivalent de __dirname en ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chargement des variables d'environnement
dotenv.config();

// Création du client Discord
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.MessageContent,
	],
});



// Pour typer correctement les commandes
client.commands = new Collection<string, any>();

// Utilisation d'une IIFE async pour permettre l'utilisation de 'await'
(async () => {
	// 💬 Chargement des commandes
	const commandsPath = path.join(__dirname, "commands");
	const commandFiles = fs
		.readdirSync(commandsPath)
		.filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const fileUrl = new URL(`file://${filePath.replace(/\\/g, "/")}`).href;

		try {
			const command = await import(fileUrl);

			// Gérer les exports default ET nommés
			const cmd = command.default || command;

			if (cmd.data && cmd.execute) {
				client.commands.set(cmd.data.name, cmd);
				console.log(`✅ Commande ${cmd.data.name} chargée`);
			} else {
				console.warn(`[⚠️] La commande dans ${file} est invalide`);
			}
		} catch (error) {
			console.error(`❌ Erreur lors du chargement de ${file}:`, error);
		}
	}

	// 📡 Chargement des événements
	const eventsPath = path.join(__dirname, "events");
	const eventFiles = fs
		.readdirSync(eventsPath)
		.filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

	for (const file of eventFiles) {
		const filePath = path.join(eventsPath, file);
		const fileUrl = new URL(`file://${filePath.replace(/\\/g, "/")}`).href;

		try {
			const event = await import(fileUrl);

			const evt = event.default || event;

			if (!evt.name || !evt.execute) {
				console.warn(`[⚠️] L'event "${file}" n'a pas de nom ou d'execute`);
				continue;
			}

			if (evt.once) {
				client.once(evt.name, (...args) => evt.execute(...args, client));
			} else {
				client.on(evt.name, (...args) => evt.execute(...args, client));
			}

			console.log(`✅ Event ${evt.name} chargé`);
		} catch (error) {
			console.error(`❌ Erreur lors du chargement de l'event ${file}:`, error);
		}
	}

	


	// 🔐 Connexion à l'API Discord
	console.log("🚀 Connexion au bot...");
	client.login(process.env.DISCORD_API_TOKEN).catch(console.error);
})();

declare module "discord.js" {
	interface Client {
		commands: Collection<string, any>;
	}
}
