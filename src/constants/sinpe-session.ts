/** sessionStorage keys for SINPE withdrawal flow */
export const SINPE_SESSION_PHONE = 'sinpe_phone';
/** JSON: { nombreCliente, identificacion, cuentaInterna } from Ridivi phoneInfo */
export const SINPE_SESSION_PROFILE = 'sinpe_ridi_profile';
/** Normalized (trim + lowercase) contact email for compliance records */
export const SINPE_SESSION_CONTACT_EMAIL = 'sinpe_contact_email';
/** JPEG data URL (~compressed) for ID front */
export const SINPE_SESSION_ID_FRONT = 'sinpe_id_front';
/** JPEG data URL (~compressed) for ID back */
export const SINPE_SESSION_ID_BACK = 'sinpe_id_back';
/** WLD amount string as entered on the amount step (e.g. "12.5") */
export const SINPE_SESSION_AMOUNT_WLD = 'sinpe_amount_wld';
/** Reference id from POST /api/initiate-payment for MiniKit pay */
export const SINPE_SESSION_PAY_REFERENCE = 'sinpe_pay_reference';
