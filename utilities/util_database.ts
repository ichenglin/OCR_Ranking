import { InferSchemaType } from "mongoose";
import { Rating } from "ts-trueskill";
import Backend from "..";

const DatabaseRatingSchema = new Backend.server_database.Schema({
    mu:    {type: Number, required: true},
    sigma: {type: Number, required: true}
});
const DatabasePlayerSchema = new Backend.server_database.Schema({
    username: {type: String,               required: true},
    key:      {type: String,               required: true},
    level:    {type: Number,               required: true},
    rating:   {type: DatabaseRatingSchema, required: true},
    updated:  {type: Date,                 required: true}
});

const DatabasePlayerModel = Backend.server_database.models.players || Backend.server_database.model("players", DatabasePlayerSchema);
export interface DatabasePlayer extends Omit<InferSchemaType<typeof DatabasePlayerSchema>, "rating"|"updated"> {
    rating:  Rating,
    updated: Date,
    valid:   boolean
};

export async function set_player(player_username: string, player_level: number, player_rating: Rating): Promise<DatabasePlayer> {
    const player_object  = get_serialized(await DatabasePlayerModel.findOneAndUpdate({
        key: player_username.toLowerCase()
    }, {$set: {
        username: player_username,
        key:      player_username.toLowerCase(),
        level:    player_level,
        rating: {
            mu:    player_rating.mu,
            sigma: player_rating.sigma
        },
        updated: new Date()
    }}, {
        upsert: true,
        new:    true,
        projection: {_id: 0, __v: 0}
    })) as InferSchemaType<typeof DatabasePlayerSchema>;
    return convert_player(player_object);
}

export async function get_player(player_username: string): Promise<DatabasePlayer | null> {
    const player_object  = get_serialized(await DatabasePlayerModel.findOne({
        key: player_username.toLowerCase()
    }, undefined, {
        projection: {_id: 0, __v: 0}
    })) as (InferSchemaType<typeof DatabasePlayerSchema> | null);
    if (player_object === null) return null;
    return convert_player(player_object);
}

function convert_player(player_object: InferSchemaType<typeof DatabasePlayerSchema>): DatabasePlayer {
    const player_data = Object.assign({}, player_object) as InferSchemaType<typeof DatabasePlayerSchema>;
    (player_data as DatabasePlayer).rating  = new Rating(player_data.rating.mu, player_data.rating.sigma);
    (player_data as DatabasePlayer).updated = new Date(player_data.updated);
    (player_data as DatabasePlayer).valid   = true;
    return (player_data as DatabasePlayer);
}

function get_serialized<DatabaseContent>(database_content: DatabaseContent): DatabaseContent {
    return JSON.parse(JSON.stringify(database_content));
}