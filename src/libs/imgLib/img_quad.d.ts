/* tslint:disable */
/* eslint-disable */
/**
* @param {(Uint8Array)[]} image_bufs
* @returns {Promise<Promise<any>>}
*/
export function merge_to_grid(image_bufs: (Uint8Array)[]): Promise<Promise<any>>;
/**
* @param {Uint8Array} image_buf
* @param {number} width
* @param {number} height
* @returns {Promise<Promise<any>>}
*/
export function resize_to_webp(image_buf: Uint8Array, width: number, height: number): Promise<Promise<any>>;
/**
* Chroma subsampling format
*/
export enum ChromaSampling {
/**
* Both vertically and horizontally subsampled.
*/
  Cs420 = 0,
/**
* Horizontally subsampled.
*/
  Cs422 = 1,
/**
* Not subsampled.
*/
  Cs444 = 2,
/**
* Monochrome.
*/
  Cs400 = 3,
}
