import { Events, Message, Client } from "discord.js";

const preditionsPromise = import("../utils/predictions.js").then(
	(module) => module,
);

export default {
	name: Events.MessageCreate,
	once: false,

	async execute(message: Message, client: Client) {
		if (message.author.bot) return;

		const messageContent = message.content.toLowerCase();

		const isTrigger =
			messageContent.includes("!journalier") ||
			messageContent.includes("!daily") ||
			messageContent.includes("!journee");

		if (isTrigger) {
			console.log(`Message reçu de ${message.author.tag}: ${message.content}`);
			const { predictions } = await preditionsPromise;
			const response =
				predictions[Math.floor(Math.random() * predictions.length)];

			await message.reply(response).catch(console.error);
		}
	},
};
