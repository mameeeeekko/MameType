// dialogue.js

import { isCleared, markDialoguePlayed, hasDialogueBeenPlayed, hasSeenTrueEnding, markTrueEndingSeen, markChoicePlayed, haveAllChoicesBeenPlayed, isChoicePlayed, getMaxClearedStageNumber } from './questProgress.js'; // ★ MODIFIED: Import new functions
import { gameState } from './gameCore.js';
import { playBGM, stopBGM, playDialogueSound, playSystemDialogueSound } from './effectManager.js';
import { showHud } from './enemyCore.js';
import { DIALOGUE_DATA, CHARACTERS, RANDOM_DIALOGUES } from './dialogueData.js';
import { QUEST_MAP } from './questMap.js';
import { showQuestMap } from './main.js';
import { images } from './assetsLoader.js';

let dialogueModal = null;
let chatPanel = null;
let chatContent = null;
let closeButton = null;
let skipToEndButton = null; // 最後までスキップ
let skipToChoiceButton = null; // 選択肢までスキップ
let choicesContainer = null; // 選択肢コンテナ用の変数を追加
let isStaffRollShowing = false; // スタッフロール表示中フラグ

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
            font-family: 'monospace', 'Courier New', Courier;
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
    return new Promise((resolve) => {
        if (document.getElementById('staff-roll-css')) {
            resolve();
            return;
        }
        const link = document.createElement('link');
        link.id = 'staff-roll-css';
        link.rel = 'stylesheet';
        link.href = './js/staffRoll.css'; // CSSファイルのパス
        link.onload = () => resolve();
        link.onerror = () => {
            console.error("Failed to load staffRoll.css");
            resolve(); // エラーでも処理を続行
        };
        document.head.appendChild(link);
    });
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
 * @returns {Promise<void>}
 */
function showMessage(text, duration = 2000) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'true-ending-message-overlay';
        const p = document.createElement('p');
        p.textContent = text;
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

    const canSkip = hasSeenTrueEnding();

    // クリックとポインター表示に対応
    const staffRollHTML = `
        <div class="staff-roll-overlay">
            ${canSkip ? '<div class="staff-roll-skip" style="position: fixed; bottom: 20px; right: 20px; color: white; font-family: monospace; z-index: 10001; opacity: 0.7; cursor: pointer;">skip &gt;&gt;&gt;</div>' : ''}
            <div class="staff-roll-content">
                <div class="staff-roll-line"><span class="role-center">STAFF</span></div>
                <div class="staff-roll-line"><span class="role">Direction / Design / Programming</span><span class="name">mame</span></div>
                <div class="staff-roll-line"><span class="role">Music</span><span class="name">Pixabay</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">RYU ITO</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">moeru music.</span></div>
                <div class="staff-roll-line"><span class="role"></span><span class="name">MusMus</span></div>
                <div class="staff-roll-line"><span class="role">Sound Effect</span><span class="name">Pixabay</span></div>
                <div class="staff-roll-line"><span class="role-center" style="margin-top: 4em;">Special Thanks</span></div>
                <div class="staff-roll-line"><span class="role-center">All Players</span></div>
                <div class="staff-roll-line" style="margin-top: 6em; justify-content: center;"><span class="role-center">Thank you for playing!</span></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', staffRollHTML);

    const overlay = document.querySelector('.staff-roll-overlay');
    const skipButton = canSkip ? document.querySelector('.staff-roll-skip') : null;
    let skipHandler = null;
    let isCompleted = false; // 多重実行防止フラグ

    const endRoll = () => {
        if (isCompleted || !overlay) return;
        isCompleted = true;

        clearTimeout(rollTimer);
        // イベントリスナーを安全に解除
        if (skipHandler) document.removeEventListener('keydown', skipHandler);
        if (skipButton) skipButton.removeEventListener('click', endRoll);

        overlay.classList.add('fade-out');

        setTimeout(() => {
            overlay.remove();
            isStaffRollShowing = false;
            if (onComplete) onComplete();
        }, 1500);
    };

    const rollTimer = setTimeout(endRoll, 30000); // 30秒でロール終了

    if (canSkip && skipButton) {
        // Sキーでのスキップ
        skipHandler = (e) => {
            if (e.key.toLowerCase() === 's') {
                e.preventDefault();
                endRoll();
            }
        };
        document.addEventListener('keydown', skipHandler);

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
        const width = element.getBoundingClientRect().width;
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

    if (dialogueState === 'CHOOSING' || waitingForMapReturn) {
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

    // ★ NEW: 選択肢の再生履歴を記録
    if (choiceId !== undefined && choiceIndex !== undefined) {
        markChoicePlayed(choiceId, choiceIndex);
    }

    // ★ backToMap フラグがあれば、会話を終了してマップに戻る
    if (choice.backToMap) {
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
    // ★スタッフロール中のスキップイベントもここで確実に解除
    const skipHandler = window._staffRollSkipHandler;
    if (skipHandler) document.removeEventListener('keydown', skipHandler);
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
    currentDialogueId = null;
    currentMessageIndex = 0;
    dialogueState = 'IDLE';
    waitingForMapReturn = false; // ★ マップに戻る待機フラグをリセット

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
    if (skipHandler) document.removeEventListener('keydown', skipHandler);

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

    // 1. CSSの読み込みを試みる
    await loadStaffRollCSS();

    // 2. 画面を暗転させる
    const blackout = await fadeToBlack();
    playBGM("bgm_hosikuzu"); // BGM再生開始
    await new Promise(r => setTimeout(r, 2000));

    // 3. メッセージを表示する
    await showMessage("Thank you for playing.");

    // 4. スタッフロールのHTMLを表示する
    await showStaffRoll(() => {
        stopBGM(); // BGM停止
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