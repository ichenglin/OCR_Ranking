import { Canvas, ImageData } from "canvas";
import { ImageLocation } from "../managers/manager_image";

export enum PixelSearcherDirection {
    SEARCH_LEFT,
    SEARCH_RIGHT,
    SEARCH_TOP,
    SEARCH_BOTTOM
};

export class PixelSearcher {
    private image_canvas: Canvas;
    private image_data:   ImageData;
    private image_origin: ImageLocation;

    private static readonly SEARCHER_DIRECTION_OFFSET = {
        [PixelSearcherDirection.SEARCH_LEFT]:   {location_x: -1, location_y:  0} as ImageLocation,
        [PixelSearcherDirection.SEARCH_RIGHT]:  {location_x:  1, location_y:  0} as ImageLocation,
        [PixelSearcherDirection.SEARCH_TOP]:    {location_x:  0, location_y: -1} as ImageLocation,
        [PixelSearcherDirection.SEARCH_BOTTOM]: {location_x:  0, location_y:  1} as ImageLocation
    };

    constructor(image_canvas: Canvas, image_origin: ImageLocation) {
        this.image_canvas = image_canvas;
        this.image_data   = this.image_canvas.getContext("2d").getImageData(0, 0, this.image_canvas.width, this.image_canvas.height);
        this.image_origin = image_origin;
    }

    public pixel_until(search_direction: PixelSearcherDirection, search_target: PixelColor, search_match: boolean, color_tolerance: number): PixelSearcher {
        // get direction offset
        const origin_offset  = PixelSearcher.SEARCHER_DIRECTION_OFFSET[search_direction];
        let   origin_current = this.image_origin;
        while (true) {
            // next origin
            const next_location = Object.assign({}, origin_current);
            next_location.location_x += origin_offset.location_x;
            next_location.location_y += origin_offset.location_y;
            // check valid
            const next_valid = this.pixel_valid(next_location);
            if (!next_valid) break;
            // check match
            const next_color = this.pixel_color(next_location);
            const next_match = this.pixel_match(search_target, next_color, color_tolerance);
            if (search_match === next_match) break;
            origin_current = next_location;
        }
        this.image_origin = origin_current;
        return this;
    }

    public pixel_origin(): ImageLocation {
        return this.image_origin;
    }

    private pixel_color(pixel_location: ImageLocation): PixelColor {
        const pixel_index = ((pixel_location.location_y * this.image_canvas.width) + pixel_location.location_x);
        return {
            pixel_red:   this.image_data.data[(pixel_index * 4) + 0],
            pixel_green: this.image_data.data[(pixel_index * 4) + 1],
            pixel_blue:  this.image_data.data[(pixel_index * 4) + 2],
            pixel_alpha: this.image_data.data[(pixel_index * 4) + 3]
        } as PixelColor;
    }

    private pixel_match(color_a: PixelColor, color_b: PixelColor, color_tolerance: number): boolean {
        if (Math.abs(color_b.pixel_red   - color_a.pixel_red)   > color_tolerance) return false;
        if (Math.abs(color_b.pixel_green - color_a.pixel_green) > color_tolerance) return false;
        if (Math.abs(color_b.pixel_blue  - color_a.pixel_blue)  > color_tolerance) return false;
        if (Math.abs(color_b.pixel_alpha - color_a.pixel_alpha) > color_tolerance) return false;
        return true;
    }

    private pixel_valid(pixel_location: ImageLocation): boolean {
        const image_width  = this.image_canvas.width;
        const image_height = this.image_canvas.height;
        if (pixel_location.location_x <  0)            return false;
        if (pixel_location.location_x >= image_width)  return false;
        if (pixel_location.location_y <  0)            return false;
        if (pixel_location.location_y >= image_height) return false;
        return true;
    }

    public static search_until(image_canvas: Canvas, image_origin: ImageLocation, search_direction: PixelSearcherDirection, search_target: PixelColor, search_match: boolean, color_tolerance: number): PixelSearcher {
        const searcher_object = new PixelSearcher(image_canvas, image_origin);
        return searcher_object.pixel_until(search_direction, search_target, search_match, color_tolerance);
    }

    public static search_unmatch(image_canvas: Canvas, image_origin: ImageLocation, search_direction: PixelSearcherDirection, color_tolerance: number): PixelSearcher {
        const searcher_object = new PixelSearcher(image_canvas, image_origin);
        const searcher_target = searcher_object.pixel_color(image_origin);
        return searcher_object.pixel_until(search_direction, searcher_target, false, color_tolerance);
    }
}

export type PixelColor = {
    pixel_red:   number,
    pixel_green: number,
    pixel_blue:  number,
    pixel_alpha: number
};