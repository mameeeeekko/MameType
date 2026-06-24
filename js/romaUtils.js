// romaUtils.js
export const ROMA_TABLE = {
  'あ': ['a'], 'い': ['i', 'yi'], 'う': ['u', 'wu'], 'え': ['e'], 'お': ['o'],
  'か': ['ka', 'ca'], 'き': ['ki'], 'く': ['ku', 'cu', 'qu'], 'け': ['ke'], 'こ': ['ko', 'co'],
  'さ': ['sa'], 'し': ['si', 'shi', 'ci'], 'す': ['su'], 'せ': ['se', 'ce'], 'そ': ['so'],
  'た': ['ta'], 'ち': ['ti', 'chi'], 'つ': ['tu', 'tsu'], 'て': ['te'], 'と': ['to'],
  'な': ['na'], 'に': ['ni'], 'ぬ': ['nu'], 'ね': ['ne'], 'の': ['no'],
  'は': ['ha'], 'ひ': ['hi'], 'ふ': ['fu', 'hu'], 'へ': ['he'], 'ほ': ['ho'],
  'ま': ['ma'], 'み': ['mi'], 'む': ['mu'], 'め': ['me'], 'も': ['mo'],
  'や': ['ya'], 'ゆ': ['yu'], 'よ': ['yo'],
  'ら': ['ra'], 'り': ['ri'], 'る': ['ru'], 'れ': ['re'], 'ろ': ['ro'],
  'わ': ['wa'], 'ゐ': ['wyi'], 'ゑ': ['wye'], 'を': ['wo'], 'ん': ['nn', 'xn', 'n'],
  'が': ['ga'], 'ぎ': ['gi'], 'ぐ': ['gu'], 'げ': ['ge'], 'ご': ['go'],
  'ざ': ['za'], 'じ': ['ji', 'zi'], 'ず': ['zu'], 'ぜ': ['ze'], 'ぞ': ['zo'],
  'だ': ['da'], 'ぢ': ['di'], 'づ': ['du'], 'で': ['de'], 'ど': ['do'],
  'ば': ['ba'], 'び': ['bi'], 'ぶ': ['bu'], 'べ': ['be'], 'ぼ': ['bo'],
  'ぱ': ['pa'], 'ぴ': ['pi'], 'ぷ': ['pu'], 'ぺ': ['pe'], 'ぽ': ['po'],
   'うぁ': ['wha', 'ula', 'uxa'], 'うぃ': ['wi','whi', 'uli', 'uxi'], 'うぇ': ['we','whe', 'ule', 'uxe'], 'うぉ': ['wo','who', 'ulo', 'uxo'],
  'きゃ': ['kya', 'kilya', 'kixya'], 'きぃ': ['kyi', 'kili', 'kixi'], 'きゅ': ['kyu', 'kilyu', 'kixyu'], 'きぇ': ['kye', 'kile', 'kixe'], 'きょ': ['kyo', 'kilyo', 'kixyo'],
  'くぁ': ['qa', 'qwa', 'kula', 'kuxa'], 'くぃ': ['qi', 'qwi', 'kuli', 'kuxi'], 'くぇ': ['qe', 'qwe', 'kule', 'kuxe'], 'くぉ': ['qo', 'qwo', 'kulo', 'kuxo'], 'くゃ': ['qya', 'kulya', 'kuxya'], 'くゅ': ['qyu', 'kulyu', 'kuxyu'], 'くょ': ['qyo', 'kulyo', 'kuxyo'],
  'しゃ': ['sya', 'sha', 'silya', 'sixya', 'shilya', 'shixya'], 'しぃ': ['syi', 'sili', 'sixi', 'shili', 'shixi'], 'しゅ': ['syu', 'shu', 'silyu', 'sixyu', 'shilyu', 'shixyu'], 'しぇ': ['sye', 'she', 'sile', 'sixe', 'shile', 'shixe'], 'しょ': ['syo', 'sho', 'silyo', 'sixyo', 'shilyo', 'shixyo'],
  'すぁ': ['swa', 'sula', 'suxa'], 'すぃ': ['swi', 'suli', 'suxi'], 'すぅ': ['swu', 'sulu', 'suxu'], 'すぇ': ['swe', 'sule', 'suxe'], 'すぉ': ['swo', 'sulo', 'suxo'],
  'つぁ': ['tsa', 'tula', 'tuxa', 'tsula', 'tsuxa'], 'つぃ': ['tsi', 'tuli', 'tuxi', 'tsuli', 'tsuxi'], 'つぇ': ['tse', 'tule', 'tuxe', 'tsule', 'tsuxe'], 'つぉ': ['tso', 'tulo', 'tuxo', 'tsulo', 'tsuxo'],
  'ちゃ': ['tya', 'cha', 'tilya', 'tixya', 'chilya', 'chixya'], 'ちぃ': ['tyi', 'tili', 'tixi', 'chili', 'chixi'], 'ちゅ': ['tyu', 'chu', 'tilyu', 'tixyu', 'chilyu', 'chixyu'], 'ちぇ': ['tye', 'che', 'tile', 'tixe', 'chile', 'chixe'], 'ちょ': ['tyo', 'cho', 'tilyo', 'tixyo', 'chilyo', 'chixyo'],
  'てゃ': ['tha', 'telya', 'texya'], 'てぃ': ['thi', 'teli', 'texi'], 'てゅ': ['thu', 'telyu', 'texyu'], 'てぇ': ['the', 'tele', 'texe'], 'てょ': ['tho', 'telyo', 'texyo'],
  'とぁ': ['twa', 'tola', 'toxa'], 'とぃ': ['twi', 'toli', 'toxi'], 'とぅ': ['twu', 'tolu', 'toxu'], 'とぇ': ['twe', 'tole', 'toxe'], 'とぉ': ['two', 'tolo', 'toxo'],
  'ひゃ': ['hya', 'hilya', 'hixya'], 'ひぃ': ['hyi', 'hili', 'hixi'], 'ひゅ': ['hyu', 'hilyu', 'hixyu'], 'ひぇ': ['hye', 'hile', 'hixe'], 'ひょ': ['hyo', 'hilyo', 'hixyo'],
  'ふぁ': ['fa', 'fula', 'fuxa', 'hula', 'huxa'], 'ふぃ': ['fi', 'fuli', 'fuxi', 'huli', 'huxi'], 'ふぇ': ['fe', 'fule', 'fuxe', 'hule', 'huxe'], 'ふぉ': ['fo', 'fulo', 'fuxo', 'hulo', 'huxo'],
  'にゃ': ['nya', 'nilya', 'nixya'], 'にぃ': ['nyi', 'nili', 'nixi'], 'にゅ': ['nyu', 'nilyu', 'nixyu'], 'にぇ': ['nye', 'nile', 'nixe'], 'にょ': ['nyo', 'nilyo', 'nixyo'],
  'みゃ': ['mya', 'milya', 'mixya'], 'みぃ': ['myi', 'mili', 'mixi'], 'みゅ': ['myu', 'milyu', 'mixyu'], 'みぇ': ['mye', 'mile', 'mixe'], 'みょ': ['myo', 'milyo', 'mixyo'],
  'りゃ': ['rya', 'rilya', 'rixya'], 'りぃ': ['ryi', 'rili', 'rixi'], 'りゅ': ['ryu', 'rilyu', 'rixyu'], 'りぇ': ['rye', 'rile', 'rixe'], 'りょ': ['ryo', 'rilyo', 'rixyo'],
  'ヴぁ': ['va', 'vula', 'vuxa'], 'ヴぃ': ['vi', 'vuli', 'vuxi'], 'ヴ': ['vu'], 'ヴぇ': ['ve', 'vule', 'vuxe'], 'ヴぉ': ['vo', 'vulo', 'vuxo'],
  'ぎゃ': ['gya', 'gilya', 'gixya'], 'ぎぃ': ['gyi', 'gili', 'gixi'], 'ぎゅ': ['gyu', 'gilyu', 'gixyu'], 'ぎぇ': ['gye', 'gile', 'gixe'], 'ぎょ': ['gyo', 'gilyo', 'gixyo'],
  'ぐぁ': ['gwa', 'gula', 'guxa'], 'ぐぃ': ['gwi', 'guli', 'guxi'], 'ぐぅ': ['gwu', 'gulu', 'guxu'], 'ぐぇ': ['gwe', 'gule', 'guxe'], 'ぐぉ': ['gwo', 'gulo', 'guxo'],
  'じゃ': ['ja', 'zya', 'jilya', 'jixya', 'zilya', 'zixya'], 'じぃ': ['jyi', 'zyi', 'jili', 'jixi', 'zili', 'zixi'], 'じゅ': ['ju', 'zyu', 'jilyu', 'jixyu', 'zilyu', 'zixyu'], 'じぇ': ['je', 'zye', 'jile', 'jixe', 'zile', 'zixe'], 'じょ': ['jo', 'zyo', 'jilyo', 'jixyo', 'zilyo', 'zixyo'],
  'でゃ': ['dha', 'delya', 'dexya'], 'でぃ': ['dhi', 'deli', 'dexi'], 'でゅ': ['dhu', 'delyu', 'dexyu'], 'でぇ': ['dhe', 'dele', 'dexe'], 'でょ': ['dho', 'delyo', 'dexyo'],
  'ぢゃ': ['dya', 'dilya', 'dixya'], 'ぢぃ': ['dyi', 'dili', 'dixi'], 'ぢゅ': ['dyu', 'dilyu', 'dixyu'], 'ぢぇ': ['dye', 'dile', 'dixe'], 'ぢょ': ['dyo', 'dilyo', 'dixyo'],
  'びゃ': ['bya', 'bilya', 'bixya'], 'びぃ': ['byi', 'bili', 'bixi'], 'びゅ': ['byu', 'bilyu', 'bixyu'], 'びぇ': ['bye', 'bile', 'bixe'], 'びょ': ['byo', 'bilyo', 'bixyo'],
  'ぴゃ': ['pya', 'pilya', 'pixya'], 'ぴぃ': ['pyi', 'pili', 'pixi'], 'ぴゅ': ['pyu', 'pilyu', 'pixyu'], 'ぴぇ': ['pye', 'pile', 'pixe'], 'ぴょ': ['pyo', 'pilyo', 'pixyo'],
  'ぁ': ['la', 'xa'], 'ぃ': ['li', 'xi'], 'ぅ': ['lu', 'xu'], 'ぇ': ['le', 'xe'], 'ぉ': ['lo', 'xo'],
  'ゃ': ['lya', 'xya'], 'ゅ': ['lyu', 'xyu'], 'ょ': ['lyo', 'xyo'], 'っ': ['ltu', 'xtu'],
  'ー': ['-', 'ー', '－'], ',': [',', '，'], '.': ['.', '．'], '、': [',', '、'], '。': ['.', '。'], '・': ['/', '・'], '!': ['!', '！'], '?': ['?', '？'],
  '「': ['[', '「'], '」': [']', '」'],
  '(': ['(', '（'], ')': [')', '）'], '（': ['(', '（'], '）': [')', '）'],
  '[': ['[', '「', '［'], ']': [']', '」', '］'],
  '-': ['-', '－'], '－': ['-', '－'],
  '@': ['@', '＠'], '＠': ['@', '＠'],
  '%': ['%', '％'], '％': ['%', '％'], '$': ['$', '＄'], '＄': ['$', '＄'],
  '#': ['#', '＃'], '＃': ['#', '＃'], '^': ['^', '＾'], '＾': ['^', '＾'],
  '&': ['&', '＆'], '＆': ['&', '＆'], '~': ['~', '～'], '～': ['~', '～'],
  ':': [':', '：'], ';': [';', '；'],
  '*': ['*', '＊'], '+': ['+', '＋'],
  '=': ['=', '＝'], '＝': ['=', '＝'],
  '<': ['<', '＜'], '＜': ['<', '＜'], '>': ['>', '＞'], '＞': ['>', '＞'],
  '{': ['{', '｛'], '｛': ['{', '｛'], '}': ['}', '｝'], '｝': ['}', '｝'],
  '/': ['/', '／'], '／': ['/', '／'], '\\': ['\\', '＼'], '＼': ['\\', '＼'],
  '_': ['_', '＿'], '＿': ['_', '＿'],
  "'": ["'", "’"], "’": ["'", "’"], '"': ['"', '”'], '”': ['"', '”'],
  '|': ['|', '｜'], '｜': ['|', '｜'],
  '0': ['0', '０'], '1': ['1', '１'], '2': ['2', '２'], '3': ['3', '３'], '4': ['4', '４'],
  '5': ['5', '５'], '6': ['6', '６'], '7': ['7', '７'], '8': ['8', '８'], '9': ['9', '９'],
  '０': ['0', '０'], '１': ['1', '１'], '２': ['2', '２'], '３': ['3', '３'], '４': ['4', '４'],
  '５': ['5', '５'], '６': ['6', '６'], '７': ['7', '７'], '８': ['8', '８'], '９': ['9', '９'],
};

