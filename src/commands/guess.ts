import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	Message,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	TextChannel,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	MessageFlags,
	User,
	MessageComponentInteraction,
} from "discord.js";
import {
	getRandomSongSnippet,
	getAvailableAlbums,
	normalizeTitle,
} from "../services/lyricsService.js";

// --- SYSTEME DE MEMOIRE ---
interface UserConfig {
	selectedAlbums: string[];
	lines: number;
	hintsEnabled: boolean;
	lastUpdated: number;
}
const userConfigs = new Map<string, UserConfig>();
const CONFIG_EXPIRATION_MS = 5 * 60 * 1000;

// --- GESTION DES PARTIES EN COURS ---
const activeGames = new Set<string>();

// --- GESTION DES SERIES DE VICTOIRES (STREAKS) ---
// Key: channelId, Value: { playerId: string, count: number }
interface WinStreak {
	playerId: string;
	count: number;
}
const winStreaks = new Map<string, WinStreak>();

// --- GESTION DES SERIES RAPIDES (MULTI-KILLS) ---
// Key: channelId, Value: { playerId: string, count: number }
interface RapidStreak {
	playerId: string;
	count: number;
}
const rapidStreaks = new Map<string, RapidStreak>();
const RAPID_STREAK_WINDOW_MS = 10000; // 10 secondes maximum pour un "Fast Kill"

// IDs
const ID_CONF_MODE = "conf_mode";
const ID_CONF_LINES = "conf_lines";
const ID_CONF_HINTS = "conf_hints";
const ID_CONF_START = "conf_start";
const ID_MODAL_LINES = "modal_lines";
const ID_INPUT_LINES = "input_lines";
const ID_GAME_CANCEL = "game_cancel";
const ID_GAME_HINT_ALBUM = "game_hint_album";
const ID_GAME_HINT_PENDU = "game_hint_pendu";
const ID_GAME_HINT_LYRICS = "game_hint_lyrics";
const ID_GAME_REPLAY = "game_replay";

// --- SEUILS D'ANNONCES POUR LES SÉRIES DE VICTOIRES (STREAK) - FR SEULEMENT ---
const STREAK_ANNOUNCEMENTS = [
	{
		threshold: 13, // 🌟 EASTER EGG TAYLOR 🌟
		message: "✨ TAYLOR MAGIQUE ! ✨",
		description:
			"**${userTag}** est rentré dans une nouvelle Era",
		color: 0xffa500, // Or/Orange pour l'impact
	},
	{
		threshold: 8,
		message: "🔥 LÉGENDAIRE !",
		description: "**${userTag}** est légendaire ",
		color: 0xffc0cb, // Rose
	},
	{
		threshold: 7,
		message: "🌟 DIVIN !",
		description: "**${userTag}** est divin(e) ",
		color: 0xffc0cb, // Rose
	},
	{
		threshold: 6,
		message: "👑 DOMINE !",
		description: "**${userTag}** domine",
		color: 0xffc0cb, // Rose
	},
	{
		threshold: 5,
		message: "🛡️ INVINCIBLE !",
		description: "**${userTag}** est invincible",
		color: 0xffc0cb, // Rose
	},
	{
		threshold: 4,
		message: "💥 CARNAGE !",
		description: "**${userTag}** fait un carnage",
		color: 0xffc0cb, // Rose
	},
	{
		threshold: 3,
		message: "🔪 MEURTRE EN SÉRIE !",
		description: "Série pour **${userTag}**",
		color: 0xffc0cb, // Rose
	},
];

// --- SEUILS D'ANNONCES RAPIDES (MULTI-KILLS) - FR SEULEMENT ---
const MULTIKILL_ANNOUNCEMENTS = [
	{
		threshold: 5,
		message: "👑 QUINTUPLÉ !",
		description: "La rapidité de **${userTag}** est divine !",
	},
	{
		threshold: 4,
		message: "💥 QUADRUPLÉ !",
		description: "**${userTag}** enchaîne très vite !",
	},
	{
		threshold: 3,
		message: "🔪 TRIPLÉ !",
		description: "**${userTag}** a été très rapide !",
	},
	{
		threshold: 2,
		message: "⚡ DOUBLÉ !",
		description: "**${userTag}** a été rapide !",
	},
];

// --- OUTILS DE CRÉATION D'EMBED D'ANNONCE ---
function createAnnouncementEmbed(
	title: string,
	description: string,
	color: number
): EmbedBuilder {
	return new EmbedBuilder()
		.setTitle(title)
		.setDescription(description)
		.setColor(color);
}

