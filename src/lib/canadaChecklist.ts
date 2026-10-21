// カナダワーホリ（2027-04-01 入国予定）でやらなければいけないことのリスト。
// 月ごとではなく「何の手続きか」でまとめ、入国・就労・日本とカナダの法的な手続きで必要なものだけを載せている。
// 各項目に「やり方」（how）と、それを確認した公式ページ（links）を持たせる。制度は変わるので、
// 手続きの前に必ずリンク先で最新情報を確認する。
// チェック状態の初期値（defaultChecked）もここで持ち、サーバー（D1）には変更した項目の状態とメモだけを保存する。

export interface Source {
  label: string;
  url: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  /** サーバーに記録がない場合に使う初期状態 */
  defaultChecked: boolean;
  /** やり方（手順・持ち物・注意点）。1要素が1段落 */
  how: string[];
  /** やり方の出典・手続きに使う公式ページ */
  links: Source[];
}

export interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export const DEPARTURE_DATE = '2027-04-01';
/** 最終確認日（リンク先の内容を確認した日） */
export const SOURCES_CHECKED_ON = '2026-10-21';

type ItemDef = { id: string; label: string; done?: boolean; how?: string[]; links?: Source[] };
function items(defs: ItemDef[]): ChecklistItem[] {
  return defs.map((d) => ({ id: d.id, label: d.label, defaultChecked: !!d.done, how: d.how ?? [], links: d.links ?? [] }));
}

