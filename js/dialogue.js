// dialogue.js

import { isCleared, markDialoguePlayed, hasDialogueBeenPlayed, hasSeenTrueEnding, markTrueEndingSeen, markChoicePlayed, haveAllChoicesBeenPlayed, isChoicePlayed, getMaxClearedStageNumber } from './questProgress.js'; // ★ MODIFIED: Import new functions
import { gameState } from './gameCore.js';
import { playBGM, fadeOutBGM, playDialogueSound, playSystemDialogueSound, playSE } from './effectManager.js';
import { showHud } from './enemyCore.js';
import { DIALOGUE_DATA, CHARACTERS, RANDOM_DIALOGUES } from './dialogueData.js';
import { QUEST_MAP } from './questMap.js';
import { showQuestMap } from './main.js';
import { images } from './assetsLoader.js';
import { getStageScale } from './stageScale.js';
import { handleKey, getCandidatesForKana } from './inputCore.js';
import { getKana, isSmallTsu } from './romaUtils.js';

let dialogueModal = null;
let chatPanel = null;
let chatContent = null;
let closeButton = null;
let skipToEndButton = null; // 最後までスキップ
let skipToChoiceButton = null; // 選択肢までスキップ
let choicesContainer = null; // 選択肢コンテナ用の変数を追加
let isStaffRollShowing = false; // スタッフロール表示中フラグ

// ★ スタッフロールのスクロール速度（px/秒）。JSがrAFでピクセル絶対指定して流す。
const STAFF_ROLL_SCROLL_SPEED = 60; //60

let currentDialogueId = null;
let currentMessageIndex = 0;
let onCompleteCallback = null;
let currentTypingMessage = null; // ★ MODIFIED: 現在タイピング中のメッセージを保持

// ★★★ 修正: 状態管理をオブジェクトに集約
// 'IDLE', 'TYPING', 'WAITING', 'CHOOSING', 'WAITING_FOR_CHOICE'
let dialogueState = 'IDLE'; 

let waitingForMapReturn = false; // ★ マップに戻る待機フラグ
// イベントリスナーを管理するための変数
const DIALOGUE_SPEEDS = [100, 80, 60, 40, 15]; // Slow -> Fast (ms)
let currentDialogueSpeed = DIALOGUE_SPEEDS[3]; // デフォルトは "Fast" (30ms)

/**
 * 会話のタイピング速度を設定します。
 * @param {number} level - 速度レベル (0:Slow ~ 4:Fast)
 */
export function setDialogueSpeed(level) {
    const safeLevel = Math.max(0, Math.min(level, DIALOGUE_SPEEDS.length - 1));
    currentDialogueSpeed = DIALOGUE_SPEEDS[safeLevel];
}

/**
 * 免責事項などのメッセージをフェードイン・アウトで表示します。
 * @param {string} message - 表示するメッセージ
 * @returns {Promise<void>} ユーザーが確認すると解決するPromise
 */
