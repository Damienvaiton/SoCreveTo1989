import { Client } from "discord.js";

const startMessagesPromise = import("../utils/sentences.js").then(
	(module) => module.startBotMessageList
);

export default {
	name: "ready",
	once: true,
	async execute(client: Client) {
		console.log(`✅ Connecté en tant que ${client.user?.tag}`);
		/*
		const startMessages = await startMessagesPromise;

		client.guilds.cache.forEach((guild) => {
			const textChannel =
				guild.channels.cache.find(
					(c) => c.name === "general" && c.isTextBased()
				) || guild.channels.cache.find((c) => c.isTextBased());

			if (textChannel && textChannel.isTextBased()) {
				const message =
					startMessages[Math.floor(Math.random() * startMessages.length)];
				textChannel.send(message).catch(console.error);
			}
		});*/
	},
};
