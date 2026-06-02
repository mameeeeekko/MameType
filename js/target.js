// target.js
// id 今現在使用していない。
// tags : 句読点、促音、記号、英語、ことわざ、擬音
export const TARGETS = [
  {
    word: "あんなに、そんなに知らなかった。",
    text: "あんなに、そんなにしらなかった。",
    tags: ["句読点"],
  },
  {
    word: "きっと切って買ってきて。",
    text: "きっときってかってきて。",
    tags: ["促音","句読点"],
  },
  {
    word: "キャンプファイヤーきょんきょん",
    text: "きゃんぷふぁいやーきょんきょん",
    tags: ["促音"],
  },
    {
    word: "とん",
    text: "とん",
    tags: [""],
  },
  {
    word: "その上で、うんと何と本当に！",
    text: "そのうえで、うんとなんとほんとに！",
    tags: ["促音", "記号"],
  },
  {
    word: "今日は晴れ",
    text: "きょうははれ",
    tags: [""],
  }, 
  {
    word: "今日はUFO",
    text: "きょうはUFO",
    tags: ["英語"],
  }, 
  {
    word: "うん",
    text: "うん",
    tags: [""],
  },
  {
    word: "かん",
    text: "かん",
    tags: [""],
  },
  {
    word: "椅子",
    text: "いす",
    tags: [""],
  },  
  {
    word: "餅",
    text: "もち",
    tags: [""],
  }, 
  {
    word: "today",
    text: "today",
    tags: ["英語"],
  }
];

export const TARGETS_LONG = [
  {
    word: "胃胃いいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいい。",
    text: "いいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいいい。",
    tags: ["長文"],
  },
  {
    word: "いいいいいいいいいいいい、ううううううううううう、ええええええええええ、おおおおおおおおおおお。あああああああああああああああああ、いいいいいいいいいいいいい、ううううううううううう。",
    text: "いいいいいいいいいいいい、ううううううううううう、ええええええええええ、おおおおおおおおおおお。あああああああああああああああああ、いいいいいいいいいいいいい、ううううううううううう。",
    tags: ["長文"],
  }, 
  ];

// ===============================
// 問題取得関数
// enemySpawner などから呼ぶ
// ===============================

export function getWord(tags, minLen, maxLen){

    // tagsが未指定なら空配列
    tags = tags || [];

    let pool = TARGETS.filter(target => {
        const len = target.text.length;
        const lenMatch =
            len >= minLen && len <= maxLen;
        // tagが未指定なら全部OK
        const tagMatch =
            tags.length === 0 ||
            tags.some(tag => target.tags.includes(tag));

        return lenMatch && tagMatch;

    });

    if(pool.length === 0){
        console.warn("条件に合う問題がない", tags, minLen, maxLen);
        return null;
    }

    const target =
        pool[Math.floor(Math.random()*pool.length)];

    return target;
}