// ---- よく使う公式ページ ----
const L = {
  arrival: { label: 'IRCC｜IEC: Prepare for arrival', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/iec/prepare-arrival.html' },
  poe: { label: 'IRCC｜How long is my POE Letter valid?', url: 'https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=846&top=15' },
  startWorking: { label: 'IRCC｜IEC: Start working in Canada', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/iec/start-working.html' },
  workInCanada: { label: 'IRCC｜Work in Canada', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada.html' },
  sin: { label: 'Service Canada｜SIN for temporary residents', url: 'https://www.canada.ca/en/employment-social-development/services/sin/temporary-residents.html' },
  sinApply: { label: 'Service Canada｜SIN の申請', url: 'https://www.canada.ca/en/employment-social-development/services/sin/apply.html' },
  bank: { label: 'カナダ金融消費者庁｜銀行口座の開き方', url: 'https://www.canada.ca/en/financial-consumer-agency/services/banking/opening-bank-account.html' },
  health: { label: 'IRCC｜カナダの医療制度', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/settle-canada/health-care.html' },
  bcWh: { label: 'BC州｜ワーホリの MSP 加入条件', url: 'https://www2.gov.bc.ca/gov/content/health/health-drug-coverage/msp/bc-residents/eligibility-and-enrolment/are-you-eligible/working-holiday-programs' },
  bcMsp: { label: 'BC州｜MSP の加入資格', url: 'https://www2.gov.bc.ca/gov/content/health/health-drug-coverage/msp/bc-residents/eligibility-and-enrolment/are-you-eligible' },
  ohip: { label: 'オンタリオ州｜OHIP の申し込み', url: 'https://www.ontario.ca/page/apply-ohip-and-get-health-card' },
  ahcip: { label: 'アルバータ州｜一時滞在者の AHCIP', url: 'https://www.alberta.ca/ahcip-temporary-residents' },
  rights: { label: 'IRCC｜Worker rights and labour standards', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/work-canada/worker-rights.html' },
  craNewcomers: { label: 'CRA｜Newcomers to Canada', url: 'https://www.canada.ca/en/revenue-agency/services/tax/international-non-residents/individuals-leaving-entering-canada-non-residents/newcomers-canada-immigrants.html' },
  craDates: { label: 'CRA｜申告と支払いの期限', url: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/important-dates-individuals.html' },
  extendStay: { label: 'IRCC｜ビジターとして滞在を延長する', url: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/extend-stay.html' },
  ntaDeparture: { label: '国税庁｜出国する時の準確定申告の記載例（PDF）', url: 'https://www.nta.go.jp/taxes/shiraberu/shinkoku/kisairei/2020/pdf/016.pdf' },
  ntaLeaflet: { label: '東京国税局｜国外転出を予定している給与所得者へ', url: 'https://www.nta.go.jp/about/organization/tokyo/kokugai/index.htm' },
  nta1910: { label: '国税庁｜No.1910 中途退職で年末調整を受けていないとき', url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1910.htm' },
  residentTax: { label: '総務省｜個人住民税', url: 'https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/149767_03.html' },
  residentTaxAbroad: { label: '横浜市青葉区｜海外転出時の住民税', url: 'https://www.city.yokohama.lg.jp/aoba/kurashi/koseki_zei_hoken/zeikin/kojin/faq/taxqa6-9.html' },
  moveOut: { label: '大阪市｜転出届（海外へ1年以上の場合も届出）', url: 'https://www.city.osaka.lg.jp/shimin/page/0000369823.html' },
  myNumber: { label: 'マイナンバーカード総合サイト｜国外で利用する', url: 'https://www.kojinbango-card.go.jp/apprec/abroad/' },
  myNumberFaq: { label: 'マイナンバーカード総合サイト｜国外転出をする場合', url: 'https://www.kojinbango-card.go.jp/faq_other9/' },
  nhi: { label: '厚生労働省｜国民健康保険の加入・脱退', url: 'https://www.mhlw.go.jp/stf/newpage_21539.html' },
  pension: { label: '日本年金機構｜国民年金の任意加入の手続き', url: 'https://www.nenkin.go.jp/service/kokunen/kanyu/20140627-02.html' },
  pensionPdf: { label: '日本年金機構｜出入国する方の国民年金の手続き（PDF）', url: 'https://www.nenkin.go.jp/service/pamphlet/kokuminnenkin.files/syutsunyukoku.pdf' },
  pensionCanada: { label: '日本年金機構｜協定相手国別の注意事項（カナダ）', url: 'https://www.nenkin.go.jp/service/shaho-kyotei/kunibetsu/notice/canada.html' },
  zairyu: { label: '外務省｜在留届（ORRネット）', url: 'https://www.ezairyu.mofa.go.jp/RRnet/index.html' },
  zairyuFaq: { label: '外務省｜在留届 よくある質問', url: 'https://www.ezairyu.mofa.go.jp/RRnet/faq.html' },
} satisfies Record<string, Source>;

export const SECTIONS: ChecklistSection[] = [
  {
    id: 'entry',
    title: '入国の条件をそろえる',
    items: items([
      {
        id: 'entry-flight',
        label: '4月1日、カナダ行きの便を押さえる',
        how: [
          'POE Letter の有効期限（2027年5月ごろ）より前に入国する便を取る。',
          '預け荷物の個数・重さの上限を見て航空会社を選ぶ。',
          '購入したら e チケットの控えを保存し、印刷もしておく。',
        ],
        links: [L.poe],
      },
      {
        id: 'entry-return',
        label: '帰りの切符か、その分の資金を確保する',
        how: [
          '入国審査では、カナダを出る航空券か、それを買えるだけのお金があることを示す必要がある。',
          '片道で行く場合は、資金証明の CAD 2,500 相当とは別に、帰国便の分のお金も口座に入れておく。',
        ],
        links: [L.arrival],
      },
      {
        id: 'entry-insurance',
        label: '海外医療保険で1年間の守りを固める',
        how: [
          '医療・入院・本国送還（repatriation）の3つをカバーしている保険を選ぶ。',
          '保険期間を2027年4月1日から滞在の終わり（約1年）までにする。期間が短いと Work Permit も保険の終了日までになり、後からその理由で延長することはできない。',
          '州の医療保険カードだけでは条件を満たさない。保険がないと入国を断られることがある。',
          '英文の保険証券（加入証明）を受け取り、印刷して手荷物に入れる。',
        ],
        links: [L.arrival],
      },
      {
        id: 'entry-stay',
        label: '着いた夜の寝床を確保する',
        how: [
          '到着してすぐ泊まる場所を予約し、住所と予約確認を控える。',
          '銀行口座を作るときなどに住所が必要になるので、最初の住所として使える。',
        ],
        links: [L.bank],
      },
      {
        id: 'entry-statement',
        label: '3月25日以降、英文の残高証明を手に入れる',
        how: [
          '最初の3か月分の生活費として、CAD 2,500 相当以上が入った口座の英文残高証明を用意する。',
          '出発日の1週間以内に発行されたものが必要。4月1日出発なら3月25日以降に発行してもらう。',
          '発行に日数がかかる銀行もあるので、申し込み方法と日数を先に銀行に確認しておく。',
          'CAD 10,000 相当以上の現金などを持って入国する場合は、入国時に申告する。しないと罰金などの対象になる。',
        ],
        links: [L.arrival],
      },
    ]),
  },
  {
    id: 'job-tax',
    title: '退職・税金',
    items: items([
      {
        id: 'tax-resign',
        label: '会社を卒業し、源泉徴収票を受け取る',
        how: [
          '退職日を決めて会社に伝える。出国日との間があくと国民健康保険の手続きが必要になるので、日付を並べて決める。',
          '2027年1月から退職日までの源泉徴収票を、出国前に受け取れるか会社に確認する。所得税の精算に使う。',
          '会社の健康保険の資格確認書などを返す。',
        ],
        links: [L.ntaDeparture, L.nhi],
      },
      {
        id: 'tax-income',
        label: '所得税にケリをつける（準確定申告か納税管理人）',
        how: [
          '2027年1月から退職日までの給与は年末調整されないので、所得税を納め過ぎていることがある。',
          '出国前に税務署で準確定申告をすれば、1月1日から出国日までの分を精算できる。源泉徴収票の内容が必要。',
          '出国前に申告しない場合は、納税管理人を決めて税務署に届け出る。申告が必要なのに何もせず出国すると、加算税や延滞税がかかることがある。',
        ],
        links: [L.ntaDeparture, L.ntaLeaflet, L.nta1910],
      },
      {
        id: 'tax-resident',
        label: '住民税の支払いルートを決める',
        how: [
          '住民税は1月1日に住んでいた市区町村が、前年の所得をもとに課税する。2027年1月1日は日本にいるので、2027年度分（2026年の所得分）がかかる。',
          '年の途中で出国しても、その年度分は全額払う。',
          '役所の住民税の窓口で出国日を伝え、出国前にまとめて払えるか、納税管理人（家族など）を届け出て出国後に払ってもらうかを決める。',
        ],
        links: [L.residentTax, L.residentTaxAbroad],
      },
    ]),
  },
  {
    id: 'city',
    title: '役所の手続き',
    items: items([
      {
        id: 'city-move-out',
        label: '国外転出届で、日本の住所に区切りをつける',
        how: [
          '1年以上海外に住む場合は、住んでいる市区町村に転出届（国外転出届）を出す。',
          'いつから受け付けるかは市区町村によって違うので、事前に確認する。',
          '持ち物の例：本人確認書類、マイナンバーカード、国民健康保険の資格確認書（持っている人）。',
          'マイナンバーカード・国民健康保険・国民年金の手続きも、同じ日に市区町村の窓口でまとめてできる。',
        ],
        links: [L.moveOut],
      },
      {
        id: 'city-mynumber',
        label: 'マイナンバーカードを海外仕様にする（転出届と同時）',
        how: [
          '転出届を出すときにマイナンバーカードを持って行き、「個人番号カード国外継続利用申請書」を出す。国外転出予定日の前日までに済ませる。',
          'カードの表面に国外転出日が書き足され、海外に住んでいる間も使えるカードとして返してもらえる。国外転出者向けの電子証明書も発行される。',
          '手続きしないと、出国予定日にカードは失効する。',
        ],
        links: [L.myNumber, L.myNumberFaq],
      },
      {
        id: 'city-nhi',
        label: '退職から出国までのすき間を国保で埋める',
        how: [
          '会社の健康保険は退職すると使えなくなる。日本に住所があって職場の健康保険に入っていない間は、国民健康保険の対象になる。',
          '退職日から出国日まで日があくなら、市区町村で国民健康保険に加入する。加入・脱退の届出は14日以内。',
          '転出届を出すときに、脱退の手続きもする。',
        ],
        links: [L.nhi],
      },
      {
        id: 'city-pension',
        label: '国民年金を続けるか、止めるかを決める',
        how: [
          '海外に住むと、国民年金は強制加入ではなくなる。手続きは市区町村の国民年金の窓口。',
          '任意加入する場合は、出国前に窓口で申し出る。保険料は日本の口座からの引き落としか、日本にいる家族などが代わりに払う。払った期間は将来の年金額に反映される。',
          '日加社会保障協定により、カナダで働いて払うカナダ年金（CPP）の期間は、日本の年金の受給資格期間に通算できる。',
        ],
        links: [L.pension, L.pensionPdf, L.pensionCanada],
      },
    ]),
  },
  {
    id: 'departure',
    title: '出発・入国の日',
    items: items([
      {
        id: 'dep-carry',
        label: '入国審査の書類一式を機内持ち込みにまとめる',
        how: [
          '預け荷物に入れず、手荷物にまとめる。',
          'パスポート／POE Letter（印刷）／海外医療保険の英文証明／残高証明（3月25日以降発行）／帰国便の航空券か、それを買える資金／Work Permit 申請時に出した書類のコピー',
          '入国審査の係官にすぐ見せられるようにしておく。',
        ],
        links: [L.arrival],
      },
      {
        id: 'dep-wp',
        label: '空港を出る前に、Work Permit を隅々までチェック',
        how: [
          '入国審査で Work Permit が発行されたら、空港を出る前に確認する。',
          '名前のつづり／パスポート情報／有効期限（Valid until）／雇用主が Open・勤務地が Unknown になっているか／就労制限（medical restrictions など）がないか',
          '間違いがあれば、その場で係官に伝える。',
        ],
        links: [L.arrival],
      },
    ]),
  },
  {
    id: 'after',
    title: '到着後すぐ',
    items: items([
      {
        id: 'after-sin',
        label: 'SIN を取って、働く準備を整える',
        how: [
          'カナダで働くには SIN（社会保険番号）が必要。到着したらできるだけ早く申し込む。',
          'オンライン、Service Canada の窓口、郵送のどれかで申請する。',
          '必要なもの：Work Permit とパスポート。IRCC からのメールは書類として使えない。',
          '申請すれば、番号が届く前から働き始められる。',
        ],
        links: [L.sin, L.sinApply, L.startWorking],
      },
      {
        id: 'after-zairyu',
        label: '在留届で、日本に居場所を知らせる',
        how: [
          '3か月以上外国に住む日本人は、住所を管轄する大使館・総領事館に在留届を出す（旅券法）。',
          '外務省の ORRネットでオンライン提出できる。現地到着の90日前から出せて、住所や電話番号が決まっていなくても出せる。',
          '入力するもの：氏名、生年月日、パスポート情報、メールアドレス、住所と電話番号、職業、滞在期間、緊急連絡先。入力したメールアドレスがログイン ID になる。',
          '住所が決まったら、ORRネットにログインして内容を更新する。',
        ],
        links: [L.zairyu, L.zairyuFaq],
      },
      {
        id: 'after-bank',
        label: 'カナダの口座を開いて、給料の受け皿をつくる',
        how: [
          '給料の振込や家賃の支払いに使う口座を作る。',
          '身分証明書は原本が必要（コピーは不可）。名前と住所がわかる書類と、名前と生年月日がわかる書類の2つを持って行く（例：パスポートと、住所が書かれた書類）。',
          '仕事が決まっていなくても、入金するお金がなくても口座は作れる。',
        ],
        links: [L.bank],
      },
      {
        id: 'after-health',
        label: '州の医療保険、対象なら迷わず申し込む',
        how: [
          '州ごとに条件が違う。住む州が決まったら、その州のページで確認する。',
          'BC州：ワーホリでも、6か月以上続けて滞在し、6か月以上・週18時間以上働くなどの条件を満たせば MSP の対象。BC州では対象になる住民は加入しなければならない。',
          'オンタリオ州：オンタリオの雇用主のもとで6か月以上フルタイムで働く場合などが対象。',
          'アルバータ州：オープンワークパーミットで12か月以上住むつもりなら対象になり得る。期限まで6か月未満のパーミットは対象外。',
          '州の保険が始まるまで時間がかかることがあるので、日本で入った海外医療保険は続ける。',
        ],
        links: [L.bcWh, L.bcMsp, L.ohip, L.ahcip, L.health],
      },
    ]),
  },
  {
    id: 'stay',
    title: '働き始めてから',
    items: items([
      {
        id: 'stay-work',
        label: '初出勤の前に、働く側の権利を押さえる',
        how: [
          '雇用主に SIN を伝える。',
          '雇用主はパスポートや Work Permit を取り上げることはできない。危険な仕事は断れる。',
          '給料・残業・休憩などのルールは州ごとに決まっている。困ったら州の労働基準の窓口に相談できる。雇用主の許可はいらず、相談したことで罰せられたり国外に退去させられたりしない。',
        ],
        links: [L.rights, L.startWorking],
      },
      {
        id: 'stay-tax',
        label: '2028年4月30日までに、カナダで初の確定申告',
        how: [
          '税金の上で居住者になると、その翌年からカナダで確定申告をする。多くの人はカナダに住み始めた日から居住者になる。',
          '2027年分の期限は2028年4月30日。NETFILE 対応のソフト（無料のものもある）か、紙で申告する。収入が少なく単純な場合は、無料のボランティア申告相談も使える。',
          'SIN が必要。',
        ],
        links: [L.craNewcomers, L.craDates],
      },
      {
        id: 'stay-wp-end',
        label: 'Work Permit が切れる前に、帰るか残るかを決める',
        how: [
          'IEC の Work Permit は、国ごとに決まった上限を超えて延長できない。期限が切れたら働けない。',
          'すぐ帰国できない場合は、期限が切れる前にビジターとして滞在延長を申請する。',
          'カナダの外に出て戻るときは、Work Permit があっても入国のたびに審査される。',
        ],
        links: [L.startWorking, L.extendStay, L.workInCanada],
      },
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
