import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	PermissionFlagsBits,
	MessageFlags,
} from "discord.js";
import { triggerManualReminder } from "../services/reminderService.js";

export default {
	data: new SlashCommandBuilder()
		.setName("test-remember")
		.setDescription("Déclenche un test du rappel des pas")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption((option) =>
			option
				.setName("userid")
				.setDescription("ID Discord spécifique à tester")
				.setRequired(false),
		)
		.addStringOption((option) =>
			option
				.setName("grade")
				.setDescription("Grade d'alerte (1, 2 ou 3)")
				.setRequired(false)
				.addChoices(
					{ name: "Grade 1 (Marche)", value: "1" },
					{ name: "Grade 2 (Attention)", value: "2" },
					{ name: "Grade 3 (Alerte)", value: "3" },
				),
		),

	async execute(interaction: ChatInputCommandInteraction) {
		const targetId = interaction.options.getString("userid") || undefined;
		const grade = interaction.options.getString("grade") || "1";

		try {
			await triggerManualReminder(interaction.client, targetId, grade);
			await interaction.reply({
				content: `✅ Test envoyé (Grade ${grade}) !`,
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			console.error("[COMMAND ERROR] /test-remember :", error);
			await interaction.reply({
				content: "❌ Une erreur est survenue.",
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};
