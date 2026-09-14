import type { ShaderMotionParams } from '../shader-mount.js';
import { type ShaderSizingParams, type ShaderSizingUniforms } from '../shader-sizing.js';
export declare const lensDistortionMeta: {
    readonly maxSamples: 50;
};
/**
 *
 * Lens Distortion image filter separates an image into shifting color layers
 * (recreating the chromatic aberration of a lens) and warps the image geometry,
 * curving it outward or inward like barrel and pincushion distortion.
 *
 * Fragment shader uniforms:
 * - u_image (sampler2D): Source image texture
 * - u_spread (float): Strength of the color split; how far the color layers are pushed apart; 0 is off (0 to 1)
 * - u_bias (float): Shifts the colors toward one end of the spread; 0 spaces them evenly (-1 to 1)
 * - u_angle (float): Direction of the spread in degrees (0 to 360)
 * - u_perspective (float): Shapes the spread direction from a straight line (0) to a radial burst out from the centre (1) (0 to 1)
 * - u_count (float): Number of sampled color layers along the spread; higher is smoother and costlier (2 to 50)
 * - u_dispersion (float): Overall amount of color dispersion; 1 gives each layer its own color from the spectrum, 0 keeps the original image color (0 to 1)
 * - u_dispersionShift (float): Balance of the dispersion between a soft circular zone at the centre and the rest of the image; 0 applies it evenly, -1 keeps it in the centre only, 1 keeps it at the edges only (-1 to 1)
 * - u_dispersionColor (float): Rotates the colors around the hue wheel, 0 to 1 for a full turn
 * - u_focusCenter (float): Reduces the spread in a circular zone at the centre; 0 keeps it full to the centre (0 to 1)
 * - u_focusEdges (float): Reduces the spread toward the edges; 0 keeps it full to the edges, 1 restores the original image there (0 to 1)
 * - u_swirl (float): Rotates the color layers around the centre by an angle growing along the spread; 0 is off (-1 to 1)
 * - u_noise (float): Scatters the spread direction with noise; 0 is off (0 to 1)
 * - u_noiseFrequency (float): Frequency of the noise, 0 to 1 mapped internally to 0 to 18; higher is finer (no effect with noise = 0)
 * - u_noiseOffset (float): Offsets the noise pattern for a different seed, 0 to 1 mapped internally to 0 to 30 (no effect with noise = 0)
 * - u_lensBulge (float): Radial lens warp of the image geometry; positive bulges out like a fisheye/barrel, negative pinches in like a pincushion; strong positive values fade out the corners (-1 to 1)
 * - u_lensCircle (float): Squeezes pixels outside the inscribed circle inward so the outline becomes a circle; also turns the spread radial and damps it near the rim; 0 is off, 1 is full (0 to 1)
 * - u_grainMixer (float): Scatters the spread with grain noise, breaking up the edges of the color layers (0 to 1)
 * - u_grainOverlay (float): Post-processing black/white grain overlay (0 to 1)
 * - u_imageX (float): Pans the image horizontally behind the effect; 0 is centred (-1 to 1)
 * - u_imageY (float): Pans the image vertically behind the effect; 0 is centred (-1 to 1)
 *
 * Vertex shader outputs (used in fragment shader):
 * - v_imageUV (vec2): Image UV coordinates with global sizing (rotation, scale, offset, etc) applied
 *
 * Vertex shader uniforms:
 * - u_resolution (vec2): Canvas resolution in pixels
 * - u_pixelRatio (float): Device pixel ratio
 * - u_originX (float): Reference point for positioning world width in the canvas (0 to 1)
 * - u_originY (float): Reference point for positioning world height in the canvas (0 to 1)
 * - u_fit (float): How to fit the rendered shader into the canvas dimensions (0 = none, 1 = contain, 2 = cover)
 * - u_scale (float): Overall zoom level of the graphics (0.01 to 4)
 * - u_rotation (float): Overall rotation angle of the graphics in degrees (0 to 360)
 * - u_offsetX (float): Horizontal offset of the graphics center (-1 to 1)
 * - u_offsetY (float): Vertical offset of the graphics center (-1 to 1)
 * - u_imageAspectRatio (float): Aspect ratio of the source image
 *
 */
export declare const lensDistortionFragmentShader: string;
export interface LensDistortionUniforms extends ShaderSizingUniforms {
    u_image: HTMLImageElement | string | undefined;
    u_spread: number;
    u_bias: number;
    u_angle: number;
    u_perspective: number;
    u_count: number;
    u_dispersion: number;
    u_dispersionShift: number;
    u_dispersionColor: number;
    u_focusCenter: number;
    u_focusEdges: number;
    u_swirl: number;
    u_noise: number;
    u_noiseFrequency: number;
    u_noiseOffset: number;
    u_lensBulge: number;
    u_lensCircle: number;
    u_grainMixer: number;
    u_grainOverlay: number;
    u_imageX: number;
    u_imageY: number;
}
export interface LensDistortionParams extends ShaderSizingParams, ShaderMotionParams {
    image?: HTMLImageElement | string;
    spread?: number;
    bias?: number;
    angle?: number;
    perspective?: number;
    count?: number;
    dispersion?: number;
    dispersionShift?: number;
    dispersionColor?: number;
    focusCenter?: number;
    focusEdges?: number;
    swirl?: number;
    noise?: number;
    noiseFrequency?: number;
    noiseOffset?: number;
    lensBulge?: number;
    lensCircle?: number;
    grainMixer?: number;
    grainOverlay?: number;
    imageX?: number;
    imageY?: number;
}
