import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import VerificationCommand from "../templates/template_command";
import { get_player, set_verified } from "../utilities/util_database";

export default class VerifyCommand extends VerificationCommand {

    public command_configuration(): SlashCommandBuilder {
        const command_builder = new SlashCommandBuilder()
            .setName("verify")
            .setDescription("Verify a player's username.");
        command_builder.addStringOption(option => option
            .setName("name")
            .setDescription("Username of the player.")
            .setRequired(true)
        );
        command_builder.addBooleanOption(option => option
            .setName("verified")
            .setDescription("Verification status of the player.")
            .setRequired(true)
        );
        return command_builder;
    }

    public async command_trigger(command_interaction: ChatInputCommandInteraction): Promise<void> {
        await command_interaction.deferReply();
        // get players
        const player_username = command_interaction.options.getString("name", true);
        const player_verified = command_interaction.options.getBoolean("verified", true);
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
        await set_verified(player_username, player_verified);
        await command_interaction.editReply("OK!");
    }
}