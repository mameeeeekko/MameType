// dialogue.js

import { getClearedStageCount, isCleared, markDialoguePlayed, hasDialogueBeenPlayed } from './questProgress.js'; // ★ MODIFIED: Import new functions
import { DIALOGUE_DATA } from './dialogueData.js';
import { QUEST_MAP } from './questMap.js';
import { showQuestMap } from './main.js';

let dialogueModal = null;
let logPanel = null;
let chatPanel = null;
let chatContent = null;
let closeButton = null;
let skipButton = null; // Skipボタン用の変数を追加

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

    const container = modal.querySelector('.dialogue-container');
    if (container) {
        container.style.width = '80%';
        container.style.maxWidth = '1000px';
        container.style.height = '80%';
        container.style.maxHeight = '700px';
        container.style.background = '#161b22';
        container.style.border = '1px solid #30363d';
        container.style.borderRadius = '12px';
        container.style.display = 'flex';
        container.style.overflow = 'hidden';
        container.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        container.style.transform = 'scale(1)';
    }

    if (logPanel) {
        logPanel.style.display = 'block';
        logPanel.style.width = '250px';
        logPanel.style.padding = '15px';
        logPanel.style.background = '#0d1117';
        logPanel.style.borderRight = '1px solid #30363d';
        logPanel.style.overflowY = 'auto';
    }

    if (chatPanel) {
        chatPanel.style.display = 'flex';
        chatPanel.style.flexDirection = 'column';
        chatPanel.style.flexGrow = '1';
    }

    if (chatContent) {
        chatContent.style.flexGrow = '1';
        chatContent.style.padding = '20px';
        chatContent.style.overflowY = 'auto';
    }

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

        const iconStyle = message.icon ? `style="background-image: url('${message.icon}')"` : '';
        bubble.innerHTML = `
            <div class="character-icon" ${iconStyle}></div>
            <div class="message-content">
                <div class="character-name">${message.character}</div>
                <div class="message-text">${message.text.replace(/\n/g, '<br>')}</div>
            </div>
        `;
        chatContent.appendChild(bubble);
    });

    // 一番上にスクロール
    chatContent.scrollTop = 0;
}

function renderChapterLog() {
    const logChaptersContainer = document.getElementById('dialogueLogChapters');
    if (!logChaptersContainer) return;
    logChaptersContainer.innerHTML = '';

    const clearedDialogueIds = Object.keys(DIALOGUE_DATA).filter(id => {
        const questId = id.replace(/_start$|_end$/, '');
        return isCleared(questId);
    });

    // 右側パネルを初期化し、選択を促すメッセージを表示
    if (chatPanel) chatPanel.style.display = 'block';
    if (chatContent) {
        chatContent.innerHTML = '<div class="log-select-prompt">左のチャプターを選択してログを読み込みます。</div>';
    }
    // 会話再生用の「次へ」ボタンはログ表示時には不要
    const controls = dialogueModal.querySelector('.dialogue-controls');
    if (controls) {
        controls.style.display = 'none';
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

        const questId = dialogueId.replace(/_start$|_end$/, '');
        const stageName = getStageName(questId);
        const eventType = dialogueId.endsWith('_start') ? '開始時' : dialogueId.endsWith('_end') ? '終了時' : '';

        chapterDiv.innerHTML = `
            <div class="log-chapter-title">${dialogue.title}</div>
            <div class="log-chapter-status">${stageName} - ${eventType}</div>
        `;

        chapterDiv.addEventListener('click', () => {
            logChaptersContainer.querySelectorAll('.log-chapter').forEach(el => el.classList.remove('active'));
            chapterDiv.classList.add('active');
            displayChapterContent(dialogueId);
        });

        logChaptersContainer.appendChild(chapterDiv);
    });
}

