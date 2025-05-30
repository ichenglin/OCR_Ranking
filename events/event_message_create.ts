import { EmbedBuilder, Events, Message } from "discord.js";
import VerificationEvent from "../templates/template_event";
import { ImageManager } from "../managers/manager_image";
import { RecognitionManager, RecognitionPlayer } from "../managers/manager_recognition";
import { RatingManager, RatingPlayer } from "../managers/manager_rating";

export default class MessageCreateEvent extends VerificationEvent {

    public event_configuration(): {name: string} {
        return {
            name: Events.MessageCreate
        };
    }

    public async event_trigger(message: Message): Promise<void> {
        if (message.author.bot       === true)   return;
        if (message.content          !== "rank") return;
        if (message.attachments.size !==  1)     return;
        // get attachment image url
        const image_url = message.attachments.at(0)?.url;
        if (image_url === undefined) return;
        // read stats from image
        const manager_image       = new ImageManager();
        const manager_recognition = new RecognitionManager();
        await manager_image.image_load(image_url);
        const round_result = await manager_recognition.recognize_image(manager_image.image_grayscale(), manager_image.image_locate());
        const round_rating = await RatingManager.rating_update(round_result);
        // respond
        const rank_embed = new EmbedBuilder()
            .setTitle("Rating Update")
            .setDescription("**NOTE:** Player score and KDR are experimental features and not taken into account for one's rating.")
            .addFields([
                {
                    name: "⌛ Round Information",
                    value: [
                        `<:dot_blue:1377733347677306980> Timer: \`${this.round_timer(round_result.round_timer)}\``,
                        `<:dot_blue:1377733347677306980> Red Score: \`${round_result.score_red} pts\` ${(round_result.score_red > round_result.score_blue) ? "(🏅)" : ""}`,
                        `<:dot_blue:1377733347677306980> Blue Score: \`${round_result.score_blue} pts\` ${(round_result.score_red < round_result.score_blue) ? "(🏅)" : ""}`
                    ].join("\n"),
                    inline: true
                },
                {
                    name: "🎯 Round Likelihood",
                    value: [
                        `<:dot_blue:1377733347677306980> Draw: \`${(round_rating.probability.draw * 100).toFixed(1)}%\` (Quality)`,
                        `<:dot_blue:1377733347677306980> Red Win: \`${(round_rating.probability.win_red * 100).toFixed(1)}%\``,
                        `<:dot_blue:1377733347677306980> Blue Win: \`${(round_rating.probability.win_blue * 100).toFixed(1)}%\``
                    ].join("\n"),
                    inline: true
                },
                {
                    name: "",
                    value: ""
                },
                {
                    name: "🟥 Team Red",
                    value: "** **\n" + round_result.players_red.map((team_player, player_index) => this.player_summary(team_player, round_rating.players_red[player_index])).join("\n\n"),
                    inline: true
                },
                {
                    name: "🟦 Team Blue",
                    value: "** **\n" + round_result.players_blue.map((team_player, player_index) => this.player_summary(team_player, round_rating.players_blue[player_index])).join("\n\n"),
                    inline: true
                }
            ])
            .setImage(image_url)
            .setTimestamp()
            .setFooter({text: `requested by ${message.author.tag}`, iconURL: message.client.user.displayAvatarURL()})
            .setColor("#84cc16");
        await message.reply({embeds: [rank_embed]});
    }

    private round_timer(round_seconds: number): string {
        return `${Math.floor(round_seconds / 60)}m ${round_seconds % 60}s`;
    }

    private player_summary(player_stats: RecognitionPlayer, player_rating: RatingPlayer): string {
        // player rating trend
        const player_rating_old   = player_rating.player_rating_old.mu;
        const player_rating_new   = player_rating.player_rating_new.mu;
        let   player_rating_trend = "";
             if (player_rating_new > player_rating_old) player_rating_trend = "(🔺)";
        else if (player_rating_new < player_rating_old) player_rating_trend = "(🔻)";
        // player kdr
        const player_kdr = ((player_stats.player_deaths > 0) ? (player_stats.player_kills / player_stats.player_deaths) : player_stats.player_kills);
        return [
            player_stats.player_bot || `🪖 **${player_stats.player_username}**`,
            player_stats.player_bot && `🤖 **${player_stats.player_username}**`,
            player_stats.player_bot || `<:dot_blue:1377733347677306980> Rating: \`${player_rating_old.toFixed(1)}\` ➤ \`${player_rating_new.toFixed(1)}\` ${player_rating_trend}`,
            player_stats.player_bot && `<:dot_blue:1377733347677306980> Rating: \`Not Updated\` (**NPC**)`,
            `<:dot_blue:1377733347677306980> Score: \`${player_stats.player_score}\` KDR: \`${player_kdr.toFixed(1)}\``
        ].filter(summary_line => ((typeof summary_line) === "string")).join("\n");
    }
}