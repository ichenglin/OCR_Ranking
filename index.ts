import { ActivityType, Client, ClientUser, GatewayIntentBits, REST, Routes } from "discord.js";
import * as dotenv from "dotenv";
import Registry from "./objects/registry";
import MessageCreateEvent from "./events/event_message_create";

dotenv.config();

// registry
export const verification_registry = new Registry();
verification_registry.register([
    new MessageCreateEvent()
]);

// rest
const discord_rest = new REST({version: "10"}).setToken(process.env.APPLICATION_TOKEN as string);

// client
const discord_client = new Client({intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
]});
for (const event_signature of verification_registry.event_signatures()) discord_client.on(event_signature.event_configuration().name, async (...args) => await event_signature.event_trigger(...args));

(async () => {
    await discord_rest.put(Routes.applicationCommands(process.env.APPLICATION_ID as string), {body: verification_registry.command_signatures()});
    await discord_client.login(process.env.APPLICATION_TOKEN as string);
    (discord_client.user as ClientUser).setPresence({
        status: "online",
        activities: [{
            name: "Flagwars (/help)",
            type: ActivityType.Playing,
        }]
    });
})();