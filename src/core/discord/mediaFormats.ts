// MediaFormatTesters, Android variants.
const IMAGE = /\.(png|jpe?g|jfif|webp|gif|heic|heif|dng|avif)$/i
const VIDEO = /\.(mp4|webm|mov|qt)$/i

export const isImageFile = (filename: string) => IMAGE.test(filename)
export const isVideoFile = (filename: string) => VIDEO.test(filename)
