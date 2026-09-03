/**
 * User-facing error strings for the API envelope `code` values and common
 * client-side failures. Keyed by the machine slug so a component can map
 * `error.code` straight to a localised message:
 *
 *   t(`errors.${res.code}`, res.error)   // falls back to the server string
 */
export const errors = {
  id: {
    // API envelope codes (src/lib/api/route-helpers.ts)
    unauthorized: "Anda harus masuk untuk melakukan tindakan ini.",
    forbidden: "Anda tidak memiliki izin untuk tindakan ini.",
    not_found: "Data yang diminta tidak ditemukan.",
    validation: "Beberapa isian tidak valid. Periksa kembali form Anda.",
    conflict: "Data serupa sudah ada.",
    plan_limit: "Batas paket Anda tercapai. Tingkatkan paket untuk melanjutkan.",
    rate_limited: "Terlalu banyak permintaan. Coba lagi sebentar.",
    internal: "Terjadi kesalahan di server. Tim kami telah diberi tahu.",

    // Network / client
    network: "Gagal terhubung ke server. Periksa koneksi Anda.",
    timeout: "Permintaan memakan waktu terlalu lama. Coba lagi.",
    unknown: "Terjadi kesalahan yang tidak diketahui.",

    // Auth-specific
    invalidCredentials: "Email atau kata sandi salah.",
    sessionExpired: "Sesi Anda telah berakhir. Silakan masuk kembali.",
  },
  en: {
    unauthorized: "You need to sign in to do that.",
    forbidden: "You don't have permission to do that.",
    not_found: "The requested item could not be found.",
    validation: "Some fields are invalid. Please check the form.",
    conflict: "A similar item already exists.",
    plan_limit: "You've hit your plan limit. Upgrade to continue.",
    rate_limited: "Too many requests. Please try again shortly.",
    internal: "Something went wrong on our end. Our team has been notified.",

    network: "Couldn't reach the server. Check your connection.",
    timeout: "The request took too long. Please try again.",
    unknown: "An unknown error occurred.",

    invalidCredentials: "Incorrect email or password.",
    sessionExpired: "Your session has expired. Please sign in again.",
  },
} as const