export const SYMBOL_TABLE = {
  "。": ".", "、": ",", "！": "!", "？": "?" , "ー": "-", "「": "[", "」": "]", " ": " ",
  "（": "(", "）": ")", "(": "(", ")": ")", "-": "-", "－": "-", "@": "@", "＠": "@",
  "[": "[", "]": "]", "［": "[", "］": "]", "％": "%", "%": "%", "$": "$", "＄": "$",
  "#": "#", "＃": "#", "^": "^", "＾": "^", "&": "&", "＆": "&", "~": "~", "～": "~",
  "：": ":", "；": ";", "＊": "*", "＋": "+", "=": "=", "＝": "=",
  "<": "<", "＜": "<", ">": ">", "＞": ">", "{": "{", "｛": "{", "}": "}", "｝": "}",
  "/": "/", "／": "/", "\\": "\\", "＼": "\\", "_": "_", "＿": "_",
  "'": "'", "’": "'", '"': '"', "”": '"', "|": "|", "｜": "|",
  " ": " ", "　": " ",
  "０": "0", "１": "1", "２": "2", "３": "3", "４": "4", "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
  "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9"
};

export const isSmallTsu = kana => kana === "っ";
export const isSymbol = kana => kana in SYMBOL_TABLE;
export const isN = kana => kana === "ん";
export const isNaRow = kana => ["な","に","ぬ","ね","の"].includes(kana);

