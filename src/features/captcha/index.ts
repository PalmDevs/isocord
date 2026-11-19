import { CaptchaModal } from './CaptchaModal'
import type { Feature } from '../../core/feature'

export const captchaFeature: Feature = {
    name: 'captcha',
    overlays: { captcha: CaptchaModal },
}