export function showDisclaimer(message) {
    return new Promise(resolve => {
        const existing = document.getElementById('disclaimerOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'disclaimerOverlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85);
            color: #ccc;
            display: flex; justify-content: center; align-items: center;
            text-align: center;
            z-index: 40000;
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
            padding: 20px;
            line-height: 1.8;
            font-size: 0.9rem;
        `;
        overlay.innerHTML = `<div>${message.replace(/\n/g, '<br>')}</div>`;
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });

        const cleanup = () => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                document.removeEventListener('keydown', cleanup);
                document.removeEventListener('click', cleanup);
                resolve();
            }, 500);
        };

        overlay.addEventListener('click', cleanup, { once: true });
        document.addEventListener('keydown', cleanup, { once: true });
    });
}

export function showDialoguePlaybackChoicePopup(message, onYes, onNo) {
    const existing = document.getElementById('dialoguePlaybackChoicePopup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dialoguePlaybackChoicePopup';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '30000';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.padding = '16px';

    overlay.innerHTML = `
        <div style="max-width: 520px; width: 100%; background: #111319; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; box-shadow: 0 18px 40px rgba(0,0,0,0.45); padding: 24px; color: #f7f7f7; text-align: center;">
            <div style="margin-bottom: 22px; font-size: 1rem; line-height: 1.7;">${message}</div>
            <div style="display: flex; justify-content: center; gap: 14px; flex-wrap: wrap;">
                <button id="dialoguePlaybackChoiceYes" style="min-width: 130px; padding: 12px 18px; border: none; border-radius: 10px; background: #2f8aff; color: #fff; font-weight: 700; cursor: pointer;">再生する</button>
                <button id="dialoguePlaybackChoiceNo" style="min-width: 130px; padding: 12px 18px; border: 1px solid rgba(255,255,255,0.18); border-radius: 10px; background: rgba(255,255,255,0.05); color: #fff; font-weight: 700; cursor: pointer;">再生しない</button>
            </div>
        </div>
    `;

    const cleanup = () => {
        const existingPopup = document.getElementById('dialoguePlaybackChoicePopup');
        if (existingPopup) existingPopup.remove();
        document.removeEventListener('keydown', handleKeyDown);
    };

    const yesButton = overlay.querySelector('#dialoguePlaybackChoiceYes');
    const noButton = overlay.querySelector('#dialoguePlaybackChoiceNo');

    yesButton.addEventListener('click', () => {
        cleanup();
        onYes();
    });
    noButton.addEventListener('click', () => {
        cleanup();
        onNo();
    });

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            cleanup();
            onNo();
        }
    };

    document.body.appendChild(overlay);
    document.addEventListener('keydown', handleKeyDown);
}

export function showClearRewardPopup(htmlContent, onClose) {
    const existing = document.getElementById('clearRewardPopup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'clearRewardPopup';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '30000';
    overlay.style.background = 'rgba(0, 0, 0, 0.75)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.padding = '16px';

    overlay.innerHTML = `
        <div style="max-width: 640px; width: 100%; background: #0f1113; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; box-shadow: 0 18px 40px rgba(0,0,0,0.45); padding: 24px; color: #f7f7f7; text-align: center;">
            <div style="margin-bottom: 18px; font-size: 1.1rem; line-height: 1.6;">クリア特典</div>
            <div style="margin-bottom: 22px;">${htmlContent}</div>
            <div style="display: flex; justify-content: center;
                        gap: 14px; flex-wrap: wrap;">
                <button id="clearRewardOk" style="min-width: 120px; padding: 12px 18px; border: none; border-radius: 10px; background: #2f8aff; color: #fff; font-weight: 700; cursor: pointer;">閉じる</button>
            </div>
        </div>
    `;

    const cleanup = () => {
        const existingPopup = document.getElementById('clearRewardPopup');
        if (existingPopup) existingPopup.remove();
        document.removeEventListener('keydown', handleKeyDown);
    };

    const okButton = overlay.querySelector('#clearRewardOk');
    okButton.addEventListener('click', () => {
        cleanup();
        if (onClose) onClose();
    });

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            cleanup();
            if (onClose) onClose();
        }
    };

    document.body.appendChild(overlay);
    document.addEventListener('keydown', handleKeyDown);
}

export function showSaveConfirmPopup(message, onYes, onNo) {
    const existing = document.getElementById('saveConfirmPopup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'saveConfirmPopup';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '30010';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.padding = '16px';

    overlay.innerHTML = `
        <div style="max-width: 520px; width: 100%; background: #111319; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 20px; color: #f7f7f7; text-align: center;">
            <div style="margin-bottom: 18px; font-size: 1rem; line-height: 1.6;">${message}</div>
            <div style="display:flex; justify-content:center; gap:12px;">
                <button id="saveConfirmYes" style="min-width:120px; padding:10px 14px; border:none; border-radius:8px; background:#2f8aff; color:#fff; font-weight:700;">セーブする</button>
                <button id="saveConfirmNo" style="min-width:120px; padding:10px 14px; border:1px solid rgba(255,255,255,0.12); border-radius:8px; background:rgba(255,255,255,0.02); color:#fff; font-weight:700;">セーブしない</button>
            </div>
        </div>
    `;

    const cleanup = () => {
        const existingPopup = document.getElementById('saveConfirmPopup');
        if (existingPopup) existingPopup.remove();
        document.removeEventListener('keydown', handleKeyDown);
    };

    const yes = overlay.querySelector('#saveConfirmYes');
    const no = overlay.querySelector('#saveConfirmNo');

    yes.addEventListener('click', () => {
        cleanup();
        onYes && onYes();
    });
    no.addEventListener('click', () => {
        cleanup();
        onNo && onNo();
    });

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cleanup();
            onNo && onNo();
        }
    };

    document.body.appendChild(overlay);
    document.addEventListener('keydown', handleKeyDown);
}

let handleDialogueClick = null;
let handleDialogueKeydown = null;

function createDialogueUI() {
    const existingModal = document.getElementById('dialogueModal');
    if (existingModal) {
        dialogueModal = existingModal;
        chatPanel = existingModal.querySelector('.dialogue-chat-panel');
        chatContent = existingModal.querySelector('#dialogueChatContent');
        closeButton = existingModal.querySelector('#dialogueCloseBtn');
        choicesContainer = existingModal.querySelector('.dialogue-choices-container');
        skipToEndButton = existingModal.querySelector('#dialogueSkipToEndBtn');
        skipToChoiceButton = existingModal.querySelector('#dialogueSkipToChoiceBtn');
        // ★ MODIFIED: 会話エリアの下に余白を追加してボタンとの重なりを防ぐ
        if (chatContent) {
            chatContent.style.paddingBottom = '100px';
        }
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'dialogueModal';
    modal.className = 'dialogue-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.display = 'none';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '20000';
    modal.style.background = 'rgba(0, 0, 0, 0.7)';

    modal.innerHTML = `
        <div class="dialogue-container">
            <div id="dialogueCharLeft" class="dialogue-character-display"></div>
            <div id="dialogueCharRight" class="dialogue-character-display"></div>
            <button id="dialogueCloseBtn" class="dialogue-close-btn">×</button>
            <div class="dialogue-log-panel">
                <h3>CHAPTER</h3>
                <div id="dialogueLogChapters"></div>
            </div>
            <div class="dialogue-chat-panel">
                <div id="dialogueChatContent" class="dialogue-chat-content"></div>
            </div>
            <div class="dialogue-controls">
                <div class="dialogue-choices-container"></div>
                <button id="dialogueSkipToEndBtn">skip to end(E) &gt;&gt;&gt;</button>
                <button id="dialogueSkipToChoiceBtn">skip to choices(C) &gt;&gt;&gt;</button>
            </div>
        </div>
    `;

    // body直下ではなく、モーダル専用コンテナに追加する
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.appendChild(modal);
    else document.body.appendChild(modal); // フォールバック

    dialogueModal = modal;
    chatPanel = modal.querySelector('.dialogue-chat-panel');
    chatContent = modal.querySelector('#dialogueChatContent');
    choicesContainer = modal.querySelector('.dialogue-choices-container');
    skipToEndButton = modal.querySelector('#dialogueSkipToEndBtn');
    skipToChoiceButton = modal.querySelector('#dialogueSkipToChoiceBtn');

    // ★ MODIFIED: 会話エリアの下に余白を追加してボタンとの重なりを防ぐ
    if (chatContent) {
        chatContent.style.paddingBottom = '100px';
    }

    // 閉じるボタンのイベント
    closeButton = modal.querySelector('#dialogueCloseBtn');
    closeButton.addEventListener('click', () => closeDialogue());

    // スキップボタンのイベント
    skipToEndButton.addEventListener('click', () => skipDialogue(true)); // true: 最後まで
    skipToChoiceButton.addEventListener('click', () => skipDialogue(false)); // false: 選択肢まで

    // ★ SYSTEMメッセージ用のスタイルを動的に追加
    const systemStyle = document.createElement('style');
    systemStyle.id = 'dialogue-system-style';
    systemStyle.textContent = `
        .chat-bubble.system-message {
            background: #1c1c1c;
            border: 1px solid #444;
            padding: 12px 16px;   /* ← ここに余白を持たせる */
            border-radius: 4px;
        }
        .chat-bubble.system-message::before,
        .chat-bubble.system-message::after {
            display: none !important; /* 吹き出しのしっぽを非表示 */
        }
        .chat-bubble.system-message .character-name,
        .chat-bubble.system-message .character-icon {
            display: none; /* 名前とアイコンを非表示 */
        }
        .chat-bubble.system-message .message-text {
            background: transparent !important;
            padding: 0;
            border-radius: 0;
            box-shadow: none;
            font-family: 'Noto Sans Mono', 'Courier New', monospace;
            text-shadow: none;
        }
    `;
    document.head.appendChild(systemStyle);
}

/**
 * 吹き出しの内部HTMLを生成します。クラスの付与は行いません。
 * @param {object} message - メッセージオブジェクト
 * @returns {string} - 吹き出しの内部HTML
 */
function createBubbleHTML(message) { // ★ MODIFIED: 'left' クラスを削除
    // アイコン画像のパスを取得 (この関数はHTML構造のみを生成)
    const charData = CHARACTERS[message.character];
    const expression = message.expression || 'normal';
    const iconKey = charData?.images?.[expression] || charData?.icon;
    const iconUrl = iconKey && images[iconKey] ? images[iconKey].src : '';

    return `
        <div class="character-icon" style="${iconUrl ? `--character-icon-url: url('${iconUrl}');` : ''}"></div>
        <div class="message-content">
            <div class="character-name">${message.character}</div>
            <div class="message-text"></div>
        </div>
    `;
}

/**
 * ログ表示用に吹き出しをチャットコンテンツに追加するヘルパー関数
 * @param {object} msg - メッセージオブジェクト
 */
function appendBubble(msg) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    if (msg.character === 'SYSTEM') {
        bubble.classList.add('system-message');
        bubble.innerHTML = `<div class="message-content"><div class="message-text">${msg.text.replace(/\n/g, '<br>')}</div></div>`;
    } else {
        if (msg.character === 'オペレーター') {
            bubble.classList.add('right');
        } else {
            bubble.classList.add('left');
        }

        bubble.innerHTML = createBubbleHTML(msg);
        const textElement = bubble.querySelector('.message-text');
        if (textElement) {
            textElement.innerHTML = msg.text.replace(/\n/g, '<br>');
        }

        const iconElement = bubble.querySelector('.character-icon');
        const charData = CHARACTERS[msg.character];
        if (iconElement && charData) {
            const expression = msg.expression || 'normal';
            const iconKey = charData?.images?.[expression] || charData?.icon;

            if (iconKey && images[iconKey]) {
                const imageUrl = images[iconKey].src;
                iconElement.style.setProperty('--character-icon-url', `url('${imageUrl}')`);
            }
        }
    }
    chatContent.appendChild(bubble);
}

/**
 * 指定された会話IDのログコンテンツを再帰的に表示します。
 * 選択肢の分岐を追跡し、プレイヤーが選んだルートのみを表示します。
 * @param {string} dialogueId - 表示する会話のID
 * @param {boolean} [isInitialCall=true] - 最初の呼び出しかどうかを判定する内部フラグ
 * @param {number} [indent=0] - インデントの深さ
 * @param {string} [parentChoiceText=""] - 親の選択肢テキスト
 */
function displayChapterContent(dialogueId, isInitialCall = true, indent = 0, parentChoiceText = "") {
    // 最初の呼び出し時にのみコンテンツをクリア
    if (isInitialCall) {
        chatContent.innerHTML = '';
    }

    const dialogueData = DIALOGUE_DATA[dialogueId];
    if (!dialogueData) {
        if (isInitialCall) {
            chatContent.innerHTML = '<div class="log-select-prompt">ログの読み込みに失敗しました。</div>';
        }
        return;
    }

    for (const message of dialogueData.messages) {
        if (message.choices && message.choiceId) {
            // ★ 親となる質問メッセージをループの前に一度だけ表示
            appendBubble(message);

            // 選択肢を持つメッセージの場合、選択された各ルートを個別に描画する
            for (let i = 0; i < message.choices.length; i++) {
                if (isChoicePlayed(message.choiceId, i)) {
                    const choice = message.choices[i];
                    const separator = document.createElement('div');
                    separator.className = 'log-branch-separator';
                    separator.style.marginLeft = `${(indent + 1) * 20}px`;

                    // ★ indent > 0 (2階層目以降) の場合のみ「└」と親テキストを表示
                    if (indent > 0 && parentChoiceText) {
                        separator.innerHTML = `[ ${parentChoiceText} ]<br><span style="margin-left: 20px;">　　└ [ ${choice.text} ] を選択</span>`;
                    } else {
                        separator.innerHTML = `[ ${choice.text} ] を選択`;
                    }

                    chatContent.appendChild(separator);

                    if (choice.response) {
                        appendBubble(choice.response);
                    }

                    // ★ 選択肢の終了を明示する
                    if (choice.end) {
                        const endSeparator = document.createElement('div');
                        endSeparator.className = 'log-branch-separator';
                        // インデントを1段深くして、選択肢の結果であることがわかるようにする
                        endSeparator.style.marginLeft = `${(indent + 2) * 20}px`; 
                        endSeparator.style.marginBottom = '1em'; // ★会話終了の後にスペースを追加
                        endSeparator.textContent = `--- 会話終了 ---`;
                        chatContent.appendChild(endSeparator);
                    } else if (choice.nextId) {
                        // 次の会話をインデントを深くして再帰的に表示
                        displayChapterContent(choice.nextId, false, indent + 1, choice.text);
                    }
                }
            }
        } else {
            // 通常のメッセージを表示
            appendBubble(message);
        }
    }
    // 一番上にスクロール
    chatContent.scrollTop = 0;
}
/**
 * キャラクターの立ち絵を表示・更新する
 * @param {object} message - 現在のメッセージオブジェクト
 */
function updateCharacterDisplay(message) {
    const leftChar = document.getElementById('dialogueCharLeft');
    const rightChar = document.getElementById('dialogueCharRight');
    if (!leftChar || !rightChar) return;

    // ★ SYSTEMの場合は、両方の立ち絵を非表示にする
    if (message.character === 'SYSTEM') {
        leftChar.style.backgroundImage = 'none';
        rightChar.style.backgroundImage = 'none';
        leftChar.classList.remove('active');
        rightChar.classList.remove('active');
        return;
    }

    // ★ 追加：キャラクターが「？」の場合は、両方の立ち絵を非表示にする
    if (message.character === '？') {
        leftChar.style.backgroundImage = 'none';  // 左側の画像をクリア
        rightChar.style.backgroundImage = 'none'; // 右側の画像をクリア
        leftChar.classList.remove('active');      // 左側を非アクティブに
        rightChar.classList.remove('active');     // 右側を非アクティブに
        return; // 「？」の処理はここで終了
    }

    // ★ オペレーターの場合は、立ち絵を表示せず、反対側のキャラクターを非アクティブにする
    if (message.character === 'オペレーター') {
        rightChar.style.backgroundImage = 'none'; // 右側の画像をクリア
        rightChar.classList.remove('active');   // 右側を非アクティブに
        leftChar.classList.remove('active');    // 左側も非アクティブに
        return; // オペレーターの処理はここで終了
    }

    const charData = CHARACTERS[message.character];
    if (!charData) return;

    // アクティブなキャラクターを判定
    const isLeftActive = charData.position === 'left';
    const isRightActive = charData.position === 'right';

    // アクティブなキャラクターを明るく、非アクティブなキャラクターを暗くする
    leftChar.classList.toggle('active', isLeftActive);
    rightChar.classList.toggle('active', isRightActive);

    // 画像の更新
    const imageName = charData.images[message.expression || 'normal'];
    const image = images[imageName];
    
    if (image) {
        if (isLeftActive) {
            leftChar.style.backgroundImage = `url('${image.src}')`;
        }
    }

    // 会話開始時に両方のキャラクターを表示（必要に応じて調整）
    if (currentMessageIndex === 1) {
        // ここで初期表示のキャラクター画像を設定できます
    }
}

function renderChapterLog() {
    const logChaptersContainer = document.getElementById('dialogueLogChapters');
    if (!logChaptersContainer) return;
    logChaptersContainer.innerHTML = '';

    // ★ MODIFIED: Include prologue if it has been played
    const container = dialogueModal.querySelector('.dialogue-container');
    container?.classList.remove('chapter-selected');

    const clearedDialogueIds = Object.keys(DIALOGUE_DATA).filter(id => {
        // プロローグとエンディングは特別扱い
        if (id === 'prologue' || id === 'true_ending_dialogue') {
            return hasDialogueBeenPlayed(id);
        }
        // それ以外の会話はクエストクリアを条件とする
        // ★ MODIFIED: 分岐会話はログに表示しない
        if (DIALOGUE_DATA[id]?.isBranch) return false;
        const questId = id.replace(/_start$|_end$/, '');
        return isCleared(questId);
    });

    // 右側パネルを初期化し、選択を促すメッセージを表示
    if (chatPanel) chatPanel.classList.remove('hidden');
    if (chatContent) {
        chatContent.innerHTML = '<div class="log-select-prompt">左のチャプターを選択してログを読み込みます。</div>';
    }
    // 会話再生用の「次へ」ボタンはログ表示時には不要
    const controls = dialogueModal.querySelector('.dialogue-controls');
    if (controls) {
        controls.classList.add('hidden');
    }


    if (clearedDialogueIds.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'log-empty';
        emptyMsg.textContent = '表示できるログがありません。';
        logChaptersContainer.appendChild(emptyMsg);
        return;
    }

    // ステージIDからステージ名を取得するためのヘルパー関数
    // QUEST_MAPを全検索してキャッシュすることで、毎回検索するのを防ぎます。
    const stageNameCache = {};
    function getStageName(questId) {
        if (stageNameCache[questId]) {
            return stageNameCache[questId];
        }

        for (const world of Object.values(QUEST_MAP)) {
            const node = world.nodes.find(n => n.id === questId);
            if (node) {
                stageNameCache[questId] = node.name;
                return node.name;
            }
        }
        stageNameCache[questId] = "不明なステージ";
        return "不明なステージ";
    }
    
    clearedDialogueIds.forEach(dialogueId => {
        const dialogue = DIALOGUE_DATA[dialogueId];

        const chapterDiv = document.createElement('div');
        chapterDiv.className = 'log-chapter';
        chapterDiv.dataset.dialogueId = dialogueId;

        let stageName;
        let eventType;

        if (dialogueId === 'prologue') {
            stageName = "プロローグ";
            eventType = "";
        } else if (dialogueId === 'true_ending_dialogue') {
            stageName = "エピローグ";
            eventType = "";
        } else {
            const questId = dialogueId.replace(/_start$|_end$/, '');
            stageName = getStageName(questId);
            eventType = dialogueId.endsWith('_start') ? '開始時' : dialogueId.endsWith('_end') ? '終了時' : '';
        }

        chapterDiv.innerHTML = `
            <div class="log-chapter-title">${dialogue.title}</div>
            <div class="log-chapter-status">${stageName}${eventType ? ` - ${eventType}` : ''}</div>
        `;

        chapterDiv.addEventListener('click', () => {
            logChaptersContainer.querySelectorAll('.log-chapter').forEach(el => el.classList.remove('active'));
            chapterDiv.classList.add('active');
            // ★チャプター選択済みクラスを付与（モバイル用）
            container?.classList.add('chapter-selected');
            displayChapterContent(dialogueId);
        });

        logChaptersContainer.appendChild(chapterDiv);
    });

    // ★エンディング再生ボタンの追加
    if (isCleared("WEND_LastBoss")) {
        const endingBtn = document.createElement('div');
        endingBtn.className = 'log-chapter ending-playback'; // 専用のスタイルを当てる
        endingBtn.innerHTML = `
            <div class="log-chapter-title">ENDING</div>
            <div class="log-chapter-status">エンディングを再生します</div>
        `;
        endingBtn.onclick = () => {
            closeDialogue(); // ログモーダルを閉じる
            startTrueEndingSequence(showLog); // エンディングを開始し、終了後にログ画面を再表示
        };
        logChaptersContainer.appendChild(endingBtn);
    }
}

/**
 * スタッフロール用のCSSを動的に読み込みます。
 * @returns {Promise<void>}
 */
function loadStaffRollCSS() {
    // CSSは style.css に統合済み
    return Promise.resolve();
}

/**
 * 画面を暗転させます。
 * @param {number} duration - 暗転にかかる時間 (ms)
 * @returns {Promise<void>}
 */
function fadeToBlack(duration = 1500) {
    return new Promise(resolve => {
        const blackout = document.createElement('div');
        blackout.className = 'true-ending-blackout';
        document.body.appendChild(blackout);

        requestAnimationFrame(() => {
            blackout.style.opacity = '1';
        });

        setTimeout(() => {
            resolve(blackout); // 暗転用divを後で消せるように返す
        }, duration);
    });
}

/**
 * 画面にメッセージを表示します。
 * @param {string} text - 表示するテキスト
 * @param {number} duration - 表示時間 (ms)
 * @param {string} className - p要素に付与する追加クラス（任意）
 * @returns {Promise<void>}
 */
function showMessage(text, duration = 2000, className = '') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'true-ending-message-overlay';
        const p = document.createElement('p');
        p.textContent = text;
        if (className) p.className = className;
        overlay.appendChild(p);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });

        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 1500);
        }, duration);
    });
}

/**
 * スタッフロールを開始します。
 */
function showStaffRoll(onComplete) {
    isStaffRollShowing = true;
    window._staffRollActive = true; // ★スタッフロール中は全ショートカットを無効化

    const canSkip = hasSeenTrueEnding();

    // クリックとポインター表示に対応
    const staffRollHTML = `
        <div class="staff-roll-overlay">
            ${canSkip ? '<div class="staff-roll-skip" style="position: fixed; bottom: 20px; right: 20px; color: white; font-family: monospace; z-index: 10001; opacity: 0.7; cursor: pointer;">skip (esc) >>> </div>' : ''}
            <div class="staff-roll-content">
                <div class="staff-roll-line"><span class="role-center">STAFF</span></div>

                <div class="staff-roll-line"><span class="role">Direction / Design</span><span class="name">mame</span></div>
                <div class="staff-roll-line"><span class="role">Programming</span><span class="name">mame</span></div>
                <div class="staff-roll-line"><span class="role">Scenario</span><span class="name">mame</span></div>
                <div class="staff-roll-line"><span class="role">Game Design / Balance</span><span class="name">mame</span></div>
                <div class="staff-roll-line"><span class="role">UI / System Design</span><span class="name">mame</span></div>
                <div class="staff-roll-line"><span class="role">Sound Design</span><span class="name">mame</span></div>
                <div class="staff-roll-line"><span class="role">Level Design</span><span class="name">mame</span></div>
                <div class="staff-roll-line"><span class="role">Debugging</span><span class="name">mame</span></div>
                <div class="staff-roll-line"><span class="role">Testing / QA</span><span class="name">mame</span></div>
                <div class="staff-roll-line"><span class="role">Playtesting</span><span class="name">mame</span></div>
                

                <div class="staff-roll-line staff-roll-section"><span class="role-center">Music</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">Pixabay</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">https://pixabay.com/</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">RYU ITO</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">https://ryu110.com/</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">moeru music.</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">https://moerumusic.com/</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">MusMus</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">https://musmus.main.jp</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">DOVA-SYNDROME</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">https://dova-syndrome.com</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">Marron Fields Production</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">https://www.marronfield.com</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">なぐもりずの音楽室</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">https://nagumorizu.com</span></div>                

                <div class="staff-roll-line staff-roll-section"><span class="role-center">Sound Effect</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">Pixabay</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">https://pixabay.com/</span></div>

                <div class="staff-roll-line staff-roll-section"><span class="role-center">Illustration / Image</span></div>
                <div class="staff-roll-line"><span class="role">Graphic</span><span class="name">mame</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">generated with ChatGPT</span></div>

                <div class="staff-roll-line staff-roll-section"><span class="role-center">Tools / Software</span></div>
                <div class="staff-roll-line"><span class="role">Editor</span><span class="name">VS Code</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">Gemini Code Assist / Cline / Antigravity / Copilot</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">ChatGPT</span></div>

                <div class="staff-roll-line staff-roll-section"><span class="role-center">Equipment</span></div>
                <div class="staff-roll-line"><span class="role">PC</span><span class="name">MacBook Air M1</span></div>
                <div class="staff-roll-line"><span class="role">Keyboard</span><span class="name">mamekeyS</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">Switch: Kailh Black Cloud / Keycaps: Kotori Blank</span></div>

                <div class="staff-roll-line staff-roll-section"><span class="role-center">Font</span></div>
                <div class="staff-roll-line"><span class="role">Japanese</span><span class="name">Noto Sans JP</span></div>
                <div class="staff-roll-line"><span class="role">English</span><span class="name">Noto Sans</span></div>
                <div class="staff-roll-line"><span class="role">Monospace</span><span class="name">Noto Sans Mono</span></div>

                <div class="staff-roll-line staff-roll-section"><span class="role-center">Inspired By</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">e-typing</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">https://www.e-typing.ne.jp</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">寿司打</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">https://sushida.net</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">The Typing of the Dead</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">SEGA</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">新世紀エヴァンゲリオン タイピング-E計画</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">GAINAX</span></div>

                <div class="staff-roll-line staff-roll-section"><span class="role-center">Procrastination（現実逃避）</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">風来のシレン6 とぐろ島探検録</span></div>

                <div class="staff-roll-line staff-roll-section"><span class="role-center">Ending Theme</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">星屑みたいに流れてく</span></div>
                <div class="staff-roll-line staff-roll-hp"><span class="hp">watson</span></div>

                <div class="staff-roll-line staff-roll-section"><span class="role-center">Special Thanks</span></div>
                <div class="staff-roll-line"><span class="role-center">All Players</span></div>
                <div class="staff-roll-thanks" id="staff-roll-thanks">
                    <div class="staff-roll-line typing-name-line"><span class="role-left">テストプレイ</span><span class="name-right" data-name="しれん" data-kana="しれん"><span class="name-text">しれん</span></span></div>
                    <div class="staff-roll-line typing-name-line"><span class="role-left">応援</span><span class="name-right" data-name="まめっこ" data-kana="まめっこ"><span class="name-text">まめっこ</span></span></div>
                    <div class="staff-roll-line typing-name-line"><span class="role-left">お世話になった</span><span class="name-right" data-name="うめこいし" data-kana="うめこいし"><span class="name-text">うめこいし</span></span></div>
                </div>
                <div id="staff-roll-joke-container"></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', staffRollHTML);

    const overlay = document.querySelector('.staff-roll-overlay');
    const skipButton = canSkip ? document.querySelector('.staff-roll-skip') : null;
    let rollKeyHandler = null;
    let isCompleted = false; // 多重実行防止フラグ

    // ★ ジョークスタッフギミック用
    // ※kana は入力対象のよみ（純粋なひらがな＋長音のみ）。
    //   ASCIIや数字・記号を含めるとローマ字変換が不能になり表示が壊れるため、
    //   画面表示用の name と入力用の kana を分けて管理する。
    const jokeStaffs = [
        { role: "開発中に逃亡した", name: "モチベーション", kana: "もちべーしょん" },
        { role: "夜食担当", name: "近くのコンビニの店員さん", kana: "ちかくのこんびにのてんいんさん" },
        { role: "デバッグの邪魔をした", name: "野良猫の鳴き声", kana: "のらねこのなきごえ" },
        { role: "バグを生み出した", name: "昔の自分", kana: "むかしのじぶん" },
        { role: "応援席", name: "フォロワー一同", kana: "ふぉろわーいちどう" },
        { role: "テストプレイで腱鞘炎", name: "友人の右手", kana: "ゆうじんのみぎて" },
        { role: "心の支え", name: "夜に食べるお菓子", kana: "よるにたべるおかし" },
        { role: "バグだと思ったら仕様だった", name: "奇跡のコード", kana: "きせきのこーど" },
        { role: "クレジット水増し要員", name: "隣の松永さん", kana: "となりのまつながさん" },
        { role: "寝不足の頭に響いた", name: "スマホのアラーム", kana: "スマホのアラーム" },
        { role: "開発中に食べた", name: "うまかっちゃん", kana: "うまかっちゃん" },
        { role: "午前3時の", name: "謎のテンション", kana: "なぞのてんしょん" },
        { role: "外での作業でお世話になった", name: "ステップワゴン", kana: "すてっぷわごん" },
        { role: "メダカの天敵", name: "野良猫", kana: "のらねこ" },
        { role: "キーボードの上に乗った", name: "ほこりと食べかす", kana: "ほこりと食べかす" },
        { role: "コンビニで買った", name: "アイスコーヒー", kana: "あいすこーひー" },
        { role: "エラーを無視した", name: "昨日の自分", kana: "きのうのじぶん" },
        { role: "開発を延ばした", name: "おっちょこちょい", kana: "おっちょこちょい" },
        { role: "テスト中に寝た", name: "寝不足の自分", kana: "ねぶそくのじぶん" },
        { role: "コードを消し飛ばした", name: "うっかりミス", kana: "うっかりみす" },
        { role: "疲れ目に", name: "ソフトサンティアひとみストレッチ", kana: "そふとさんてぃあひとみすとれっち" },
        { role: "作業用BGM", name: "ゲーム音楽集", kana: "ゲーム音楽集" },
        { role: "トラックボールの使いすぎ", name: "右手の親指", kana: "みぎてのおやゆび" },
        { role: "水槽の住人", name: "ウーパールーパー", kana: "うーぱーるーぱー" },
        { role: "ゲームをここまで遊んでくれた", name: "あなた", kana: "あなた" },
        { role: "カロリー補給", name: "開発を支えた炭水化物一同", kana: "かいはつをささえたたんすいかぶついちどう" },
        { role: "健康への免罪符", name: "特茶（気休め）", kana: "とくちゃ（きやすめ）" },
        { role: "塩分担当", name: "ポテトチップスコンソメ味", kana: "ぽてとちっぷすこんそめあじ" },
        { role: "CSS崩壊", name: "原因不明の謎の隙間", kana: "げんいんふめいのなぞのすきま" },
        { role: "開発中に食べた", name: "カップラーメン", kana: "かっぷらーめん" },
        { role: "開発中に食べた", name: "チョコレート", kana: "ちょこれーと" },
        { role: "開発中に飲んだ", name: "コーヒー", kana: "こーひー" },
        { role: "開発中に飲んだ", name: "エナジードリンク", kana: "えなじーどりんく" },
        { role: "開発中に飲んだ", name: "炭酸水", kana: "たんさんすい" },
        { role: "こんなおふざけに付き合ってくれている", name: "あなた", kana: "あなた" },
        { role: "AIの限界", name: "無料モデルの利用制限に達しました", kana: "むりょうもでるのりようせいげんにたっしました" },
        { role: "英語の翻訳・変換", name: "google翻訳", kana: "googleほんやく" },
        { role: "週末の楽しみ", name: "F１", kana: "f1" },
        { role: "やっていないとこもある", name: "リファクタリング", kana: "りふぁくたりんぐ" },


    ];
    // ★ ジョークスタッフをシャッフル（毎回違う順番で出現させる）
    //   Fisher-Yates シャッフル：配列の順序をその場で入れ替える
    for (let i = jokeStaffs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [jokeStaffs[i], jokeStaffs[j]] = [jokeStaffs[j], jokeStaffs[i]];
    }
    let jokeStaffIndex = 0;
    let jokeStaffCount = 0;
    const JOKE_STAFF_MAX = 20; // 追加できるジョークスタッフの上限（1人入力で1人追加）
    let jokeModeActive = false;

    // ★ 受付（handleKey）と完全に一致するローマ字列を生成する。
    //   getDisplayFullRoma は「文末のん」などを最短表記（"n"）にする一方、
    //   受付側は設定（final_n_mode='nn'）で "nn" を要求する等のズレがあり、
    //   表示どおり打っても完了しないケースがあった。
    //   そのため候補生成元（getCandidatesForKana＝受付と同じ関数）から
    //   直接組み立て、表示＝打鍵列を完全一致させる。
    const buildRollRoma = ({ text, pos, typed, inputedRomaji }) => {
        let result = inputedRomaji || '';
        let i = pos || 0;
        const hasTyped = (typed || '').length > 0;
        while (i < text.length) {
            const kana = getKana(text, i);
            if (!kana) break;
            const cands = getCandidatesForKana(text, i) || [];
            if (cands.length === 0) {
                // 候補がないかな（念のため表示だけは崩さない）
                result += kana;
                i += kana.length;
                continue;
            }
            const sel = (hasTyped && i === pos)
                ? (cands.find(r => r.startsWith(typed)) || cands[0])
                : cands[0];
            result += sel;
            if (isSmallTsu(kana)) {
                // 促音は「っ+次のかな」を1候補（例: "ffu"）で打ち切るので両方スキップ
                const nextKana = getKana(text, i + kana.length);
                i += (sel.length > 1 && sel !== 'ltu' && sel !== 'xtu' && nextKana)
                    ? kana.length + nextKana.length
                    : kana.length;
            } else {
                i += kana.length;
            }
        }
        return result;
    };

    // ★ ジョークスタッフを「いま画面内に見えている最下端のスタッフ行」の直下に差し込む。
    //   画面の下端にぱっと現れて、そのまま上へ流れていく＝「増えた」ことが目に見える。
    const addJokeStaff = (completedLine) => {
        if (jokeStaffIndex >= jokeStaffs.length || jokeStaffCount >= JOKE_STAFF_MAX) return;

        const staff = jokeStaffs[jokeStaffIndex];
        const role = staff.role;
        const name = staff.name;
        const nameHiragana = staff.kana; // 入力用のよみ（ひらがなのみ）

        const jokeEl = document.createElement('div');
        jokeEl.className = 'staff-roll-line typing-name-line joke-staff';
        jokeEl.innerHTML = `
            <span class="role-left">${role}</span>
            <span class="name-right" data-name="${name}" data-kana="${nameHiragana}"><span class="name-text">${name}</span></span>
        `;

        // いま画面内に見えているスタッフ行のうち、いちばん下端に表示されているものを探す
        const vh = window.innerHeight || document.documentElement.clientHeight;
        let bottomLine = null;
        let maxBottom = -Infinity;
        document.querySelectorAll('.staff-roll-content .staff-roll-line').forEach(line => {
            const rect = line.getBoundingClientRect();
            if (rect.top < vh && rect.bottom > 0) { // 画面内に表示中
                if (rect.bottom > maxBottom) {
                    maxBottom = rect.bottom;
                    bottomLine = line;
                }
            }
        });

        // 最下端の行の直下に差し込む（画面下端にぴったり現れる）
        if (bottomLine && bottomLine.parentNode) {
            bottomLine.insertAdjacentElement('afterend', jokeEl);
        } else if (completedLine && completedLine.parentNode) {
            completedLine.insertAdjacentElement('afterend', jokeEl);
        } else {
            const container = document.getElementById('staff-roll-joke-container');
            if (!container) return;
            container.appendChild(jokeEl);
        }

        // ローマ字表示を初期化
        const nameEl = jokeEl.querySelector('.name-right');
        const roma = buildRollRoma({ text: nameHiragana, pos: 0, typed: '', inputedRomaji: '' });
        const romaEl = document.createElement('span');
        romaEl.className = 'roma';
        romaEl.innerHTML = `<span class="typed-part"></span>${roma}`;
        nameEl.appendChild(romaEl);

        // SEを鳴らす
        try { playSE('select', 0.6); } catch(e) {}

        jokeStaffIndex++;
        jokeStaffCount++;
    };

    // ★ Special Thanks セクションが画面に入ったらタイピングモード有効化
    // threshold 0 で「少しでも見えたら」即有効化し、入力できるタイミングを早める。
    // ※ローマ字表示の生成はロール構築時に済ませてあるため、ここでは高さが変わらない。
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !jokeModeActive && !isCompleted) {
                jokeModeActive = true;
                // 最初の対象を設定
                ensureTarget();
            }
        });
    }, { threshold: 0 });

    // タイピング状態管理
    let currentTypingTarget = null; // 現在入力対象の名前行
    let typingCompleteCount = 0; // 完了した名前の数

    // 一時ゲーム状態（handleKey用）
    const rollTypingState = {
        text: '',
        typed: '',
        pos: 0,
        inputedRomaji: '',
        correctCount: 0,
        mistakeCount: 0
    };

    // ===== 対象行の管理（「表示中の行」だけが入力対象。毎回再計算して壊れないようにする） =====
    // 進捗は行ごとに dataset へ保存するため、対象が移っても入力途中が消えない。
    const loadLineState = (line) => {
        const nameEl = line.querySelector('.name-right');
        if (!nameEl) return;
        rollTypingState.text = nameEl.dataset.kana || nameEl.dataset.name || '';
        rollTypingState.pos = parseInt(nameEl.dataset.pos || '0', 10) || 0;
        rollTypingState.typed = nameEl.dataset.typed || '';
        rollTypingState.inputedRomaji = nameEl.dataset.roma || '';
    };

    const saveLineState = (line) => {
        const nameEl = line.querySelector('.name-right');
        if (!nameEl) return;
        nameEl.dataset.pos = String(rollTypingState.pos);
        nameEl.dataset.typed = rollTypingState.typed;
        nameEl.dataset.roma = rollTypingState.inputedRomaji;
    };

    // 行が画面内に見えているか
    const isLineVisible = (line) => {
        const rect = line.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        return rect.top < vh && rect.bottom > 0;
    };

    // 現在入力できる行（上から順に、未完了・未失敗・表示中の最初の行）
    const pickTarget = () => {
        const lines = document.querySelectorAll('.typing-name-line');
        for (const line of lines) {
            const nameEl = line.querySelector('.name-right');
            if (!nameEl) continue;
            if (nameEl.classList.contains('typed') || nameEl.classList.contains('missed')) continue;
            if (!isLineVisible(line)) continue;
            return line;
        }
        return null;
    };

    // 対象の整合性を保つ（完了・失敗・画面外なら次の対象へ）
    const ensureTarget = () => {
        if (!jokeModeActive || isCompleted || isFinishing) return;

        if (currentTypingTarget) {
            const nameEl = currentTypingTarget.querySelector('.name-right');
            const done = nameEl.classList.contains('typed') || nameEl.classList.contains('missed');
            if (!done && isLineVisible(currentTypingTarget)) return; // 有効な対象のまま

            // 画面外に流れた場合は入力失敗扱い
            if (!done) {
                nameEl.classList.add('missed');
                nameEl.classList.remove('typing');
            }
            currentTypingTarget.classList.remove('current-target');
            currentTypingTarget = null;
        }

        const next = pickTarget();
        if (next) {
            currentTypingTarget = next;
            setCurrentTargetMark(next);
            loadLineState(next);
            updateNameRoma(next);
        }
        // ※対象が残らない場合もここでは終了しない。
        //   「Thank you」はコンテンツが画面上に流れ切ってから（スクロール完了時）表示する。
    };

    // 全名前のローマ字表示を初期化
    const initAllNameRoma = () => {
        const lines = document.querySelectorAll('.typing-name-line');
        lines.forEach(line => {
            const nameEl = line.querySelector('.name-right');
            if (!nameEl) return;
            const kana = nameEl.dataset.kana || nameEl.dataset.name || '';
            const roma = buildRollRoma({ text: kana, pos: 0, typed: '', inputedRomaji: '' });
            let romaEl = nameEl.querySelector('.roma');
            if (!romaEl) {
                romaEl = document.createElement('span');
                romaEl.className = 'roma';
                nameEl.appendChild(romaEl);
            }
            romaEl.innerHTML = `<span class="typed-part"></span>${roma}`;
        });
    };

    // 現在の対象に目印をつける
    const setCurrentTargetMark = (line) => {
        // 既存の目印を削除
        document.querySelectorAll('.typing-name-line.current-target').forEach(el => {
            el.classList.remove('current-target');
        });
        // 新しい目印を設定
        if (line) {
            line.classList.add('current-target');
            const nameEl = line.querySelector('.name-right');
            if (nameEl) nameEl.classList.add('typing');
        }
    };

    // 名前とローマ字の表示を更新（文字ごとに色を変える）
    const updateNameRoma = (line) => {
        if (!line) return;
        const nameEl = line.querySelector('.name-right');
        if (!nameEl) return;
        const kana = nameEl.dataset.kana || nameEl.dataset.name || '';
        const roma = buildRollRoma({
            text: kana,
            pos: rollTypingState.pos,
            typed: rollTypingState.typed,
            inputedRomaji: rollTypingState.inputedRomaji
        });

        // ローマ字表示の更新
        let romaEl = nameEl.querySelector('.roma');
        if (!romaEl) {
            romaEl = document.createElement('span');
            romaEl.className = 'roma';
            nameEl.appendChild(romaEl);
        }
        const typedLen = Math.min(roma.length, rollTypingState.inputedRomaji.length + rollTypingState.typed.length);
        const typedPart = roma.slice(0, typedLen);
        const remainPart = roma.slice(typedLen);
        romaEl.innerHTML = `<span class="typed-part">${typedPart}</span>${remainPart}`;

        // 表示名の文字ごとに色を変える（表示名とよみの長さが違う場合は比率で色分け）
        const display = nameEl.dataset.name || '';
        const nameTextEl = nameEl.querySelector('.name-text');
        if (nameTextEl && display) {
            const doneChars = kana.length > 0
                ? Math.min(display.length, Math.floor((rollTypingState.pos / kana.length) * display.length + 1e-6))
                : 0;
            let nameHTML = '';
            for (let i = 0; i < display.length; i++) {
                if (i < doneChars) {
                    // 入力済みの文字
                    nameHTML += `<span class="char-typed">${display[i]}</span>`;
                } else {
                    // 未入力の文字
                    nameHTML += `<span class="char-remain">${display[i]}</span>`;
                }
            }
            nameTextEl.innerHTML = nameHTML;
        }
    };

    // 対象が画面外にスクロールしたら次へ移る（チェック用）
    const checkTargetVisible = () => {
        ensureTarget();
    };
    // 100msごとに画面内チェック（終了時にクリアできるよう保持）
    const visibilityCheckInterval = setInterval(checkTargetVisible, 100);

    // タイピング完了時の処理
    const onTypingComplete = () => {
        if (!currentTypingTarget) return;

        // 完了状態に
        const nameEl = currentTypingTarget.querySelector('.name-right');
        if (nameEl) {
            nameEl.classList.add('typed');
            nameEl.classList.remove('typing');
        }
        saveLineState(currentTypingTarget);
        currentTypingTarget.classList.remove('current-target');

        // ★ ジョークスタッフを「入力した行の直後」に1人追加（1人入力→1人出現）
        addJokeStaff(currentTypingTarget);
        typingCompleteCount++;

        // 次の対象へ（毎回再計算：直後に差し込まれたジョークも対象になる）
        currentTypingTarget = null;
        ensureTarget();
    };

    // 強制終了（Thank you for playing! → The End フェードイン/アウト）
    // ※呼ばれるのはスクロールドライバが「コンテンツが画面上に流れ切った」ことを
    //   検知したとき（または最終手段のフェイルセーフ）。表示中のスタッフが
    //   見えている状態で Thank you を出さない。
    let isFinishing = false;
    let scrollRafId = null;
    let scrollStartTs = null;
    const stopScrollLoop = () => {
        if (scrollRafId) {
            cancelAnimationFrame(scrollRafId);
            scrollRafId = null;
        }
    };
    const finishRoll = () => {
        if (isFinishing || isCompleted) return;
        isFinishing = true;

        // スクロールループを停止
        stopScrollLoop();

        // Thank you for playing! → The End を表示
        showThankYouThenEnd();
    };

    // Thank you for playing! → The End フェードイン/アウト
    const showThankYouThenEnd = () => {
        const overlay = document.querySelector('.staff-roll-overlay');
        if (!overlay) return;

        // Thank you for playing! 表示
        const thankYou = document.createElement('div');
        thankYou.className = 'staff-roll-thank-you-final';
        thankYou.innerHTML = 'Thank you for playing!';
        overlay.appendChild(thankYou);

        // 2秒後に The End 表示
        setTimeout(() => {
            thankYou.style.opacity = '0';
            thankYou.style.transition = 'opacity 1s ease-out';
            
            setTimeout(() => {
                thankYou.remove();
                
                // The End 表示
                const theEnd = document.createElement('div');
                theEnd.className = 'staff-roll-the-end-final';
                theEnd.innerHTML = 'The End';
                overlay.appendChild(theEnd);
                
                // 3秒後にフェードアウトして終了
                setTimeout(() => {
                    theEnd.style.opacity = '0';
                    theEnd.style.transition = 'opacity 2s ease-out';
                    setTimeout(() => endRoll(), 2000);
                }, 3000);
            }, 1000);
        }, 2000);
    };

    // タイピング処理（既存のhandleKeyを使用）
    const processTyping = (e) => {
        if (!currentTypingTarget || isFinishing) return false;

        const nameEl = currentTypingTarget.querySelector('.name-right');
        if (!nameEl) return false;

        // 対象のよみ（ひらがな）を入力テキストとして設定
        rollTypingState.text = nameEl.dataset.kana || nameEl.dataset.name || '';

        // handleKeyで判定（silent=true：ゲーム本体の描画・終了判定・コンボ処理には触れない）
        const result = handleKey(e, true, rollTypingState);

        // 進捗を行に保存（対象が移っても入力途中が消えないように）
        saveLineState(currentTypingTarget);

        // 表示更新
        updateNameRoma(currentTypingTarget);

        // 正解キーごとに軽いSE（完了時はジョーク追加のSEが鳴るのでスキップ）
        if (result && result.success && !result.isMiss) {
            try { playSE('select', 0.25); } catch(err) {}
        }

        // ★ 完了判定は「単語全体の入力が終わったとき」。
        // handleKey の isComplete は「1かな文字が完成したとき」に立つフラグなので、
        // ゲーム本体（checkGameEnd / defenseCore）と同じく pos >= text.length で判定する。
        if (result && result.success && rollTypingState.pos >= rollTypingState.text.length) {
            onTypingComplete();
        }

        return result && !result.isMiss;
    };

    const endRoll = () => {
        if (isCompleted || !overlay) return;
        isCompleted = true;

        clearTimeout(rollTimer);
        // ※ スタッフロールフラグはここでは解除しない。
        //   Thank you → The End のフェードアウト中もショートカットを無効化し続け、
        //   「完全に終了したとき」に startTrueEndingSequence 側の onComplete で解除する。
        // IntersectionObserver を切断
        observer.disconnect();
        // 画面内チェックを停止
        clearInterval(visibilityCheckInterval);
        // キーボードブロックを解除
        if (rollKeyHandler) document.removeEventListener('keydown', rollKeyHandler, true);
        if (window._staffRollSkipHandler) window._staffRollSkipHandler = null;
        if (skipButton) skipButton.removeEventListener('click', endRoll);

        overlay.classList.add('fade-out');
        // 曲も同時にフェードアウト（約3.5秒で消える）
        fadeOutBGM(3500);
        // スクロールループも確実に停止
        stopScrollLoop();

        setTimeout(() => {
            overlay.remove();
            isStaffRollShowing = false;
            if (onComplete) onComplete();
        }, 1500);
    };

    // ★ スクロールドライバ：rAFでピクセル絶対指定してコンテンツを流す。
    //   CSSのtranslateY(%)アニメーションは「要素の高さ」基準のため、
    //   ジョークスタッフ追加（高さ増加）の瞬間に表示が跳ねてしまう。
    //   ピクセル絶対指定なら追加しても座標は不変 → 自然な流れが保たれる。
    //   ※CSS側は align-items: flex-start（上寄せアンカー）にしてあるため、
    //     要素を追加しても既存の表示位置は一切動かない。
    const rollContent = document.querySelector('.staff-roll-content');
    let rollTimer = null;
    if (rollContent) {
        rollContent.style.animation = 'none'; // CSSアニメーションを無効化（JS駆動に移行）
        const startY = window.innerHeight || 800; // 開始位置：コンテンツ上端が画面下端
        rollContent.style.transform = `translateY(${startY}px)`;

        const scrollLoop = (ts) => {
            if (isCompleted || isFinishing) return;
            if (scrollStartTs === null) scrollStartTs = ts;
            const y = startY - ((ts - scrollStartTs) / 1000) * STAFF_ROLL_SCROLL_SPEED;
            rollContent.style.transform = `translateY(${y}px)`;

            // コンテンツ全体が画面上に流れ切ったら Thank you → The End へ
            if (y + rollContent.offsetHeight <= -40) {
                finishRoll();
                return;
            }
            scrollRafId = requestAnimationFrame(scrollLoop);
        };
        scrollRafId = requestAnimationFrame(scrollLoop);

        // 最終手段のフェイルセーフ（ジョーク追加ぶんの高さ＋余裕を見て算出）
        const failsafeMs = ((rollContent.offsetHeight + startY + 1600) / STAFF_ROLL_SCROLL_SPEED) * 1000 + 60000;
        rollTimer = setTimeout(endRoll, failsafeMs);
    } else {
        rollTimer = setTimeout(endRoll, 60000);
    }

    // ★ スタッフロール中は、ESCキー以外の全ショートカットをブロックする。
    // 他のキーハンドラ（保存・メニュー等）より先にcaptureフェーズで受け止める。
    // ※Sキーはセーブ画面のショートカットと競合するため、スキップには使わない。
    // ※タイピングモード時は、名前を入力するとジョークスタッフが追加される。
    // stopImmediatePropagationで、document上の他の全リスナー（バブル含む）への伝播を完全に遮断する。
    rollKeyHandler = (e) => {
        // ESCでスキップ
        if (canSkip && e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            endRoll();
            return;
        }

        // タイピングモード時：名前入力を処理（既存のhandleKeyを使用）
        if (jokeModeActive && !isFinishing && e.key.length === 1) {
            if (currentTypingTarget) {
                processTyping(e);
            }
        }

        // 全ショートカットをブロック（Sキー含む）
        e.preventDefault();
        e.stopImmediatePropagation();
    };
    document.addEventListener('keydown', rollKeyHandler, true);
    // ★ 他のクリーンアップ処理からも参照できるようグローバルに保持
    window._staffRollSkipHandler = rollKeyHandler;

    // ★ ローマ字表示はロール構築時に全員分まとめて生成しておく。
    // （Special Thanks 出現時など途中で高さが変わると、
    //   translateY(%) 基準のスクロールアニメーションが跳ねてしまうため）
    initAllNameRoma();

    // IntersectionObserver で Special Thanks セクションを監視
    const specialThanksSection = document.querySelector('.staff-roll-thanks');
    if (specialThanksSection) observer.observe(specialThanksSection);

    if (canSkip && skipButton) {
        // クリックでのスキップ
        skipButton.addEventListener('click', endRoll);

        // ホバーエフェクト
        skipButton.style.transition = 'transform 0.2s, opacity 0.2s';
        skipButton.onmouseover = () => {
            skipButton.style.transform = 'scale(1.1)';
            skipButton.style.opacity = '1';
        };
        skipButton.onmouseout = () => {
            skipButton.style.transform = 'scale(1.0)';
            skipButton.style.opacity = '0.7';
        };
    }
}

