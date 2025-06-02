import { Canvas, CanvasRenderingContext2D, createCanvas, Image, loadImage } from "canvas";
import { PixelColor, PixelSearcher, PixelSearcherDirection } from "../objects/object_searcher";

export class ImageManager {
    private image_source:  string;
    private image_object:  Image;
    private image_canvas:  Canvas;
    private image_context: CanvasRenderingContext2D;

    private static readonly SCOREBOARD_BORDER = {
        pixel_red:   0,
        pixel_green: 0,
        pixel_blue:  0,
        pixel_alpha: 255
    } as PixelColor;
    private static readonly TIMER_BACKGROUND_TOP = {
        pixel_red:   4,
        pixel_green: 4,
        pixel_blue:  4,
        pixel_alpha: 255
    } as PixelColor;
    private static readonly TIMER_BORDER = {
        pixel_red:   127,
        pixel_green: 127,
        pixel_blue:  127,
        pixel_alpha: 255
    } as PixelColor;

    constructor() {
        this.image_source  = (undefined as any);
        this.image_object  = (undefined as any);
        this.image_canvas  = (undefined as any);
        this.image_context = (undefined as any);
    }

    public async image_load(image_source: string): Promise<void> {
        this.image_source  = image_source;
        this.image_object  = await loadImage(this.image_source);
        this.image_canvas  = createCanvas(this.image_object.width, this.image_object.height);
        this.image_context = this.image_canvas.getContext("2d");
        this.image_context.drawImage(this.image_object, 0, 0);
    }

    public image_locate(): ImageBounds {
        const image_width        = this.image_object.width;
        const image_height       = this.image_object.height;
        const image_width_center = Math.floor(image_width  * (1/2));
        // search scoreboard
        const scoreboard_top = PixelSearcher.search_until(this.image_canvas, {
            location_x: image_width_center,
            location_y: Math.floor(image_height * (1/4))
        }, PixelSearcherDirection.SEARCH_TOP, ImageManager.SCOREBOARD_BORDER, true, 0).pixel_origin().location_y;
        const scoreboard_bottom = PixelSearcher.search_until(this.image_canvas, {
            location_x: image_width_center,
            location_y: Math.floor(image_height * (3/4))
        }, PixelSearcherDirection.SEARCH_BOTTOM, ImageManager.SCOREBOARD_BORDER, true, 0).pixel_origin().location_y;
        const scoreboard_right = PixelSearcher.search_until(this.image_canvas, {
            location_x: image_width_center,
            location_y: Math.floor(image_height * (3/4))
        }, PixelSearcherDirection.SEARCH_RIGHT, ImageManager.SCOREBOARD_BORDER, true, 0).pixel_origin().location_x;
        const scoreboard_left    = ((image_width - 1) - scoreboard_right);
        const scoreboard_center  = Math.floor((scoreboard_top + scoreboard_bottom) / 2);
        const scoreboard_quarter = ((scoreboard_right - image_width_center) / 4);
        // search timer
        const timer_top = PixelSearcher.search_until(this.image_canvas, {
            location_x: image_width_center,
            location_y: 0
        }, PixelSearcherDirection.SEARCH_BOTTOM, ImageManager.TIMER_BACKGROUND_TOP, true, 0).pixel_origin().location_y + (1);
        const timer_right = PixelSearcher.search_until(this.image_canvas, {
            location_x: image_width_center,
            location_y: timer_top
        }, PixelSearcherDirection.SEARCH_RIGHT, ImageManager.TIMER_BACKGROUND_TOP, false, 0).pixel_origin().location_x;
        const timer_bottom = PixelSearcher.search_until(this.image_canvas, {
            location_x: timer_right,
            location_y: timer_top
        }, PixelSearcherDirection.SEARCH_BOTTOM, ImageManager.TIMER_BORDER, true, 0).pixel_origin().location_y;
        const timer_left  = ((image_width - 1) - timer_right);
        const timer_width = (timer_right - timer_left + 1);
        // search red score
        const score_red_ceil = {
            location_x: (image_width_center - timer_width),
            location_y: timer_top
        } as ImageLocation;
        const score_red_left  = PixelSearcher.search_unmatch(this.image_canvas, score_red_ceil, PixelSearcherDirection.SEARCH_LEFT,  5).pixel_origin().location_x;
        const score_red_right = PixelSearcher.search_unmatch(this.image_canvas, score_red_ceil, PixelSearcherDirection.SEARCH_RIGHT, 5).pixel_origin().location_x;
        // search blue score
        const score_blue_ceil = {
            location_x: (image_width_center + timer_width),
            location_y: timer_top
        } as ImageLocation;
        const score_blue_left  = PixelSearcher.search_unmatch(this.image_canvas, score_blue_ceil, PixelSearcherDirection.SEARCH_LEFT,  5).pixel_origin().location_x;
        const score_blue_right = PixelSearcher.search_unmatch(this.image_canvas, score_blue_ceil, PixelSearcherDirection.SEARCH_RIGHT, 5).pixel_origin().location_x;
        const image_bounds_raw = {
            image_players_red: {
                origin:      {location_x: scoreboard_left,    location_y: scoreboard_top}    as ImageLocation,
                destination: {location_x: image_width_center, location_y: scoreboard_center} as ImageLocation
            },
            image_players_blue: {
                origin:      {location_x: scoreboard_left,    location_y: scoreboard_center} as ImageLocation,
                destination: {location_x: image_width_center, location_y: scoreboard_bottom} as ImageLocation
            },
            image_scoreboard_red: {
                origin:      {location_x: image_width_center + scoreboard_quarter, location_y: scoreboard_top}    as ImageLocation,
                destination: {location_x: scoreboard_right   - scoreboard_quarter, location_y: scoreboard_center} as ImageLocation
            },
            image_scoreboard_blue: {
                origin:      {location_x: image_width_center + scoreboard_quarter, location_y: scoreboard_center} as ImageLocation,
                destination: {location_x: scoreboard_right   - scoreboard_quarter, location_y: scoreboard_bottom} as ImageLocation
            },
            image_timer: {
                origin:      {location_x: timer_left,  location_y: timer_top}    as ImageLocation,
                destination: {location_x: timer_right, location_y: timer_bottom} as ImageLocation
            },
            image_score_red: {
                origin:      {location_x: score_red_left,  location_y: timer_top}    as ImageLocation,
                destination: {location_x: score_red_right, location_y: timer_bottom} as ImageLocation
            },
            image_score_blue: {
                origin:      {location_x: score_blue_left,  location_y: timer_top}    as ImageLocation,
                destination: {location_x: score_blue_right, location_y: timer_bottom} as ImageLocation
            },
            image_valid: undefined as unknown
        } as ImageBounds;
        const image_bounds_valid = ([
            this.area_valid(image_bounds_raw.image_players_red),
            this.area_valid(image_bounds_raw.image_players_blue),
            this.area_valid(image_bounds_raw.image_scoreboard_red),
            this.area_valid(image_bounds_raw.image_scoreboard_blue),
            this.area_valid(image_bounds_raw.image_timer),
            this.area_valid(image_bounds_raw.image_score_red),
            this.area_valid(image_bounds_raw.image_score_blue)
        ].filter(requirement => (!requirement)).length <= 0);
        return Object.assign(image_bounds_raw, {image_valid: image_bounds_valid});
    }

