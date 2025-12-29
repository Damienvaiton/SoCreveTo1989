import { Events, Message, Client } from "discord.js";

export default {
	name: Events.MessageCreate,
	once: false,

	async execute(message: Message, client: Client) {
		if (message.author.bot) return;

		const content = message.content.trim().toLowerCase();

		// 1. Regex pour !coquin, !coquine, !coquins (début/fin exacts)
		const isCoquin = /^!coquine?s?$/.test(content);

		// 2. Regex pour "grr" (n'importe où, mais en mot entier)
		const hasGrrr = /\bgr+\b/.test(content);

		// 3. Regex pour !gourmand, !gourmande (n'importe où dans le message)
		const isGourmand = /!gourmande?s?/.test(content);

		if (isCoquin || hasGrrr || isGourmand) {
			// Lien direct .gif de media1.tenor.com pour l'affichage propre
			await message.reply(
				"https://media1.tenor.com/m/rt23AR7cgwUAAAAC/sabrina-carpenter-sabrina-carpenter-snl.gif"
			);
		} else if (content === "!conne") {
			await message.reply(
				"https://revuedelatoile.fr/wp-content/uploads/2025/09/Miniatures-Wordpress-Revue-de-la-Toile25.png"
			);
		}
	},
};