function typeMessage(element, text, onFinished, noType = false, message = null) {
    dialogueState = 'TYPING';
    let i = 0;
    const speed = noType ? 0 : currentDialogueSpeed;
    let timerId = null; // タイマーIDを保持する変数

    // ★ 右側の吹き出しの場合、タイピング開始前に最大幅を計算して固定する
    const bubble = element.closest('.chat-bubble');
    if (bubble && bubble.classList.contains('right')) {
        element.style.visibility = 'hidden'; // 一時的に非表示
        element.innerHTML = text.replace(/\n/g, '<br>'); // 全文をセット
        // transform スケール下では rect が表示幅を返すためステージ座標へ変換する
        const width = element.getBoundingClientRect().width / (getStageScale() || 1);
        element.style.width = `${width}px`;
        element.style.visibility = 'visible'; // 表示に戻す
        element.innerHTML = ''; // テキストをクリアしてタイピング開始
    }

    function type() {
        if (dialogueState !== 'TYPING') { // スキップされた場合
            clearTimeout(timerId); // タイマーを停止
            return;
        }
        if (i < text.length) {
            element.innerHTML = text.substring(0, i + 1).replace(/\n/g, '<br>');
            // ★★★ 会話の文字表示音を再生 ★★★
            const char = text[i];
            // 空白や改行文字では音を鳴らさない
            if (char !== ' ' && char !== '\n' && char !== '\r') {
                if (message && message.character === 'SYSTEM') {
                    playSystemDialogueSound();
                } else {
                    playDialogueSound();
                }
            }
            timerId = setTimeout(() => {
                // ★文字を追加した直後にスクロール
                if (chatContent) chatContent.scrollTop = chatContent.scrollHeight;

                i++;
                type();
            }, speed);
        } else {
            if (onFinished) onFinished();
        }
    }
    type();
}

