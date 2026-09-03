/**
 * Transactional email copy. Consumed server-side by src/lib/mail.ts, which
 * picks the locale from the recipient's preference (Member.metadata.locale)
 * or the tenant default.
 *
 * `{brand}` and `{link}` are simple placeholders the mailer substitutes.
 */
export const email = {
  id: {
    verify: {
      subject: "Verifikasi alamat email Anda — {brand}",
      heading: "Konfirmasi alamat email Anda",
      body: "Hai {name}, selamat datang di {brand}. Silakan konfirmasi alamat email Anda untuk mengaktifkan akun:",
      button: "Konfirmasi email",
      linkFallback: "Atau tempel tautan ini di browser Anda:",
      expiry: "Tautan ini kedaluwarsa dalam 24 jam. Jika Anda tidak membuat akun, abaikan email ini.",
    },
    reset: {
      subject: "Atur ulang kata sandi Anda — {brand}",
      heading: "Atur ulang kata sandi Anda",
      body: "Kami menerima permintaan untuk mengatur ulang kata sandi akun {brand} Anda. Klik di bawah untuk memilih kata sandi baru:",
      button: "Atur ulang kata sandi",
      linkFallback: "Atau tempel tautan ini di browser Anda:",
      expiry: "Tautan ini kedaluwarsa dalam 1 jam. Jika Anda tidak meminta ini, abaikan email ini.",
    },
  },
  en: {
    verify: {
      subject: "Verify your email — {brand}",
      heading: "Confirm your email address",
      body: "Hi {name}, welcome to {brand}. Please confirm your email address to activate your account:",
      button: "Confirm email",
      linkFallback: "Or paste this link into your browser:",
      expiry: "This link expires in 24 hours. If you didn't create an account, you can ignore this email.",
    },
    reset: {
      subject: "Reset your password — {brand}",
      heading: "Reset your password",
      body: "We received a request to reset the password for your {brand} account. Click below to choose a new password:",
      button: "Reset password",
      linkFallback: "Or paste this link into your browser:",
      expiry: "This link expires in 1 hour. If you didn't request this, you can ignore this email.",
    },
  },
} as const
