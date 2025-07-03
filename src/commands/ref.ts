import { SlashCommandBuilder, CommandInteraction } from "discord.js";

const refListPromise = import("../utils/sentences.js").then(
	(module) => module.refList
);

const data = new SlashCommandBuilder()
	.setName("ref")
	.setDescription("Give a reference");

async function execute(interaction: CommandInteraction) {
	const references = await refListPromise;
	const randomIndex = Math.floor(Math.random() * references.length);
	const randomReference = references[randomIndex];

	await interaction.reply(randomReference);
}

// Export default avec la structure attendue
export default {
	data,
	execute,
};
