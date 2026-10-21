// カナダワーホリ（2027-04-01 入国予定）までにやることチェックリストの中身。
// 月ごとではなく「何の手続きか」でまとめ、やらないと入国・就労・日本の法的な手続きで困るものだけを載せている。補足説明は各公式ページで確認した内容で、
// 出典（sources）を一緒に持つ。制度は変わるので、実際に手続きする前に必ずリンク先で最新情報を確認する。
// チェック状態の初期値（defaultChecked）もここで持ち、サーバー（D1）には変更した項目の checked/updatedAt だけを保存する。

export interface ChecklistItem {
  id: string;
  label: string;
  /** サーバーに記録がない場合に使う初期状態 */
  defaultChecked: boolean;
}

export interface Source {
  label: string;
  url: string;
}

export interface ChecklistSection {
  id: string;
  title: string;
  /** セクションの補足説明（公式情報の要点） */
  notes?: string[];
  /** 補足説明の出典（公式ページ） */
  sources?: Source[];
  items: ChecklistItem[];
}

export const DEPARTURE_DATE = '2027-04-01';
/** 最終確認日（出典リンク先の内容を確認した日） */
export const SOURCES_CHECKED_ON = '2026-10-21';

function items(defs: [string, string, boolean?][]): ChecklistItem[] {
  return defs.map(([id, label, done]) => ({ id, label, defaultChecked: !!done }));
}

const IRCC_ARRIVAL: Source = {
  label: 'IRCC｜IEC: Prepare for arrival',
  url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/iec/prepare-arrival.html',
};