    public image_grayscale(luminance_threshold: number): Buffer {
        // create grayscale image
        const grayscale_data = this.image_context.getImageData(0, 0, this.image_canvas.width, this.image_canvas.height);
        for (let pixel_index = 0; pixel_index < (grayscale_data.data.length / 4); pixel_index++) {
            const pixel_red   = grayscale_data.data[(pixel_index * 4) + 0];
            const pixel_green = grayscale_data.data[(pixel_index * 4) + 1];
            const pixel_blue  = grayscale_data.data[(pixel_index * 4) + 2];
            // relative luminance
            const pixel_luminance = Math.floor((pixel_red * 0.2126) + (pixel_green * 0.7152) + (pixel_blue * 0.0722));
            const pixel_binary    = ((pixel_luminance >= luminance_threshold) ? 255 : 0);
            grayscale_data.data[(pixel_index * 4) + 0] = pixel_binary;
            grayscale_data.data[(pixel_index * 4) + 1] = pixel_binary;
            grayscale_data.data[(pixel_index * 4) + 2] = pixel_binary;
        }
        // create canvas copy
        const grayscale_canvas  = createCanvas(this.image_canvas.width, this.image_canvas.height);
        const grayscale_context = grayscale_canvas.getContext("2d");
        // output grayscale
        grayscale_context.putImageData(grayscale_data, 0, 0);
        return grayscale_canvas.toBuffer();
    }

    private area_valid(image_area: ImageArea): boolean {
        const x_difference = (image_area.destination.location_x - image_area.origin.location_x);
        const y_difference = (image_area.destination.location_y - image_area.origin.location_y);
        return ((x_difference > 0) && (y_difference > 0));
    }
}

export type ImageBounds = {
    image_timer:           ImageArea,
    image_score_red:       ImageArea,
    image_score_blue:      ImageArea,
    image_players_red:     ImageArea,
    image_players_blue:    ImageArea,
    image_scoreboard_red:  ImageArea,
    image_scoreboard_blue: ImageArea,
    image_valid:           boolean
};

export type ImageArea = {
    origin:      ImageLocation, // left-top
    destination: ImageLocation  // right-bottom
};

export type ImageLocation = {
    location_x: number,
    location_y: number
};