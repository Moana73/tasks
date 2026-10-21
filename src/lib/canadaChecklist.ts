// カナダワーホリ（2027-04-01 入国予定）までにやることチェックリストの中身。
// 月ごとではなく「何の手続きか」でまとめている。補足説明は各公式ページで確認した内容で、
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
    title: 'ワーホリ申請・パスポート',
    notes: [
      'POE Letter（入国許可通知）は発行から1年有効で、レターに書かれた有効期限までに入国する必要がある。期限は延長できず、過ぎると申請し直しになる。',
      'eTA は Work Permit 承認時に自動で発行され、申請に使ったパスポートに電子的に紐づいている。パスポートを新しくした場合は eTA の取り直しが必要。',
    ],
    sources: [
      { label: 'IRCC｜How long is my POE Letter valid?', url: 'https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=846&top=15' },
      { label: 'IRCC｜IEC: After you apply', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/iec/after-apply-next-steps.html' },
      { label: 'IRCC｜eTA と就労・就学許可', url: 'https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1052&top=23' },
    ],
    items: items([
      ['visa-iec', 'IEC Working Holiday 申請', true],
      ['visa-wp', 'Work Permit 申請承認', true],
      ['visa-poe', 'POE Letter 取得（有効期限 2027年5月ごろ）', true],
      ['visa-passport', 'パスポート確認（2029年3月まで有効・更新しない）', true],
      ['visa-eta-number', 'POE Letter 記載の eTA 番号を確認'],
      ['visa-eta-passport', 'eTA に紐づくパスポート番号が今のパスポートと同じか確認'],
    ]),
  },
  {
    id: 'plan',
    title: '計画を決める',
    items: items([
      ['plan-city', '最初に住む都市を決める'],
      ['plan-budget', 'ワーホリ中の貯金・予算目標を決める'],
      ['plan-job', '現地でやりたい仕事を考える'],
      ['plan-resign', '日本の仕事をいつ辞めるか決める'],
    ]),
  },
  {
    id: 'flight',
    title: '航空券',
    notes: ['入国時には、カナダを出国する航空券か、それを買えるだけの資金を示す必要がある。帰国便を買わない場合は、下の資金証明とは別にその分のお金を用意しておく。'],
    sources: [IRCC_ARRIVAL],
    items: items([
      ['flight-check', '航空券の価格をチェック'],
      ['flight-compare', '預け荷物の条件も含めて航空会社を比較'],
      ['flight-buy', '4月1日の航空券を購入'],
    ]),
  },
  {
    id: 'insurance',
    title: '海外医療保険',
    notes: [
      '医療・入院・本国送還（repatriation）をカバーし、滞在期間すべてに有効な保険が必要。州の医療保険カードだけでは足りない。保険がないと入国を拒否されることがある。',
      '保険期間が滞在予定より短いと、Work Permit の期限が保険の終了日に合わせられ、後からその理由で延長することはできない。',
    ],
    sources: [IRCC_ARRIVAL],
    items: items([
      ['ins-compare', '海外ワーホリ保険を比較'],
      ['ins-decide', '加入する保険を決める'],
      ['ins-buy', '海外医療保険を契約（4月1日から約1年間をカバー）'],
      ['ins-print', '保険証券（英文）を印刷'],
    ]),
  },
  {
    id: 'housing',
    title: '最初の滞在先',
    items: items([
      ['house-search', '最初の滞在先の候補を探す'],
      ['house-rent', '現地の家賃相場を調べる'],
      ['house-narrow', '最初の滞在先を絞る'],
      ['house-book', '最初の宿泊先を予約'],
      ['house-address', '宿泊先の住所・予約確認を控える'],
    ]),
  },
  {
    id: 'money',
    title: 'お金・カード',
    notes: [
      '資金証明：最初の3か月分の生活費として CAD 2,500 相当以上。銀行の残高証明は、カナダへ出発する日の1週間以内に発行されたものが必要（4月1日出発なら3月25日以降に取得）。',
      'CAD 10,000 相当以上の現金等を持って入国する場合は、申告しないと罰金などの対象になる。',
    ],
    sources: [IRCC_ARRIVAL],
    items: items([
      ['money-cards', '海外で使えるクレジットカードを2枚程度用意'],
      ['money-cards-setting', '日本の銀行・カードの海外利用設定を確認'],
      ['money-transfer', '海外送金の方法を決める'],
      ['money-split', 'カナダ用の資金と日本に残す資金を分ける'],
      ['money-bank-research', 'カナダの銀行を調べる'],
      ['money-statement', '英文の残高証明を取得（出発1週間以内に発行のもの）'],
    ]),
  },
  {
    id: 'career',
    title: '仕事探しの準備',
    items: items([
      ['career-cv-start', '英文CVの準備を始める'],
      ['career-cv-done', '英文CVを完成させる'],
      ['career-linkedin', 'LinkedIn などを英語化'],
      ['career-medical', '医療・介護・保育の仕事をする可能性があれば、Work Permit の就労制限を確認'],
    ]),
  },
  {
    id: 'japan-job',
    title: '退職と所得税',
    notes: [
      '年の途中で退職して年末調整を受けないと、所得税を納め過ぎていることがある。翌年以降に確定申告すれば還付を受けられ、申告は5年間できる。',
      '出国前に確定申告が必要かを確認し、必要なら出国までに申告・納税を済ませるか、納税管理人の届出をする。',
    ],
    sources: [
      { label: '国税庁｜No.1910 中途退職で年末調整を受けていないとき', url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1910.htm' },
      { label: '東京国税局｜給与所得者の方で国外転出を予定されている方へ', url: 'https://www.nta.go.jp/about/organization/tokyo/kokugai/index.htm' },
    ],
    items: items([
      ['jp-resign', '退職の手続き'],
      ['jp-salary', '最終給与を確認'],
      ['jp-withholding', '源泉徴収票の受け取り方法を確認'],
      ['jp-income-tax', '所得税の確定申告が必要か確認（還付申告は帰国後でも可）'],
    ]),
  },
  {
    id: 'japan-city',
    title: '住民票・健康保険・年金',
    notes: [
      '1年以上海外に住む場合は、市区町村に転出届（国外転出届）を出す。',
      '日本に住所があって会社の健康保険に入っていない人は国民健康保険に入る。退職日から出国日まで日が空くなら、その間は国保の対象になり、加入・脱退の届出は14日以内。',
      '海外に住むと国民年金は強制加入ではなくなるが、日本国籍なら任意加入できる。出国前なら住所地の市区町村窓口で手続きし、保険料は日本の口座からの引き落としか、日本にいる家族などが代わりに納める。',
      '日加社会保障協定により、カナダで働いて払ったカナダ年金（CPP）の加入期間は、日本の年金の受給資格期間に通算できる。',
    ],
    sources: [
      { label: '大阪市｜転出届（海外へ1年以上の場合も届出）', url: 'https://www.city.osaka.lg.jp/shimin/page/0000369823.html' },
      { label: '厚生労働省｜国民健康保険の加入・脱退について', url: 'https://www.mhlw.go.jp/stf/newpage_21539.html' },
      { label: '日本年金機構｜国民年金の任意加入の手続き', url: 'https://www.nenkin.go.jp/service/kokunen/kanyu/20140627-02.html' },
      { label: '日本年金機構｜出入国する方の国民年金の手続き（PDF）', url: 'https://www.nenkin.go.jp/service/pamphlet/kokuminnenkin.files/syutsunyukoku.pdf' },
      { label: '日本年金機構｜協定相手国別の注意事項（カナダ）', url: 'https://www.nenkin.go.jp/service/shaho-kyotei/kunibetsu/notice/canada.html' },
    ],
    items: items([
      ['city-move-out', '国外転出届を出す'],
      ['city-nhi', '国民健康保険の手続き（退職日〜出国日の空白期間を日付で整理）'],
      ['city-pension-decide', '国民年金に任意加入するか決める'],
      ['city-pension', '国民年金の手続き'],
    ]),
  },
  {
    id: 'japan-tax',
    title: '住民税',
    notes: [
      '住民税は、1月1日に住んでいた市区町村が前年の所得をもとに課税する。2027年1月1日は日本に住んでいるので、2027年度分（2026年の所得分）がかかる。',
      '年の途中で出国しても、その年度の住民税は全額納める。出国後も納付が続く場合は、納税管理人の申告が必要になることがある。',
    ],
    sources: [
      { label: '総務省｜個人住民税', url: 'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/149767_03.html' },
      { label: '横浜市青葉区｜海外転出時の住民税', url: 'https://www.city.yokohama.lg.jp/aoba/kurashi/koseki_zei_hoken/zeikin/kojin/faq/taxqa6-9.html' },
    ],
    items: items([
      ['tax-how', '住民税の支払い方法を役所で確認（一括で払うか、納税管理人に任せるか）'],
      ['tax-agent', '必要なら納税管理人を決めて届け出る'],
    ]),
  },
  {
    id: 'japan-other',
    title: 'マイナンバー・免許・契約',
    notes: [
      'マイナンバーカードを国外でも使い続けたい場合は、転出届を出すときにカードを持って行き、国外継続利用の手続きをする。手続きせずに国外転出するとカードは失効する。',
      '国外運転免許証は発行から1年有効で更新はできない。日本の住所地で申請するので、転出届の前に取る。カナダで外国の免許で運転できる期間や条件は州ごとに違う。',
    ],
    sources: [
      { label: 'マイナンバーカード総合サイト｜国外転出をする場合', url: 'https://www.kojinbango-card.go.jp/faq_other9/' },
      { label: '警視庁｜国外運転免許証取得手続', url: 'https://www.keishicho.metro.tokyo.lg.jp/menkyo/menkyo/kokugai/kokugai01.html' },
      { label: 'IRCC｜Driving in Canada', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/settle-canada/driving.html' },
    ],
    items: items([
      ['other-mynumber', 'マイナンバーカードの国外継続利用手続き（転出届と同時）'],
      ['other-license', '国際免許が必要か判断し、必要なら転出届の前に取得'],
      ['other-phone', '日本の携帯番号を残すか決める'],
      ['other-contracts', '日本の携帯・各種契約を整理'],
      ['other-mail', '郵便物の管理方法を決める'],
      ['other-sim', 'カナダで使う SIM・eSIM を比較して準備'],
    ]),
  },
  {
    id: 'docs',
    title: '書類の準備と荷造り',
    notes: ['入国審査で見せられるように、パスポート・POE Letter・保険の証明・資金証明・出国用航空券（または購入資金）・Work Permit 申請時に出した書類のコピーを用意する。'],
    sources: [IRCC_ARRIVAL],
    items: items([
      ['docs-poe-print', 'POE Letter を印刷'],
      ['docs-wp-copies', 'Work Permit 申請時に提出した書類を保存・コピー'],
      ['docs-cloud', '重要書類をスマホとクラウドにも保存'],
      ['docs-medicine', '常備薬・処方薬を準備'],
      ['docs-pack', '荷造り'],
    ]),
  },
  {
    id: 'carry-on',
    title: '機内持ち込み（預け荷物に入れない）',
    sources: [IRCC_ARRIVAL],
    items: items([
      ['bag-passport', 'パスポート', true],
      ['bag-poe', 'POE Letter', true],
      ['bag-insurance', '海外医療保険の証明書'],
      ['bag-statement', '残高証明（出発1週間以内に発行のもの）'],
      ['bag-ticket', '航空券'],
      ['bag-return', '帰国便の航空券、または購入できる資金'],
      ['bag-wp-copies', 'Work Permit 申請時に提出した書類のコピー'],
      ['bag-address', '最初の宿泊先の住所・予約確認'],
      ['bag-cards', 'クレジットカード'],
      ['bag-cash', '現金'],
      ['bag-phone', 'スマホ'],
      ['bag-charger', '充電器'],
      ['bag-battery', 'モバイルバッテリー'],
      ['bag-medicine', '常備薬'],
      ['bag-contacts', '緊急連絡先'],
    ]),
  },
  {
    id: 'arrival',
    title: '入国時：Work Permit を受け取ったら確認',
    notes: [
      '空港を出る前に Work Permit の内容をよく確認し、間違いがあればその場で係官に伝える。',
      'ワーホリの場合は、雇用主が Open、勤務地が Unknown になっているはず（時間や期間の制限がないオープンワークパーミット）。有効期限は、保険・パスポートなどの期限を超えない。',
    ],
    sources: [IRCC_ARRIVAL],
    items: items([
      ['arr-name', '名前のつづり'],
      ['arr-passport', 'パスポート情報'],
      ['arr-valid', '有効期限（Valid until）'],
      ['arr-employer', '雇用主が Open になっているか'],
      ['arr-location', '勤務地（Location）が Unknown になっているか'],
      ['arr-restrictions', '就労制限（medical restrictions など）の有無'],
    ]),
  },
  {
    id: 'after',
    title: '到着後すぐ',
    notes: [
      'カナダで働くには SIN（社会保険番号）が必要。申請すれば番号が届く前から働き始められる。Work Permit とパスポートを持って、オンライン・Service Canada の窓口・郵送のいずれかで申請する。',
      '3か月以上外国に住む日本人は、住所を管轄する在外公館に在留届を出す（旅券法）。オンラインなら現地到着の90日前から出せる。',
    ],
    sources: [
      { label: 'Service Canada｜SIN for temporary residents', url: 'https://www.canada.ca/en/employment-social-development/services/sin/temporary-residents.html' },
      { label: '外務省｜在留届 よくある質問', url: 'https://www.ezairyu.mofa.go.jp/RRnet/faq.html' },
    ],
    items: items([
      ['after-sin', 'SIN を申請'],
      ['after-phone', 'カナダの電話番号・SIM を用意'],
      ['after-bank', '銀行口座を開設'],
      ['after-zairyu', '在留届を出す'],
      ['after-housing', '長期の住まいを探す'],
      ['after-cv', '英文CVを現地向けに調整'],
      ['after-apply', '仕事に応募し始める'],
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
