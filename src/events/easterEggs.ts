import { Events, Message, Client } from "discord.js";

export default {
	// Le nom de l'événement que ton index.ts va lire
	name: Events.MessageCreate,

	// On veut que ça s'exécute à chaque message, pas juste une fois
	once: false,

	// La logique (ton code est ici)
	async execute(message: Message, client: Client) {
		// 1. Toujours ignorer les bots
		if (message.author.bot) return;

		// 2. Nettoyage du message
		const content = message.content.trim().toLowerCase();

		if (content === "!coquine") {
			await message.reply(
				"https://media1.tenor.com/m/rt23AR7cgwUAAAAC/sabrina-carpenter-sabrina-carpenter-snl.gif"
			);
		}

	},
};
