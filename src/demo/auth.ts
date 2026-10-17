// デモ版のログイン：Google の代わりにその場でデモアカウントに入る
import { demoLogin } from './api';
import { store } from '../lib/store';

export function startLogin() {
  demoLogin();
  void store.boot();
}