// --- OUTILS DE NETTOYAGE ROBUSTE (Local, mais doit être cohérent avec le service) ---

const cleanTitleForGame = (title: string) => {
	let clean = title.replace(/[\u2018\u2019`]/g, "'");

	const patternsToRemove = [
		"Taylor's Version",
		"From The Vault",
		"10 Minute Version",
		"Piano Version",
		"Live",
		"Remix",
		"Acoustic",
		"Sad Girl Autumn Version",
		"Recorded at",
	];

	let previous = "";
	while (clean !== previous) {
		previous = clean;
		const regex = new RegExp(
			`\\s*([\\(\\[\\-]|\\s)\\s*(${patternsToRemove.join(
				"|"
			)}).*?([\\)\\]]|$)|\\s*-\\s*$`,
			"gi"
		);
		clean = clean.replace(regex, "");
	}
	return clean.trim();
};

const normalizeString = (str: string) => {
	if (!str) return "";
	let s = cleanTitleForGame(str);
	return s
		.toLowerCase()
		.replace(/[.,?!:;“”'"\/]/g, "")
		.replace(/\s+/g, " ")
		.trim();
};

const generateHangman = (title: string) =>
	cleanTitleForGame(title).replace(/[a-zA-Z0-9À-ÿ]/g, "_ ");

export default {
	data: new SlashCommandBuilder()
		.setName("guess")
		.setDescription("Lance une partie de Blind Test (Configuration incluse)")
		.addUserOption((option) =>
			option
				.setName("duel")
				.setDescription("Défier un utilisateur spécifique (Optionnel)")
				.setRequired(false)
		),

	async execute(interaction: ChatInputCommandInteraction) {
		if (!interaction.channel || interaction.channel.type !== 0)
			return interaction.reply({
				content: "❌ Salon invalide.",
				flags: MessageFlags.Ephemeral,
			});
		const channel = interaction.channel as TextChannel;
		const opponent = interaction.options.getUser("duel");

		console.log(
			`[CMD] 👤 ${interaction.user.tag} lance /guess dans #${channel.name} ${
				opponent ? `(Duel vs ${opponent.tag})` : ""
			}`
		);

		if (opponent) {
			if (opponent.bot)
				return interaction.reply({
					content: "🤖 Tu ne peux pas défier un robot.",
					flags: MessageFlags.Ephemeral,
				});
			if (opponent.id === interaction.user.id)
				return interaction.reply({
					content: "🪞 Tu ne peux pas te défier toi-même.",
					flags: MessageFlags.Ephemeral,
				});
		}

		if (activeGames.has(channel.id)) {
			return interaction.reply({
				content: "🚫 **Une partie est déjà en cours !**",
				flags: MessageFlags.Ephemeral,
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		activeGames.add(channel.id);

		try {
			const allAlbums = getAvailableAlbums();
			let config = {
				selectedAlbums: [...allAlbums],
				lines: 2,
				hintsEnabled: true,
			};
			const savedConfig = userConfigs.get(interaction.user.id);
			if (
				savedConfig &&
				Date.now() - savedConfig.lastUpdated < CONFIG_EXPIRATION_MS
			) {
				console.log(`[CONF] 💾 Config chargée pour ${interaction.user.tag}`);
				config.selectedAlbums = savedConfig.selectedAlbums;
				config.lines = savedConfig.lines;
				config.hintsEnabled = savedConfig.hintsEnabled;
			}

			const saveConfigToCache = () => {
				userConfigs.set(interaction.user.id, {
					...config,
					lastUpdated: Date.now(),
				});
			};

			const renderDashboard = () => {
				const isAllSelected = config.selectedAlbums.length === allAlbums.length;
				const albumText = isAllSelected
					? "Tous les albums (Aléatoire)"
					: `${config.selectedAlbums.length} albums sélectionnés`;
				const duelText = opponent
					? `⚔️ **DUEL** contre ${opponent.username}`
					: "🌍 Mode Solo / Public";

				const embed = new EmbedBuilder()
					.setTitle("🎛️ Configuration du Blind Test")
					.setDescription(
						`Configure ta partie avant de lancer !\n\n${duelText}`
					)
					.setColor(opponent ? 0xff0000 : 0x2b2d31)
					.addFields(
						{ name: "💿 Albums", value: albumText, inline: true },
						{ name: "📝 Lignes", value: `${config.lines}`, inline: true },
						{
							name: "💡 Indices",
							value: config.hintsEnabled ? "✅ Activés" : "❌ Désactivés",
							inline: true,
						}
					);

				const menuOptions = allAlbums
					.slice(0, 25)
					.map((alb: string) =>
						new StringSelectMenuOptionBuilder()
							.setLabel(alb)
							.setValue(alb)
							.setDefault(config.selectedAlbums.includes(alb))
					);
				const selectMenu = new StringSelectMenuBuilder()
					.setCustomId(ID_CONF_MODE)
					.setPlaceholder("Filtrer les albums...")
					.setMinValues(1)
					.setMaxValues(menuOptions.length)
					.addOptions(menuOptions);
				const btnLines = new ButtonBuilder()
					.setCustomId(ID_CONF_LINES)
					.setLabel(`Lignes : ${config.lines}`)
					.setStyle(ButtonStyle.Secondary)
					.setEmoji("✏️");
				const btnHints = new ButtonBuilder()
					.setCustomId(ID_CONF_HINTS)
					.setLabel(config.hintsEnabled ? "Indices : ON" : "Indices : OFF")
					.setStyle(
						config.hintsEnabled ? ButtonStyle.Success : ButtonStyle.Danger
					);
				const btnStart = new ButtonBuilder()
					.setCustomId(ID_CONF_START)
					.setLabel("Lancer")
					.setStyle(ButtonStyle.Primary)
					.setEmoji(opponent ? "⚔️" : "🚀");

				const row1 =
					new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
						selectMenu
					);
				const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
					btnLines,
					btnHints,
					btnStart
				);
				return { embeds: [embed], components: [row1, row2] };
			};

			const dashboardMsg = await interaction.editReply(renderDashboard());
			const confCollector = dashboardMsg.createMessageComponentCollector({
				filter: (i) => i.user.id === interaction.user.id,
				time: 60000,
			});

			confCollector.on("collect", async (i) => {
				if (i.customId === ID_CONF_MODE && i.isStringSelectMenu()) {
					config.selectedAlbums = i.values;
					saveConfigToCache();
					await i.update(renderDashboard());
				} else if (i.customId === ID_CONF_LINES) {
					const modal = new ModalBuilder()
						.setCustomId(ID_MODAL_LINES)
						.setTitle("Configuration des Lignes");
					const linesInput = new TextInputBuilder()
						.setCustomId(ID_INPUT_LINES)
						.setLabel("Lignes (1-5)")
						.setStyle(TextInputStyle.Short)
						.setPlaceholder("2")
						.setValue(config.lines.toString())
						.setMinLength(1)
						.setMaxLength(1)
						.setRequired(true);
					modal.addComponents(
						new ActionRowBuilder<TextInputBuilder>().addComponents(linesInput)
					);
					await i.showModal(modal);
					try {
						const sub = await i.awaitModalSubmit({
							filter: (s) =>
								s.customId === ID_MODAL_LINES && s.user.id === i.user.id,
							time: 30000,
						});
						const val = parseInt(sub.fields.getTextInputValue(ID_INPUT_LINES));
						config.lines = isNaN(val) || val < 1 || val > 5 ? 2 : val;
						saveConfigToCache();
						await sub.deferUpdate();
						await interaction.editReply(renderDashboard());
					} catch (e) {}
				} else if (i.customId === ID_CONF_HINTS) {
					config.hintsEnabled = !config.hintsEnabled;
					saveConfigToCache();
					await i.update(renderDashboard());
				} else if (i.customId === ID_CONF_START) {
					confCollector.stop("start");
					await i.update({
						content: opponent
							? `⚔️ **Duel lancé !**`
							: `✅ **Partie lancée !**`,
						embeds: [],
						components: [],
					});
					// Lancement initial: la série rapide est nulle
					runGame(channel, config, interaction.user, opponent, null);
				}
			});

			confCollector.on("end", (_, reason) => {
				if (reason !== "start") {
					activeGames.delete(channel.id);
					interaction
						.editReply({ content: "⏱️ Temps écoulé.", components: [] })
						.catch(() => {});
				}
			});
		} catch (error) {
			activeGames.delete(channel.id);
			interaction.editReply({ content: "❌ Erreur critique." }).catch(() => {});
		}
	},
};

// MODIFIE LA SIGNATURE DE runGame pour accepter l'état initial de la série rapide
async function runGame(
	channel: TextChannel,
	config: { selectedAlbums: string[]; lines: number; hintsEnabled: boolean },
	launcher: User,
	opponent: User | null,
	initialRapidStreak?: RapidStreak | null // NOUVEAU PARAMÈTRE
) {
	if (!activeGames.has(channel.id)) activeGames.add(channel.id);

	// Initialisation/persistance de la série rapide
	if (
		initialRapidStreak &&
		initialRapidStreak.count >= 1 &&
		initialRapidStreak.playerId
	) {
		rapidStreaks.set(channel.id, initialRapidStreak);
	} else {
		rapidStreaks.delete(channel.id);
	}

	let startMessage = opponent
		? `⚔️ **DUEL** : ${launcher} 🆚 ${opponent} !`
		: `🎶 *Recherche...*`;
	const loadingMsg = await channel.send(startMessage);

	const gameData = await getRandomSongSnippet(
		config.lines,
		config.selectedAlbums
	);

	if (!gameData) {
		activeGames.delete(channel.id);
		return loadingMsg.edit("❌ Erreur : Aucune chanson trouvée.");
	}

	console.log(
		`[GAME] 🎮 Partie active: "${gameData.title}" (Lignes: ${config.lines})`
	);

	let currentLines = config.lines;
	const hints = { album: false, pendu: false, lyricsAdded: 0 };

	const renderGame = () => {
		const currentSnippet = gameData.allLines
			.slice(gameData.startIndex, gameData.startIndex + currentLines)
			.join("\n");
		let footer = "Jeu illimité";
		if (hints.album) footer += ` • 💿 ${gameData.album}`;
		if (hints.pendu) footer += ` • 🔤 ${generateHangman(gameData.title)}`;

		const embedTitle = opponent
			? `⚔️ DUEL : ${launcher.username} vs ${opponent.username}`
			: "🎤 Blind Test : Taylor Swift";
		const embedColor = opponent ? 0xff0000 : 0x0099ff;

		const embed = new EmbedBuilder()
			.setTitle(embedTitle)
			.setDescription(
				`**De quelle chanson viennent ces paroles ?**\n\n> *${currentSnippet.replace(
					/\n/g,
					"\n> "
				)}*`
			)
			.setColor(embedColor)
			.setFooter({ text: footer });

		const row = new ActionRowBuilder<ButtonBuilder>();
		if (config.hintsEnabled) {
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(ID_GAME_HINT_ALBUM)
					.setLabel("💿 Album")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(hints.album)
			);
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(ID_GAME_HINT_PENDU)
					.setLabel("🔤 Pendu")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(hints.pendu)
			);
			const canAdd =
				gameData.startIndex + currentLines < gameData.allLines.length;
			row.addComponents(
				new ButtonBuilder()
					.setCustomId(ID_GAME_HINT_LYRICS)
					.setLabel("➕ Suite")
					.setStyle(ButtonStyle.Success)
					.setDisabled(!canAdd || hints.lyricsAdded >= 3)
			);
		}
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(ID_GAME_CANCEL)
				.setLabel("Abandonner")
				.setStyle(ButtonStyle.Danger)
		);

		return { embeds: [embed], components: [row] };
	};

	const gameMsg = await loadingMsg.edit(renderGame());

	// --- CHRONOMÉTRAGE DE LA RÉPONSE (START) ---
	const startTime = Date.now();
	// ------------------------------------------

	const msgCol = channel.createMessageCollector({
		filter: (m) => {
			if (m.author.bot) return false;
			if (opponent)
				return m.author.id === launcher.id || m.author.id === opponent.id;
			return true;
		},
	});
	const btnCol = gameMsg.createMessageComponentCollector();

	let winner: Message | null = null;

	btnCol.on("collect", async (i) => {
		if (opponent && i.user.id !== launcher.id && i.user.id !== opponent.id)
			return i.reply({ content: "🤫 Chut !", flags: MessageFlags.Ephemeral });

		if (i.customId === ID_GAME_CANCEL) {
			console.log(`[GAME] 🏳️ Abandon demandé par ${i.user.tag}`);
			msgCol.stop("cancel");
			await i.deferUpdate();
			return;
		}
		if (i.customId === ID_GAME_HINT_ALBUM) {
			hints.album = true;
		}
		if (i.customId === ID_GAME_HINT_PENDU) {
			hints.pendu = true;
		}
		if (i.customId === ID_GAME_HINT_LYRICS) {
			currentLines++;
			hints.lyricsAdded++;
		}
		await i.update(renderGame());
	});

	// --- CORRECTION CRITIQUE DE LA VALIDATION DE LA RÉPONSE ---
	msgCol.on("collect", (m) => {
		// 1. Nettoyer la réponse de l'utilisateur (en utilisant la fonction locale qui est robuste)
		const guess = normalizeString(m.content);
		// 2. Nettoyer le titre correct (en utilisant la fonction exportée du service)
		const answer = normalizeTitle(gameData.title);

		// 3. Validation : La réponse doit être strictement égale au titre normalisé.
		if (guess === answer) {
			// --- LOGIQUE DE GESTION DE LA SÉRIE RAPIDE (Multi-Kill Stop Reason) ---
			const timeElapsed = Date.now() - startTime;
			const isFastKill = timeElapsed <= RAPID_STREAK_WINDOW_MS;

			const stopReason = isFastKill ? "fast_winner" : "winner";
			// ----------------------------------------------------------------------

			winner = m;
			msgCol.stop(stopReason);
			btnCol.stop();
		}
	});
	// -----------------------------------------------------------

	const getEndGameComponents = () => {
		const row = new ActionRowBuilder<ButtonBuilder>();
		row.addComponents(
			new ButtonBuilder()
				.setLabel("Voir sur Genius")
				.setStyle(ButtonStyle.Link)
				.setURL(gameData.url)
				.setEmoji("📜")
		);
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(ID_GAME_REPLAY)
				.setLabel("🔄 Rejouer")
				.setStyle(ButtonStyle.Secondary)
		);
		return [row];
	};

	msgCol.on("end", (_, reason) => {
		activeGames.delete(channel.id);
		(async () => {
			await gameMsg.edit({ components: [] }).catch(() => {});
			let endEmbed: EmbedBuilder;

			// --- DÉCLARATIONS DE SÉRIE ---
			const currentStreak = winStreaks.get(channel.id) || {
				playerId: "",
				count: 0,
			};
			let currentRapid = rapidStreaks.get(channel.id) || {
				playerId: "",
				count: 0,
			};
			const channelId = channel.id;

			const isFastKill = reason === "fast_winner";

			// État à passer à la prochaine partie (initialisé à null si non conservé)
			let finalRapidStreak: RapidStreak | null = null;

			if ((reason === "winner" || reason === "fast_winner") && winner) {
				// --- 1. GESTION DE LA SÉRIE CONSÉCUTIVE (STREAK: Killing Spree, etc.) ---
				if (winner.author.id === currentStreak.playerId) {
					currentStreak.count++;
				} else {
					currentStreak.playerId = winner.author.id;
					currentStreak.count = 1;
				}
				winStreaks.set(channelId, currentStreak);

				// --- 2. GESTION DE LA SÉRIE RAPIDE (MULTI-KILL: Doublé, Triplé, etc.) ---
				if (isFastKill && winner.author.id === currentRapid.playerId) {
					currentRapid.count++;
				} else if (isFastKill) {
					// Nouveau début de série rapide
					currentRapid = { playerId: winner.author.id, count: 1 };
				} else {
					// Victoire lente, réinitialise la série rapide
					rapidStreaks.delete(channelId);
					currentRapid = { playerId: "", count: 0 }; // Réinitialisation de l'objet pour les vérifs suivantes
				}

				// Si la série rapide est valide (> 1 ou 1 rapide qui vient de commencer), on la prépare pour la relance
				if (currentRapid.count >= 1) {
					rapidStreaks.set(channelId, currentRapid);
					finalRapidStreak = currentRapid;
				}

				// --- CONTRUCTION DE L'EMBED DE RÉSULTAT ---
				endEmbed = new EmbedBuilder()
					.setTitle(
						opponent
							? `🏆 ${winner.author.username} remporte le duel !`
							: "🎉 Bonne réponse !"
					)
					.setDescription(
						`Bravo ${winner.author} !\nC'était **${gameData.title}**\nAlbum : *${gameData.album}*`
					)
					.setThumbnail(gameData.cover)
					.setColor(0x00ff00);

				// Envoi de l'Embed de résultat
				const replyMessage = await winner
					.reply({ embeds: [endEmbed], components: getEndGameComponents() })
					.catch(() => {});

				console.log(
					`[GAME] 🏆 Victoire: ${winner.author.tag} (Série: ${currentStreak.count}, Rapide: ${currentRapid.count})`
				);

				// --- GESTION DES ANNONCES DANS UN NOUVEL EMBED ---
				let announcementEmbed: EmbedBuilder | null = null;

				// CRÉATION DE LA MENTION UTILISATEUR POUR LE TAG DANS L'EMBED
				const userTag = winner.author.toString();

				// A) Annonce de la Série Consécutive (Killing Spree)
				const streakAnnouncement = STREAK_ANNOUNCEMENTS.sort(
					(a, b) => b.threshold - a.threshold
				).find((a) => a.threshold <= currentStreak.count);

				if (streakAnnouncement) {
					const title = streakAnnouncement.message;
					// Remplacement de ${userTag} par la mention
					const description = streakAnnouncement.description.replace(
						"${userTag}",
						userTag
					);
					announcementEmbed = createAnnouncementEmbed(
						title,
						description,
						streakAnnouncement.color // ⬅️ Utilisation de la couleur définie, y compris l'Or pour 13
					);
				}

				// B) Annonce Multikill (Doublé, Triplé)
				// On affiche si le compteur rapide est >= 2 ET si la victoire était rapide (pour garantir le chrono)
				if (currentRapid.count >= 2 && isFastKill) {
					const rapidAnnouncement = MULTIKILL_ANNOUNCEMENTS.sort(
						(a, b) => b.threshold - a.threshold
					).find((a) => a.threshold === currentRapid.count);

					if (rapidAnnouncement) {
						const title = rapidAnnouncement.message;
						// Remplacement de ${userTag} par la mention
						const description = rapidAnnouncement.description.replace(
							"${userTag}",
							userTag
						);

						// Si l'Embed de Streak existe déjà, nous ajoutons l'annonce rapide à celui-ci
						if (announcementEmbed) {
							announcementEmbed.addFields({
								name: title,
								value: description,
								inline: false,
							});
						} else {
							// Sinon, on crée un nouvel Embed uniquement pour la rapidité
							announcementEmbed = createAnnouncementEmbed(
								title,
								description,
								0x00bfff
							); // Bleu clair pour la rapidité
						}
					}
				}

				// Envoi de l'Embed d'Annonce (Série / Rapidité) après l'Embed de résultat
				if (announcementEmbed && replyMessage) {
					await channel
						.send({ embeds: [announcementEmbed] })
						.catch(console.error);
				}
			} else if (reason === "cancel" || reason === "time") {
				// --- GESTION DE LA FIN DE SÉRIE ---
				if (currentStreak.count >= 3 && currentStreak.playerId) {
					const userName =
						channel.client.users.cache.get(currentStreak.playerId)?.username ||
						"un joueur";
					const embedReset = createAnnouncementEmbed(
						"🛑 SÉRIE INTERROMPUE !",
						`La série de **${currentStreak.count}** victoires de **${userName}** est terminée.`,
						0xff0000
					);
					await channel.send({ embeds: [embedReset] }).catch(console.error);
				}
				// Réinitialiser les deux séries pour tout abandon ou timeout
				winStreaks.delete(channelId);
				rapidStreaks.delete(channelId);
				// finalRapidStreak reste null
				console.log(
					`[GAME] ❌ Partie annulée/abandonnée. Séries réinitialisées.`
				);

				// --- EMBED D'ABANDON ---
				endEmbed = new EmbedBuilder()
					.setTitle(opponent ? "🏳️ Duel annulé" : "🚨 Partie Abandonnée")
					.setDescription(
						`La réponse était **${gameData.title}**\nAlbum : *${gameData.album}*`
					)
					.setThumbnail(gameData.cover)
					.setColor(0xff0000);
				await channel
					.send({ embeds: [endEmbed], components: getEndGameComponents() })
					.catch(() => {});
			}

			const replayFilter = (i: MessageComponentInteraction) => {
				if (opponent)
					return i.user.id === launcher.id || i.user.id === opponent.id;
				return !i.user.bot;
			};

			const replayCollector = channel.createMessageComponentCollector({
				filter: (i) => i.customId === ID_GAME_REPLAY && replayFilter(i),
				time: 30000,
			});

			replayCollector.on("collect", async (i) => {
				if (activeGames.has(channel.id)) {
					await i.reply({
						content: "🚫 Une partie a déjà redémarré !",
						flags: MessageFlags.Ephemeral,
					});
					return;
				}
				replayCollector.stop();
				await i.reply({
					content: "🔄 Relance de la partie avec les mêmes paramètres...",
					flags: MessageFlags.Ephemeral,
				});
				// PASSAGE DE L'ÉTAT RAPIDE LORS DU REJEU
				runGame(channel, config, launcher, opponent, finalRapidStreak);
			});
		})();
	});
}
