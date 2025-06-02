import { InferSchemaType } from "mongoose";
import { Rating } from "ts-trueskill";
import Backend from "..";
import { RecognitionPlayer } from "../managers/manager_recognition";

const DatabaseRatingSchema = new Backend.server_database.Schema({
    mu:    {type: Number, required: true},
    sigma: {type: Number, required: true}
});
const DatabasePlayerSchema = new Backend.server_database.Schema({
    username: {type: String,               required: true},
    key:      {type: String,               required: true},
    level:    {type: Number,               required: true},
    rating:   {type: DatabaseRatingSchema, required: true},
    updates:  {type: Number,               required: true},
    updated:  {type: Date,                 required: true},
    verified: {type: Boolean,              required: true}
});

const DatabasePlayerModel = Backend.server_database.models.players || Backend.server_database.model("players", DatabasePlayerSchema);
export interface DatabasePlayer extends Omit<InferSchemaType<typeof DatabasePlayerSchema>, "rating"|"updated"> {
    rating:  Rating,
    updated: Date,
    valid:   boolean
};

export async function set_player(recognition_data: RecognitionPlayer, database_data: DatabasePlayer, player_rating: Rating): Promise<DatabasePlayer> {
    const player_object  = get_serialized(await DatabasePlayerModel.findOneAndUpdate({
        key: database_data.username.toLowerCase()
    }, {$set: {
        username: database_data.username,
        key:      database_data.username.toLowerCase(),
        level:    recognition_data.player_level,
        rating: {
            mu:    player_rating.mu,
            sigma: player_rating.sigma
        },
        updated:  new Date(),
        verified: database_data.verified
    }, $inc: {
        updates: 1
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

export async function set_verified(player_username: string, player_verified: boolean): Promise<DatabasePlayer | null> {
    const player_object  = get_serialized(await DatabasePlayerModel.findOneAndUpdate({
        key: player_username.toLowerCase()
    }, {$set: {
        verified: player_verified
    }}, {
        // should not upsert
        new:    true,
        projection: {_id: 0, __v: 0}
    })) as (InferSchemaType<typeof DatabasePlayerSchema> | null);
    if (player_object === null) return null;
    return convert_player(player_object);
}

export async function get_verified(): Promise<DatabasePlayer[]> {
    const verified_objects = get_serialized(await DatabasePlayerModel.find({
        verified: true
    })) as InferSchemaType<typeof DatabasePlayerSchema>[];
    return verified_objects.map(verified_data => convert_player(verified_data));
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