export const SECTIONS: ChecklistSection[] = [
  {
    id: 'visa',
    title: 'ワーホリ申請',
    notes: [
      'POE Letter に書かれた有効期限までに入国する（期限は延長できない）。',
      'eTA は Work Permit 承認時に自動で発行され、申請に使ったパスポートに紐づいている。パスポートを新しくした場合は eTA の取り直しが必要。',
    ],
    sources: [
      { label: 'IRCC｜How long is my POE Letter valid?', url: 'https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=846&top=15' },
      { label: 'IRCC｜eTA と就労・就学許可', url: 'https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1052&top=23' },
    ],
    items: items([
      ['visa-wp', 'IEC 申請・Work Permit 承認', true],
      ['visa-poe', 'POE Letter 取得（有効期限 2027年5月ごろ）', true],
      ['visa-eta', 'eTA に紐づくパスポートが今のパスポートか確認'],
    ]),
  },
  {
    id: 'entry',
    title: '入国の条件をそろえる',
    notes: [
      '保険は医療・入院・本国送還をカバーし、滞在期間すべてに有効なもの。期間が短いと Work Permit もそこまでになり、後から延長できない。',
      '資金証明は最初の3か月分として CAD 2,500 相当以上。銀行の残高証明は出発日の1週間以内に発行されたもの（4月1日出発なら3月25日以降）。',
      'カナダを出る航空券を持っていない場合は、それを買えるだけの資金も必要。',
    ],
    sources: [{ label: 'IRCC｜IEC: Prepare for arrival', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/iec/prepare-arrival.html' }],
    items: items([
      ['entry-flight', '4月1日の航空券を購入'],
      ['entry-return', '帰国便の航空券か、それを買える資金を用意'],
      ['entry-insurance', '海外医療保険に加入（4月1日から約1年間）'],
      ['entry-stay', '最初の宿泊先を予約'],
      ['entry-statement', '英文の残高証明を取得（3月25日以降）'],
    ]),
  },
  {
    id: 'job-tax',
    title: '退職・税金',
    notes: [
      '出国前に所得税の確定申告が必要か確認し、必要なら出国までに申告・納税するか、納税管理人を届け出る。年末調整を受けずに退職した分の還付申告は、翌年から5年間できる。',
      '住民税は1月1日に住んでいた市区町村が課税する。2027年1月1日は日本にいるので2027年度分がかかり、年の途中で出国しても全額納める。出国後も払う場合は納税管理人が必要になることがある。',
    ],
    sources: [
      { label: '東京国税局｜給与所得者の方で国外転出を予定されている方へ', url: 'https://www.nta.go.jp/about/organization/tokyo/kokugai/index.htm' },
      { label: '国税庁｜No.1910 中途退職で年末調整を受けていないとき', url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1910.htm' },
      { label: '総務省｜個人住民税', url: 'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/149767_03.html' },
      { label: '横浜市青葉区｜海外転出時の住民税', url: 'https://www.city.yokohama.lg.jp/aoba/kurashi/koseki_zei_hoken/zeikin/kojin/faq/taxqa6-9.html' },
    ],
    items: items([
      ['tax-resign', '退職手続きと源泉徴収票の受け取り'],
      ['tax-income', '所得税の確定申告が必要か確認'],
      ['tax-resident', '住民税の払い方を決める（一括納付か納税管理人）'],
    ]),
  },
  {
    id: 'city',
    title: '役所の手続き',
    notes: [
      '1年以上海外に住む場合は転出届（国外転出届）を出す。マイナンバーカードは、このとき国外継続利用の手続きをしないと失効する。',
      '退職日から出国日まで日が空くなら、その間は国民健康保険の対象。加入・脱退の届出は14日以内。',
      '海外に住むと国民年金は強制加入ではなくなる。日本国籍なら任意加入でき、出国前なら市区町村の窓口で手続きする。',
    ],
    sources: [
      { label: '大阪市｜転出届（海外へ1年以上の場合も届出）', url: 'https://www.city.osaka.lg.jp/shimin/page/0000369823.html' },
      { label: 'マイナンバーカード総合サイト｜国外転出をする場合', url: 'https://www.kojinbango-card.go.jp/faq_other9/' },
      { label: '厚生労働省｜国民健康保険の加入・脱退について', url: 'https://www.mhlw.go.jp/stf/newpage_21539.html' },
      { label: '日本年金機構｜国民年金の任意加入の手続き', url: 'https://www.nenkin.go.jp/service/kokunen/kanyu/20140627-02.html' },
    ],
    items: items([
      ['city-move-out', '国外転出届を出す'],
      ['city-mynumber', 'マイナンバーカードの手続き（転出届と同時）'],
      ['city-nhi', '国民健康保険の届出（退職日〜出国日）'],
      ['city-pension', '国民年金の手続き（任意加入するか決める）'],
    ]),
  },
  {
    id: 'departure',
    title: '出発・入国の日',
    notes: [
      '入国審査で見せるもの：パスポート、POE Letter、保険の証明、資金証明、帰国便の航空券か資金、Work Permit 申請時に出した書類のコピー。預け荷物には入れない。',
      'Work Permit は空港を出る前に、名前・有効期限・雇用主が Open・就労制限の有無を確認し、間違いがあればその場で係官に伝える。',
    ],
    sources: [{ label: 'IRCC｜IEC: Prepare for arrival', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/iec/prepare-arrival.html' }],
    items: items([
      ['dep-carry', '入国審査で見せる書類を手荷物にまとめる'],
      ['dep-wp', 'Work Permit の内容を空港で確認'],
    ]),
  },
  {
    id: 'after',
    title: '到着後',
    notes: [
      'カナダで働くには SIN が必要。申請すれば番号が届く前から働ける。オンライン・Service Canada の窓口・郵送で申請できる。',
      '3か月以上外国に住む日本人は在留届を出す（旅券法）。オンラインなら到着の90日前から出せる。',
    ],
    sources: [
      { label: 'Service Canada｜SIN for temporary residents', url: 'https://www.canada.ca/en/employment-social-development/services/sin/temporary-residents.html' },
      { label: '外務省｜在留届 よくある質問', url: 'https://www.ezairyu.mofa.go.jp/RRnet/faq.html' },
    ],
    items: items([
      ['after-sin', 'SIN を申請'],
      ['after-zairyu', '在留届を出す'],
    ]),
  },
];

export const ALL_ITEMS: { sectionId: string; sectionTitle: string; item: ChecklistItem }[] = SECTIONS.flatMap((s) =>
  s.items.map((item) => ({ sectionId: s.id, sectionTitle: s.title, item })),
);

export const DEFAULT_CHECKED: Record<string, boolean> = Object.fromEntries(
  ALL_ITEMS.map(({ item }) => [item.id, item.defaultChecked]),
);

/** 出発日までの残り日数（当日は0、出発後は負の値） */
export function daysUntilDeparture(today: Date): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(`${DEPARTURE_DATE}T00:00:00Z`).getTime();
  return Math.round((d - t) / 86_400_000);
}
