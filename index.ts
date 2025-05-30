import { ActivityType, Client, ClientUser, GatewayIntentBits, REST, Routes } from "discord.js";
import * as Mongoose from "mongoose";
import * as dotenv from "dotenv";
import Registry from "./objects/object_registry";
import RateCommand from "./commands/command_rate";
import InteractionCreateEvent from "./events/event_interaction_create";

dotenv.config();

const Backend = {
    server_database: Mongoose,
    server_registry: new Registry(),
    server_rest:     new REST({version: "10"}).setToken(process.env.APPLICATION_TOKEN as string),
    server_client:   new Client({intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]})
};

(async () => {
    // database
    await Backend.server_database.connect(process.env.MONGODB_URI as string, {
        authSource: "admin",
        user:       process.env.MONGODB_USERNAME as string,
        pass:       process.env.MONGODB_PASSWORD as string
    });
    // registry
    Backend.server_registry.register([
        new InteractionCreateEvent(),
        new (await import("./commands/command_rate")).default()
    ]);
    // hook signatures
    for (const event_signature of Backend.server_registry.event_signatures()) Backend.server_client.on(event_signature.event_configuration().name, async (...args) => await event_signature.event_trigger(...args));
    // rest
    await Backend.server_rest.put(Routes.applicationCommands(process.env.APPLICATION_ID as string), {body: Backend.server_registry.command_signatures()});
    // client
    await Backend.server_client.login(process.env.APPLICATION_TOKEN as string);
    (Backend.server_client.user as ClientUser).setPresence({
        status: "online",
        activities: [{
            name: "Flagwars (/help)",
            type: ActivityType.Playing,
        }]
    });
})();

export default Backend;