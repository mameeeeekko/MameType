// dialogue.js

import { isCleared, markDialoguePlayed, hasDialogueBeenPlayed, hasSeenTrueEnding, markTrueEndingSeen } from './questProgress.js'; // ★ MODIFIED: Import new functions
import { playBGM, stopBGM } from './effectManager.js';
import { showHud } from './enemyCore.js';
import { DIALOGUE_DATA, CHARACTERS } from './dialogueData.js';
import { QUEST_MAP } from './questMap.js';
import { showQuestMap } from './main.js';
import { images } from './assetsLoader.js';

let dialogueModal = null;
let logPanel = null;
let chatPanel = null;
let chatContent = null;
let closeButton = null;
let skipButton = null; // Skipボタン用の変数を追加
let isStaffRollShowing = false; // スタッフロール表示中フラグ

let currentDialogueId = null;
let currentMessageIndex = 0;
let onCompleteCallback = null;
let isTyping = false;

// イベントリスナーを管理するための変数
const DIALOGUE_SPEEDS = [100, 75, 50, 30, 15]; // Slow -> Fast (ms)
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
        logPanel = existingModal.querySelector('.dialogue-log-panel');
        chatPanel = existingModal.querySelector('.dialogue-chat-panel');
        chatContent = existingModal.querySelector('#dialogueChatContent');
        closeButton = existingModal.querySelector('#dialogueCloseBtn');
        skipButton = existingModal.querySelector('#dialogueSkipBtn'); // Skipボタンを取得
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
                <div class="dialogue-controls">
                    <button id="dialogueSkipBtn">skip &gt;&gt;&gt;</button>
                </div>
            </div>
        </div>
    `;

    // body直下ではなく、モーダル専用コンテナに追加する
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.appendChild(modal);
    else document.body.appendChild(modal); // フォールバック

    dialogueModal = modal;
    logPanel = modal.querySelector('.dialogue-log-panel');
    chatPanel = modal.querySelector('.dialogue-chat-panel');
    chatContent = modal.querySelector('#dialogueChatContent');
    skipButton = modal.querySelector('#dialogueSkipBtn'); // Skipボタンを取得

    // 閉じるボタンのイベント
    closeButton = modal.querySelector('#dialogueCloseBtn');
    closeButton.addEventListener('click', () => closeDialogue());

    // Skipボタンのクリックイベント
    skipButton.addEventListener('click', () => skipDialogue());
}

function displayChapterContent(dialogueId) {
    const dialogue = DIALOGUE_DATA[dialogueId];
    if (!dialogue) {
        chatContent.innerHTML = '<div class="log-select-prompt">ログの読み込みに失敗しました。</div>';
        return;
    }

    chatContent.innerHTML = ''; // コンテンツをクリア

    dialogue.messages.forEach(message => {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        
        bubble.innerHTML = `
            <div class="character-icon"></div>
            <div class="message-content">
                <div class="character-name">${message.character}</div>
                <div class="message-text">${message.text.replace(/\n/g, '<br>')}</div>
            </div>
        `;

        // ★ MODIFIED: キャラクターアイコンを設定するロジックを追加
        const iconElement = bubble.querySelector('.character-icon');
        if (iconElement) {
            const charData = CHARACTERS[message.character];
            // ★ MODIFIED: 表情に応じたアイコンキーを取得
            const expression = message.expression || 'normal';
            const iconKey = charData?.images?.[expression] || charData?.icon;

            if (iconKey && images[iconKey]) {
                const imageUrl = images[iconKey].src;
                iconElement.style.setProperty('--character-icon-url', `url('${imageUrl}')`);
            }
        }
        // オペレーターの発言は右側に表示
        if (message.character === 'オペレーター') bubble.classList.add('right');

        chatContent.appendChild(bubble);
    });

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
    isStaffRollShowing = true; // ★表示開始

    const canSkip = hasSeenTrueEnding();

    // クリックとポインター表示に対応
    const staffRollHTML = `
        <div class="staff-roll-overlay">
            ${canSkip ? '<div class="staff-roll-skip" style="position: fixed; bottom: 20px; right: 20px; color: white; font-family: monospace; z-index: 10001; opacity: 0.7; cursor: pointer;">skip &gt;&gt;&gt;</div>' : ''}
            <div class="staff-roll-content">
                <div class="staff-roll-line"><span class="role-center">STAFF</span></div>
                <div class="staff-roll-line"><span class="role">Direction / Design / Programming</span><span class="name">MameSamurai</span></div>
                <div class="staff-roll-line"><span class="role">Music</span><span class="name">DOVA-SYNDROME</span></div>
                <div class="staff-roll-line"><span class="role">Sound Effect</span><span class="name">OtoLogic</span></div>
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

    const endRoll = () => {
        if (!overlay) return;
        clearTimeout(rollTimer);
        // イベントリスナーを安全に解除
        if (skipHandler) document.removeEventListener('keydown', skipHandler);
        if (skipButton) skipButton.removeEventListener('click', endRoll);

        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.remove();
            isStaffRollShowing = false; // ★表示終了
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
    }
}