function displayNextMessage(messageOverride, onComplete, noType = false) {

    dialogueState = 'TYPING';
    let message;
    if (messageOverride) {
        message = messageOverride;
    } else {
        const dialogue = DIALOGUE_DATA[currentDialogueId];
        if (!dialogue || currentMessageIndex >= dialogue.messages.length) {
            finishDialogue();
            return;
        }
        message = dialogue.messages[currentMessageIndex];
        currentMessageIndex++;
    }
    currentTypingMessage = message;

    // ★立ち絵を更新
    updateCharacterDisplay(message);

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    // ★ MODIFIED: クラス付与ロジックをここに集約
    if (message.character === 'SYSTEM') {
        bubble.classList.add('system-message');
        // SYSTEMの場合はアイコンや名前が不要なシンプルな構造
        bubble.innerHTML = `<div class="message-content"><div class="message-text"></div></div>`;
    } else {
        if (message.character === 'オペレーター') {
            bubble.classList.add('right');
        } else {
            bubble.classList.add('left');
        }

        // 通常の吹き出しHTMLを生成
        bubble.innerHTML = createBubbleHTML(message);

        // アイコン設定
        const iconElement = bubble.querySelector('.character-icon');
        if (iconElement) {
            const charData = CHARACTERS[message.character];
            const expression = message.expression || 'normal';
            const iconKey = charData?.images?.[expression] || charData?.icon;

            if (iconKey && images[iconKey]) {
                const imageUrl = images[iconKey].src;
                iconElement.style.setProperty('--character-icon-url', `url('${imageUrl}')`);
            }
        }
    }

    chatContent.appendChild(bubble);

    const messageTextElement = bubble.querySelector('.message-text');

    // ★ 選択肢がある場合のコールバックを定義
    const onTypingFinished = () => {
        if (message.choices) {
            // ★★★ 修正: すぐに選択肢を表示せず、ユーザーの入力を待つ状態にする
            // このメッセージが現在タイピング中のメッセージであることを保持
            currentTypingMessage = message;
            dialogueState = 'WAITING_FOR_CHOICE';
        } else {
            // ★★★ 修正: 応答メッセージ表示後などはユーザーの入力を待つ
            dialogueState = 'WAITING';
        }
        if (onComplete) {
            onComplete();
        }
    };
    
    // ★★★ 修正: スキップ処理から参照できるように、コールバックをメッセージオブジェクトに保持
    message._onTypingFinished = onTypingFinished;

    if (noType) {
        messageTextElement.innerHTML = message.text.replace(/\n/g, '<br>');
        onTypingFinished();
    } else {
        typeMessage(messageTextElement, message.text, onTypingFinished, noType, message);
    }
}

