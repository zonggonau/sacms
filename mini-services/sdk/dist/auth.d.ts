import type { SaCMS } from "./client";
export interface MemberUser {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    role: string;
    status: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    lastLoginAt?: string | null;
}
export interface AuthSession {
    message: string;
    user: MemberUser;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: "Bearer";
}
export interface RegisterParams {
    email: string;
    password: string;
    name?: string;
    avatar?: string;
    metadata?: Record<string, unknown>;
}
export type RegisterResult = AuthSession | {
    message: string;
    requiresEmailVerification: true;
};
export interface UpdateProfileParams {
    name?: string;
    avatar?: string;
    metadata?: Record<string, unknown>;
    currentPassword?: string;
    newPassword?: string;
}
export interface ChangePasswordParams {
    currentPassword: string;
    password: string;
    passwordConfirmation: string;
}
export interface ResetPasswordParams {
    code: string;
    password: string;
    passwordConfirmation: string;
}
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
export declare class AuthClient {
    private cf;
    constructor(cf: SaCMS<any>);
    /** Sign in an existing member. Throws `SaCMSError` (401) on a wrong email/password. */
    login(email: string, password: string): Promise<AuthSession>;
    /**
     * Register a new member. Returns a full session immediately, unless the
     * workspace requires email verification first — check
     * `"requiresEmailVerification" in result` to tell the two apart.
     */
    register(params: RegisterParams): Promise<RegisterResult>;
    /** Consume the one-time code from a registration verification email. */
    confirmEmail(code: string): Promise<{
        message: string;
    }>;
    /** Exchange a refresh token for a new access + refresh token pair (rotates the refresh token). */
    refresh(refreshToken: string): Promise<Omit<AuthSession, "user" | "message"> & {
        message: string;
    }>;
    /** Revoke a session. Pass the refresh token to invalidate it server-side; always resolves. */
    logout(refreshToken?: string): Promise<{
        message: string;
    }>;
    /** The signed-in member's own profile. `memberAccessToken` is that member's token from login/register/refresh. */
    me(memberAccessToken: string): Promise<{
        user: MemberUser;
    }>;
    /** Update the signed-in member's own profile (name/avatar/metadata), or change their password. */
    updateMe(memberAccessToken: string, data: UpdateProfileParams): Promise<{
        message: string;
        user: MemberUser;
    }>;
    /** Dedicated password-change call (requires the current password). */
    changePassword(memberAccessToken: string, params: ChangePasswordParams): Promise<{
        message: string;
    }>;
    /** Request a password-reset email for the given address. Always resolves (never reveals whether the email exists). */
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    /** Complete a password reset using the code from the reset email. */
    resetPassword(params: ResetPasswordParams): Promise<{
        message: string;
    }>;
}