function typeMessage(element, text, onFinished) {
    isTyping = true;
    let i = 0;
    const speed = currentDialogueSpeed; // ms
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
        if (!isTyping) { // スキップされた場合
            clearTimeout(timerId); // タイマーを停止
            return;
        }
        if (i < text.length) {
            element.innerHTML = text.substring(0, i + 1).replace(/\n/g, '<br>');
            timerId = setTimeout(() => {
                // ★文字を追加した直後にスクロール
                if (chatContent) chatContent.scrollTop = chatContent.scrollHeight;

                i++;
                type();
            }, speed);
        } else {
            isTyping = false;
            if (onFinished) onFinished();
        }
    }
    type();
}

function displayNextMessage() {
    const dialogue = DIALOGUE_DATA[currentDialogueId];
    if (!dialogue || currentMessageIndex >= dialogue.messages.length) {
        finishDialogue(); // ★コールバック付きの終了処理を呼び出す
        return;
    }

    const message = dialogue.messages[currentMessageIndex];
    // ★立ち絵を更新
updateCharacterDisplay(message);
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    
    bubble.innerHTML = `
        <div class="character-icon"></div>
        <div class="message-content">
            <div class="character-name">${message.character}</div>
            <div class="message-text"></div>
        </div>
    `;

    // ★ MODIFIED: キャラクターアイコンを設定するロジック
    const iconElement = bubble.querySelector('.character-icon');
    if (iconElement) {
        const charData = CHARACTERS[message.character];
        // ★ MODIFIED: 表情に応じたアイコンキーを取得
        const expression = message.expression || 'normal';
        const iconKey = charData?.images?.[expression] || charData?.icon;

        if (iconKey && images[iconKey]) {
            const imageUrl = images[iconKey].src;
            iconElement.style.setProperty('--character-icon-url', `url('${imageUrl}')`);
        }
    }

    chatContent.appendChild(bubble);

    // ★ MODIFIED: 新しい吹き出しが表示されたら、即座に一番下までスクロールする
    chatContent.scrollTop = chatContent.scrollHeight;

    // オペレーターの発言は右側に表示するためのクラスを追加
    if (message.character === 'オペレーター') bubble.classList.add('right');

    const messageTextElement = bubble.querySelector('.message-text');

    currentMessageIndex++;

    typeMessage(messageTextElement, message.text);
}

