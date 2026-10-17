/** Google ログイン開始（Worker の /auth/google へ遷移） */
export function startLogin() {
  location.assign('/auth/google');
}
