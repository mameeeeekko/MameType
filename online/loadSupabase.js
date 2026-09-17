//supabase.js
// ======================================================================
// ★v1.0.42: supabase は「実際に通信する瞬間」だけ動的importする。
// ----------------------------------------------------------------------
//  supabase.js は https://esm.sh のモジュールを静的importしているため、
//  このファイルを静的にimportすると、esm.sh が取得できない環境
//  （＝オフライン起動時）にモジュール解決が失敗し、
//  呼び出し元（main.js など）ごと起動できなくなる。
//  そのため読み込みを関数内に閉じ込め、失敗時は null を返して
//  「オンライン機能なし」として安全にフォールバックする。
// ======================================================================

let _supabasePromise = null;

/**
 * Supabaseクライアントを取得する（初回のみ読み込み、以後は使い回す）
 * @returns {Promise<object|null>} 取得できなければ null
 */
export function loadSupabase() {
  if (!_supabasePromise) {
    _supabasePromise = import("./supabase.js")
      .then(m => m.supabase)
      .catch(e => {
        console.warn("[online] Supabaseクライアントを読み込めません（オフライン扱い）:", e);
        return null;
      });
  }
  return _supabasePromise;
}