/**
 * 会話を指定されたIDに切り替えます。モーダルは閉じません。
 * @param {string} dialogueId - 次の会話のID
 */
function continueDialogue(dialogueId) {
    console.log(`[DEBUG] continueDialogue: Calling startDialogue for ID: "${dialogueId}" with isContinuation = true`);
    startDialogue(dialogueId, onCompleteCallback, true);
}
/**
 * 会話をスキップする
 * @param {boolean} toEnd - trueなら最後まで、falseなら未読の選択肢までスキップ
 */
function skipDialogue(toEnd = true) {
    if (!currentDialogueId || dialogueState === 'IDLE') return;

    // ★ MODIFIED: 「最後までスキップ」の場合、即座に会話を終了してコールバックを呼ぶ
    if (toEnd) {
        finishDialogue(); // suppressCallbackはfalse（デフォルト）でコールバックを実行
        return;
    }

    const dialogue = DIALOGUE_DATA[currentDialogueId];
    let stopIndex = -1; // スキップを停止するメッセージのインデックス

    // ★ MODIFIED: toEndがfalseの場合、現在の再生位置以降で最初の選択肢を探す
    if (!toEnd) {
        // currentMessageIndexから探し始めることで、すでに表示済みの選択肢はスキップする
        for (let i = currentMessageIndex; i < dialogue.messages.length; i++) {
            const message = dialogue.messages[i];
            // 選択肢があれば、そこで停止する（既読・未読は問わない）
            if (message.choices) {
                stopIndex = i;
                break;
            }
        }
    }

    // 未再生の選択肢が見つかった場合
    if (stopIndex !== -1) {
        // その選択肢の手前まで一気に表示
        while (currentMessageIndex < stopIndex) {
            displayNextMessage(null, null, true); // true: noType
        }

        // ★ MODIFIED: displayNextMessage() を直接呼ばず、選択肢表示に特化させる
        // これにより、currentMessageIndex が余計に進むのを防ぐ
        const choiceMessage = dialogue.messages[stopIndex];
        currentMessageIndex = stopIndex + 1; // 選択肢を表示するメッセージのインデックスを正しく設定
        updateCharacterDisplay(choiceMessage); // 立ち絵を更新
        displayChoices(choiceMessage.choices); // 選択肢を直接表示


        // ★ 選択肢までスキップしたら、両方のスキップボタンを隠す
        if (skipToEndButton) skipToEndButton.style.display = 'none';
        if (skipToChoiceButton) skipToChoiceButton.style.display = 'none';
        return;
    }

    // 未再生の選択肢がない場合は、最後までスキップ
    // 既に会話が最後まで表示されている場合は、会話を終了させる
    if (currentMessageIndex >= dialogue.messages.length && !isTyping) {
        finishDialogue();

        return;
    }


    // 2. 残りのメッセージをすべて表示
    while (currentMessageIndex < dialogue.messages.length) { 
        displayNextMessage(null, null, true);
    }

    // 3. UIを更新
    chatContent.scrollTop = chatContent.scrollHeight;
    if (skipToEndButton) skipToEndButton.style.display = 'none';
    if (skipToChoiceButton) skipToChoiceButton.style.display = 'none';

    // 会話の最後に到達したので、次のクリック/キー入力でダイアログが閉じるように
    // currentMessageIndexをメッセージ数に設定しておく
    dialogueState = 'WAITING';
}

