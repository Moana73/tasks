// カナダワーホリ（2027-04-01 入国）までにやることチェックリストの中身。
// 文言・セクション分け・期日はユーザー提供の準備メモをそのまま構造化したもの。
// チェック状態の「規定値（デフォルト）」もここで持ち、サーバー（D1）には
// デフォルトから変えた項目の checked/updatedAt だけを保存する。

export interface ChecklistItem {
  id: string;
  label: string;
  /** サーバーに記録がない場合に使う初期状態 */
  defaultChecked: boolean;
}

export interface ChecklistSection {
  id: string;
  title: string;
  /** 期間（timeline 上の並び・現在地判定に使う）。null は常設セクション */
  start: string | null;
  end: string | null;
  /** セクション見出しの下に出す補足説明（複数段落） */
  notes?: string[];
  items: ChecklistItem[];
}

export const DEPARTURE_DATE = '2027-04-01';

function items(defs: [string, string, boolean?][]): ChecklistItem[] {
  return defs.map(([id, label, done]) => ({ id, label, defaultChecked: !!done }));
}

export const SECTIONS: ChecklistSection[] = [
  {
    id: 'prep-status',
    title: '出発準備ステータス',
    start: null,
    end: null,
    items: items([
      ['prep-1', 'IEC Working Holiday 申請', true],
      ['prep-2', 'Work Permit 申請承認', true],
      ['prep-3', 'POE Letter 取得（有効期限 2027年5月ごろ）', true],
      ['prep-4', 'パスポート確認（2029年3月まで有効・更新不要と判断）', true],
      ['prep-5', 'POE Letter 記載の eTA 番号を確認', false],
      ['prep-6', 'eTA に登録されているパスポート番号を確認', false],
    ]),
  },
  {
    id: 'p1',
    title: '2026年9〜10月',
    start: '2026-09-01',
    end: '2026-10-31',
    items: items([
      ['p1-1', '最初に住む都市を決める'],
      ['p1-2', 'ワーホリ中の貯金・予算目標を決める'],
      ['p1-3', '航空券価格をチェック'],
      ['p1-4', '海外ワーホリ保険を比較'],
      ['p1-5', '最初の滞在先候補を探す'],
      ['p1-6', '現地でやりたい仕事を考える'],
      ['p1-7', '英文CVの準備を始める'],
      ['p1-8', '日本の仕事をいつ辞めるか決める'],
    ]),
  },
  {
    id: 'p2',
    title: '2026年11〜12月',
    start: '2026-11-01',
    end: '2026-12-31',
    notes: ['帰国航空券は必須ではないが、持っていない場合は帰国便を購入できる資金を入国時に示せるようにする。'],
    items: items([
      ['p2-1', '4月1日の航空券を購入'],
      ['p2-2', '預け荷物条件も含めて航空会社を比較'],
      ['p2-3', '海外ワーホリ保険を決める'],
      ['p2-4', '最初の滞在先を絞る'],
      ['p2-5', '現地の家賃相場を調べる'],
      ['p2-6', '海外で使えるクレジットカードを2枚程度用意'],
      ['p2-7', '海外送金方法を決める'],
      ['p2-8', 'カナダ用資金と日本に残す資金を分ける'],
    ]),
  },
  {
    id: 'p3',
    title: '2027年1月',
    start: '2027-01-01',
    end: '2027-01-31',
    notes: [
      'カナダIECでは医療・入院・本国送還をカバーする保険が必要。滞在予定期間のすべてをカバーしないと、Work Permitが保険期間までに短縮され、後からその理由で延長できない可能性がある。',
      '約1年間のワーホリなら、4月1日から約1年間をカバーする保険に加入する。',
    ],
    items: items([
      ['p3-1', '海外医療保険を契約'],
      ['p3-2', '保険開始日を2027年4月1日にする'],
      ['p3-3', '最初の宿泊先を予約'],
      ['p3-4', '英文CV完成'],
      ['p3-5', 'LinkedIn等を英語化'],
      ['p3-6', 'SIM・eSIM比較'],
      ['p3-7', 'カナダの銀行を調べる'],
      ['p3-8', 'SIN取得方法を確認'],
      ['p3-9', '国際免許が必要か判断'],
    ]),
  },
  {
    id: 'p4',
    title: '2027年2月',
    start: '2027-02-01',
    end: '2027-02-28',
    notes: [
      '会社員を退職すると、会社の健康保険・厚生年金は退職後に資格喪失。国外転出届を出して国内に住所がなくなると、国民健康保険は原則対象外、国民年金は強制加入ではなくなる。',
      '国民年金は「節約を優先して任意加入しない」か「将来の年金額を減らしたくないので任意加入する」かを検討する（カナダと日本には社会保障協定あり）。',
      '重要：退職日と4月1日の出国日の間に期間が空く場合、その数日間だけ国民健康保険に加入する必要がある可能性がある。退職日が決まったら日付単位で整理する。',
    ],
    items: items([
      ['p4-1', '退職手続き'],
      ['p4-2', '最終給与確認'],
      ['p4-3', '源泉徴収票の受け取り方法確認'],
      ['p4-4', '国外転出届について確認'],
      ['p4-5', '国民健康保険の手続き'],
      ['p4-6', '国民年金を任意加入するか決める'],
      ['p4-7', '住民税の支払い方法確認'],
      ['p4-8', '必要なら納税管理人を設定'],
      ['p4-9', 'マイナンバーカードの国外継続利用手続き確認'],
      ['p4-10', '日本の携帯番号を残すか決める'],
      ['p4-11', '日本の銀行・クレジットカードの海外利用設定確認'],
      ['p4-12', '郵便物の管理方法を決める'],
    ]),
  },
  {
    id: 'p5',
    title: '2027年3月1〜15日',
    start: '2027-03-01',
    end: '2027-03-15',
    notes: ['医療・介護・保育などの仕事をする可能性がある場合は、Work Permit上の健康診断・就労制限についても確認する。'],
    items: items([
      ['p5-1', '海外保険証券を印刷'],
      ['p5-2', '航空券確認'],
      ['p5-3', '宿泊先住所確認'],
      ['p5-4', 'POE Letter印刷'],
      ['p5-5', 'IEC Work Permit申請時に提出した書類を保存'],
      ['p5-6', 'クレジットカード海外利用確認'],
      ['p5-7', 'SIM/eSIM準備'],
      ['p5-8', '荷造り開始'],
      ['p5-9', '常備薬・処方薬準備'],
      ['p5-10', '重要書類をスマホ＋クラウドにも保存'],
    ]),
  },
  {
    id: 'p6',
    title: '2027年3月中旬〜下旬',
    start: '2027-03-16',
    end: '2027-03-24',
    notes: ['2027年1月1日時点で日本に住んでいる場合、2027年度住民税が発生する可能性がある。出国後も支払いが必要になる場合があるため役所で確認する。'],
    items: items([
      ['p6-1', '国外転出届'],
      ['p6-2', '国民健康保険手続き'],
      ['p6-3', '国民年金手続き'],
      ['p6-4', 'マイナンバー関係'],
      ['p6-5', '住民税確認'],
      ['p6-6', '必要なら納税管理人設定'],
      ['p6-7', '日本の携帯・各種契約整理'],
    ]),
  },
  {
    id: 'p7',
    title: '2027年3月25日〜31日',
    start: '2027-03-25',
    end: '2027-03-30',
    notes: [
      '重要：カナダIEC入国には最低 CAD 2,500 相当の資金証明が必要。銀行明細・レターは出発日の1週間以内に発行されたものが必要（4月1日出発なら3月25日以降に取得）。',
      '帰国航空券を持っていない場合は、CAD 2,500 とは別に帰国・出国航空券を買える資金も用意しておく。',
    ],
    items: items([['p7-1', '英文残高証明を取得（3月25日以降に発行）']]),
  },
  {
    id: 'p8',
    title: '2027年3月31日 — 機内持ち込みバッグ最終確認',
    start: '2027-03-31',
    end: '2027-03-31',
    notes: ['絶対に預け荷物に入れないもの。'],
    items: items([
      ['p8-1', 'パスポート', true],
      ['p8-2', 'POE Letter', true],
      ['p8-3', '海外医療保険証明書'],
      ['p8-4', '3月25日以降発行の残高証明'],
      ['p8-5', '航空券'],
      ['p8-6', '帰国航空券、または帰国便を購入できる資金'],
      ['p8-7', 'Work Permit申請時に提出した書類コピー'],
      ['p8-8', '最初の宿泊先住所・予約確認'],
      ['p8-9', 'クレジットカード'],
      ['p8-10', '現金'],
      ['p8-11', 'スマホ'],
      ['p8-12', '充電器'],
      ['p8-13', 'モバイルバッテリー'],
      ['p8-14', '常備薬'],
      ['p8-15', '緊急連絡先'],
    ]),
  },
  {
    id: 'p9',
    title: '2027年4月1日 — カナダ入国',
    start: '2027-04-01',
    end: '2027-04-01',
    notes: [
      '入国時に正式なWork Permitを発行してもらう。空港を出る前に内容を確認する。',
      '間違いがあればその場でBorder Services Officerに確認する。',
    ],
    items: items([
      ['p9-1', '名前'],
      ['p9-2', 'パスポート情報'],
      ['p9-3', 'Work Permit有効期限'],
      ['p9-4', 'EmployerがOpenになっているか'],
      ['p9-5', 'Location'],
      ['p9-6', '就労制限の有無'],
    ]),
  },
  {
    id: 'p10',
    title: 'カナダ到着後1週間',
    start: '2027-04-01',
    end: '2027-04-08',
    notes: ['SINはカナダで働くために必要。優先順位の高い順。'],
    items: items([
      ['p10-1', 'SIN取得'],
      ['p10-2', 'カナダの電話番号・SIM'],
      ['p10-3', '銀行口座開設'],
      ['p10-4', '長期滞在先探し'],
      ['p10-5', '英文CV調整'],
      ['p10-6', '仕事応募開始'],
    ]),
  },
];

export const ALL_ITEMS: { sectionId: string; sectionTitle: string; item: ChecklistItem }[] = SECTIONS.flatMap((s) =>
  s.items.map((item) => ({ sectionId: s.id, sectionTitle: s.title, item })),
);

export const DEFAULT_CHECKED: Record<string, boolean> = Object.fromEntries(
  ALL_ITEMS.map(({ item }) => [item.id, item.defaultChecked]),
);

/** タイムライン上のセクション（常設の prep-status を除く）だけを日付順に */
const TIMELINE_SECTIONS = SECTIONS.filter((s) => s.start && s.end);

/** 今日の日付から見て「現在のフェーズ」のセクション id を返す */
export function currentSectionId(today: Date): string {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  for (const s of TIMELINE_SECTIONS) {
    const end = new Date(`${s.end}T00:00:00Z`).getTime();
    if (t <= end) return s.id;
  }
  return TIMELINE_SECTIONS[TIMELINE_SECTIONS.length - 1]!.id;
}

/** 出発日までの残り日数（当日は0、出発後は負の値） */
export function daysUntilDeparture(today: Date): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(`${DEPARTURE_DATE}T00:00:00Z`).getTime();
  return Math.round((d - t) / 86_400_000);
}