function typeMessage(element, text, onFinished) {
    isTyping = true;
    let i = 0;
    const speed = currentDialogueSpeed; // ms
    let timerId = null; // タイマーIDを保持する変数

    function type() {
        if (!isTyping) { // スキップされた場合
            clearTimeout(timerId); // タイマーを停止
            return;
        }
        if (i < text.length) {
            element.innerHTML = text.substring(0, i + 1).replace(/\n/g, '<br>');
            timerId = setTimeout(() => {
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

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    const iconStyle = message.icon ? `style="background-image: url('${message.icon}')"` : '';
    bubble.innerHTML = `
        <div class="character-icon" ${iconStyle}></div>
        <div class="message-content">
            <div class="character-name">${message.character}</div>
            <div class="message-text"></div>
        </div>
    `;
    chatContent.appendChild(bubble);

    // スムーズにスクロール
    chatContent.scrollTop = chatContent.scrollHeight;

    const messageTextElement = bubble.querySelector('.message-text');

    currentMessageIndex++;

    // タイピング完了後に「次へ」ボタンを表示する
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
        if (lastMessageBubble) {
            lastMessageBubble.innerHTML = message.text.replace(/\n/g, '<br>');
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
    closeDialogue(); // モーダルを閉じる

    // イベントリスナーを削除
    if (handleDialogueClick) dialogueModal.removeEventListener('click', handleDialogueClick);
    if (handleDialogueKeydown) document.removeEventListener('keydown', handleDialogueKeydown);
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
        if (closeButton) closeButton.style.display = 'none';

        const controls = dialogueModal.querySelector('.dialogue-controls');
        const logPanel = dialogueModal.querySelector('.dialogue-log-panel');
        const chatPanel = dialogueModal.querySelector('.dialogue-chat-panel');
        if (logPanel) logPanel.style.display = 'none';
        if (chatPanel) chatPanel.style.display = 'none';
        if (controls) controls.style.display = 'none';
        dialogueModal.classList.remove('show');
        dialogueModal.style.display = 'none';
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

    chatContent.innerHTML = '';
    if (dialogueModal) {
        dialogueModal.style.display = 'flex';
        dialogueModal.style.opacity = '1';
        dialogueModal.style.visibility = 'visible';
        dialogueModal.style.pointerEvents = 'auto';
    }
    dialogueModal.classList.add('show');

    // ★会話開始時にコントロールパネルを表示する
    const controls = dialogueModal.querySelector('.dialogue-controls');
    if (controls) {
        // controls.style.display = 'block'; // blockにして領域を確保
        // controls.style.height = '0'; // 高さを0に
        // controls.style.visibility = 'hidden'; // 見えなくする
        controls.style.display = 'flex';
    }

    // イベントリスナーをセット
    handleDialogueClick = () => advanceDialogue();
    handleDialogueKeydown = (e) => {
        // 会話モーダルが表示されていない場合は何もしない
        if (!isDialogueVisible()) return;

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            advanceDialogue();
        }
        // ESCキーで会話を中断してマップに戻る
        if (e.key === 'Escape') {
            e.preventDefault();
            closeDialogue();
            showQuestMap();
        }
    };
    dialogueModal.addEventListener('click', handleDialogueClick);
    document.addEventListener('keydown', handleDialogueKeydown);
    
    // ★チャットパネルを表示する
    if (chatPanel) chatPanel.style.display = 'block';

    // 会話中は閉じるボタンを非表示
    if (closeButton) closeButton.style.display = 'none';

    // 会話中はログパネルを非表示にする
    if (logPanel) logPanel.style.display = 'none';

    // ★ MODIFIED: Control Skip button visibility based on whether dialogue has been played
    if (skipButton) {
        // Only allow skipping if the dialogue has been played before
        if (hasDialogueBeenPlayed(dialogueId)) {
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

    // ログパネルを表示
    if (logPanel) logPanel.style.display = 'block';
    // ログ表示時は閉じるボタンを表示
    if (closeButton) closeButton.style.display = 'block';

    // ログ表示時はSkipボタンを非表示
    if (skipButton) {
        skipButton.style.display = 'none';
    }

    // チャットパネルは非表示
    if (chatPanel) chatPanel.style.display = 'none';

    // チャプターリストを生成・表示
    renderChapterLog();

    const controls = dialogueModal.querySelector('.dialogue-controls');
    if (controls) {
        controls.style.display = 'none';
    }

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


// CSSを動的に読み込む
function loadDialogueCSS() {
    if (document.getElementById('dialogue-css')) return;
    const link = document.createElement('link');
    link.id = 'dialogue-css';
    link.rel = 'stylesheet';
    link.href = './js/dialogue.css';
    document.head.appendChild(link);
}

function injectDialogueStyles() {
    if (document.getElementById('dialogue-inline-styles')) return;
    const style = document.createElement('style');
    style.id = 'dialogue-inline-styles';
    style.textContent = `.message-text { text-align: left; }`;
    document.head.appendChild(style);
}

loadDialogueCSS();
injectDialogueStyles();

// DIALOGUE_DATAを再エクスポートして、questMapUI.jsから参照できるようにする
export { DIALOGUE_DATA }