function advanceDialogue() {
    if (!currentDialogueId || dialogueState === 'IDLE') return;

    // 選択肢表示中、またはマップ遷移待機中は入力を無視
    // ★★★ 修正: WAITING_FOR_CHOICE状態のときに選択肢を表示する
    if (dialogueState === 'WAITING_FOR_CHOICE') {
        if (currentTypingMessage?.choices) {
            displayChoices(currentTypingMessage.choices);
        }
        return;
    }

    if (dialogueState === 'CHOOSING') {
        return;
    }

    // タイピング中の場合、タイピングをスキップする
    if (dialogueState === 'TYPING') {
        const lastMessageBubble = chatContent.querySelector('.chat-bubble:last-child .message-text');
        if (lastMessageBubble && currentTypingMessage) {
            lastMessageBubble.innerHTML = currentTypingMessage.text.replace(/\n/g, '<br>');
            chatContent.scrollTo({ top: chatContent.scrollHeight, behavior: 'smooth' });
            // ★★★ 修正: スキップ時にも onTypingFinished を呼び出す
            // これにより、スキップ後に 'WAITING_FOR_CHOICE' 状態へ正しく移行できる
            const onTypingFinished = currentTypingMessage._onTypingFinished;
            if (onTypingFinished) {
                onTypingFinished();
            }
        }
        return;
    }

    // ★ NEW: マップに戻る待機中の場合、モーダルを閉じてマップに戻る
    if (waitingForMapReturn) {
        waitingForMapReturn = false;
        closeDialogue();
        showQuestMap();
        return;
    }

    // 応答メッセージ表示後(WAITING状態)にnextIdがあれば遷移
    if (dialogueState === 'WAITING' && currentTypingMessage?.nextId) {
        const nextId = currentTypingMessage.nextId;
        currentTypingMessage = null; // 処理したのでクリア
        continueDialogue(nextId);
        return;
    }

    // 通常の会話進行
    const dialogue = DIALOGUE_DATA[currentDialogueId];
    if (!dialogue) return;

    if (dialogueState === 'WAITING') {
        if (currentMessageIndex >= dialogue.messages.length) {
            finishDialogue();
        } else {
            displayNextMessage();
        }
    }
}
/**
 * 選択肢を表示します。
 * @param {Array} choices - 選択肢の配列
 */
