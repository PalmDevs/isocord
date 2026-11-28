// PerceptualVolumeUtils: volume sliders move in perceptual steps and store amplitudes.

/** Below unity, amplitude is perceptual raised to this power. */
const LOW_EXPONENT = 2.8
/** Above unity, each perceptual unit adds this many dB. */
const DB_PER_UNIT = 6
const DB_FACTOR = 20

/** Returns the amplitude of a perceptual volume. `unity` is the value at 0 dB. */
export function perceptualToAmplitude(perceptual: number, unity: number) {
    if (perceptual === 0) return 0
    const ratio = perceptual / unity
    const scale =
        ratio < 1
            ? ratio ** LOW_EXPONENT
            : 10 ** ((DB_PER_UNIT * (ratio - 1)) / DB_FACTOR)
    return scale * unity
}

/** Returns the perceptual volume of an amplitude. */
export function amplitudeToPerceptual(amplitude: number, unity: number) {
    if (amplitude === 0) return 0
    const ratio = amplitude / unity
    const scale =
        ratio < 1
            ? ratio ** (1 / LOW_EXPONENT)
            : (DB_FACTOR * Math.log10(ratio)) / DB_PER_UNIT + 1
    return scale * unity
}