// ----------------------
// 全角英字 → 半角
// ----------------------
export function toHalfWidthAlpha(str){
  if(!str) return str;   // ← 追加（undefined/null防止）

  // 全角記号・英数字の範囲（！〜〜）を網羅的に半角へ変換するように改善
  return str.replace(/[！-～]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );
}


export function getKana(text,pos){
  if (pos >= text.length) return null;

  const two = text.slice(pos, pos + 2);
  if (ROMA_TABLE[two]) return two;
  
  const one = text[pos];
  return one;
}

// ----------------------
// ローマ字候補取得
// ----------------------
export function getRomajiCandidates(kana){

  if(!kana) return [];  // ← 追加（最重要）

  // 検索用に正規化（全角→半角）したキーを作成
  const normalizedKana = toHalfWidthAlpha(kana);

  // テーブルにあればそれを返す（数字や括弧もここを通るようになる）
  if(ROMA_TABLE[normalizedKana]) {
    // 特殊処理: 末尾 'ん' の入力方式をユーザー設定で優先する
    if (normalizedKana === 'ん' || kana === 'ん') {
      const candidates = [...ROMA_TABLE[normalizedKana]];
      try {
        const mode = localStorage.getItem('final_n_mode') || 'nn';
        if (mode === 'n') {
          // 'n' を先頭に移動
          const idx = candidates.indexOf('n');
          if (idx > 0) candidates.splice(0, 0, ...candidates.splice(idx, 1));
        } else {
          // デフォルトは 'nn' を優先
          const idx = candidates.indexOf('nn');
          if (idx > 0) candidates.splice(0, 0, ...candidates.splice(idx, 1));
        }
      } catch (e) {
        // localStorage 取得エラーでも通常の配列を返す
      }
      return candidates;
    }

    return ROMA_TABLE[normalizedKana];
  }
  if(ROMA_TABLE[kana]) return ROMA_TABLE[kana]; // 念のため変換前でもチェック

  // 英数字・記号（ASCII可視文字）の場合、半角と全角の両方を受け付けるようにする
  if(/^[!-~]$/.test(normalizedKana)) {
    const half = normalizedKana.toLowerCase();
    return [half]; // 半角小文字のみを返す
  }

  return [];
}


export function getSokuonCandidates(nextKana){
  const nextRoma = getRomajiCandidates(nextKana);
  const set = new Set();
  for(const r of nextRoma){ 
    if(r.length>0) set.add(r[0]+r); 
  }
  set.add("ltu"); 
  set.add("xtu");
  return [...set];
}
