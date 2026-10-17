export type Status = 'todo' | 'doing' | 'done';
export type Filter = 'all' | Status;

export interface Task {
  id: string;
  title: string;
  note: string;
  status: Status;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export const STATUS_LABEL: Record<Status, string> = {
  todo: '未着手',
  doing: '進行中',
  done: '完了',
};

const ORDER: Status[] = ['todo', 'doing', 'done'];

/** フリック方向に応じた次のステータス（右 = 進める / 左 = 戻す） */
export function stepStatus(s: Status, dir: 1 | -1): Status | null {
  const i = ORDER.indexOf(s) + dir;
  return ORDER[i] ?? null;
}
