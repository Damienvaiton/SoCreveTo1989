import cron from "node-cron";
import { Client, EmbedBuilder, Events, AttachmentBuilder } from "discord.js";
import path from "path";

// IDs des utilisateurs à notifier
const DEFAULT_USERS = ["378634441503014913", "1164513168668770325"];
const VALIDATION_EMOJI = "✅";

// Association des grades avec tes fichiers réels
const GRADE_FILES = {
	"1": "walk.png",
	"2": "warn.png",
	"3": "alert.png",
};

let dailyStatus = new Map<string, boolean>();

function getReminderContent(grade: string, userName: string) {
	switch (grade) {
		case "1":
			return {
				title: `👟 Coucou ${userName} ! C'est l'heure !`,
				description:
					"Il est temps de valider tes pas pour aujourd'hui. N'oublie pas de synchroniser ton app ! ✨",
				color: 0x57f287,
			};
		case "2":
			return {
				title: `⏰ Petit rappel ${userName}...`,
				description:
					"Tu n'as pas encore validé tes pas ! Un petit effort, c'est important pour la forme. 💪",
				color: 0xfee75c,
			};
		case "3":
			return {
				title: `🚨 Dernier appel ${userName} !`,
				description:
					"C'est la dernière chance pour valider tes pas ce soir ! On ne lâche rien ! 🔥",
				color: 0xed4245,
			};
		default:
			return {
				title: `📊 Suivi des pas pour ${userName}`,
				description:
					"Vérification du système de rappel. Réagis avec ✅ pour valider !",
				color: 0x5865f2,
			};
	}
}

function createStepEmbed(grade: string, userName: string) {
	const content = getReminderContent(grade, userName);
	// Récupération du nom de fichier correct selon ton arborescence
	const fileName =
		GRADE_FILES[grade as keyof typeof GRADE_FILES] || GRADE_FILES["1"];

	// Chemin absolu vers l'image dans ton projet
	const filePath = path.join(process.cwd(), "assets", "img", fileName);
	const file = new AttachmentBuilder(filePath);

	const embed = new EmbedBuilder()
		.setTitle(content.title)
		.setDescription(
			`${content.description}\n\n⚠️ **Grade d'alerte :** \`${grade}\``,
		)
		.setColor(content.color)
		// Utilisation de l'image attachée
		.setThumbnail(`attachment://${fileName}`)
		.setTimestamp()
		.setFooter({ text: "Objectif Santé • SoCreveTo1989" });

	return { embed, file };
}

export function initStepReminders(client: Client) {
	// 21h00 : Grade 1
	cron.schedule("0 21 * * *", async () => {
		dailyStatus.clear();
		await broadcastReminder(client, "1", DEFAULT_USERS);
	});

	// 22h00 : Grade 2
	cron.schedule("0 22 * * *", async () => {
		await broadcastReminder(client, "2", DEFAULT_USERS, true);
	});

	// 23h00 : Grade 3
	cron.schedule("0 23 * * *", async () => {
		await broadcastReminder(client, "3", DEFAULT_USERS, true);
	});

	client.on(Events.MessageReactionAdd, async (reaction, user) => {
		if (user.bot) return;
		if (reaction.emoji.name === VALIDATION_EMOJI) {
			if (dailyStatus.get(user.id) === false) {
				dailyStatus.set(user.id, true);

				const successEmbed = new EmbedBuilder()
					.setTitle(`✅ Bravo ${user.username} !`)
					.setDescription(
						"Tes pas sont validés pour aujourd'hui. Repose-toi bien ! ✨",
					)
					.setColor(0x57f287);
				await user.send({ embeds: [successEmbed] });
			}
		}
	});
}

export async function triggerManualReminder(
	client: Client,
	targetId?: string,
	alertGrade: string = "1",
) {
	const users = targetId ? [targetId] : DEFAULT_USERS;
	await broadcastReminder(client, alertGrade, users);
}

async function broadcastReminder(
	client: Client,
	grade: string,
	users: string[],
	checkStatus: boolean = false,
) {
	for (const userId of users) {
		if (checkStatus && dailyStatus.get(userId) === true) continue;
		try {
			const user = await client.users.fetch(userId);
			const { embed, file } = createStepEmbed(grade, user.username);

			// Envoi de l'embed avec le fichier image attaché
			const message = await user.send({ embeds: [embed], files: [file] });
			await message.react(VALIDATION_EMOJI);
			dailyStatus.set(userId, false);
		} catch (err) {
			console.error(`[REMINDER] Erreur vers ${userId} :`, err);
		}
	}
}
