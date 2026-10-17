"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthClient = void 0;
/**
 * Member (end-user) authentication for this workspace — login, registration,
 * session refresh/logout, and profile management for people who sign in to
 * the *generated site itself* (not the SDK's own service token, which is a
 * separate, workspace-level credential used for every other method).
 *
 * `me`/`updateMe`/`changePassword` act on a specific member and need that
 * member's own `accessToken` from `login`/`register`/`refresh` — the SDK is
 * stateless and does not store or manage sessions/cookies for you; keep the
 * tokens wherever your app keeps its own session state (a cookie, usually)
 * and pass the current one in on each call.
 */
class AuthClient {
    constructor(cf) {
        this.cf = cf;
    }
    /** Sign in an existing member. Throws `SaCMSError` (401) on a wrong email/password. */
    login(email, password) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/auth/login`, {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
    }
    /**
     * Register a new member. Returns a full session immediately, unless the
     * workspace requires email verification first — check
     * `"requiresEmailVerification" in result` to tell the two apart.
     */
    register(params) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/auth/register`, {
            method: "POST",
            body: JSON.stringify(params),
        });
    }
    /** Consume the one-time code from a registration verification email. */
    confirmEmail(code) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/auth/email-confirmation`, {
            method: "POST",
            body: JSON.stringify({ code }),
        });
    }
    /** Exchange a refresh token for a new access + refresh token pair (rotates the refresh token). */
    refresh(refreshToken) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/auth/refresh`, {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
        });
    }
    /** Revoke a session. Pass the refresh token to invalidate it server-side; always resolves. */
    logout(refreshToken) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/auth/logout`, {
            method: "POST",
            body: JSON.stringify(refreshToken ? { refreshToken } : {}),
        });
    }
    /** The signed-in member's own profile. `memberAccessToken` is that member's token from login/register/refresh. */
    me(memberAccessToken) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/auth/me`, {
            headers: { Authorization: `Bearer ${memberAccessToken}` },
        });
    }
    /** Update the signed-in member's own profile (name/avatar/metadata), or change their password. */
    updateMe(memberAccessToken, data) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/auth/me`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${memberAccessToken}` },
            body: JSON.stringify(data),
        });
    }
    /** Dedicated password-change call (requires the current password). */
    changePassword(memberAccessToken, params) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/auth/change-password`, {
            method: "POST",
            headers: { Authorization: `Bearer ${memberAccessToken}` },
            body: JSON.stringify(params),
        });
    }
    /** Request a password-reset email for the given address. Always resolves (never reveals whether the email exists). */
    forgotPassword(email) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/auth/forgot-password`, {
            method: "POST",
            body: JSON.stringify({ email }),
        });
    }
    /** Complete a password reset using the code from the reset email. */
    resetPassword(params) {
        return this.cf.request(`/api/public/${this.cf.getTenant()}/auth/reset-password`, {
            method: "POST",
            body: JSON.stringify(params),
        });
    }
}
exports.AuthClient = AuthClient;
