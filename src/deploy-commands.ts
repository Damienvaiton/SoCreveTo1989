import { REST, Routes } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

dotenv.config();

const commands = [];

const commandsPath = path.join(process.cwd(), "src", "commands");
const commandFiles = fs
	.readdirSync(commandsPath)
	.filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const fileUrl = pathToFileURL(filePath).href;

	try {
		const commandModule = await import(fileUrl);

		// Essayer différentes façons d'importer
		const command = commandModule.default || commandModule;

		console.log(`📁 Chargement de ${file}:`, {
			hasDefault: !!commandModule.default,
			hasData: !!command?.data,
			hasExecute: !!command?.execute,
			keys: Object.keys(commandModule),
		});

		if (command && "data" in command && "execute" in command) {
			commands.push(command.data.toJSON());
			console.log(`✅ Commande ${command.data.name} ajoutée`);
		} else {
			console.warn(`[⚠️] La commande ${file} est invalide ou mal exportée`);
			console.warn(`Structure:`, command);
		}
	} catch (error) {
		console.error(`❌ Erreur lors du chargement de ${file}:`, error);
	}
}

const rest = new REST({ version: "10" }).setToken(
	process.env.DISCORD_API_TOKEN!
);

(async () => {
	try {
		console.log(`📦 Déploiement de ${commands.length} commandes...`);

		if (commands.length === 0) {
			console.warn("⚠️ Aucune commande à déployer !");
			return;
		}

		await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
			body: commands,
		});

		console.log("✅ Commandes déployées !");
	} catch (error) {
		console.error("❌ Erreur lors du déploiement :", error);
	}
})();