function displayChoices(choices) {
    if (!choicesContainer) return;

    dialogueState = 'CHOOSING';
    choicesContainer.innerHTML = ''; // コンテナをクリア
    choicesContainer.style.display = 'flex';
    chatPanel?.classList.add('is-choosing'); // ★選択肢表示中のクラスを追加

    // ★ 選択肢表示中はスキップボタンを非表示にする
    if (skipToEndButton) skipToEndButton.style.display = 'none';
    if (skipToChoiceButton) skipToChoiceButton.style.display = 'none';


    // ★ MODIFIED: 現在のメッセージから choiceId を取得
    const currentMessage = DIALOGUE_DATA[currentDialogueId].messages[currentMessageIndex - 1];
    const choiceId = currentMessage.choiceId;

    choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.className = 'dialogue-choice-btn';
        // ★ MODIFIED: 既読の選択肢は文字色を変更する
        if (isChoicePlayed(choiceId, index)) {
            button.style.color = '#4caf50'; // 緑色
            button.style.opacity = '0.8'; // 少し薄くして既読感を出す
        }
        // ★ MODIFIED: 選択肢に番号を追加
        button.textContent = `${index + 1}. ${choice.text}`;

        button.onclick = (e) => {
            e.stopPropagation(); // 親要素へのクリックイベント伝播を停止
            // ★ MODIFIED: 現在のメッセージオブジェクトからchoiceIdを取得して渡す
            const currentMessage = DIALOGUE_DATA[currentDialogueId].messages[currentMessageIndex - 1];
            handleChoice(choice, index, currentMessage.choiceId);
        };
        choicesContainer.appendChild(button);
    });
}

/**
 * 選択肢が選ばれたときの処理
 * @param {object} choice - 選択されたchoiceオブジェクト
 * @param {number} choiceIndex - 選択された選択肢のインデックス
 * @param {string} choiceId - 選択肢グループのID
 */
function handleChoice(choice, choiceIndex, choiceId) {
    dialogueState = 'IDLE'; // 一時的にIDLEにして、次の処理で状態を更新
    if (choicesContainer) {
        choicesContainer.style.display = 'none';
        choicesContainer.innerHTML = '';
        chatPanel?.classList.remove('is-choosing');

        const dialogueData = DIALOGUE_DATA[currentDialogueId];
        // ★★★ 修正: 現在の再生位置の「次」からスライスすることで、ループ選択肢を選んだ際の判定を正しくする
        const futureMessages = dialogueData.messages.slice(currentMessageIndex);
        // この先に未読の選択肢が残っているかチェック
        const hasUnplayedChoicesAhead = futureMessages.some(m =>
            m.choices && m.choiceId && !haveAllChoicesBeenPlayed(m.choiceId, m.choices.length)
        );
        // 現在の再生位置以降に、選択肢（既読・未読問わず）が残っているかチェック
        const hasMoreChoicesAhead = dialogueData.messages.slice(currentMessageIndex).some(m => m.choices && m.choiceId);

        if (dialogueData) {
            // 会話全体がスキップ可能か（一度クリア/再生済みか）を判定
            const isSkippable = currentDialogueId.endsWith('_start')
                ? isCleared(currentDialogueId.replace(/_start$/, ''))
                : hasDialogueBeenPlayed(currentDialogueId);


            if (choiceId !== undefined && choiceIndex !== undefined) {
                //選択肢が未読だったかどうかをチェック
                const wasUnread = !isChoicePlayed(choiceId, choiceIndex);
                if (wasUnread && !isSkippable) {
                    // 初回プレイ時など、スキップ自体が許可されていない場合はボタンを非表示
                    if (skipToEndButton) skipToEndButton.style.display = 'none';
                    if (skipToChoiceButton) skipToChoiceButton.style.display = 'none';
                } else {
                    // 既読の場合、または未読でもスキップ可能な場合
                    if (isSkippable) {
                        // この先にまだ見ていない選択肢が残っている場合、かつ、この先にも選択肢がある場合。
                        if (hasUnplayedChoicesAhead && hasMoreChoicesAhead) {
                            // 「選択肢までスキップ」を表示
                            if (skipToChoiceButton) skipToChoiceButton.style.display = 'block';
                            if (skipToEndButton) skipToEndButton.style.display = 'none';
                        // この先にまだ見ていない選択肢が残っていない場合、かつ、この先にも選択肢がある場合。   
                        } else if (!hasUnplayedChoicesAhead && hasMoreChoicesAhead) {
                            if (skipToChoiceButton) skipToChoiceButton.style.display = 'block';
                            if (skipToEndButton) skipToEndButton.style.display = 'block';
                        // この先に未読の選択肢がない場合
                        } else {
                            if (skipToChoiceButton) skipToChoiceButton.style.display = 'none';
                            if (skipToEndButton) skipToEndButton.style.display = 'block';
                        }
                    } else {
                        // スキップ不可能な会話（初回プレイなど）ではボタンを非表示
                        if (skipToEndButton) skipToEndButton.style.display = 'none';
                        if (skipToChoiceButton) skipToChoiceButton.style.display = 'none';
                    }
                }
            }
        }
    }

    const showResponse = choice.response;
    const goToNextId = choice.nextId;

    // ★ NEW: プレイヤーの選択をログに追加
    // responseやnextIdがなくても、選択したという事実をログに残す
    if (choice.text) {
        // 選択肢のテキストをログとして表示
        const playerResponseBubble = document.createElement('div');
        playerResponseBubble.className = 'chat-bubble right'; // プレイヤーの発言として右寄せ
        // オペレーターの発言として名前を表示しないように、シンプルな構造にする
        playerResponseBubble.innerHTML = `<div class="message-content"><div class="message-text">${choice.text}</div></div>`;
        chatContent.appendChild(playerResponseBubble);
        chatContent.scrollTop = chatContent.scrollHeight;
    }

    // ★ NEW: 選択肢の再生履歴を記録
    if (choiceId !== undefined && choiceIndex !== undefined) {
        markChoicePlayed(choiceId, choiceIndex);
    }

    // ★ backToMap フラグがあれば、会話を終了してマップに戻る
    if (choice.backToMap) {
        if (skipToEndButton) skipToEndButton.style.display = 'none';
        if (skipToChoiceButton) skipToChoiceButton.style.display = 'none';

        // response があればそれを表示してからマップに戻る
        if (!choice.response) {
            // responseがなければ即座にマップに戻る
            closeDialogue();
            showQuestMap();
        } else {
            // responseがあれば、表示後にユーザーの入力を待つ
            waitingForMapReturn = true;
            displayNextMessage(choice.response);
        }
        return;
    }
    if (showResponse) {
        // ★★★ 修正: responseにnextIdを紐付けて、advanceDialogueで処理させる
        if (goToNextId) {
            showResponse.nextId = goToNextId; // 次のIDを渡す
        }
        // response表示後はユーザーの入力を待つので、コールバックは不要
        displayNextMessage(showResponse);
    } else if (goToNextId) {
        // responseがなくnextIdだけの場合
        // こちらは即時遷移で問題ない
        continueDialogue(goToNextId);
    } else {
        // responseもnextIdもない場合は、通常の会話フローを継続
        // advanceDialogueを直接呼ぶと状態遷移が複雑になるため、
        // WAITING状態にしてユーザーの次の入力を待つ
        dialogueState = 'WAITING';
        advanceDialogue();
    }
}


/**
 * 会話モーダルを閉じ、完了コールバックを実行します。
 * 主に会話が正常に終了した際に内部的に使用されます。
 */
function finishDialogue() {
    // 選択肢表示中は終了しない
    if (dialogueState === 'CHOOSING') {
        return;
    }
    dialogueState = 'IDLE';
    // DIALOGUE_DATAにデータが存在する場合のみ再生履歴を記録する。
    const lastPlayedDialogueId = currentDialogueId; // コールバック前にIDを保持
    if (lastPlayedDialogueId && DIALOGUE_DATA[lastPlayedDialogueId]) {
        // ★★★ 修正: ランダム会話の場合、再生履歴は記録しない
        // isBranchフラグで判定する
        const isRandomOrBranch = DIALOGUE_DATA[lastPlayedDialogueId].isBranch;
        if (!isRandomOrBranch) {
            markDialoguePlayed(lastPlayedDialogueId);
        }
    }
    currentDialogueId = null; // ★★★ 会話IDを確実にクリアする

    const leftChar = document.getElementById('dialogueCharLeft'); // 立ち絵を非表示にする
    const rightChar = document.getElementById('dialogueCharRight');
    if(leftChar) leftChar.style.backgroundImage = 'none';
    if(rightChar) rightChar.style.backgroundImage = 'none';

    closeDialogue(); // モーダルを閉じる

    // イベントリスナーを削除
    if (handleDialogueClick) dialogueModal.removeEventListener('click', handleDialogueClick);
    if (handleDialogueKeydown) document.removeEventListener('keydown', handleDialogueKeydown);
    // ★スタッフロール中のスキップイベントもここで確実に解除（captureで登録しているためフラグを揃える）
    const skipHandler = window._staffRollSkipHandler;
    if (skipHandler) document.removeEventListener('keydown', skipHandler, true);
    handleDialogueClick = null;
    handleDialogueKeydown = null;

    if (onCompleteCallback) {
        const cb = onCompleteCallback;
        // ★★★ 修正: コールバックを呼ぶ直前に、一時的なランダム会話データを削除する
        // currentDialogueIdは既にnullになっているので、最後に再生したIDを別の変数で保持する必要がある
        if (lastPlayedDialogueId && lastPlayedDialogueId.startsWith('_random_')) {
            delete DIALOGUE_DATA[lastPlayedDialogueId];
        }
        // コールバックを呼んだ後でクリアする
        onCompleteCallback = null;
        cb(); // コールバックを実行
    }
}

/**
 * 会話モーダルを強制的に閉じます。
 * コールバックは実行されません。
 */
export function closeDialogue() {
    if (dialogueModal) {
        dialogueModal.querySelector('.dialogue-controls')?.classList.add('hidden');
        dialogueModal.querySelector('.dialogue-log-panel')?.classList.add('hidden');
        dialogueModal.querySelector('.dialogue-chat-panel')?.classList.add('hidden');

        dialogueModal.classList.remove('show');
        // ★ログ表示用のクラスもリセット
        dialogueModal.querySelector('.dialogue-container')?.classList.remove('log-view-mode', 'chapter-selected');

        dialogueModal.style.display = 'none'; // 最終的な非表示
    }
    if (chatContent) {
        chatContent.innerHTML = '';
    }
    const leftChar = document.getElementById('dialogueCharLeft');
    const rightChar = document.getElementById('dialogueCharRight');
    if (leftChar) leftChar.style.backgroundImage = 'none';
    if (rightChar) rightChar.style.backgroundImage = 'none';

    currentDialogueId = null;
    currentMessageIndex = 0;
    dialogueState = 'IDLE';
    waitingForMapReturn = false; // ★ マップに戻る待機フラグをリセット
    currentTypingMessage = null;

    // ★ 選択肢コンテナをクリアし、関連クラスを削除
    if (choicesContainer) {
        choicesContainer.style.display = 'none';
        choicesContainer.innerHTML = '';
    }
    chatPanel?.classList.remove('is-choosing');

    // イベントリスナーを削除
    if (handleDialogueClick) dialogueModal.removeEventListener('click', handleDialogueClick);
    if (handleDialogueKeydown) document.removeEventListener('keydown', handleDialogueKeydown);
    const skipHandler = window._staffRollSkipHandler;
    if (skipHandler) document.removeEventListener('keydown', skipHandler, true);

    handleDialogueClick = null;
    handleDialogueKeydown = null;
}

