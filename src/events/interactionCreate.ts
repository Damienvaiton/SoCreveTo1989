import {
	Events,
	Interaction,
	Client,
	ChatInputCommandInteraction,
} from "discord.js";

export default {
	name: Events.InteractionCreate,

	async execute(interaction: Interaction, client: Client) {
		// On vérifie que c’est bien une commande slash
		if (!interaction.isChatInputCommand()) return;

		const command = client.commands.get(interaction.commandName);
		if (!command) {
			console.warn(`❌ Commande inconnue: ${interaction.commandName}`);
			return;
		}

		try {
			console.log(`➡️ Exécution de la commande /${interaction.commandName}`);
			await command.execute(interaction as ChatInputCommandInteraction);
		} catch (error) {
			console.error(
				`❌ Erreur dans la commande ${interaction.commandName}`,
				error
			);

			const reply = {
				content:
					"❗ Une erreur est survenue lors de l'exécution de la commande.",
				ephemeral: true,
			};

			if (interaction.replied || interaction.deferred) {
				await interaction.followUp(reply);
			} else {
				await interaction.reply(reply);
			}
		}
	},
};
