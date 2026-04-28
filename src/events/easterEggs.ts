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

		//contient alex ou alexina (n'importe où, mais en mot entier)
		const isAlex = /\balex\b/.test(content) || /\balexina\b/.test(content);

		const isChichi = /\bchichi\b/.test(content) || /\blaura\b/.test(content);

		const isMani =
			/\bmani\b/.test(content) ||
			/\bmanon\b/.test(content) ||
			/\bmanu\b/.test(content) ||
			/\bmartine\b/.test(content);

		const isChiara =
			/\bchiara\b/.test(content) || /\breinettpd\b/.test(content);

		const isClarisse = /\bclarisse\b/.test(content);

		const isCarotte = /\bcarotte\b/.test(content) || /\bdamien\b/.test(content);

		const isAlexandra = /\balexandra\b/.test(content);

		// 4. regex si le message contient le mot vinylecord (n'importe où, mais en mot entier)
		const hasVinylecord = /\bvinylcord\b/.test(content);

		if (isCoquin || hasGrrr || isGourmand) {
			// Lien direct .gif de media1.tenor.com pour l'affichage propre
			await message.reply(
				"https://tenor.com/view/sabrina-carpenter-sabrina-carpenter-snl-sabrina-snl-bite-lip-flirt-gif-12600428547893134085",
			);
		} else if (content === "!conne") {
			await message.reply(
				"https://revuedelatoile.fr/wp-content/uploads/2025/09/Miniatures-Wordpress-Revue-de-la-Toile25.png",
			);
		} else if (content === "!chan") {
			await message.reply("https://tenor.com/3Lul.gif");
		} else if (content === "!lire") {
			await message.reply("https://tenor.com/3Lul.gif");
		} else if (hasVinylecord || content === "!vinylcord") {
			await message.reply(
				"https://tenor.com/view/simon-xcx-dog-licking-gif-19464467",
			);
		} else if (isAlexandra || content === "!alexandra") {
			const gifs = [
				"https://tenor.com/hHvqzIZZIwE.gif",
				"https://tenor.com/jjTCj92orI1.gif",
				"https://tenor.com/t0d05tdcB3o.gif",
				"https://tenor.com/f4pkJ6BW7ei.gif",
				"https://tenor.com/u3qv3CPudKa.gif",
			];
			const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
			await message.reply(randomGif);
		} else if (content === "!alex" || isAlex) {
			const gifs = [
				//Frites
				"https://tenor.com/bDXqC.gif",
				"https://tenor.com/pVCdmoRaYNH.gif",
				"https://tenor.com/8pDU.gif",
				"https://tenor.com/bWSmj.gif",
				//Alcool
				"https://tenor.com/k931MVensmk.gif",
				"https://tenor.com/bVw7D.gif",
				"https://tenor.com/bvAqo.gif",
				//alex
				"https://tenor.com/t47WdcTog4G.gif",
				//Taylorswift fearless
				"https://tenor.com/usZLuyNceGJ.gif",
				"https://tenor.com/jW4nclXLOWa.gif",
				"https://tenor.com/iNiQTB8W3LA.gif",
				"https://tenor.com/jDKZ8diPGnq.gif",
				"https://tenor.com/cU0PM7yNawM.gif",
				"https://tenor.com/macsYNTEVLH.gif",
				"https://tenor.com/l2pXK0fASri.gif",
				"https://tenor.com/HYuP.gif",
				"https://tenor.com/kJQgNvjPYOM.gif",
				"https://tenor.com/baNa9.gif",
				"https://tenor.com/oHvpTBR3f6S.gif",
				"https://tenor.com/8mtY.gif",
				"https://tenor.com/oHvpTBR3f6S.gif",
				"https://tenor.com/bw3ZO.gif",
				"https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbWJ0c3Q3ZWZ3aXd2MjhqbGFiZmZxenp4N2Q1cmlpeXJ0MmZtMGRvdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT0Cym7rG3H60ppjgc/giphy.gif",
				"https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHUxbmh3bzM1c2t2c3Z0ZXhsYm1venRpdHFpM2xvbDV1MjVtbnM3YyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT0CyCetrtkdvFmxOw/giphy.gif",
				//Gracie Abrams
				"https://tenor.com/gB9FgmWrJYd.gif",
				"https://tenor.com/fuVVYNvUZlL.gif",
				"https://tenor.com/nv0VTH4qv2R.gif",
				"https://tenor.com/b1ZoW.gif",
				"https://tenor.com/bUuWA.gif",
				"https://tenor.com/bUoDd.gif",
				"https://tenor.com/rBpEk3H32Ps.gif",
				"https://tenor.com/qKHtq0ekFzl.gif",
				"https://tenor.com/b1uQi.gif",
				"https://tenor.com/bWiF5.gif",
				"https://tenor.com/eK27ZAqbAoL.gif",
				"https://tenor.com/bUoDd.gif",
				//Louis Tomlinson
				"https://tenor.com/bQzCV.gif",
				"https://tenor.com/iwX6C9tu2hD.gif",
				"https://tenor.com/iwX6C9tu2hD.gif",
				"https://tenor.com/ncGc6WSPJJU.gif",
				"https://tenor.com/blFgb.gif",
				"https://tenor.com/bnCUY.gif",
				"https://tenor.com/hD9leZomEvo.gif",
				"https://tenor.com/veeT8OPE49v.gif",
				"https://tenor.com/84YD.gif",
				"https://tenor.com/bIkGC.gif",
				"https://tenor.com/l9lcMYRh5Jb.gif",
			];
			const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
			await message.reply(randomGif);
		} else if (content === "!chichi" || content === "!laura" || isChichi) {
			const gifs = [
				//Technologie
				"https://tenor.com/7xVq.gif",
				"https://tenor.com/zd5T.gif",
				"https://tenor.com/bs0Ka.gif",
				"https://tenor.com/bEPzw.gif",
				"https://tenor.com/em9AGuoP1XR.gif",
				//Taylor Swift Debut
				"https://tenor.com/rBZez6pfSl9.gif",
				"https://tenor.com/byi07.gif",
				"https://tenor.com/cr1iKyjL6tX.gif",
				"https://tenor.com/bCiBFaEqPyj.gif",
				"https://tenor.com/s8w1.gif",
				"https://tenor.com/rhFV586P7Vt.gif",
				"https://tenor.com/oy7Aw2pUYnN.gif",
				"https://tenor.com/hJ7vPs2dORh.gif",
				"https://tenor.com/bX2ca.gif",
				"https://tenor.com/dfv8AkXyRhd.gif",
				// The Neighbourhood
				"https://tenor.com/EqWF.gif",
				"https://tenor.com/poqpZ4fcoko.gif",
				//Star Academy
				"https://tenor.com/vDzk9DgRhzU.gif",
				"https://tenor.com/qtBZVCA1jHP.gif",
				"https://tenor.com/kU6y84mdkFh.gif",
				"https://tenor.com/l7KJQVGSX60.gif",
				"https://tenor.com/cmpujzPl3wU.gif",
				//Sombr
				"https://tenor.com/nDPVxSq2btX.gif",
				"https://tenor.com/uHfqI0DlSzX.gif",
				"https://tenor.com/e3eG0VvAG8U.gif",
				"https://tenor.com/vMcDzT6ZJnA.gif",
			];
			const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
			await message.reply(randomGif);
		} else if (content === "clarisse" || isClarisse) {
			const gifs = [
				//Anouk
				"https://tenor.com/dvgqAYxL23F.gif",
				"https://tenor.com/nR2f4cJ6nSG.gif",
				"https://tenor.com/nqH9kMDOggz.gif",
				"https://tenor.com/d8VG2uI7zVE.gif",
				"https://tenor.com/dzD5Pc7JbQc.gif",
				"https://tenor.com/nR2f4cJ6nSG.gif",
				"https://tenor.com/Ln9fhPxOOG.gif",
				//Taylor Swift Reputation
				"https://tenor.com/rY9gU3CInjh.gif",
				"https://tenor.com/uYNozHrxmbf.gif",
				"https://tenor.com/bHEOR.gif",
				"https://tenor.com/c2kzUKcn795.gif",
				"https://tenor.com/ol31Yem9Qr2.gif",
				"https://tenor.com/bPnwW.gif",
				"https://tenor.com/qBa2v39dS3A.gif",
				"https://tenor.com/Osfj.gif",
				"https://tenor.com/nMw7r36DJjX.gif",
				"https://tenor.com/ks2XhCFoAag.gif",
				"https://tenor.com/buy6e.gif",
				// Louis Tomlinson
				"https://tenor.com/qC75ZjtKkYq.gif",
				"https://tenor.com/OGhg2xu7NK.gif",
				"https://tenor.com/OGhg2xu7NK.gif",
				"https://tenor.com/nb97EdWnhgB.gif",
				"https://tenor.com/nqwdyZ92uYo.gif",
				"https://tenor.com/84YL.gif",
				"https://tenor.com/bfANG.gif",
				"https://tenor.com/pip9kVTNmTu.gif",
				"https://tenor.com/bJA9u.gif",
			];
			const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
			await message.reply(randomGif);
		} else if (
			content === "!mani" ||
			content === "!manon" ||
			content === "!manu" ||
			content === "!martine" ||
			isMani
		) {
			const gifs = [
				//Taylor Swift 1989
				"https://tenor.com/jhsTExNP3Ze.gif",
				"https://tenor.com/oTM9vtPBObK.gif",
				"https://tenor.com/cWGkdm8Ue0P.gif",
				"https://tenor.com/EijyakVjUn.gif",
				"https://tenor.com/vfQxqK2YpTj.gif",
				"https://tenor.com/uRyWsFmOHmp.gif",
				"https://tenor.com/vyr4.gif",
				"https://tenor.com/dgzFHnBrkBn.gif",
				"https://tenor.com/p0Z8HuXZDxU.gif",
				//Olympique de Marseille
				"https://tenor.com/XNtr.gif",
				"https://tenor.com/dF7IctUNhXU.gif",
				"https://tenor.com/bXIdM.gif",
				"https://tenor.com/lLyb9nxazp2.gif",
				//Sfera Ebbasta
				"https://tenor.com/btmL2.gif",
				"https://tenor.com/SLkk.gif",
				"https://tenor.com/bMEoC.gif",
				"https://tenor.com/bMEog.gif",
				"https://tenor.com/bjqLr.gif",
				"https://tenor.com/g7MPeAmuZRg.gif",
				//Halsey
				"https://tenor.com/j449mtvviqB.gif",
				"https://tenor.com/ny0rUeeFPP9.gif",
				"https://tenor.com/cmesq0Sa2r2.gif",
				"https://tenor.com/bgo1u.gif",
				"https://tenor.com/whLg.gif",
				"https://tenor.com/bF9FT.gif",
				"https://tenor.com/rXilgGLaOQ0.gif",
				"https://tenor.com/bYMju.gif",
				"https://tenor.com/whQO.gif",
				"https://tenor.com/bslTg.gif",
				"https://tenor.com/dke8ub4nOV0.gif",
			];
			const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
			await message.reply(randomGif);
		} else if (content === "!chiara" || content === "!reinettpd" || isChiara) {
			const gifs = [
				//Taylor Swift TTPD
				"https://tenor.com/kwVkBMXhlzP.gif",
				"https://tenor.com/p9Ugd4lFxWg.gif",
				"https://tenor.com/hqQxrhE9Lfj.gif",
				"https://tenor.com/c3vCiArxTnb.gif",
				"https://tenor.com/jct4tDNxa9D.gif",
				"https://tenor.com/nG7woTdRAQW.gif",
				"https://tenor.com/gqAiyMvLzs7.gif",
				"https://tenor.com/c7LnN38ea38.gif",
				"https://tenor.com/h2H0QGpQdVb.gif",
				"https://tenor.com/jl2Jj22TdEa.gif",
				"https://tenor.com/eDYl78mPQEA.gif",
				"https://tenor.com/mTmltmObZbG.gif",
				//Hate
				"https://tenor.com/bEUA9.gif",
				"https://tenor.com/bppy2.gif",
				"https://tenor.com/bIdx2.gif",
				"https://tenor.com/s9Gk.gif",
				"https://tenor.com/sJPPZt8N55U.gif",
				"https://tenor.com/bU5Qa.gif",
			];
			const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
			await message.reply(randomGif);
		} else if (content === "!carotte" || content === "!damien" || isCarotte) {
			const gifs = [
				//Taylor Swift Midnights
				"https://tenor.com/bonVW665YMI.gif",
				"https://tenor.com/r4edN4V4MpQ.gif",
				"https://tenor.com/f3CZ7tFJfm5.gif",
				"https://tenor.com/sOB6kxgaGlB.gif",
				"https://tenor.com/vlNu4ququLH.gif",
				"https://tenor.com/pYPBlgXebHN.gif",
				"https://tenor.com/p4O0bWbMVg0.gif",
				"https://tenor.com/czlL7c0vVFv.gif",
				"https://tenor.com/ufV1KkivZcQ.gif",
				//Tate McRae
				"https://tenor.com/bYjL1.gif",
				"https://tenor.com/bVAVD.gif",
				"https://tenor.com/bZ45H.gif",
				"https://tenor.com/ne77DNoLFgx.gif",
				"https://tenor.com/jwr6uyAZSvc.gif",
				"https://tenor.com/uBtAsTfuHAk.gif",
				"https://tenor.com/fnFxg7yIJyj.gif",
				//Adele Castillon
				"https://tenor.com/pSjCDKyLMBf.gif",
				//Carotte
				"https://tenor.com/j3o7lpf3F8W.gif",
				"https://tenor.com/wi0L.gif",
				//random
				"https://tenor.com/iZZMvnGGDwi.gif",
				"https://tenor.com/biv1n.gif",
				"https://tenor.com/o9nB.gif",
				//insomnia
				"https://tenor.com/o5Q6FAavM3b.gif",
				"https://tenor.com/bRAMk.gif",
				"https://tenor.com/hHvqzIZZIwE.gif",
			];
			const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
			await message.reply(randomGif);
		}
	},
};