/**
 * 指定されたIDの会話を開始します。
 * @param {string} dialogueId - dialogueData.jsで定義された会話のID
 * @param {function} onComplete - 会話が終了したときに呼び出されるコールバック関数
 * @param {boolean} isContinuation - 内部用フラグ。モーダルを再生成しない場合にtrue
 */
export function startDialogue(dialogueId, onComplete, isContinuation = false) {
    // --- ランダム会話のフォールバック処理 ---
    if (!DIALOGUE_DATA[dialogueId]) {
        const node = gameState.currentQuestNode;
        if (node && node.enableRandomDialogue) {
            // ★★★ 修正: 現在のステージ番号ではなく、クリア済みの最大ステージ番号を基準にする
            const stageNum = getMaxClearedStageNumber();

            if (!isNaN(stageNum)) {
                // ステージ番号に合致する範囲を探す
                const rangeKey = Object.keys(RANDOM_DIALOGUES).find(key => {
                    const [start, end] = key.split('-').map(Number);
                    return stageNum >= start && stageNum <= end;
                });

                if (rangeKey) {
                    const timing = dialogueId.endsWith('_start') ? 'pre' : 'post';
                    const randomPool = RANDOM_DIALOGUES[rangeKey]?.[timing];

                    if (randomPool && randomPool.length > 0) {
                        // ランダムに会話を選び、一時的な会話データとして扱う
                        const randomMessage = randomPool[Math.floor(Math.random() * randomPool.length)];
                        const temporaryDialogueId = `_random_${Date.now()}`;
                        DIALOGUE_DATA[temporaryDialogueId] = {
                            title: "ランダムイベント",
                            isBranch: true, // ログには残さない
                            messages: [randomMessage]
                        };
                        // 一時的なIDで会話を開始する
                        startDialogue(temporaryDialogueId, onComplete, isContinuation);
                        return;
                    }
                }
            }
        }

        // ランダム会話も再生できなかった場合
        console.log(`Dialogue with id "${dialogueId}" not found, and no random dialogue available.`);
        if (onComplete && !isContinuation) {
            onComplete(); // そのままコールバックを呼んで次の処理へ
        }
        return;
    }

    if (!isContinuation) {
        createDialogueUI();
    }

    // ★★★ 修正: 最後に再生したIDをグローバルに保持
    window._lastDialogueId = dialogueId;

    currentDialogueId = dialogueId;
    currentMessageIndex = 0;
    if (!isContinuation) onCompleteCallback = onComplete;
    dialogueState = 'IDLE';

    // ★チャットモードに設定
    dialogueModal.querySelector('.dialogue-container')?.classList.remove('log-view-mode');
    // 会話が継続している場合はチャット内容をクリアしない
    if (!isContinuation) {
        console.log(`[DEBUG] startDialogue: Clearing chatContent for dialogue ID: "${dialogueId}" (isContinuation: ${isContinuation})`);
        chatContent.innerHTML = '';
    }
    if (dialogueModal) {
        dialogueModal.style.display = 'flex';
        dialogueModal.style.opacity = '1';
        dialogueModal.style.visibility = 'visible';
        dialogueModal.style.pointerEvents = 'auto';
    }
    dialogueModal.classList.add('show');

    // 継続でない場合のみイベントリスナーを再設定
    if (!isContinuation) {
        // イベントリスナーをセット
        handleDialogueClick = () => advanceDialogue();
        handleDialogueKeydown = (e) => {
            // 会話モーダルが表示されていない場合は何もしない
            // ★スタッフロール表示中はメニューキーを無効化
            if (isStaffRollShowing) return true;

            if (!isDialogueVisible()) return;

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                advanceDialogue();
            }
            // 'E'キーで最後までスキップ
            if (e.key.toLowerCase() === 'e') {
                e.preventDefault();
                if (skipToEndButton && skipToEndButton.style.display !== 'none') {
                    skipToEndButton.click();
                }
            }
            // 'C'キーで選択肢までスキップ
            if (e.key.toLowerCase() === 'c') {
                e.preventDefault();
                if (skipToChoiceButton && skipToChoiceButton.style.display !== 'none') {
                    skipToChoiceButton.click();
                }
            }
            // ★ ADDED: 数字キーで選択肢を選ぶ
            if (dialogueState === 'CHOOSING' && /^[1-9]$/.test(e.key)) {
                e.preventDefault();
                const choiceIndex = parseInt(e.key, 10) - 1;
                const choiceButtons = choicesContainer.querySelectorAll('.dialogue-choice-btn');
                if (choiceButtons[choiceIndex]) {
                    // 対応するボタンのクリックイベントを発火
                    choiceButtons[choiceIndex].click();
                }
                return; // 選択肢を選んだら他のキー処理は行わない
            }
            // ESCキーで会話を中断してマップに戻る
            if (e.key === 'Escape') {
                e.preventDefault();

                // ★ プロローグとエンディング中はESCを無効化
                if (currentDialogueId === 'prologue' || currentDialogueId === 'true_ending_dialogue') {
                    return; // 何もせずに処理を抜ける
                }
                // ★ 初めてクリアしたノードの戦闘後会話はESCでスキップさせない
                if (currentDialogueId?.endsWith('_end') && !hasDialogueBeenPlayed(currentDialogueId)) {
                    return;
                } else {
                    closeDialogue();
                    showQuestMap();
                }
            }
        }
        dialogueModal.addEventListener('click', handleDialogueClick);
        document.addEventListener('keydown', handleDialogueKeydown);
    }

    // ★ MODIFIED: Control Skip button visibility based on whether dialogue has been played
    if (skipToEndButton && skipToChoiceButton) {
        const dialogue = DIALOGUE_DATA[dialogueId]; // ★ この行を追加
        // デフォルトでは両方のボタンを非表示
        skipToEndButton.style.display = 'none';
        skipToChoiceButton.style.display = 'none';

        let canSkip = false;
        if (dialogueId.endsWith('_start')) {
            // クエスト開始前の会話：クエストがクリア済みならスキップ可能
            const questId = dialogueId.replace(/_start$/, '');
            canSkip = isCleared(questId);
        } else if (dialogueId.endsWith('_end')) {
            // クエストクリア後の会話：一度再生済みならスキップ可能
            const questId = dialogueId.replace(/_start$|_end$/, '');
            canSkip = hasDialogueBeenPlayed(dialogueId);
        } else {
            // プロローグやエンディングなど、特殊な会話の場合：再生済みかチェック
            // ★ MODIFIED: 分岐先の会話なども考慮し、再生済みであればスキップ可能にする。
            // `_start`や`_end`で終わらない会話ID（例: 'W1_Q1_branch_1'）も、一度再生されていればスキップ対象とする。
            canSkip = hasDialogueBeenPlayed(dialogueId);
        }

        // プロローグは初回はスキップ不可
        if (dialogueId === 'prologue' && !hasDialogueBeenPlayed('prologue')) {
            canSkip = false;
        }

        if (dialogue && canSkip) {
             const hasChoices = dialogue.messages.some(m => m.choices && m.choiceId);
             const choiceMessages = dialogue.messages.filter(m => m.choices?.length > 0 && m.choiceId);
             console.log(`[DEBUG] hasChoices: ${hasChoices}`);

             if (hasChoices) {
                // ★ MODIFIED: 会話内の全選択肢を走査し、1つでも既読のものがあるか判定
                const hasAnyPlayedChoice = choiceMessages.some(message =>
                    message.choices.some((choice, index) => isChoicePlayed(message.choiceId, index))
                );

                // ★ MODIFIED: すべての選択肢グループが既読かを判定
                const allChoicesPlayed = choiceMessages.every(message =>
                    haveAllChoicesBeenPlayed(message.choiceId, message.choices.length)
                );

                console.log(`[DEBUG] hasAnyPlayedChoice: ${hasAnyPlayedChoice}`);
                console.log(`[DEBUG] allChoicesPlayed: ${allChoicesPlayed}`);
                // 「選択肢までスキップ」: 1つでも既読の選択肢があれば表示
                if (hasAnyPlayedChoice || allChoicesPlayed) {
                    skipToChoiceButton.style.display = 'block';
                }
                // 「最後までスキップ」: すべての選択肢が既読の場合のみ表示
                if (allChoicesPlayed) {
                    skipToEndButton.style.display = 'block';
                }
            } else {
                // 選択肢がない場合は「最後までスキップ」のみ表示
                skipToEndButton.style.display = 'block';
            }
        }
    }

    displayNextMessage();
}

/**
 * 会話ログモーダルを表示します。
 */
export function showLog() {
    createDialogueUI();
    // ★ログ表示モードに設定
    dialogueModal.querySelector('.dialogue-container')?.classList.add('log-view-mode');

    // チャプターリストを生成・表示
    renderChapterLog();

    // モーダルを表示
    if (dialogueModal) {
        dialogueModal.style.display = 'flex';
        dialogueModal.style.opacity = '1';
        dialogueModal.style.visibility = 'visible';
        dialogueModal.style.pointerEvents = 'auto';
        dialogueModal.classList.add('show');
    }
}

/**
 * 会話モーダルが表示されているかどうかを返します。
 * @returns {boolean}
 */
export function isDialogueVisible() {
    return dialogueModal && dialogueModal.classList.contains('show');
}

/**
 * スタッフロールが表示中かどうかを返します。
 */
export function isStaffRollActive() {
    return isStaffRollShowing;
}

/**
 * 真エンディングシーケンスを開始します。
 */
export async function startTrueEndingSequence(onCompleteCallback) {
    // HUDを非表示にする
    showHud(false);

    // ★ ここからエンディングが完全に終了するまで、全ショートカットキーを無効化する。
    //   （タイトル表示中や Thank you 表示中に s/a などでセーブ・勲章画面が開くのを防ぐ）
    window._staffRollActive = true;

    // 1. CSSの読み込みを試みる
    await loadStaffRollCSS();

    // 2. 画面を暗転させる
    const blackout = await fadeToBlack();
    playBGM("bgm_hosikuzu"); // BGM再生開始
    await new Promise(r => setTimeout(r, 2000));

    // 3. メッセージを表示する（ゲームタイトル）
    await showMessage("MameType", 2800, 'staff-roll-title');

    // 4. スタッフロールのHTMLを表示する
    await showStaffRoll(() => {
        // BGMのフェードアウトは showStaffRoll() 内部（endRoll）で行われる
        // ★ エンディングが完全に終了してからショートカットキーを再有効化する
        window._staffRollActive = false;
        if (onCompleteCallback) onCompleteCallback();
        showHud(true); // ★ HUDを再表示
    });
    // 5. エンディングを見たことを記録する
    markTrueEndingSeen();

    if (blackout) blackout.remove();
}

// CSSを動的に読み込む
function loadDialogueCSS() {
    if (document.getElementById('dialogue-css')) return;
    const link = document.createElement('link');
    link.id = 'dialogue-css';
    link.rel = 'stylesheet';
    link.href = './js/dialogue.css';
    document.head.appendChild(link);
}

loadDialogueCSS();

// DIALOGUE_DATAを再エクスポートして、questMapUI.jsから参照できるようにする
export { DIALOGUE_DATA }