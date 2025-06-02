import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import VerificationCommand from "../templates/template_command";
import { get_player } from "../utilities/util_database";
import { expose } from "ts-trueskill";

export default class PlayerCommand extends VerificationCommand {

    public command_configuration(): SlashCommandBuilder {
        const command_builder = new SlashCommandBuilder()
            .setName("player")
            .setDescription("Retrieve a player's information and rating.");
        command_builder.addStringOption(option => option
            .setName("name")
            .setDescription("Username of the player.")
            .setRequired(true)
        );
        return command_builder;
    }

    public async command_trigger(command_interaction: ChatInputCommandInteraction): Promise<void> {
        await command_interaction.deferReply();
        // get players
        const player_username = command_interaction.options.getString("name", true);
        const player_rating   = await get_player(player_username);
        if (player_rating === null) {
            // invalid player
            const invalid_embed = new EmbedBuilder()
                .setTitle("⛔ Player Not Found ⛔")
                .setDescription(`**No records were found** for the player with username \`${player_username}\`. Please try again later. \`(ERR_USR_INV)\``)
                .setTimestamp()
                .setFooter({text: `requested by ${command_interaction.user.tag}`, iconURL: command_interaction.client.user.displayAvatarURL()})
                .setColor("#ef4444");
            await command_interaction.editReply({embeds: [invalid_embed]});
            return;
        }
        const player_embed = new EmbedBuilder()
            .setTitle(`🪖 ${player_rating.username}'s Stats 🪖`)
            .setDescription("A player's rating reflects their estimated skill level, improving in accuracy as **more rounds** were played.")
            .addFields([
                {
                    name: "🪪 Information",
                    value: [
                        `<:db:1377733347677306980> Level: \`${player_rating.level}\``,
                        `<:db:1377733347677306980> Verified: \`${player_rating.verified ? "Yes" : "No"}\``,
                        `<:db:1377733347677306980> Updated: \`${player_rating.updated.toDateString()}\``
                    ].join("\n"),
                    inline: true
                },
                {
                    name: "💯 Records",
                    value: [
                        `<:db:1377733347677306980> Rating: \`${expose(player_rating.rating).toFixed(2)}\``,
                        `<:db:1377733347677306980> Played: \`${player_rating.updates} rounds\``
                    ].join("\n"),
                    inline: true
                }
            ])
            .setTimestamp()
            .setFooter({text: `requested by ${command_interaction.user.tag}`, iconURL: command_interaction.client.user.displayAvatarURL()})
            .setColor("#84cc16");
        await command_interaction.editReply({embeds: [player_embed]});
    }
}