function skipDialogue() {
    if (!currentDialogueId) return;

    const dialogue = DIALOGUE_DATA[currentDialogueId];
    // 既に会話が最後まで表示されている場合は、会話を終了させる
    if (currentMessageIndex >= dialogue.messages.length && !isTyping) {
        finishDialogue();
        return;
    }

    // 1. 現在のタイピングを即時完了
    isTyping = false;
    const lastMessage = dialogue.messages[currentMessageIndex - 1];
    const lastMessageBubble = chatContent.querySelector('.chat-bubble:last-child .message-text');
    if (lastMessageBubble && lastMessage) {
        lastMessageBubble.innerHTML = lastMessage.text.replace(/\n/g, '<br>');
    }

    // 2. 残りのメッセージをすべて表示
    while (currentMessageIndex < dialogue.messages.length) {
        const message = dialogue.messages[currentMessageIndex];
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        const iconStyle = message.icon ? `style="background-image: url('${message.icon}')"` : '';
        bubble.innerHTML = `
            <div class="character-icon" ${iconStyle}></div>
            <div class="message-content">
                <div class="character-name">${message.character}</div>
                <div class="message-text">${message.text.replace(/\n/g, '<br>')}</div>
            </div>
        `;
        chatContent.appendChild(bubble);
        if (message.character === 'オペレーター') bubble.classList.add('right');
        currentMessageIndex++;
    }

    // 3. UIを更新
    chatContent.scrollTop = chatContent.scrollHeight;
    skipButton.style.display = 'none';

    // 会話の最後に到達したので、次のクリック/キー入力でダイアログが閉じるように
    // currentMessageIndexをメッセージ数に設定しておく
    currentMessageIndex = dialogue.messages.length;
}

function advanceDialogue() {
    if (isTyping) {
        // タイピングエフェクトをスキップ
        const dialogue = DIALOGUE_DATA[currentDialogueId];
        const message = dialogue.messages[currentMessageIndex - 1];
        const lastMessageBubble = chatContent.querySelector('.chat-bubble:last-child .message-text');
        if (lastMessageBubble && message) {
            lastMessageBubble.innerHTML = message.text.replace(/\n/g, '<br>');
            chatContent.scrollTo({
                top: chatContent.scrollHeight,
                behavior: 'smooth'
            });
        }
        isTyping = false;
    } else {
        // 次のメッセージへ、または会話終了
        const dialogue = DIALOGUE_DATA[currentDialogueId];
        if (currentMessageIndex >= dialogue.messages.length) {
            finishDialogue();
        } else {
            displayNextMessage();
        }
    }
}

/**
 * 会話モーダルを閉じ、完了コールバックを実行します。
 * 主に会話が正常に終了した際に内部的に使用されます。
 */
function finishDialogue() {
    // ★ MODIFIED: Mark dialogue as played when it finishes
    if (currentDialogueId) {
        markDialoguePlayed(currentDialogueId);
    }
    // 立ち絵を非表示にする
    const leftChar = document.getElementById('dialogueCharLeft');
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
    isTyping = false;

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
 */
export function startDialogue(dialogueId, onComplete) {
    if (!DIALOGUE_DATA[dialogueId]) {
        console.error(`Dialogue with id "${dialogueId}" not found.`);
        if (onComplete) onComplete();
        return;
    }

    createDialogueUI();

    currentDialogueId = dialogueId;
    currentMessageIndex = 0;
    onCompleteCallback = onComplete;
    isTyping = false;

    // ★チャットモードに設定
    dialogueModal.querySelector('.dialogue-container')?.classList.remove('log-view-mode');
    chatContent.innerHTML = '';
    if (dialogueModal) {
        dialogueModal.style.display = 'flex';
        dialogueModal.style.opacity = '1';
        dialogueModal.style.visibility = 'visible';
        dialogueModal.style.pointerEvents = 'auto';
    }
    dialogueModal.classList.add('show');

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
        // 's'キーでスキップ
        if (e.key.toLowerCase() === 's') {
            e.preventDefault();
            // skipButtonが存在し、かつ表示されている場合のみクリックする
            if (skipButton && skipButton.style.display !== 'none') {
                skipButton.click();
            }
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
    };
    dialogueModal.addEventListener('click', handleDialogueClick);
    document.addEventListener('keydown', handleDialogueKeydown);
    
    // ★ MODIFIED: Control Skip button visibility based on whether dialogue has been played
    if (skipButton) {
        // プロローグ以外で、かつ再生済みの会話のみスキップ可能にする
        if (dialogueId !== 'prologue' && hasDialogueBeenPlayed(dialogueId)) {
            skipButton.style.display = 'block';
        } else {
            skipButton.style.display = 'none';
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