// Source-verified facts are deliberately NOT inputs to model.ts.
export const scientificFacts = [
  {
    evidenceClass: 'source-verified',
    title: '酒母は酵母を育てる工程',
    text: '酒母では清酒の発酵に用いる酵母を培養します。生酛系は乳酸菌がつくる乳酸を利用し、速醸系は醸造用乳酸を使います。',
    source: '酒類総合研究所「清酒」生酛（山廃）系酒母とは',
    url: 'https://www.nrib.go.jp/sake/sakefaq02.html',
    checkedOn: '2026-09-07',
  },
  {
    evidenceClass: 'source-verified',
    title: '糖化と発酵は異なる働き',
    text: '清酒の醪では、麹由来の酵素による米のでんぷんの糖化と、酵母によるアルコール発酵が並行して進みます。',
    source: '酒類総合研究所「エヌリブ16号」3頁',
    url: 'https://www.nrib.go.jp/sake/nrib/pdf/NRIBNo16.pdf',
    checkedOn: '2026-09-07',
  },
] as const;
export const educationalNote = {
  evidenceClass: 'educational-simplification',
  text: '「糖を利用する」という関係だけを、糖のアイコンを集める遊びに置き換えています。移動して粒を食べる描写は、実際の酵母の摂取方法を再現していません。',
};
export const fictionalNote = {
  evidenceClass: 'game-model',
  text: 'キャラクター、競合の追跡、パルス、ダッシュ、酸性化ゲージと緑区画の減速、温度別の係数は架空です。競合は特定の菌種・病原菌を表しません。ゲージはpHでも酸度でもありません。',
};
export const disclaimer =
  'このゲームは仕込み・飲用可否・菌数・酒質を判定しない。';
