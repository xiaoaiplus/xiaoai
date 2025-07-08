// ==UserScript==
// @name         电竞自动下注脚本
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  电竞网站自动下注脚本，可以自动选择比赛并下注，专注于odds元素的超强适应性赔率检测，修复金额验证问题，支持快速金额选择
// @author       AI助手
// @match        https://imes-0hloh.takatakz.xyz/esportsitev2/index.html*
// @match        *://*.takatakz.xyz/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    // 用于跟踪比赛下注次数的对象
    const matchBetCounts = {};

    // 获取比赛的唯一标识符
    function getMatchIdentifier(matchElement) {
        // 获取游戏名称
        let gameName = '未知游戏';

        // 尝试从左侧面板获取游戏名称
        const leftPanel = document.querySelector('.leftPanel, .leftPanel.dom-collector-highlight');
        if (leftPanel) {
            // 尝试找到当前选中的游戏
            const selectedGame = leftPanel.querySelector('[class*="selected"], [class*="active"]');
            if (selectedGame) {
                gameName = selectedGame.textContent.trim();
            } else {
                // 尝试从左侧面板中提取游戏名称
                const gameNameMatch = leftPanel.textContent.match(/(英雄联盟|刀塔2|CS2|王者荣耀|无尽对决|守望先锋2|彩虹六号|使命召唤|星际争霸2|火箭联盟|炉石传说|NBA 2K|魔兽争霸3|绝地求生|堡垒之夜|云顶之弈|Free Fire|街头霸王6|铁拳8|Apex 英雄|Rennsport)/i);
                if (gameNameMatch) {
                    gameName = gameNameMatch[1];
                } else {
                    // 尝试从比赛元素中获取游戏名称
                    const gameNameElement = matchElement.querySelector('[class*="game-name"], [class*="sport-name"], [class*="esport-name"]');
                    if (gameNameElement) {
                        gameName = gameNameElement.textContent.trim();
                    }
                }
            }
        }

        // 获取比赛名称/联赛名称
        let leagueName = '未知联赛';
        const leagueElement = matchElement.querySelector('[class*="league"], [class*="tournament"], [class*="competition"]');
        if (leagueElement) {
            leagueName = leagueElement.textContent.trim();
        }

        // 获取队伍名称
        let teamNames = '';
        const teamElements = matchElement.querySelectorAll('[class*="team"], [class*="competitor"], [class*="player"]');
        if (teamElements.length >= 2) {
            teamNames = `${teamElements[0].textContent.trim()}_vs_${teamElements[1].textContent.trim()}`;
        }

        // 获取比赛局数信息
        let gameCount = '未知局数';
        const gameCountElement = matchElement.querySelector('[class*="bo"], [class*="best-of"], [class*="series"]');
        if (gameCountElement) {
            gameCount = gameCountElement.textContent.trim();
        } else {
            // 尝试从文本中提取BO信息
            const matchText = matchElement.textContent;
            const boMatch = matchText.match(/BO[1-9]|BO\s[1-9]|Best\sof\s[1-9]|最佳[1-9]局/i);
            if (boMatch) {
                gameCount = boMatch[0];
            } else {
                // 尝试查找所有元素，寻找包含BO信息的元素
                const allElements = matchElement.querySelectorAll('*');
                for (const element of allElements) {
                    const text = element.textContent.trim();
                    const boMatch = text.match(/BO[1-9]|BO\s[1-9]|Best\sof\s[1-9]|最佳[1-9]局/i);
                    if (boMatch) {
                        gameCount = boMatch[0];
                        break;
                    }
                }
            }
        }

        // 获取当前比分，用于确定当前是第几局
        let currentRound = '1';

        // 尝试查找明确标注当前局数的元素
        const roundElements = matchElement.querySelectorAll('[class*="round"], [class*="map"], [class*="game"]');
        for (const element of roundElements) {
            const text = element.textContent.trim();
            const roundMatch = text.match(/第([1-9])局|([1-9]):[1-9]|[1-9]:([1-9])|Map\s*([1-9])|Game\s*([1-9])/i);
            if (roundMatch) {
                for (let i = 1; i < roundMatch.length; i++) {
                    if (roundMatch[i]) {
                        currentRound = roundMatch[i];
                        break;
                    }
                }
                if (currentRound !== '1') break; // 如果找到非默认值，则停止查找
            }
        }

        // 如果没有找到明确的局数标注，则通过比分推断
        if (currentRound === '1') {
            const scoreElements = matchElement.querySelectorAll('[class*="score"]');
            if (scoreElements.length >= 2) {
                const homeScore = parseInt(scoreElements[0].textContent.trim()) || 0;
                const awayScore = parseInt(scoreElements[1].textContent.trim()) || 0;
                currentRound = String(homeScore + awayScore + 1); // 当前局数 = 已完成的局数 + 1
            } else {
                // 尝试从所有元素中查找比分信息
                const allElements = matchElement.querySelectorAll('*');
                for (const element of allElements) {
                    const text = element.textContent.trim();
                    const scoreMatch = text.match(/([0-9])\s*[-:]\s*([0-9])/i);
                    if (scoreMatch && scoreMatch.length >= 3) {
                        const homeScore = parseInt(scoreMatch[1]) || 0;
                        const awayScore = parseInt(scoreMatch[2]) || 0;
                        currentRound = String(homeScore + awayScore + 1);
                        break;
                    }
                }
            }
        }

        // 组合成唯一标识符: 游戏名称_联赛名称_队伍名称_比赛局数_当前局
        const identifier = `${gameName}_${leagueName}_${teamNames}_${gameCount}_${currentRound}`;
        debugLog(`生成比赛标识符: ${identifier}`);

        return identifier;
    }

    // 简单的字符串哈希函数
    function hashString(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // 添加样式
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');

        :root {
            --primary-color: #3b82f6;
            --primary-hover: #2563eb;
            --primary-light: rgba(59, 130, 246, 0.1);
            --secondary-color: #10b981;
            --secondary-hover: #059669;
            --dark-bg: #0f172a;
            --panel-bg: #1e293b;
            --card-bg: #334155;
            --card-hover: #475569;
            --text-primary: #f8fafc;
            --text-secondary: #e2e8f0;
            --text-muted: #94a3b8;
            --border-color: #475569;
            --danger-color: #ef4444;
            --danger-hover: #dc2626;
            --warning-color: #f59e0b;
            --warning-hover: #d97706;
            --success-color: #10b981;
            --success-hover: #059669;
            --border-radius: 10px;
            --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            --shadow-sm: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .auto-bet-panel {
            position: fixed;
            top: 20px;
            left: 20px; /* 修改为左上角 */
            background-color: var(--panel-bg);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            padding: 16px;
            z-index: 9999;
            color: var(--text-primary);
            width: 1000px; /* 增加宽度以适应横向布局 */
            font-family: 'Roboto', sans-serif;
            font-size: 14px;
            transition: var(--transition);
            overflow: hidden;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }

        .auto-bet-panel-header {
            display: flex;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-color);
            position: relative;
        }

        .auto-bet-panel-logo {
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            font-weight: bold;
            font-size: 18px;
            box-shadow: var(--shadow-sm);
            position: relative;
            overflow: hidden;
        }

        .auto-bet-panel-logo::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(to bottom right, rgba(255, 255, 255, 0.2), transparent);
            border-radius: 50%;
        }

        .auto-bet-panel-title {
            flex: 1;
            font-size: 18px;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0;
            background: linear-gradient(90deg, var(--text-primary), var(--text-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .auto-bet-panel-controls {
            display: flex;
            gap: 8px;
        }

        .auto-bet-panel-control-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            transition: var(--transition);
            padding: 0;
            font-size: 16px;
        }

        .auto-bet-panel-control-btn:hover {
            background-color: var(--card-bg);
            color: var(--text-primary);
            transform: translateY(-1px);
            box-shadow: var(--shadow-sm);
        }

        .auto-bet-panel-tabs {
            display: flex;
            justify-content: center; /* 居中显示标签 */
            margin-bottom: 16px;
            border-bottom: 1px solid var(--border-color);
            position: relative;
            z-index: 1;
        }

        .auto-bet-panel-tab {
            padding: 10px 18px;
            cursor: pointer;
            color: var(--text-secondary);
            border-bottom: 2px solid transparent;
            transition: var(--transition);
            font-weight: 500;
            position: relative;
            overflow: hidden;
        }

        .auto-bet-panel-tab.active {
            color: var(--primary-color);
            border-bottom: 2px solid var(--primary-color);
        }

        .auto-bet-panel-tab.active::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 2px;
            background: linear-gradient(90deg, var(--primary-color), var(--primary-hover));
            box-shadow: 0 0 8px var(--primary-color);
        }

        .auto-bet-panel-tab:hover:not(.active) {
            color: var(--text-primary);
            background-color: var(--primary-light);
        }

        .auto-bet-panel-tab:active {
            transform: translateY(1px);
        }

        .auto-bet-panel-content {
            max-height: 650px;
            overflow-y: hidden; /* 内容区域不需要滚动条，由各标签页自行处理 */
            padding: 10px;
            display: flex; /* 使用flex布局 */
            flex-direction: row; /* 横向排列 */
            gap: 16px; /* 元素之间的间距 */
            justify-content: space-between; /* 均匀分布 */
            align-items: flex-start; /* 顶部对齐 */
        }

        .auto-bet-panel-tab-content {
            display: block !important; /* 始终显示所有标签内容 */
            width: 32%; /* 平均分配宽度，留一点间距 */
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius);
            padding: 12px;
            background-color: var(--dark-bg);
            opacity: 0.8;
            max-height: 600px; /* 设置最大高度 */
            overflow-y: auto; /* 添加垂直滚动条 */
            scrollbar-width: thin;
            scrollbar-color: var(--border-color) var(--panel-bg);
        }

        .auto-bet-panel-tab-content::-webkit-scrollbar {
            width: 6px;
        }

        .auto-bet-panel-tab-content::-webkit-scrollbar-track {
            background: var(--panel-bg);
            border-radius: 10px;
        }

        .auto-bet-panel-tab-content::-webkit-scrollbar-thumb {
            background-color: var(--border-color);
            border-radius: 10px;
            border: 2px solid transparent;
            background-clip: padding-box;
        }

        .auto-bet-panel-tab-content.active {
            opacity: 1;
            box-shadow: 0 0 10px rgba(var(--primary-color-rgb), 0.3);
        }

        .auto-bet-panel-content::-webkit-scrollbar {
            width: 6px;
        }

        .auto-bet-panel-content::-webkit-scrollbar-track {
            background: var(--panel-bg);
            border-radius: 10px;
        }

        .auto-bet-panel-content::-webkit-scrollbar-thumb {
            background-color: var(--border-color);
            border-radius: 10px;
            border: 2px solid transparent;
            background-clip: padding-box;
        }

        .auto-bet-panel-content::-webkit-scrollbar-thumb:hover {
            background-color: var(--text-muted);
        }

        .auto-bet-panel-section {
            margin-bottom: 20px;
            position: relative;
        }

        .auto-bet-panel-section-title {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 14px;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            letter-spacing: 0.5px;
        }

        .auto-bet-panel-section-title::after {
            content: '';
            flex: 1;
            height: 1px;
            background: linear-gradient(90deg, var(--border-color), transparent);
            margin-left: 10px;
        }

        .auto-bet-panel-form-group {
            margin-bottom: 14px;
            position: relative;
        }

        .auto-bet-panel label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            color: var(--text-secondary);
            font-weight: 500;
        }

        .auto-bet-panel input, .auto-bet-panel select {
            width: 100%;
            padding: 10px 14px;
            background-color: var(--dark-bg);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            border-radius: 8px;
            font-size: 14px;
            transition: var(--transition);
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .auto-bet-panel input:hover, .auto-bet-panel select:hover {
            border-color: var(--text-muted);
        }

        .auto-bet-panel input:focus, .auto-bet-panel select:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px var(--primary-light);
        }

        .auto-bet-panel-button-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
        }

        .auto-bet-panel button {
            padding: 12px 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: var(--transition);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            position: relative;
            overflow: hidden;
            box-shadow: var(--shadow-sm);
            letter-spacing: 0.3px;
        }

        .auto-bet-panel button::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), transparent);
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .auto-bet-panel button:hover::before {
            opacity: 1;
        }

        .auto-bet-panel button:active {
            transform: translateY(1px);
            box-shadow: none;
        }

        .auto-bet-panel button.primary {
            background: linear-gradient(to bottom, var(--primary-color), var(--primary-hover));
            color: white;
        }

        .auto-bet-panel button.primary:hover {
            background: linear-gradient(to bottom, var(--primary-hover), var(--primary-hover));
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .auto-bet-panel button.secondary {
            background: linear-gradient(to bottom, var(--card-bg), var(--card-hover));
            color: var(--text-primary);
        }

        .auto-bet-panel button.secondary:hover {
            background: linear-gradient(to bottom, var(--card-hover), var(--card-hover));
        }

        .auto-bet-panel button.success {
            background: linear-gradient(to bottom, var(--success-color), var(--success-hover));
            color: white;
        }

        .auto-bet-panel button.success:hover {
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .auto-bet-panel button.danger {
            background: linear-gradient(to bottom, var(--danger-color), var(--danger-hover));
            color: white;
        }

        .auto-bet-panel button.danger:hover {
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .auto-bet-panel button.warning {
            background: linear-gradient(to bottom, var(--warning-color), var(--warning-hover));
            color: white;
        }

        .auto-bet-panel button.warning:hover {
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .auto-bet-panel button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            box-shadow: none;
        }

        .auto-bet-panel button:disabled::before {
            display: none;
        }

        .auto-bet-panel .status {
            padding: 12px;
            background-color: var(--dark-bg);
            border-radius: var(--border-radius);
            text-align: center;
            margin-bottom: 20px;
            font-size: 13px;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
        }

        .auto-bet-panel .status::before {
            content: '';
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: var(--text-muted);
            box-shadow: 0 0 5px var(--text-muted);
            animation: pulse 2s infinite;
        }

        .auto-bet-panel .status.active::before {
            background-color: var(--success-color);
            box-shadow: 0 0 8px var(--success-color);
        }

        .auto-bet-panel .status.error::before {
            background-color: var(--danger-color);
            box-shadow: 0 0 8px var(--danger-color);
        }

        .auto-bet-panel .status.warning::before {
            background-color: var(--warning-color);
            box-shadow: 0 0 8px var(--warning-color);
        }

        .auto-bet-panel .bet-counts {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            background-color: var(--dark-bg);
            border-radius: var(--border-radius);
            padding: 16px;
            margin-bottom: 20px;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
        }

        .auto-bet-panel .bet-counts::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--primary-color), transparent);
            opacity: 0.7;
        }

        .auto-bet-panel .bet-count-item {
            text-align: center;
            position: relative;
            padding: 8px;
            border-radius: var(--border-radius);
            background-color: rgba(0, 0, 0, 0.2);
            border: 1px solid var(--border-color);
            transition: var(--transition);
        }

        .auto-bet-panel .bet-count-item:hover {
            background-color: rgba(0, 0, 0, 0.3);
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }

        .auto-bet-panel .bet-count-value {
            font-size: 20px;
            font-weight: 700;
            color: var(--primary-color);
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .auto-bet-panel .bet-count-item:nth-child(3) .bet-count-value {
            color: var(--success-color);
        }

        .auto-bet-panel .bet-count-item:nth-child(4) .bet-count-value {
            color: var(--danger-color);
        }

        .auto-bet-panel .bet-count-label {
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 4px;
            font-weight: 500;
            letter-spacing: 0.5px;
        }

        /* 比赛列表卡片样式 */
        .match-list-container {
            margin-top: 16px;
            max-height: 520px;
            overflow-y: auto;
            padding-right: 4px;
            border-radius: var(--border-radius);
        }

        .match-list-container::-webkit-scrollbar {
            width: 6px;
        }

        .match-list-container::-webkit-scrollbar-track {
            background: var(--panel-bg);
        }

        .match-list-container::-webkit-scrollbar-thumb {
            background-color: var(--border-color);
            border-radius: 20px;
        }

        .match-list-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .match-list-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .match-list-refresh {
            background: none;
            border: none;
            color: var(--primary-color);
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .match-card {
            background-color: var(--card-bg);
            border-radius: var(--border-radius);
            padding: 12px 16px;
            margin-bottom: 12px;
            position: relative;
            cursor: pointer;
            transition: var(--transition);
            border-left: 4px solid transparent;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
            overflow: hidden;
            width: 100%;
            max-height: 160px;
        }

        .match-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 50%);
            pointer-events: none;
        }

        .match-card:hover {
            background-color: var(--card-hover);
            transform: translateY(-3px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.25);
        }

        .match-card.live {
            border-left-color: var(--danger-color);
        }

        .match-card.soon {
            border-left-color: var(--success-color);
        }

        .match-card.upcoming {
            border-left-color: var(--primary-color);
        }

        .match-card.highlighted {
            box-shadow: 0 0 0 2px var(--primary-color), 0 6px 12px rgba(0, 0, 0, 0.25);
            animation: highlight-pulse 2s infinite;
        }

        @keyframes highlight-pulse {
            0% { box-shadow: 0 0 0 2px var(--primary-color), 0 6px 12px rgba(0, 0, 0, 0.25); }
            50% { box-shadow: 0 0 0 3px var(--primary-light), 0 6px 12px rgba(0, 0, 0, 0.25); }
            100% { box-shadow: 0 0 0 2px var(--primary-color), 0 6px 12px rgba(0, 0, 0, 0.25); }
        }

        .match-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .match-card-league {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
            letter-spacing: 0.3px;
        }

        .match-card-league::before {
            content: '';
            display: inline-block;
            width: 14px;
            height: 14px;
            background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
            border-radius: 50%;
            opacity: 0.8;
            box-shadow: 0 0 4px rgba(var(--primary-color-rgb), 0.5);
        }

        .match-card-status {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 14px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            background-color: var(--dark-bg);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .match-card-status.live {
            color: white;
            background: linear-gradient(to right, var(--danger-color), var(--danger-hover));
            animation: pulse 2s infinite;
        }

        .match-card-status.soon {
            color: white;
            background: linear-gradient(to right, var(--success-color), var(--success-hover));
        }

        .match-card-status.upcoming {
            color: white;
            background: linear-gradient(to right, var(--primary-color), var(--primary-light));
        }

        .match-card-game-name {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--primary-color);
            font-size: 13px;
            font-weight: 700;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 200px;
            letter-spacing: 0.3px;
            margin-bottom: 2px;
        }

        .match-card-game-name::before {
            content: '🎮';
            display: inline-block;
            width: 14px;
            height: 14px;
            opacity: 0.8;
        }

        .match-card-current-round {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 14px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.5px;
            background-color: var(--dark-bg);
            color: var(--warning-color);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            margin-right: 8px;
        }

        .match-card-teams {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 10px 0;
            position: relative;
            width: 100%;
        }

        .match-card-teams::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 15%;
            right: 15%;
            height: 1px;
            background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.1), transparent);
        }

        .match-card-team-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            max-width: 45%;
            min-width: 120px;
        }

        .match-card-team {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
            font-weight: 600;
            font-size: 14px;
            color: var(--text-primary);
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            transition: var(--transition);
            text-align: center;
        }

        .match-card-odds {
            font-size: 12px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 10px;
            margin-top: 4px;
            background-color: var(--dark-bg);
            color: var(--success-color);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .match-card-odds.home {
            color: var(--primary-color);
        }

        .match-card-odds.away {
            color: var(--warning-color);
        }

        .match-card:hover .match-card-team {
            color: var(--primary-color);
        }

        .match-card-team.home {
            text-align: left;
            padding-right: 10px;
        }

        .match-card-team.away {
            text-align: right;
            padding-left: 10px;
        }

        .match-card-vs {
            position: relative;
            width: 34px;
            height: 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.2));
            border-radius: 50%;
            color: var(--text-muted);
            font-size: 11px;
            font-weight: 700;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(255, 255, 255, 0.05);
        }

        .match-card-vs::after {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.1);
            pointer-events: none;
        }

        .match-card-score {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
            margin: 8px 0;
            font-size: 18px;
            font-weight: 800;
            color: var(--text-primary);
            text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        .match-card-score-divider {
            color: var(--text-muted);
            font-weight: 400;
            opacity: 0.7;
        }

        .match-card-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 12px;
            color: var(--text-muted);
            position: relative;
        }

        .match-card-footer::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 30%;
            height: 1px;
            background: linear-gradient(to right, var(--primary-color), transparent);
            opacity: 0.5;
        }

        .match-card-game-count {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 500;
            letter-spacing: 0.3px;
            padding: 3px 8px;
            margin-right: 8px;
            border-radius: 10px;
            background-color: var(--dark-bg);
            color: var(--primary-color);
            font-size: 11px;
            font-weight: 600;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .match-card-game-count::before {
            content: '🎮';
            font-size: 14px;
            opacity: 0.8;
        }

        .match-card-bet-count {
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--warning-color);
            font-weight: 600;
            letter-spacing: 0.3px;
        }

        .match-card-bet-count::before {
            content: '💰';
            font-size: 14px;
            opacity: 0.8;
        }

        .match-card-bet-status {
            position: absolute;
            top: 14px;
            right: 14px;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid var(--panel-bg);
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
            z-index: 1;
        }

        .match-card-bet-status::after {
            content: '';
            position: absolute;
            top: -4px;
            left: -4px;
            right: -4px;
            bottom: -4px;
            border-radius: 50%;
            border: 1px solid currentColor;
            opacity: 0.3;
            z-index: 0;
        }

        .match-card-bet-status.win {
            background-color: var(--success-color);
            box-shadow: 0 0 8px var(--success-color);
        }

        .match-card-bet-status.lose {
            background-color: var(--danger-color);
            box-shadow: 0 0 8px var(--danger-color);
        }

        .match-card-bet-status.pending {
            background-color: var(--warning-color);
            box-shadow: 0 0 8px var(--warning-color);
            animation: pulse 2s infinite;
        }

        .match-card-bet-button {
            background: linear-gradient(to bottom, var(--primary-color), var(--primary-dark));
            color: white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .match-card-bet-button:hover {
            background-color: var(--primary-hover);
        }

        /* 统计面板样式 */
        #bet-stats-container {
            margin-top: 16px;
        }

        .statistics-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-top: 16px;
            max-height: 520px;
            overflow-y: auto;
        }

        .statistics-card {
            background-color: var(--dark-bg);
            border-radius: var(--border-radius);
            padding: 16px;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
            border: 1px solid var(--border-color);
            transition: var(--transition);
        }

        .statistics-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
            border-color: var(--primary-color);
        }

        .statistics-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, var(--primary-color), transparent);
            opacity: 0.7;
        }

        .statistics-card-title {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-secondary);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .statistics-card-title::before {
            content: '';
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--primary-color), var(--primary-light));
            opacity: 0.8;
        }

        .statistics-card-value {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 8px;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .statistics-card-subtitle {
            font-size: 12px;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .statistics-progress {
            height: 6px;
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
            margin-top: 12px;
            overflow: hidden;
        }

        .statistics-progress-bar {
            height: 100%;
            background: linear-gradient(to right, var(--primary-color), var(--primary-light));
            border-radius: 3px;
            transition: width 0.3s ease;
        }

        .statistics-progress-bar.success {
            background: linear-gradient(to right, var(--success-color), var(--success-hover));
        }

        .statistics-progress-bar.danger {
            background: linear-gradient(to right, var(--danger-color), var(--danger-hover));
        }

        /* 状态样式 */
        .status-live {
            color: var(--danger-color);
            font-weight: 700;
            text-shadow: 0 0 5px rgba(var(--danger-color-rgb), 0.3);
        }

        .status-soon {
            color: var(--success-color);
            font-weight: 700;
            text-shadow: 0 0 5px rgba(var(--success-color-rgb), 0.3);
        }

        .status-upcoming {
            color: var(--primary-color);
            font-weight: 700;
            text-shadow: 0 0 5px rgba(var(--primary-color-rgb), 0.3);
        }

        /* 最小化样式 */
        .auto-bet-panel.minimized {
            width: 64px;
            height: 64px;
            overflow: hidden;
            padding: 0;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform: translateZ(0);
            cursor: pointer;
        }

        .auto-bet-panel.minimized:hover {
            transform: translateY(-5px) scale(1.05);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
        }

        .auto-bet-panel.minimized::before {
            content: "⚽";
            font-size: 28px;
            color: white;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
            100% { transform: translateY(0); }
        }

        .auto-bet-panel.minimized > * {
            display: none;
        }

        /* 动画效果 */
        @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.8; transform: scale(1.05); }
            100% { opacity: 1; transform: scale(1); }
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes status-change-pulse {
            0% { box-shadow: 0 0 0 0 rgba(var(--success-rgb), 0.7); }
            50% { box-shadow: 0 0 0 15px rgba(var(--success-rgb), 0.3); }
            100% { box-shadow: 0 0 0 0 rgba(var(--success-rgb), 0); }
        }

        .pulse {
            animation: pulse 2s infinite;
        }

        .fade-in {
            animation: fadeIn 0.5s ease-out forwards;
        }

        /* 状态变化高亮 */
        .status-changed {
            animation: status-change-pulse 1.5s ease-in-out 3;
            position: relative;
            z-index: 10;
        }

        /* 添加一个闪烁边框效果 */
        .match-card.highlighted {
            animation: status-change-pulse 1.5s ease-in-out 3;
            position: relative;
            z-index: 10;
            border: 1px solid var(--success-color);
        }

        /* 响应式调整 */
        @media (max-width: 768px) {
            .auto-bet-panel {
                width: 320px;
                right: 10px;
                top: 10px;
            }

            .statistics-container {
                grid-template-columns: 1fr;
            }

            .match-card-team {
                font-size: 13px;
            }
        }
    `);

    // 等待页面加载完成
    function waitForPageLoad() {
        return new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
    }

    // 等待元素出现
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(mutations => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`等待元素 ${selector} 超时`));
            }, timeout);
        });
    }

    // 创建控制面板
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.className = 'auto-bet-panel';
        panel.innerHTML = `
            <div class="auto-bet-panel-header">
                <div class="auto-bet-panel-logo">⚽</div>
                <h3 class="auto-bet-panel-title">电竞自动下注</h3>
                <div class="auto-bet-panel-controls">
                    <button class="auto-bet-panel-control-btn" id="toggle-minimize">_</button>
                </div>
            </div>

            <div class="auto-bet-panel-tabs">
                <div class="auto-bet-panel-tab active" data-tab="settings">设置</div>
                <div class="auto-bet-panel-tab" data-tab="matches">比赛</div>
                <div class="auto-bet-panel-tab" data-tab="stats">统计</div>
            </div>

            <div class="auto-bet-panel-content">
                <!-- 设置选项卡 -->
                <div class="auto-bet-panel-tab-content active" id="settings-tab">
                    <div class="auto-bet-panel-section">
                        <div class="auto-bet-panel-section-title">基本设置</div>

                        <div class="auto-bet-panel-form-group">
                            <label for="bet-type">下注类型:</label>
                            <select id="bet-type">
                                <option value="single">单项</option>
                                <option value="parlay">过关</option>
                            </select>
                        </div>

                        <div class="auto-bet-panel-form-group">
                            <label for="bet-mode">下注模式:</label>
                            <select id="bet-mode">
                                <option value="manual">手动选择</option>
                                <option value="auto">自动选择</option>
                            </select>
                        </div>

                        <div class="auto-bet-panel-form-group">
                            <label for="bet-amount">下注金额:</label>
                            <input type="number" id="bet-amount" value="10" min="1">
                        </div>

                        <div class="auto-bet-panel-form-group">
                            <label for="bet-team">下注选项:</label>
                            <select id="bet-team">
                                <option value="home">主队/左边</option>
                                <option value="away">客队/右边</option>
                                <option value="random">随机选择</option>
                            </select>
                        </div>

                        <div class="auto-bet-panel-section-title">赔率设置</div>

                        <div class="auto-bet-panel-form-group">
                            <label for="bet-odds-min">最低赔率:</label>
                            <input type="number" id="bet-odds-min" value="1.5" min="1" step="0.1">
                        </div>

                        <div class="auto-bet-panel-form-group">
                            <label for="bet-odds-max">最高赔率:</label>
                            <input type="number" id="bet-odds-max" value="3.0" min="1" step="0.1">
                        </div>

                        <div class="auto-bet-panel-section-title">筛选设置</div>

                        <div class="auto-bet-panel-form-group">
                            <label for="bet-upcoming-matches">下注即将开始的比赛:</label>
                            <select id="bet-upcoming-matches">
                                <option value="false">否 (仅下注进行中)</option>
                                <option value="true">是 (包含即将开始)</option>
                            </select>
                        </div>

                        <div class="auto-bet-panel-form-group">
                            <label for="max-bets-per-match">单场比赛最大下注次数:</label>
                            <select id="max-bets-per-match">
                                <option value="1">1次</option>
                                <option value="2" selected>2次</option>
                                <option value="3">3次</option>
                                <option value="0">不限制</option>
                            </select>
                        </div>
                    </div>

                    <div class="auto-bet-panel-button-group">
                        <button id="start-auto-bet" class="primary">开始自动下注</button>
                        <button id="stop-auto-bet" class="danger" disabled>停止自动下注</button>
                    </div>

                    <div class="auto-bet-panel-button-group">
                        <button id="place-single-bet" class="secondary">立即下注一次</button>
                        <button id="reset-bet-counts" class="secondary">重置下注计数</button>
                    </div>

                    <button id="refresh-bet-history" class="secondary">刷新投注记录</button>

                    <div class="status" id="bet-status">准备就绪</div>
                </div>

                <!-- 比赛选项卡 -->
                <div class="auto-bet-panel-tab-content" id="matches-tab">
                    <div class="match-list-header">
                        <div class="match-list-title">比赛列表</div>
                        <div class="match-list-auto-refresh">自动刷新中...</div>
                    </div>
                    <div class="match-list-container" id="match-list-container">
                        <!-- 比赛卡片将在这里动态生成 -->
                    </div>
                </div>

                <!-- 统计选项卡 -->
                <div class="auto-bet-panel-tab-content" id="stats-tab">
                    <div class="bet-counts">
                        <div class="bet-count-item">
                            <div class="bet-count-value" id="total-matches">0</div>
                            <div class="bet-count-label">比赛数</div>
                        </div>
                        <div class="bet-count-item">
                            <div class="bet-count-value" id="total-bets">0</div>
                            <div class="bet-count-label">总下注</div>
                        </div>
                        <div class="bet-count-item">
                            <div class="bet-count-value" id="win-bets">0</div>
                            <div class="bet-count-label">赢</div>
                        </div>
                        <div class="bet-count-item">
                            <div class="bet-count-value" id="lose-bets">0</div>
                            <div class="bet-count-label">输</div>
                        </div>
                    </div>

                    <div class="auto-bet-panel-section">
                        <div class="auto-bet-panel-section-title">下注统计</div>
                        <div id="bet-stats-container">
                            <!-- 统计数据将在这里动态生成 -->
                            <div class="statistics-container">
                                <div class="statistics-card fade-in">
                                    <div class="statistics-card-title">下注概况</div>
                                    <div class="statistics-card-value">0</div>
                                    <div class="statistics-card-subtitle">总下注比赛数</div>
                                    <div class="statistics-progress">
                                        <div class="statistics-progress-bar" style="width: 0%"></div>
                                    </div>
                                </div>

                                <div class="statistics-card fade-in">
                                    <div class="statistics-card-title">胜率</div>
                                    <div class="statistics-card-value">0%</div>
                                    <div class="statistics-card-subtitle">已完成 0 个下注</div>
                                    <div class="statistics-progress">
                                        <div class="statistics-progress-bar danger" style="width: 0%"></div>
                                    </div>
                                </div>

                                <div class="statistics-card fade-in">
                                    <div class="statistics-card-title">下注结果</div>
                                    <div class="statistics-card-value">
                                        <span style="color: var(--success-color)">0</span> /
                                        <span style="color: var(--danger-color)">0</span> /
                                        <span style="color: var(--warning-color)">0</span>
                                    </div>
                                    <div class="statistics-card-subtitle">胜 / 负 / 待定</div>
                                </div>

                                <div class="statistics-card fade-in">
                                    <div class="statistics-card-title">比赛覆盖率</div>
                                    <div class="statistics-card-value">0</div>
                                    <div class="statistics-card-subtitle">监控中的比赛数量</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // 关闭按钮已移除，不再需要事件监听

        // 最小化/展开按钮事件
        panel.querySelector('#toggle-minimize').addEventListener('click', () => {
            panel.classList.toggle('minimized');
            if (panel.classList.contains('minimized')) {
                GM_setValue('panelState', 'minimized');
            } else {
                GM_setValue('panelState', 'expanded');
            }
        });

        // 点击最小化面板时展开
        panel.addEventListener('click', (e) => {
            if (panel.classList.contains('minimized') && e.target === panel) {
                panel.classList.remove('minimized');
                GM_setValue('panelState', 'expanded');
            }
        });

        // 添加标签页切换功能
        const tabs = panel.querySelectorAll('.auto-bet-panel-tab');
        const tabContents = panel.querySelectorAll('.auto-bet-panel-tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // 移除所有标签页的active类
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                // 添加当前标签页的active类
                this.classList.add('active');
                const tabId = this.getAttribute('data-tab') + '-tab';
                document.getElementById(tabId).classList.add('active');

                // 注意：我们不再隐藏非活动标签页，只改变透明度
            });
        });

        // 添加自动刷新提示样式
        const autoRefreshElement = panel.querySelector('.match-list-auto-refresh');
        if (autoRefreshElement) {
            autoRefreshElement.style.color = 'var(--success-color)';
            autoRefreshElement.style.fontSize = '13px';
            autoRefreshElement.style.display = 'flex';
            autoRefreshElement.style.alignItems = 'center';

            // 添加脉动动画效果
            const pulseStyle = document.createElement('style');
            pulseStyle.textContent = `
                @keyframes pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
                .match-list-auto-refresh {
                    animation: pulse 2s infinite ease-in-out;
                }
            `;
            document.head.appendChild(pulseStyle);
        }

        // 保存设置
        function saveSettings() {
            const settings = {
                betType: document.getElementById('bet-type').value,
                betMode: document.getElementById('bet-mode').value,
                betAmount: document.getElementById('bet-amount').value,
                betTeam: document.getElementById('bet-team').value,
                betOddsMin: document.getElementById('bet-odds-min').value,
                betOddsMax: document.getElementById('bet-odds-max').value,
                betUpcomingMatches: document.getElementById('bet-upcoming-matches').value,
                maxBetsPerMatch: document.getElementById('max-bets-per-match').value
            };
            GM_setValue('autoBetSettings', settings);
        }

        // 加载设置
        function loadSettings() {
            const settings = GM_getValue('autoBetSettings');
            if (settings) {
                document.getElementById('bet-type').value = settings.betType || 'single';
                document.getElementById('bet-mode').value = settings.betMode || 'manual';
                document.getElementById('bet-amount').value = settings.betAmount || 10;
                document.getElementById('bet-team').value = settings.betTeam || 'home';
                document.getElementById('bet-odds-min').value = settings.betOddsMin || 1.5;
                document.getElementById('bet-odds-max').value = settings.betOddsMax || 3.0;
                document.getElementById('bet-upcoming-matches').value = settings.betUpcomingMatches || 'false';
                document.getElementById('max-bets-per-match').value = settings.maxBetsPerMatch || '2';
            }
        }

        // 重置下注计数
        function resetBetCounts() {
            // 清空下注计数对象
            Object.keys(matchBetCounts).forEach(key => {
                delete matchBetCounts[key];
            });
            updateBetCountsDisplay();

            // 清除本地存储中的下注记录
            try {
                localStorage.removeItem('matchBetCounts');
                debugLog('已清除本地存储中的下注记录');
            } catch (error) {
                debugLog('清除本地存储中的下注记录失败: ' + error.message);
            }

            // 在控制面板中显示提示
            const statusElement = document.getElementById('autoBetStatus');
            if (statusElement) {
                statusElement.textContent = '已重置所有下注计数';
                statusElement.style.color = 'green';
                setTimeout(() => {
                    statusElement.textContent = '准备就绪';
                    statusElement.style.color = '';
                }, 3000);
            }

            updateStatus('已重置所有比赛的下注计数');
        }

        // 更新下注计数显示
    function updateBetCountsDisplay() {
        const betCountsElement = document.getElementById('bet-counts');
        if (betCountsElement) {
            const totalMatches = Object.keys(matchBetCounts).length;
            const totalBets = Object.values(matchBetCounts).reduce((sum, count) => sum + count, 0);
            betCountsElement.textContent = `比赛数: ${totalMatches}, 总下注次数: ${totalBets}`;
            debugLog(`更新下注计数显示: 比赛数=${totalMatches}, 总下注次数=${totalBets}`);
            debugLog('当前matchBetCounts对象:', matchBetCounts);

            // 将最新的下注计数保存到本地存储
            try {
                localStorage.setItem('matchBetCounts', JSON.stringify(matchBetCounts));
                debugLog('已将下注计数保存到本地存储');
            } catch (error) {
                debugLog('保存下注计数到本地存储失败: ' + error.message);
            }

            // 更新比赛列表卡片
            if (typeof updateMatchCards === 'function') {
                updateMatchCards();
            } else {
                debugLog('updateMatchCards函数未定义，无法更新比赛列表卡片');
            }
        } else {
            debugLog('找不到bet-counts元素，无法更新下注计数显示');
        }
    }

    // 获取比赛结果状态（赢、输、未结算）
    function getMatchBetResult(match) {
        // 默认为未结算
        let result = 'pending';

        // 检查比赛是否已结束
        const matchStatus = getMatchStatus(match);
        if (matchStatus !== '进行中' && matchStatus !== '即将开始' && matchStatus !== '未开赛') {
            // 比赛可能已结束，检查比分
            const scoreElements = match.querySelectorAll('[class*="score"]');
            if (scoreElements.length >= 2) {
                const homeScore = parseInt(scoreElements[0].textContent.trim());
                const awayScore = parseInt(scoreElements[1].textContent.trim());

                if (!isNaN(homeScore) && !isNaN(awayScore)) {
                    // 获取我们下注的队伍（假设我们总是下注主队/左边）
                    const betTeam = document.getElementById('bet-team').value;

                    if (betTeam === 'home' || (betTeam === 'random' && Math.random() < 0.5)) {
                        // 下注主队
                        result = homeScore > awayScore ? 'win' : 'lose';
                    } else {
                        // 下注客队
                        result = awayScore > homeScore ? 'win' : 'lose';
                    }
                }
            } else if (scoreElements.length === 1) {
                // 尝试从单个比分元素中提取两个分数
                const scoreText = scoreElements[0].textContent.trim();
                const scores = scoreText.split(/\s*[-:]\s*/);
                if (scores.length === 2) {
                    const homeScore = parseInt(scores[0]);
                    const awayScore = parseInt(scores[1]);

                    if (!isNaN(homeScore) && !isNaN(awayScore)) {
                        // 获取我们下注的队伍
                        const betTeam = document.getElementById('bet-team').value;

                        if (betTeam === 'home' || (betTeam === 'random' && Math.random() < 0.5)) {
                            // 下注主队
                            result = homeScore > awayScore ? 'win' : 'lose';
                        } else {
                            // 下注客队
                            result = awayScore > homeScore ? 'win' : 'lose';
                        }
                    }
                }
            }

            // 检查是否有明确的结果标识
            const resultElement = match.querySelector('[class*="result"], [class*="outcome"], [class*="winner"]');
            if (resultElement) {
                const resultText = resultElement.textContent.toLowerCase();
                if (resultText.includes('win') || resultText.includes('赢') || resultText.includes('胜')) {
                    result = 'win';
                } else if (resultText.includes('lose') || resultText.includes('输') || resultText.includes('负')) {
                    result = 'lose';
                }
            }
        }

        return result;
    }

    /**
     * 从DOM中提取比赛信息的增强函数
     * 结合了原有功能和改进的比赛数据获取.js的优点
     */
    function enhancedExtractMatchesFromDOM() {
        debugLog('[增强数据采集] 开始从DOM中提取比赛信息');

        let matches = [];

        // 1. 首先尝试查找用户提到的matchInfoLeft和teamInfoGrp元素
        const matchInfoLeftElements = document.querySelectorAll('.matchInfoLeft, [class*="matchInfoLeft"], [class*="match-info-left"]');
        const teamInfoGrpElements = document.querySelectorAll('.teamInfoGrp, [class*="teamInfoGrp"], [class*="team-info-grp"]');

        if (matchInfoLeftElements.length > 0 && teamInfoGrpElements.length > 0) {
            debugLog(`[增强数据采集] 找到 ${matchInfoLeftElements.length} 个matchInfoLeft元素和 ${teamInfoGrpElements.length} 个teamInfoGrp元素`);

            // 尝试将matchInfoLeft和teamInfoGrp元素配对
            const matchPairs = [];

            // 方法1: 尝试查找相邻的元素或兄弟元素
            for (const matchInfo of matchInfoLeftElements) {
                // 检查下一个兄弟元素
                let nextSibling = matchInfo.nextElementSibling;
                while (nextSibling) {
                    if (nextSibling.classList.contains('teamInfoGrp') ||
                        nextSibling.className.includes('teamInfoGrp') ||
                        nextSibling.className.includes('team-info-grp')) {
                        // 创建一个虚拟的比赛元素
                        const matchElement = document.createElement('div');
                        matchElement.className = 'virtual-match-element';
                        matchElement.originalMatchInfo = matchInfo;
                        matchElement.teamInfoGrp = nextSibling;
                        matchPairs.push(matchElement);
                        break;
                    }
                    nextSibling = nextSibling.nextElementSibling;
                }

                // 如果没有找到，检查父元素的其他子元素
                if (!nextSibling && matchInfo.parentElement) {
                    const siblings = matchInfo.parentElement.children;
                    for (const sibling of siblings) {
                        if (sibling !== matchInfo &&
                            (sibling.classList.contains('teamInfoGrp') ||
                             sibling.className.includes('teamInfoGrp') ||
                             sibling.className.includes('team-info-grp'))) {
                            // 创建一个虚拟的比赛元素
                            const matchElement = document.createElement('div');
                            matchElement.className = 'virtual-match-element';
                            matchElement.originalMatchInfo = matchInfo;
                            matchElement.teamInfoGrp = sibling;
                            matchPairs.push(matchElement);
                            break;
                        }
                    }
                }
            }

            // 方法2: 尝试查找共同的父元素
            if (matchPairs.length === 0) {
                // 为每个matchInfoLeft创建一个映射，记录它的所有父元素
                const matchInfoParents = new Map();
                matchInfoLeftElements.forEach(matchInfo => {
                    const parents = [];
                    let parent = matchInfo.parentElement;
                    while (parent) {
                        parents.push(parent);
                        parent = parent.parentElement;
                    }
                    matchInfoParents.set(matchInfo, parents);
                });

                // 检查每个teamInfoGrp，看它是否与某个matchInfoLeft共享父元素
                for (const teamInfo of teamInfoGrpElements) {
                    let parent = teamInfo.parentElement;
                    let found = false;

                    while (parent && !found) {
                        // 检查每个matchInfoLeft的父元素列表
                        for (const [matchInfo, parents] of matchInfoParents.entries()) {
                            if (parents.includes(parent)) {
                                // 找到共同的父元素，创建一个虚拟的比赛元素
                                const matchElement = document.createElement('div');
                                matchElement.className = 'virtual-match-element';
                                matchElement.originalMatchInfo = matchInfo;
                                matchElement.teamInfoGrp = teamInfo;
                                matchPairs.push(matchElement);
                                found = true;
                                break;
                            }
                        }
                        parent = parent.parentElement;
                    }
                }
            }

            // 如果找到了配对的元素，使用它们
            if (matchPairs.length > 0) {
                debugLog(`[增强数据采集] 成功配对 ${matchPairs.length} 个比赛元素`);
                matches = matchPairs;
                return matches;
            }

            // 方法3: 如果无法配对，则创建虚拟元素，将所有matchInfoLeft和teamInfoGrp组合
            if (matchInfoLeftElements.length === teamInfoGrpElements.length) {
                debugLog(`[增强数据采集] 尝试一对一配对 ${matchInfoLeftElements.length} 个元素`);
                for (let i = 0; i < matchInfoLeftElements.length; i++) {
                    const matchElement = document.createElement('div');
                    matchElement.className = 'virtual-match-element';
                    matchElement.originalMatchInfo = matchInfoLeftElements[i];
                    matchElement.teamInfoGrp = teamInfoGrpElements[i];
                    matchPairs.push(matchElement);
                }
                matches = matchPairs;
                return matches;
            }

            // 方法4: 如果无法配对，则单独使用teamInfoGrp元素
            debugLog(`[增强数据采集] 无法配对元素，使用 ${teamInfoGrpElements.length} 个teamInfoGrp元素`);
            matches = Array.from(teamInfoGrpElements);
            return matches;
        }

        // 2. 如果没有找到特定元素，尝试多种选择器查找比赛元素
        const matchSelectors = [
            'div[class*="match"]',
            'div[class*="event"]',
            'div[class*="game"]',
            'div[class*="contest"]',
            'div.teamInfoGrp',
            'div.marketRow'
        ];

        // 尝试每一个选择器
        for (const selector of matchSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                debugLog(`[增强数据采集] 使用选择器 ${selector} 找到 ${elements.length} 个元素`);
                matches = Array.from(elements);
                break;
            }
        }

        // 如果仍然没有找到比赛元素，尝试更多的方法
        if (matches.length === 0) {
            debugLog('[增强数据采集] 未找到任何比赛元素，尝试更多的选择器或DOM遍历方法');
            // 尝试更多的方法，例如遍历DOM树查找可能的比赛元素
            const alternativeMatches = tryAlternativeMatchExtraction();
            if (alternativeMatches.length > 0) {
                matches = alternativeMatches;
            }
        }

        debugLog(`[增强数据采集] 开始处理 ${matches.length} 个比赛元素`);
        return matches;
    }

    /**
     * 尝试更多的方法提取比赛信息
     */
    function tryAlternativeMatchExtraction() {
        debugLog('[增强数据采集] 尝试替代方法提取比赛信息');

        // 尝试查找包含队伍名称和赔率的元素
        const allElements = document.querySelectorAll('*');
        const teamAndOddsRegex = /([一-龥\w\s]+)[^\w]+(\d+\.\d+)[^\w]+([一-龥\w\s]+)[^\w]+(\d+\.\d+)/;

        let matchCandidates = [];

        // 遍历所有元素，查找可能包含比赛信息的元素
        allElements.forEach(element => {
            const text = element.textContent.trim();
            if (teamAndOddsRegex.test(text) && text.length < 200) { // 避免匹配过长的文本
                matchCandidates.push(element);
            }
        });

        debugLog(`[增强数据采集] 找到 ${matchCandidates.length} 个可能的比赛元素`);

        // 处理找到的候选元素
        if (matchCandidates.length > 0) {
            // 过滤掉嵌套的元素，只保留最外层的元素
            const filteredCandidates = matchCandidates.filter(element => {
                return !matchCandidates.some(other => {
                    return other !== element && other.contains(element);
                });
            });

            debugLog(`[增强数据采集] 过滤后剩余 ${filteredCandidates.length} 个比赛元素`);
            return filteredCandidates;
        }

        return [];
    }

    /**
     * 生成唯一的比赛ID
     */
    function generateMatchId(match) {
        // 尝试获取游戏名称、联赛名称、队伍名称等信息
        const gameName = getGameName(match);
        const leagueName = getLeagueName(match);
        const teamInfo = getTeamNames(match);
        const gameCount = getGameCount(match);
        const currentRound = getCurrentRound(match);

        // 组合成唯一标识符
        const identifier = `${gameName}-${leagueName}-${teamInfo.homeTeam}-${teamInfo.awayTeam}-${gameCount}-${currentRound}`;

        // 使用简单的哈希函数生成ID
        return hashString(identifier);
    }

    /**
     * 简单的字符串哈希函数
     */
    function hashString(str) {
        let hash = 0;
        if (str.length === 0) return hash;

        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        return 'match-' + Math.abs(hash).toString(16);
    }

    /**
     * 获取游戏名称
     */
    function getGameName(match) {
        let gameName = '未知游戏';

        // 检查是否是虚拟匹配元素（包含matchInfoLeft和teamInfoGrp）
        if (match.className === 'virtual-match-element' && match.originalMatchInfo) {
            // 从matchInfoLeft元素中提取游戏名称
            const matchInfoLeft = match.originalMatchInfo;

            // 尝试从matchInfoLeft元素中获取游戏名称
            const gameNameElement = matchInfoLeft.querySelector('[class*="game-name"], [class*="sport-name"], [class*="esport-name"]');
            if (gameNameElement) {
                gameName = gameNameElement.textContent.trim();
                return gameName;
            }

            // 尝试从matchInfoLeft的文本内容中提取游戏名称
            const matchInfoText = matchInfoLeft.textContent;
            const gameNameMatch = matchInfoText.match(/(英雄联盟|刀塔2|CS2|王者荣耀|无尽对决|守望先锋2|彩虹六号|使命召唤|星际争霸2|火箭联盟|炉石传说|NBA 2K|魔兽争霸3|绝地求生|堡垒之夜|云顶之弈|Free Fire|街头霸王6|铁拳8|Apex 英雄|Rennsport)/i);
            if (gameNameMatch) {
                gameName = gameNameMatch[1];
                return gameName;
            }
        }

        // 尝试从比赛元素中获取游戏名称（通用方法）
        const gameNameElement = match.querySelector('[class*="game-name"], [class*="sport-name"], [class*="esport-name"]');
        if (gameNameElement) {
            gameName = gameNameElement.textContent.trim();
            return gameName;
        }

        // 尝试从左侧面板中提取游戏名称
        const leftPanel = document.querySelector('.leftPanel, .leftPanel.dom-collector-highlight');
        if (leftPanel) {
            // 尝试找到当前选中的游戏
            const selectedGame = leftPanel.querySelector('[class*="selected"], [class*="active"]');
            if (selectedGame) {
                gameName = selectedGame.textContent.trim();
                return gameName;
            }

            // 尝试从左侧面板中提取游戏名称
            const gameNameMatch = leftPanel.textContent.match(/(英雄联盟|刀塔2|CS2|王者荣耀|无尽对决|守望先锋2|彩虹六号|使命召唤|星际争霸2|火箭联盟|炉石传说|NBA 2K|魔兽争霸3|绝地求生|堡垒之夜|云顶之弈|Free Fire|街头霸王6|铁拳8|Apex 英雄|Rennsport)/i);
            if (gameNameMatch) {
                gameName = gameNameMatch[1];
                return gameName;
            }
        }

        // 尝试从比赛元素的文本内容中提取游戏名称
        const matchText = match.textContent;
        const gameNameMatch = matchText.match(/(英雄联盟|刀塔2|CS2|王者荣耀|无尽对决|守望先锋2|彩虹六号|使命召唤|星际争霸2|火箭联盟|炉石传说|NBA 2K|魔兽争霸3|绝地求生|堡垒之夜|云顶之弈|Free Fire|街头霸王6|铁拳8|Apex 英雄|Rennsport)/i);
        if (gameNameMatch) {
            gameName = gameNameMatch[1];
        }

        return gameName;
    }

    /**
     * 获取队伍名称
     */
    function getTeamNames(match) {
        let homeTeam = '未知队伍';
        let awayTeam = '未知队伍';

        // 检查是否是虚拟匹配元素（包含matchInfoLeft和teamInfoGrp）
        if (match.className === 'virtual-match-element') {
            // 从teamInfoGrp元素中提取队伍名称
            if (match.teamInfoGrp) {
                const teamInfoGrp = match.teamInfoGrp;

                // 方法1: 尝试查找明确的队伍元素
                const teamElements = teamInfoGrp.querySelectorAll('[class*="team"], [class*="competitor"], [class*="player"]');
                if (teamElements.length >= 2) {
                    homeTeam = teamElements[0].textContent.trim();
                    awayTeam = teamElements[1].textContent.trim();
                    return { homeTeam, awayTeam };
                }

                // 方法2: 尝试查找左右两侧的元素
                const leftElements = teamInfoGrp.querySelectorAll('.left, [class*="left"], [class*="home"]');
                const rightElements = teamInfoGrp.querySelectorAll('.right, [class*="right"], [class*="away"]');

                if (leftElements.length > 0 && rightElements.length > 0) {
                    homeTeam = leftElements[0].textContent.trim();
                    awayTeam = rightElements[0].textContent.trim();
                    return { homeTeam, awayTeam };
                }

                // 方法3: 尝试从文本内容中提取队伍名称和赔率
                const teamInfoText = teamInfoGrp.textContent.trim();
                const teamMatch = teamInfoText.match(/([一-龥\w\s]+)[^\w]+(\d+\.\d+)[^\w]+([一-龥\w\s]+)[^\w]+(\d+\.\d+)/);
                if (teamMatch) {
                    homeTeam = teamMatch[1].trim();
                    awayTeam = teamMatch[3].trim();
                    return { homeTeam, awayTeam };
                }

                // 方法4: 尝试将文本内容分成两半
                const allText = teamInfoText.replace(/\d+\.\d+/g, '').trim(); // 移除所有赔率
                const midPoint = Math.floor(allText.length / 2);
                if (allText.length > 4) { // 确保有足够的文本
                    homeTeam = allText.substring(0, midPoint).trim();
                    awayTeam = allText.substring(midPoint).trim();
                    return { homeTeam, awayTeam };
                }
            }

            // 如果teamInfoGrp没有提供足够信息，尝试从matchInfoLeft获取
            if (match.originalMatchInfo) {
                const matchInfoLeft = match.originalMatchInfo;
                const teamElements = matchInfoLeft.querySelectorAll('[class*="team"], [class*="competitor"], [class*="player"]');

                if (teamElements.length >= 2) {
                    homeTeam = teamElements[0].textContent.trim();
                    awayTeam = teamElements[1].textContent.trim();
                    return { homeTeam, awayTeam };
                }
            }
        }

        // 检查是否是teamInfoGrp元素
        if (match.classList && (match.classList.contains('teamInfoGrp') || match.className.includes('teamInfoGrp'))) {
            // 方法1: 尝试查找明确的队伍元素
            const teamElements = match.querySelectorAll('[class*="team"], [class*="competitor"], [class*="player"]');
            if (teamElements.length >= 2) {
                homeTeam = teamElements[0].textContent.trim();
                awayTeam = teamElements[1].textContent.trim();
                return { homeTeam, awayTeam };
            }

            // 方法2: 尝试查找左右两侧的元素
            const leftElements = match.querySelectorAll('.left, [class*="left"], [class*="home"]');
            const rightElements = match.querySelectorAll('.right, [class*="right"], [class*="away"]');

            if (leftElements.length > 0 && rightElements.length > 0) {
                homeTeam = leftElements[0].textContent.trim();
                awayTeam = rightElements[0].textContent.trim();
                return { homeTeam, awayTeam };
            }

            // 方法3: 尝试从文本内容中提取队伍名称和赔率
            const matchText = match.textContent.trim();
            const teamMatch = matchText.match(/([一-龥\w\s]+)[^\w]+(\d+\.\d+)[^\w]+([一-龥\w\s]+)[^\w]+(\d+\.\d+)/);
            if (teamMatch) {
                homeTeam = teamMatch[1].trim();
                awayTeam = teamMatch[3].trim();
                return { homeTeam, awayTeam };
            }
        }

        // 尝试查找队伍元素（通用方法）
        const teamElements = match.querySelectorAll('[class*="team"], [class*="competitor"], [class*="player"]');
        if (teamElements.length >= 2) {
            homeTeam = teamElements[0].textContent.trim();
            awayTeam = teamElements[1].textContent.trim();
            return { homeTeam, awayTeam };
        }

        // 尝试从文本内容中提取队伍名称
        const matchText = match.textContent;
        // 尝试提取队伍名称和赔率（支持中文和英文）
        const teamMatch = matchText.match(/([一-龥\w\s]+)(\d+\.\d+)([一-龥\w\s]+)(\d+\.\d+)/);
        if (teamMatch) {
            homeTeam = teamMatch[1].trim();
            awayTeam = teamMatch[3].trim();
        }

        return { homeTeam, awayTeam };
    }

    /**
     * 获取联赛/比赛名称
     */
    function getLeagueName(match) {
        let leagueName = '未知联赛';

        // 检查是否是虚拟匹配元素（包含matchInfoLeft和teamInfoGrp）
        if (match.className === 'virtual-match-element' && match.originalMatchInfo) {
            // 从matchInfoLeft元素中提取联赛名称
            const matchInfoLeft = match.originalMatchInfo;

            // 尝试查找联赛元素
            const leagueElement = matchInfoLeft.querySelector('[class*="league"], [class*="tournament"], [class*="competition"]');
            if (leagueElement) {
                leagueName = leagueElement.textContent.trim();
                return leagueName;
            }

            // 如果没有找到明确的联赛元素，尝试从matchInfoLeft的文本内容中提取
            const matchInfoText = matchInfoLeft.textContent.trim();
            // 通常联赛名称会出现在文本的开头部分
            const lines = matchInfoText.split(/\n|\r|\t|\s{2,}/).filter(line => line.trim().length > 0);
            if (lines.length > 0) {
                // 假设第一行或第二行是联赛名称
                leagueName = lines[0].trim();
                // 如果第一行太短，可能是时间，尝试使用第二行
                if (leagueName.length < 3 && lines.length > 1) {
                    leagueName = lines[1].trim();
                }
                return leagueName;
            }
        }

        // 尝试查找联赛元素（通用方法）
        const leagueElement = match.querySelector('[class*="league"], [class*="tournament"], [class*="competition"]');
        if (leagueElement) {
            leagueName = leagueElement.textContent.trim();
        }

        return leagueName;
    }

    /**
     * 获取比赛局数信息
     */
    function getGameCount(match) {
        let gameCount = '';

        // 检查是否是虚拟匹配元素（包含matchInfoLeft和teamInfoGrp）
        if (match.className === 'virtual-match-element' && match.originalMatchInfo) {
            // 从matchInfoLeft元素中提取比赛局数信息
            const matchInfoLeft = match.originalMatchInfo;

            // 尝试查找明确的局数元素
            const gameCountElement = matchInfoLeft.querySelector('[class*="bo"], [class*="best-of"], [class*="series"]');
            if (gameCountElement) {
                gameCount = gameCountElement.textContent.trim();
                return gameCount;
            }

            // 尝试从文本中提取BO信息
            const matchInfoText = matchInfoLeft.textContent;
            const boMatch = matchInfoText.match(/BO[1-9]|BO\s[1-9]|Best\sof\s[1-9]|最佳[1-9]局/i);
            if (boMatch) {
                gameCount = boMatch[0];
                return gameCount;
            }

            // 尝试查找所有元素，寻找包含BO信息的元素
            const allElements = matchInfoLeft.querySelectorAll('*');
            for (const element of allElements) {
                const text = element.textContent.trim();
                const boMatch = text.match(/BO[1-9]|BO\s[1-9]|Best\sof\s[1-9]|最佳[1-9]局/i);
                if (boMatch) {
                    gameCount = boMatch[0];
                    return gameCount;
                }
            }
        }

        // 通用方法
        // 尝试查找明确的局数元素
        const gameCountElement = match.querySelector('[class*="bo"], [class*="best-of"], [class*="series"]');
        if (gameCountElement) {
            gameCount = gameCountElement.textContent.trim();
            return gameCount;
        }

        // 尝试从文本中提取BO信息
        const matchText = match.textContent;
        const boMatch = matchText.match(/BO[1-9]|BO\s[1-9]|Best\sof\s[1-9]|最佳[1-9]局/i);
        if (boMatch) {
            gameCount = boMatch[0];
            return gameCount;
        }

        // 尝试查找所有元素，寻找包含BO信息的元素
        const allElements = match.querySelectorAll('*');
        for (const element of allElements) {
            const text = element.textContent.trim();
            const boMatch = text.match(/BO[1-9]|BO\s[1-9]|Best\sof\s[1-9]|最佳[1-9]局/i);
            if (boMatch) {
                gameCount = boMatch[0];
                break;
            }
        }

        return gameCount;
    }

    /**
     * 获取当前局数
     */
    function getCurrentRound(match) {
        let currentRound = '1';

        // 检查是否是虚拟匹配元素（包含matchInfoLeft和teamInfoGrp）
        if (match.className === 'virtual-match-element' && match.originalMatchInfo) {
            // 从matchInfoLeft元素中提取当前局数信息
            const matchInfoLeft = match.originalMatchInfo;

            // 尝试查找明确标注当前局数的元素
            const roundElements = matchInfoLeft.querySelectorAll('[class*="round"], [class*="map"], [class*="game"]');
            for (const element of roundElements) {
                const text = element.textContent.trim();
                const roundMatch = text.match(/第([1-9])局|([1-9]):[1-9]|[1-9]:([1-9])|Map\s*([1-9])|Game\s*([1-9])/i);
                if (roundMatch) {
                    for (let i = 1; i < roundMatch.length; i++) {
                        if (roundMatch[i]) {
                            currentRound = roundMatch[i];
                            break;
                        }
                    }
                    if (currentRound !== '1') return currentRound; // 如果找到非默认值，则返回
                }
            }

            // 尝试从文本中提取当前局数信息
            const matchInfoText = matchInfoLeft.textContent;
            const roundMatch = matchInfoText.match(/第([1-9])局|([1-9]):[1-9]|[1-9]:([1-9])|Map\s*([1-9])|Game\s*([1-9])/i);
            if (roundMatch) {
                for (let i = 1; i < roundMatch.length; i++) {
                    if (roundMatch[i]) {
                        currentRound = roundMatch[i];
                        return currentRound;
                    }
                }
            }

            // 如果没有找到明确的局数标注，则通过比分推断
            const scoreElements = matchInfoLeft.querySelectorAll('[class*="score"]');
            if (scoreElements.length >= 2) {
                const homeScore = parseInt(scoreElements[0].textContent.trim()) || 0;
                const awayScore = parseInt(scoreElements[1].textContent.trim()) || 0;
                currentRound = String(homeScore + awayScore + 1); // 当前局数 = 已完成的局数 + 1
                return currentRound;
            }
        }

        // 通用方法
        // 尝试查找明确标注当前局数的元素
        const roundElements = match.querySelectorAll('[class*="round"], [class*="map"], [class*="game"]');
        for (const element of roundElements) {
            const text = element.textContent.trim();
            const roundMatch = text.match(/第([1-9])局|([1-9]):[1-9]|[1-9]:([1-9])|Map\s*([1-9])|Game\s*([1-9])/i);
            if (roundMatch) {
                for (let i = 1; i < roundMatch.length; i++) {
                    if (roundMatch[i]) {
                        currentRound = roundMatch[i];
                        break;
                    }
                }
                if (currentRound !== '1') break; // 如果找到非默认值，则停止查找
            }
        }

        // 如果没有找到明确的局数标注，则通过比分推断
        if (currentRound === '1') {
            const scoreElements = match.querySelectorAll('[class*="score"]');
            if (scoreElements.length >= 2) {
                const homeScore = parseInt(scoreElements[0].textContent.trim()) || 0;
                const awayScore = parseInt(scoreElements[1].textContent.trim()) || 0;
                currentRound = String(homeScore + awayScore + 1); // 当前局数 = 已完成的局数 + 1
            }
        }

        return currentRound;
    }

    /**
     * 获取比分信息
     */
    function getScores(match) {
        let homeScore = '0';
        let awayScore = '0';

        // 检查是否是虚拟匹配元素（包含matchInfoLeft和teamInfoGrp）
        if (match.className === 'virtual-match-element') {
            // 从matchInfoLeft元素中提取比分
            if (match.originalMatchInfo) {
                const matchInfoLeft = match.originalMatchInfo;

                // 尝试查找比分元素
                const scoreElements = matchInfoLeft.querySelectorAll('[class*="score"]');
                if (scoreElements.length >= 2) {
                    homeScore = scoreElements[0].textContent.trim() || '0';
                    awayScore = scoreElements[1].textContent.trim() || '0';
                    return { homeScore, awayScore };
                }

                if (scoreElements.length === 1) {
                    // 尝试从单个比分元素中提取两个分数
                    const scoreText = scoreElements[0].textContent.trim();
                    const scores = scoreText.split(/\s*[-:]\s*/);
                    if (scores.length === 2) {
                        homeScore = scores[0] || '0';
                        awayScore = scores[1] || '0';
                        return { homeScore, awayScore };
                    }

                    // 尝试使用正则表达式匹配
                    const scoreMatch = scoreText.match(/(\d+)[^\d]+(\d+)/);
                    if (scoreMatch && scoreMatch.length === 3) {
                        homeScore = scoreMatch[1] || '0';
                        awayScore = scoreMatch[2] || '0';
                        return { homeScore, awayScore };
                    }
                }
            }

            // 从teamInfoGrp元素中提取比分
            if (match.teamInfoGrp) {
                const teamInfoGrp = match.teamInfoGrp;

                // 尝试查找比分元素
                const scoreElements = teamInfoGrp.querySelectorAll('[class*="score"]');
                if (scoreElements.length >= 2) {
                    homeScore = scoreElements[0].textContent.trim() || '0';
                    awayScore = scoreElements[1].textContent.trim() || '0';
                    return { homeScore, awayScore };
                }

                if (scoreElements.length === 1) {
                    // 尝试从单个比分元素中提取两个分数
                    const scoreText = scoreElements[0].textContent.trim();
                    const scores = scoreText.split(/\s*[-:]\s*/);
                    if (scores.length === 2) {
                        homeScore = scores[0] || '0';
                        awayScore = scores[1] || '0';
                        return { homeScore, awayScore };
                    }

                    // 尝试使用正则表达式匹配
                    const scoreMatch = scoreText.match(/(\d+)[^\d]+(\d+)/);
                    if (scoreMatch && scoreMatch.length === 3) {
                        homeScore = scoreMatch[1] || '0';
                        awayScore = scoreMatch[2] || '0';
                        return { homeScore, awayScore };
                    }
                }
            }
        }

        // 通用方法：尝试查找比分元素
        const scoreElements = match.querySelectorAll('[class*="score"]');
        if (scoreElements.length >= 2) {
            homeScore = scoreElements[0].textContent.trim() || '0';
            awayScore = scoreElements[1].textContent.trim() || '0';
            return { homeScore, awayScore };
        }

        if (scoreElements.length === 1) {
            // 尝试从单个比分元素中提取两个分数
            const scoreText = scoreElements[0].textContent.trim();
            const scores = scoreText.split(/\s*[-:]\s*/);
            if (scores.length === 2) {
                homeScore = scores[0] || '0';
                awayScore = scores[1] || '0';
                return { homeScore, awayScore };
            }

            // 尝试使用正则表达式匹配
            const scoreMatch = scoreText.match(/(\d+)[^\d]+(\d+)/);
            if (scoreMatch && scoreMatch.length === 3) {
                homeScore = scoreMatch[1] || '0';
                awayScore = scoreMatch[2] || '0';
                return { homeScore, awayScore };
            }
        }

        return { homeScore, awayScore };
    }

    /**
     * 获取赔率信息
     */
    function getOdds(match) {
        let homeOdds = '未知';
        let awayOdds = '未知';

        // 检查是否是虚拟匹配元素（包含matchInfoLeft和teamInfoGrp）
        if (match.className === 'virtual-match-element' && match.originalMatchInfo && match.originalTeamInfo) {
            // 从teamInfoGrp元素中提取赔率
            const teamInfoGrp = match.originalTeamInfo;

            // 方法1: 尝试查找明确的赔率元素
            const oddsElements = teamInfoGrp.querySelectorAll('[class*="odd"], [class*="odds"], [class*="rate"], [class*="ratio"]');
            if (oddsElements.length >= 2) {
                homeOdds = oddsElements[0].textContent.trim();
                awayOdds = oddsElements[1].textContent.trim();
                return { homeOdds, awayOdds };
            }

            // 方法2: 尝试查找所有可能包含赔率的元素
            const allElements = teamInfoGrp.querySelectorAll('*');
            const oddsRegex = /\d+\.\d+/; // 匹配形如1.5, 2.0等赔率格式
            const foundOdds = [];

            for (const element of allElements) {
                const text = element.textContent.trim();
                if (oddsRegex.test(text) && text.length < 10) { // 赔率通常是短文本
                    foundOdds.push(text);
                    if (foundOdds.length >= 2) break;
                }
            }

            if (foundOdds.length >= 2) {
                homeOdds = foundOdds[0];
                awayOdds = foundOdds[1];
                return { homeOdds, awayOdds };
            }
        }

        // 检查是否是teamInfoGrp元素
        if (match.classList.contains('teamInfoGrp') || match.className.includes('teamInfoGrp')) {
            // 方法1: 尝试查找明确的赔率元素
            const oddsElements = match.querySelectorAll('[class*="odd"], [class*="odds"], [class*="rate"], [class*="ratio"]');
            if (oddsElements.length >= 2) {
                homeOdds = oddsElements[0].textContent.trim();
                awayOdds = oddsElements[1].textContent.trim();
                return { homeOdds, awayOdds };
            }

            // 方法2: 尝试查找所有可能包含赔率的元素
            const allElements = match.querySelectorAll('*');
            const oddsRegex = /\d+\.\d+/; // 匹配形如1.5, 2.0等赔率格式
            const foundOdds = [];

            for (const element of allElements) {
                const text = element.textContent.trim();
                if (oddsRegex.test(text) && text.length < 10) { // 赔率通常是短文本
                    foundOdds.push(text);
                    if (foundOdds.length >= 2) break;
                }
            }

            if (foundOdds.length >= 2) {
                homeOdds = foundOdds[0];
                awayOdds = foundOdds[1];
                return { homeOdds, awayOdds };
            }
        }

        // 通用方法
        // 方法1: 尝试查找明确的赔率元素
        const oddsElements = match.querySelectorAll('[class*="odd"], [class*="odds"], [class*="rate"], [class*="ratio"]');
        if (oddsElements.length >= 2) {
            homeOdds = oddsElements[0].textContent.trim();
            awayOdds = oddsElements[1].textContent.trim();
            return { homeOdds, awayOdds };
        }

        // 方法2: 尝试查找所有可能包含赔率的元素
        const allElements = match.querySelectorAll('*');
        const oddsRegex = /\d+\.\d+/; // 匹配形如1.5, 2.0等赔率格式
        const foundOdds = [];

        for (const element of allElements) {
            const text = element.textContent.trim();
            if (oddsRegex.test(text) && text.length < 10) { // 赔率通常是短文本
                foundOdds.push(text);
                if (foundOdds.length >= 2) break;
            }
        }

        if (foundOdds.length >= 2) {
            homeOdds = foundOdds[0];
            awayOdds = foundOdds[1];
            return { homeOdds, awayOdds };
        }

        // 方法3: 尝试从文本内容中提取赔率
        const matchText = match.textContent;
        const oddsMatch = matchText.match(/(\d+\.\d+)[^\d]+(\d+\.\d+)/);
        if (oddsMatch) {
            homeOdds = oddsMatch[1];
            awayOdds = oddsMatch[2];
        }

        return { homeOdds, awayOdds };
    }

    // 获取比赛信息并创建比赛卡片
    function updateMatchCards() {
        const matchListContainer = document.getElementById('match-list-container');
        if (!matchListContainer) {
            debugLog('找不到match-list-container元素，无法更新比赛卡片');
            return;
        }

        // 清空容器
        matchListContainer.innerHTML = '';

        // 使用增强的方法获取所有比赛
        let matches = enhancedExtractMatchesFromDOM();

        // 如果增强方法没有找到比赛，尝试原始方法
        if (matches.length === 0) {
            matches = Array.from(document.querySelectorAll('div[class*="match"], div[class*="event"], div[class*="game"], div[class*="contest"]'));
        }

        debugLog(`找到 ${matches.length} 个比赛元素`);

        // 更新总比赛数显示
        const totalMatchesElement = document.getElementById('total-matches');
        if (totalMatchesElement) {
            totalMatchesElement.textContent = matches.length;
        }

        // 更新总下注次数显示
        const totalBetsElement = document.getElementById('total-bets');
        if (totalBetsElement) {
            const totalBets = Object.values(matchBetCounts).reduce((sum, count) => sum + count, 0);
            totalBetsElement.textContent = totalBets;
        }

        if (matches.length === 0) {
            matchListContainer.innerHTML = '<div class="match-card empty"><div class="match-card-empty-message">未找到比赛</div></div>';
            return;
        }

            // 处理每个比赛
         matches.forEach(match => {
             // 获取比赛ID
             const matchId = generateMatchId(match);

             // 获取比赛状态
             const matchStatus = getMatchStatus(match);
             let statusClass = '';
             let statusText = matchStatus;

             if (matchStatus === '进行中') {
                 statusClass = 'live';
             } else if (matchStatus === '即将开始') {
                 statusClass = 'soon';
             } else if (matchStatus === '未开赛') {
                 statusClass = 'upcoming';
             } else if (matchStatus.includes('结束') || matchStatus.includes('完成')) {
                 statusClass = 'ended';
             }

             // 获取游戏名称
             const gameName = getGameName(match);

             // 获取队伍名称
             const teamInfo = getTeamNames(match);
             const homeTeam = teamInfo.homeTeam;
             const awayTeam = teamInfo.awayTeam;

             // 获取联赛/比赛名称
             const leagueName = getLeagueName(match);

             // 获取比赛局数信息
             const gameCount = getGameCount(match);

             // 获取当前局数
             const currentRound = getCurrentRound(match);

             // 获取比分信息
             const scores = getScores(match);
             const homeScore = scores.homeScore;
             const awayScore = scores.awayScore;

             // 获取赔率信息
             const odds = getOdds(match);
             const homeOdds = odds.homeOdds;
             const awayOdds = odds.awayOdds;

             // 创建比赛卡片
            const card = document.createElement('div');
            card.className = `match-card ${statusClass}`;
            card.dataset.matchId = matchId;

            // 获取比赛结果状态
            let betResult = '';
            if (matchBetCounts[matchId]) {
                betResult = getMatchBetResult(match);
                card.classList.add('has-bet');
                card.classList.add(`bet-${betResult}`);
            }

            // 添加卡片内容
            card.innerHTML = `
                <div class="match-card-header">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div class="match-card-game-name">${gameName}</div>
                        <div class="match-card-league">${leagueName}</div>
                    </div>
                    <div class="match-card-status ${statusClass}">
                        ${statusClass === 'live' ? '<span class="live-indicator"></span>' : ''}
                        ${statusText}
                    </div>
                </div>
                <div class="match-card-content">
                    <div class="match-card-teams">
                        <div class="match-card-team-container">
                            <div class="match-card-team home" title="${homeTeam}">${homeTeam}</div>
                            <div class="match-card-odds home">${homeOdds}</div>
                        </div>
                        <div class="match-card-vs">VS</div>
                        <div class="match-card-team-container">
                            <div class="match-card-team away" title="${awayTeam}">${awayTeam}</div>
                            <div class="match-card-odds away">${awayOdds}</div>
                        </div>
                    </div>
                    <div class="match-card-score-container" style="margin-top: 6px;">
                        <div class="match-card-score home ${parseInt(homeScore) > parseInt(awayScore) ? 'winning' : ''}">${homeScore}</div>
                        <div class="match-card-score-separator">:</div>
                        <div class="match-card-score away ${parseInt(awayScore) > parseInt(homeScore) ? 'winning' : ''}">${awayScore}</div>
                    </div>
                </div>
                <div class="match-card-footer">
                    <div style="display: flex; align-items: center;">
                        ${gameCount ? `<div class="match-card-game-count">${gameCount}</div>` : ''}
                        <div class="match-card-current-round">第${currentRound}局</div>
                    </div>
                    ${matchBetCounts[matchId] ?
                        `<div class="match-card-bet-count ${betResult}">
                            <span class="bet-count-value">${matchBetCounts[matchId]}</span>
                            <span class="bet-count-label">次</span>
                        </div>` :
                        '<div class="match-card-bet-count empty">未下注</div>'}
                </div>
                ${betResult ? `<div class="match-card-bet-result ${betResult}">${betResult === 'win' ? '赢' : betResult === 'lose' ? '输' : '待定'}</div>` : ''}
            `;

            // 添加点击事件 - 点击卡片时滚动到对应的比赛
            card.addEventListener('click', () => {
                // 移除所有高亮
                document.querySelectorAll('.match-highlight').forEach(el => {
                    el.classList.remove('match-highlight');
                });

                // 移除所有卡片的高亮
                document.querySelectorAll('.match-card.highlighted').forEach(el => {
                    el.classList.remove('highlighted');
                });

                // 高亮显示对应的比赛元素
                match.classList.add('match-highlight');

                // 高亮显示当前卡片
                card.classList.add('highlighted');

                // 滚动到对应的比赛元素
                match.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // 添加高亮效果
                match.style.boxShadow = '0 0 15px 3px var(--primary-light, #4a9eff)';
                setTimeout(() => {
                    match.style.boxShadow = '';
                }, 2500);

                // 显示一个提示
                updateStatus(`已定位到比赛: ${homeTeam} vs ${awayTeam}`);
            });

            // 添加到容器
            matchListContainer.appendChild(card);
        });

        // 更新统计数据
        updateBetStatistics();
    }

    // 更新下注统计数据
    function updateBetStatistics() {
        const statsContainer = document.getElementById('bet-stats-container');
        if (!statsContainer) return;

        // 计算胜负数据
        let winCount = 0;
        let loseCount = 0;
        let pendingCount = 0;

        // 遍历所有比赛
        const matches = Array.from(document.querySelectorAll('div[class*="match"], div[class*="event"], div[class*="game"], div[class*="contest"]'));
        const totalMatches = matches.length;
        matches.forEach(match => {
            const matchId = getMatchIdentifier(match);
            if (matchBetCounts[matchId]) {
                const result = getMatchBetResult(match);
                if (result === 'win') winCount++;
                else if (result === 'lose') loseCount++;
                else pendingCount++;
            }
        });

        // 更新统计显示
        const winElement = document.getElementById('win-bets');
        const loseElement = document.getElementById('lose-bets');
        const totalBetsElement = document.getElementById('total-bets');
        const totalMatchesElement = document.getElementById('total-matches');

        if (winElement) winElement.textContent = winCount;
        if (loseElement) loseElement.textContent = loseCount;
        if (totalBetsElement) totalBetsElement.textContent = winCount + loseCount + pendingCount;
        if (totalMatchesElement) totalMatchesElement.textContent = totalMatches;

        // 计算胜率和完成率
        const winRate = winCount + loseCount > 0 ? (winCount / (winCount + loseCount) * 100).toFixed(1) : 0;
        const completionRate = totalMatches > 0 ? ((winCount + loseCount + pendingCount) / totalMatches * 100).toFixed(1) : 0;

        // 更新统计选项卡内容 - 使用新的现代化UI
        statsContainer.innerHTML = `
            <div class="statistics-container">
                <div class="statistics-card fade-in">
                    <div class="statistics-card-title">下注概况</div>
                    <div class="statistics-card-value">${winCount + loseCount + pendingCount}</div>
                    <div class="statistics-card-subtitle">总下注比赛数</div>
                    <div class="statistics-progress">
                        <div class="statistics-progress-bar" style="width: ${completionRate}%"></div>
                    </div>
                </div>

                <div class="statistics-card fade-in">
                    <div class="statistics-card-title">胜率</div>
                    <div class="statistics-card-value">${winRate}%</div>
                    <div class="statistics-card-subtitle">已完成 ${winCount + loseCount} 个下注</div>
                    <div class="statistics-progress">
                        <div class="statistics-progress-bar ${winRate >= 50 ? 'success' : 'danger'}" style="width: ${winRate}%"></div>
                    </div>
                </div>

                <div class="statistics-card fade-in">
                    <div class="statistics-card-title">下注结果</div>
                    <div class="statistics-card-value">
                        <span style="color: var(--success-color)">${winCount}</span> /
                        <span style="color: var(--danger-color)">${loseCount}</span> /
                        <span style="color: var(--warning-color)">${pendingCount}</span>
                    </div>
                    <div class="statistics-card-subtitle">胜 / 负 / 待定</div>
                </div>

                <div class="statistics-card fade-in">
                    <div class="statistics-card-title">比赛覆盖率</div>
                    <div class="statistics-card-value">${totalMatches}</div>
                    <div class="statistics-card-subtitle">监控中的比赛数量</div>
                </div>
            </div>
        `;
    }

        // 保存设置事件
        document.getElementById('bet-type').addEventListener('change', saveSettings);
        document.getElementById('bet-mode').addEventListener('change', saveSettings);
        document.getElementById('bet-amount').addEventListener('input', saveSettings);
        document.getElementById('bet-team').addEventListener('change', saveSettings);
        document.getElementById('bet-odds-min').addEventListener('input', saveSettings);
        document.getElementById('bet-odds-max').addEventListener('input', saveSettings);

        // 加载保存的设置
        loadSettings();

        // 加载面板状态
        const panelState = GM_getValue('panelState', 'expanded');
        if (panelState === 'minimized') {
            panel.classList.add('minimized');
        } else if (panelState === 'hidden') {
            panel.style.display = 'none';
        }

        return panel;
    }

    // 更新状态
    function updateStatus(message) {
        const statusElement = document.getElementById('bet-status');
        if (statusElement) {
            // 重置所有状态样式
            statusElement.classList.remove('status-live', 'status-soon', 'status-upcoming');

            // 根据消息内容添加相应的状态样式
            if (message.includes('进行中')) {
                statusElement.classList.add('status-live');
            } else if (message.includes('即将开始')) {
                statusElement.classList.add('status-soon');
            } else if (message.includes('未开赛')) {
                statusElement.classList.add('status-upcoming');
            }

            statusElement.textContent = message;
            console.log('[自动下注]', message);
        }
    }

    // 调试日志函数
    function debugLog(message, data) {
        const DEBUG_MODE = true; // 设置为false可以关闭调试输出
        if (DEBUG_MODE) {
            if (data !== undefined) {
                console.log(`[自动下注调试] ${message}`, data);
            } else {
                console.log(`[自动下注调试] ${message}`);
            }
        }
    }

    // 解析赔率
    function parseOdds(oddsText) {
        const odds = parseFloat(oddsText.trim());
        return isNaN(odds) ? 0 : odds;
    }

    // 获取元素的所有兄弟节点
    function getSiblings(element) {
        const siblings = [];
        let sibling = element.parentNode.firstChild;

        while (sibling) {
            if (sibling.nodeType === 1 && sibling !== element) {
                siblings.push(sibling);
            }
            sibling = sibling.nextSibling;
        }

        return siblings;
    }

    // 判断比赛状态（进行中、即将开始、未开赛）
    function getMatchStatus(matchElement) {
        // 获取之前的状态（如果存在）
        const previousStatus = matchElement.dataset.previousStatus || '';
        let currentStatus = '';

        // 检查是否有明确的状态标识
        const statusElement = matchElement.querySelector('.match-status, [class*="status"], [class*="state"]');
        if (statusElement) {
            const statusText = statusElement.textContent.toLowerCase();
            if (statusText.includes('进行中') || statusText.includes('live')) {
                currentStatus = '进行中';
            } else if (statusText.includes('即将开始') || statusText.includes('soon')) {
                currentStatus = '即将开始';
            } else if (statusText.includes('未开赛') || statusText.includes('upcoming')) {
                currentStatus = '未开赛';
            }
        }

        // 如果没有找到明确的状态，继续检查其他指标
        if (!currentStatus) {
            // 检查是否有比分显示
            const scoreElements = matchElement.querySelectorAll('[class*="score"]');
            if (scoreElements.length > 0) {
                // 检查是否有非零比分
                for (const scoreElement of scoreElements) {
                    if (/\d+/.test(scoreElement.textContent) && scoreElement.textContent.trim() !== '0' && scoreElement.textContent.trim() !== '0-0') {
                        currentStatus = '进行中';
                        break;
                    }
                }
                if (!currentStatus) {
                    currentStatus = '即将开始'; // 有比分元素但都是0，可能是即将开始
                }
            }
        }

        // 如果仍然没有状态，检查时间信息
        if (!currentStatus) {
            const timeElement = matchElement.querySelector('[class*="time"], [class*="date"]');
            if (timeElement) {
                const timeText = timeElement.textContent.toLowerCase();
                if (timeText.includes('live') || timeText.includes('进行中')) {
                    currentStatus = '进行中';
                } else if (timeText.match(/\d+:\d+/) || timeText.includes('soon') || timeText.includes('即将')) {
                    currentStatus = '即将开始';
                }
            }
        }

        // 如果仍然没有确定状态，默认为未开赛
        if (!currentStatus) {
            currentStatus = '未开赛';
        }

        // 检查状态是否发生变化
        if (previousStatus && previousStatus !== currentStatus) {
            // 状态发生变化，添加视觉提示
            debugLog(`比赛状态变化: ${previousStatus} -> ${currentStatus}`);

            // 如果是从即将开始变为进行中，添加高亮动画
            if (previousStatus === '即将开始' && currentStatus === '进行中') {
                // 在比赛元素上添加一个临时的高亮类
                matchElement.classList.add('status-changed');

                // 在卡片上也添加高亮
                const matchId = getMatchIdentifier(matchElement);
                const matchCard = document.querySelector(`.match-card[data-match-id="${matchId}"]`);
                if (matchCard) {
                    matchCard.classList.add('highlighted');

                    // 获取队伍名称
                    const homeTeamEl = matchCard.querySelector('.match-card-team.home');
                    const awayTeamEl = matchCard.querySelector('.match-card-team.away');
                    const homeTeam = homeTeamEl ? homeTeamEl.textContent : '未知队伍';
                    const awayTeam = awayTeamEl ? awayTeamEl.textContent : '未知队伍';

                    // 显示状态变化通知
                    updateStatus(`比赛开始! ${homeTeam} VS ${awayTeam} 现在进行中`);

                    // 滚动到对应的比赛元素
                    matchCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // 3秒后移除高亮
                    setTimeout(() => {
                        matchCard.classList.remove('highlighted');
                    }, 3000);
                }

                // 3秒后移除高亮
                setTimeout(() => {
                    matchElement.classList.remove('status-changed');
                }, 3000);
            }
        }

        // 保存当前状态以便下次比较
        matchElement.dataset.previousStatus = currentStatus;

        return currentStatus;
    }

    // 选择比赛
    function selectMatch() {
        const betType = document.getElementById('bet-type').value;
        const betTeam = document.getElementById('bet-team').value;
        const minOdds = parseFloat(document.getElementById('bet-odds-min').value);
        const maxOdds = parseFloat(document.getElementById('bet-odds-max').value);
        const includeUpcomingMatches = document.getElementById('bet-upcoming-matches').value === 'true';

        // 获取所有比赛
        let matches;
        if (betType === 'single') {
            // 单项比赛选择器 - 尝试多种可能的选择器
            matches = Array.from(document.querySelectorAll('div[class*="match"], div[class*="event"], div[class*="game"], div[class*="contest"]')).filter(match => {
                // 获取比赛状态
                const matchStatus = getMatchStatus(match);

                // 根据设置决定是否包含即将开始的比赛
                if (matchStatus === '进行中') {
                    return true; // 始终包含进行中的比赛
                } else if (matchStatus === '即将开始') {
                    return includeUpcomingMatches; // 根据设置决定是否包含
                } else {
                    return false; // 排除未开赛的比赛
                }
            });
        } else {
            // 过关比赛选择器 - 尝试多种可能的选择器
            matches = Array.from(document.querySelectorAll('div[class*="match"], div[class*="event"], div[class*="game"], div[class*="contest"]')).filter(match => {
                return (match.textContent.includes('过关盘口可用') ||
                       match.textContent.toLowerCase().includes('parlay') ||
                       match.textContent.toLowerCase().includes('combo'));
            });
        }

        debugLog(`找到 ${matches.length} 个可能的比赛`);
        if (matches.length === 0) {
            // 尝试更宽泛的选择器
            const allPossibleMatches = document.querySelectorAll('div[class*="container"], div[class*="row"], div[class*="card"]');
            debugLog(`尝试更宽泛的选择器，找到 ${allPossibleMatches.length} 个可能的容器`);

            // 过滤出可能包含比赛信息的容器
            matches = Array.from(allPossibleMatches).filter(el => {
                const text = el.textContent.toLowerCase();
                return (text.includes('vs') || text.includes('对') || text.includes('vs.')) &&
                       /\d+\.\d+/.test(text); // 包含类似赔率的数字
            });

            debugLog(`过滤后找到 ${matches.length} 个可能的比赛`);
            if (matches.length === 0) {
                updateStatus('没有找到符合条件的比赛，请检查网站结构');
                return null;
            }
        }

        // 随机选择一场比赛
        const randomIndex = Math.floor(Math.random() * matches.length);
        const selectedMatch = matches[randomIndex];

        // 尝试多种可能的赔率元素选择器
        let oddsElements = [];

        debugLog('开始查找赔率元素');
        debugLog('选中的比赛内容', selectedMatch.textContent);

        // 方法1：尝试多种可能的赔率类名 - 增强对特定'odds'元素的支持
        const oddsSelectors = [
            // 精确匹配odds类名
            'div.odds',
            'span.odds',
            // 包含odds的类名
            'div[class*="odds"]',
            'span[class*="odds"]',
            // 包含odds的id
            'div[id*="odds"]',
            'span[id*="odds"]',
            // 包含odds的属性
            'div[data-odds]',
            'span[data-odds]',
            // 其他可能的赔率相关选择器
            'div[class*="rate"]',
            'div[class*="ratio"]',
            'span[class*="rate"]',
            'div[class*="price"]',
            'span[class*="price"]',
            'div[data-test*="odds"]',
            'div[data-test*="rate"]',
            'div[data-role*="odds"]'
        ];

        // 直接在整个文档中查找odds元素，然后过滤属于当前比赛的元素
        if (oddsElements.length < 2) {
            debugLog('尝试在整个文档中查找odds元素');
            const allOddsElements = document.querySelectorAll('.odds, [class*="odds"]');
            debugLog(`在整个文档中找到 ${allOddsElements.length} 个odds元素`);

            // 过滤出属于当前比赛的odds元素
            if (allOddsElements.length > 0) {
                oddsElements = Array.from(allOddsElements).filter(el => {
                    // 检查元素是否是当前比赛的子元素或与当前比赛有关联
                    return selectedMatch.contains(el) ||
                           // 检查元素是否与当前比赛在同一行或同一区域
                           (el.getBoundingClientRect().top >= selectedMatch.getBoundingClientRect().top &&
                            el.getBoundingClientRect().top <= selectedMatch.getBoundingClientRect().bottom);
                });

                debugLog(`过滤后找到 ${oddsElements.length} 个与当前比赛相关的odds元素`);
            }
        }

        for (const selector of oddsSelectors) {
            const elements = selectedMatch.querySelectorAll(selector);
            if (elements.length >= 2) {
                oddsElements = Array.from(elements);
                debugLog(`使用选择器 ${selector} 找到 ${elements.length} 个赔率元素`);
                break;
            }
        }

        // 方法2：如果方法1失败，尝试查找包含数字的元素（可能是赔率）
        if (oddsElements.length < 2) {
            debugLog('尝试方法2: 查找包含数字的元素');
            // 查找所有可能包含赔率的元素（通常是数字格式如1.5、2.0等）
            const possibleOddsElements = Array.from(selectedMatch.querySelectorAll('div, span, p, button, a')).filter(el => {
                const text = el.textContent.trim();
                // 匹配类似赔率的数字格式（如1.5、2.0等）
                const isOddsFormat = /^\d+\.\d+$/.test(text) && parseFloat(text) > 1.0;

                // 检查元素是否有odds相关的类名、ID或属性
                const hasOddsClass = el.className && el.className.toLowerCase().includes('odds');
                const hasOddsId = el.id && el.id.toLowerCase().includes('odds');
                const hasOddsAttribute = el.hasAttribute('data-odds') ||
                                        el.hasAttribute('data-odd') ||
                                        el.hasAttribute('odds');

                // 如果元素有odds相关的标识，优先考虑
                if (hasOddsClass || hasOddsId || hasOddsAttribute) {
                    debugLog(`找到带有odds标识的元素: ${text}`);
                    return true;
                }

                return isOddsFormat;
            });

            debugLog(`方法2结果: 找到 ${possibleOddsElements.length} 个可能的赔率元素`,
                    possibleOddsElements.map(el => el.textContent));

            if (possibleOddsElements.length >= 2) {
                oddsElements = possibleOddsElements;
                debugLog('使用方法2找到的赔率元素');
            }
        }

        // 方法3：如果前两种方法都失败，尝试查找队伍旁边的数字元素
        if (oddsElements.length < 2) {
            debugLog('尝试方法3: 查找队伍旁边的数字元素');
            // 找到队伍名称元素 - 尝试多种可能的选择器
            const teamSelectors = [
                'div[class*="team"]',
                'div[class*="competitor"]',
                'div[class*="player"]',
                'span[class*="team"]',
                'span[class*="competitor"]',
                'div[data-test*="team"]',
                'div[data-role*="team"]'
            ];

            let teamElements = [];
            for (const selector of teamSelectors) {
                const elements = selectedMatch.querySelectorAll(selector);
                if (elements.length >= 2) {
                    teamElements = Array.from(elements);
                    debugLog(`使用选择器 ${selector} 找到 ${elements.length} 个队伍元素`);
                    break;
                }
            }

            // 如果没有找到明确的队伍元素，尝试查找包含vs的元素
            if (teamElements.length < 2) {
                const vsContainer = Array.from(selectedMatch.querySelectorAll('div, span')).find(el =>
                    el.textContent.includes('vs') || el.textContent.includes('VS') || el.textContent.includes('对')
                );

                if (vsContainer) {
                    debugLog('找到包含vs的元素:', vsContainer.textContent);
                    // 查找vs元素的兄弟节点或子节点作为可能的队伍元素
                    teamElements = Array.from(vsContainer.querySelectorAll('*')).concat(getSiblings(vsContainer));
                }
            }

            debugLog(`找到 ${teamElements.length} 个可能的队伍元素`);

            if (teamElements.length >= 2) {
                // 查找队伍元素附近的数字元素
                teamElements.forEach((teamEl, index) => {
                    debugLog(`检查第 ${index+1} 个队伍元素: ${teamEl.textContent}`);

                    // 检查兄弟节点
                    const siblings = getSiblings(teamEl);
                    debugLog(`找到 ${siblings.length} 个兄弟节点`);

                    siblings.forEach(sib => {
                        // 检查是否有odds相关的类名或属性
                        const hasOddsClass = sib.className && sib.className.toLowerCase().includes('odds');
                        const hasOddsId = sib.id && sib.id.toLowerCase().includes('odds');
                        const hasOddsAttribute = sib.hasAttribute('data-odds') || sib.hasAttribute('odds');

                        // 检查文本是否是赔率格式
                        const text = sib.textContent.trim();
                        const isOddsFormat = /^\d+\.\d+$/.test(text) && parseFloat(text) > 1.0;

                        if (hasOddsClass || hasOddsId || hasOddsAttribute || isOddsFormat) {
                            debugLog(`找到可能的赔率元素: ${text}`);
                            oddsElements.push(sib);
                        }
                    });

                    // 检查父元素的兄弟节点
                    if (teamEl.parentElement) {
                        const parentSiblings = getSiblings(teamEl.parentElement);
                        parentSiblings.forEach(sib => {
                            // 检查是否有odds相关的类名或属性
                            const hasOddsClass = sib.className && sib.className.toLowerCase().includes('odds');
                            const hasOddsId = sib.id && sib.id.toLowerCase().includes('odds');

                            if (hasOddsClass || hasOddsId) {
                                debugLog(`在父元素兄弟节点中找到odds元素: ${sib.textContent}`);
                                oddsElements.push(sib);
                                return;
                            }

                            const text = sib.textContent.trim();
                            if (/\d+\.\d+/.test(text)) {
                                // 查找包含数字的子元素
                                const numElements = Array.from(sib.querySelectorAll('*')).filter(el => {
                                    // 检查是否有odds相关的类名或属性
                                    const hasOddsClass = el.className && el.className.toLowerCase().includes('odds');
                                    const hasOddsId = el.id && el.id.toLowerCase().includes('odds');
                                    const hasOddsAttribute = el.hasAttribute('data-odds') || el.hasAttribute('odds');

                                    // 检查文本是否是赔率格式
                                    const text = el.textContent.trim();
                                    const isOddsFormat = /^\d+\.\d+$/.test(text) && parseFloat(text) > 1.0;

                                    return hasOddsClass || hasOddsId || hasOddsAttribute || isOddsFormat;
                                });

                                if (numElements.length > 0) {
                                    debugLog(`在父元素兄弟节点中找到可能的赔率: ${numElements[0].textContent}`);
                                    oddsElements.push(numElements[0]);
                                }
                            }
                        });
                    }

                    // 检查整个比赛容器中是否有与队伍相关的odds元素
                    const teamRect = teamEl.getBoundingClientRect();
                    const allOddsInMatch = Array.from(selectedMatch.querySelectorAll('[class*="odds"], [id*="odds"], [data-odds]'));

                    allOddsInMatch.forEach(oddsEl => {
                        const oddsRect = oddsEl.getBoundingClientRect();
                        // 检查odds元素是否在队伍元素的同一行或附近
                        const isNearTeam = Math.abs(oddsRect.top - teamRect.top) < 50 || // 同一行或接近
                                          Math.abs(oddsRect.bottom - teamRect.bottom) < 50;

                        if (isNearTeam) {
                            debugLog(`找到与队伍在同一行的odds元素: ${oddsEl.textContent}`);
                            oddsElements.push(oddsEl);
                        }
                    });
                });
            }
        }

        // 方法3.5：尝试查找所有具有data-odds属性的元素
        if (oddsElements.length < 2) {
            debugLog('尝试方法3.5: 查找具有data-odds属性的元素');
            const dataOddsElements = selectedMatch.querySelectorAll('[data-odds], [data-odd], [odds]');

            if (dataOddsElements.length >= 2) {
                oddsElements = Array.from(dataOddsElements);
                debugLog(`找到 ${oddsElements.length} 个具有data-odds属性的元素`);
            }
        }

        // 方法4：查找任何看起来像赔率的数字，并检查是否有odds相关的父元素或祖先元素
        if (oddsElements.length < 2) {
            debugLog('尝试方法4: 查找任何看起来像赔率的数字，并检查odds相关元素');
            // 获取所有文本节点
            const walker = document.createTreeWalker(
                selectedMatch,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            const textNodes = [];
            let node;
            while (node = walker.nextNode()) {
                const text = node.textContent.trim();
                // 匹配类似赔率的数字格式，并且值大于1.0
                if (/^\d+\.\d+$/.test(text) && parseFloat(text) > 1.0) {
                    // 检查父元素或祖先元素是否有odds相关的类名或属性
                    let parent = node.parentNode;
                    let hasOddsAncestor = false;

                    // 向上检查5层祖先元素
                    for (let i = 0; i < 5 && parent; i++) {
                        if (parent.className && parent.className.toLowerCase().includes('odds') ||
                            parent.id && parent.id.toLowerCase().includes('odds') ||
                            parent.hasAttribute && (parent.hasAttribute('data-odds') || parent.hasAttribute('odds'))) {
                            hasOddsAncestor = true;
                            debugLog(`找到带有odds标识的祖先元素，包含赔率: ${text}`);
                            break;
                        }
                        parent = parent.parentNode;
                    }

                    // 如果有odds相关的祖先元素，优先添加
                    if (hasOddsAncestor) {
                        textNodes.unshift(node); // 放在数组前面，优先考虑
                    } else {
                        textNodes.push(node);
                    }

                    debugLog(`找到可能的赔率文本: ${text}`);
                }
            }

            // 如果找到至少两个可能的赔率文本节点
            if (textNodes.length >= 2) {
                // 将文本节点转换为它们的父元素
                oddsElements = textNodes.map(node => node.parentNode);
                debugLog('使用方法4找到的赔率元素');
            }
        }

        // 方法5：查找任何可点击的元素，其中包含数字，并检查是否有odds相关的类名或属性
        if (oddsElements.length < 2) {
            debugLog('尝试方法5: 查找可点击元素中的数字，并检查odds相关元素');
            const clickableElements = Array.from(selectedMatch.querySelectorAll('div[class*="button"], div[role="button"], button, a, div[class*="odds"], span[class*="odds"]'));

            const oddsButtons = clickableElements.filter(el => {
                // 检查是否有odds相关的类名或属性
                const hasOddsClass = el.className && el.className.toLowerCase().includes('odds');
                const hasOddsId = el.id && el.id.toLowerCase().includes('odds');
                const hasOddsAttribute = el.hasAttribute('data-odds') || el.hasAttribute('odds');

                // 如果有odds相关的标识，优先考虑
                if (hasOddsClass || hasOddsId || hasOddsAttribute) {
                    debugLog(`找到带有odds标识的可点击元素: ${el.textContent}`);
                    return true;
                }

                const text = el.textContent.trim();
                return /\d+\.\d+/.test(text) && parseFloat(text.match(/\d+\.\d+/)[0]) > 1.0;
            });

            debugLog(`方法5结果: 找到 ${oddsButtons.length} 个可能的赔率按钮`);
            if (oddsButtons.length >= 2) {
                oddsElements = oddsButtons;
            }
        }

        // 方法6：查找特定HTML结构中的odds元素
        if (oddsElements.length < 2) {
            debugLog('尝试方法6: 查找特定HTML结构中的odds元素');

            // 尝试查找常见的赔率容器结构
            const oddsContainers = Array.from(selectedMatch.querySelectorAll('.odds-container, .bet-odds, .market-odds, [class*="odds-container"], [class*="bet-odds"], [class*="market-odds"]'));

            if (oddsContainers.length > 0) {
                debugLog(`找到 ${oddsContainers.length} 个可能的赔率容器`);

                // 从容器中提取赔率元素
                for (const container of oddsContainers) {
                    // 查找容器中的数字元素
                    const numElements = Array.from(container.querySelectorAll('*')).filter(el => {
                        const text = el.textContent.trim();
                        return /^\d+\.\d+$/.test(text) && parseFloat(text) > 1.0;
                    });

                    if (numElements.length >= 2) {
                        oddsElements = numElements;
                        debugLog(`在赔率容器中找到 ${numElements.length} 个赔率元素`);
                        break;
                    }
                }
            }
        }

        debugLog(`最终找到 ${oddsElements.length} 个赔率元素`);
        if (oddsElements.length < 2) {
            // 显示比赛元素的HTML结构，帮助调试
            debugLog('比赛元素HTML结构', selectedMatch.outerHTML);
            updateStatus('无法找到赔率元素，请检查网站结构是否已更新');
            return null;
        }

        // 解析赔率
        const homeOdds = parseOdds(oddsElements[0].textContent);
        const awayOdds = parseOdds(oddsElements[1].textContent);

        // 根据设置选择队伍
        let selectedTeam, selectedOdds, teamIndex;
        if (betTeam === 'home' || (betTeam === 'random' && Math.random() < 0.5)) {
            selectedTeam = 'home';
            selectedOdds = homeOdds;
            teamIndex = 0;
        } else {
            selectedTeam = 'away';
            selectedOdds = awayOdds;
            teamIndex = 1;
        }

        // 检查赔率是否在范围内
        if (selectedOdds < minOdds || selectedOdds > maxOdds) {
            updateStatus(`赔率 ${selectedOdds} 不在设定范围内 (${minOdds}-${maxOdds})`);
            return null;
        }

        return {
            match: selectedMatch,
            team: selectedTeam,
            odds: selectedOdds,
            element: oddsElements[teamIndex]
        };
    }

    // 设置下注金额
    async function setBetAmount(amount) {
        debugLog('尝试查找下注金额输入框');

        // 验证金额是否有效
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            updateStatus('下注金额无效，请输入有效的金额');
            debugLog(`无效的下注金额: ${amount}`);
            return false;
        }

        // 尝试多种可能的选择器
        let amountInput = null;

        // 方法0：使用用户指定的特定选择器
        amountInput = document.querySelector('#singleBet, .btQuickA, input#singleBet, input.btQuickA');
        debugLog(`方法0结果: ${amountInput ? '找到' : '未找到'}用户指定的下注金额输入框`);

        // 方法1：使用原有的选择器
        if (!amountInput) {
            amountInput = document.querySelector('input[class*="amount"]');
            debugLog(`方法1结果: ${amountInput ? '找到' : '未找到'}下注金额输入框`);
        }

        // 方法2：尝试查找任何数字输入框
        if (!amountInput) {
            const inputs = Array.from(document.querySelectorAll('input[type="number"], input[type="text"]'));
            debugLog(`找到 ${inputs.length} 个可能的输入框`);

            // 查找可能的金额输入框
            amountInput = inputs.find(input => {
                // 检查输入框的属性和周围元素
                const hasAmountClass = input.className.toLowerCase().includes('amount');
                const hasAmountId = input.id.toLowerCase().includes('amount');
                const hasAmountPlaceholder = input.placeholder && input.placeholder.toLowerCase().includes('金额');
                const parentText = input.parentElement ? input.parentElement.textContent.toLowerCase() : '';
                const hasAmountParentText = parentText.includes('金额') || parentText.includes('金') || parentText.includes('额');

                return hasAmountClass || hasAmountId || hasAmountPlaceholder || hasAmountParentText;
            });

            debugLog(`方法2结果: ${amountInput ? '找到' : '未找到'}可能的下注金额输入框`);
        }

        // 方法3：查找下注面板中的输入框
        if (!amountInput) {
            // 查找可能的下注面板
            const betPanels = Array.from(document.querySelectorAll('div[class*="bet"], div[class*="slip"], div[class*="ticket"]'));
            debugLog(`找到 ${betPanels.length} 个可能的下注面板`);

            for (const panel of betPanels) {
                const inputs = panel.querySelectorAll('input');
                if (inputs.length > 0) {
                    // 假设第一个输入框是金额输入框
                    amountInput = inputs[0];
                    debugLog(`在下注面板中找到输入框: ${amountInput.outerHTML}`);
                    break;
                }
            }
        }

        // 方法4：查找任何可能的输入框
        if (!amountInput) {
            const allInputs = Array.from(document.querySelectorAll('input'));
            debugLog(`找到 ${allInputs.length} 个输入框元素`);

            // 过滤出可能的金额输入框（排除隐藏的、禁用的和只读的输入框）
            const visibleInputs = allInputs.filter(input => {
                const style = window.getComputedStyle(input);
                return style.display !== 'none' &&
                       style.visibility !== 'hidden' &&
                       !input.disabled &&
                       !input.readOnly;
            });

            if (visibleInputs.length > 0) {
                // 尝试找到最可能是金额输入框的元素
                amountInput = visibleInputs.find(input => {
                    // 检查输入框的类型
                    return input.type === 'number' || input.type === 'text';
                }) || visibleInputs[0]; // 如果没有找到合适的，使用第一个可见输入框

                debugLog(`方法4结果: 使用可见输入框 ${amountInput.outerHTML}`);
            }
        }

        // 方法5：查找可能在iframe中的输入框
        if (!amountInput) {
            const iframes = document.querySelectorAll('iframe');
            debugLog(`找到 ${iframes.length} 个iframe元素`);

            for (const iframe of iframes) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    const iframeInputs = iframeDoc.querySelectorAll('input[type="number"], input[type="text"]');

                    if (iframeInputs.length > 0) {
                        amountInput = iframeInputs[0];
                        debugLog(`在iframe中找到输入框: ${amountInput.outerHTML}`);
                        break;
                    }
                } catch (e) {
                    debugLog(`无法访问iframe内容: ${e.message}`);
                }
            }
        }

        // 如果仍然找不到，记录页面结构以便调试
        if (!amountInput) {
            debugLog('无法找到下注金额输入框，记录页面结构以便调试');
            const betSlip = document.querySelector('div[class*="bet"], div[class*="slip"], div[class*="ticket"]');
            if (betSlip) {
                debugLog('下注面板HTML结构', betSlip.outerHTML);
            } else {
                debugLog('无法找到下注面板');
            }

            updateStatus('找不到下注金额输入框，请检查网站结构是否已更新');
            return false;
        }

        // 设置金额
        debugLog(`找到下注金额输入框，设置金额: ${amount}`);

        try {
            // 先点击输入框以激活它
            // 模拟完整的鼠标点击事件序列
            amountInput.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
            amountInput.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
            amountInput.click();
            // 等待一小段时间确保点击事件被处理
            await new Promise(resolve => setTimeout(resolve, 100));
            // 再聚焦输入框
            amountInput.focus();
            // 再次触发点击事件以确保激活
            amountInput.click();

            // 先清空输入框
            amountInput.value = '';
            amountInput.dispatchEvent(new Event('input', { bubbles: true }));
            // 短暂延迟确保清空操作完成
            await new Promise(resolve => setTimeout(resolve, 50));

            // 再次确认输入框处于激活状态
            amountInput.focus();
            amountInput.click();

            // 模拟逐个输入数字
            const amountStr = amount.toString();
            for (let i = 0; i < amountStr.length; i++) {
                amountInput.value += amountStr[i];
                // 触发多种事件，确保输入被识别
                amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                amountInput.dispatchEvent(new KeyboardEvent('keydown', { key: amountStr[i], code: `Digit${amountStr[i]}`, keyCode: 48 + parseInt(amountStr[i]), bubbles: true }));
                amountInput.dispatchEvent(new KeyboardEvent('keyup', { key: amountStr[i], code: `Digit${amountStr[i]}`, keyCode: 48 + parseInt(amountStr[i]), bubbles: true }));
                // 短暂延迟，模拟真实输入
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // 触发多种事件，确保金额被正确识别
            amountInput.dispatchEvent(new Event('change', { bubbles: true }));
            amountInput.dispatchEvent(new Event('blur', { bubbles: true }));

            // 再次聚焦并按下回车键，有些网站需要这样确认输入
            amountInput.focus();
            amountInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            amountInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

            // 验证金额是否已设置
            if (!amountInput.value || amountInput.value === '0' || amountInput.value === '') {
                debugLog('常规输入方法失败，尝试其他方法设置金额');

                // 方法1：尝试直接设置value属性
                amountInput.value = amount;
                amountInput.setAttribute('value', amount);
                amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                amountInput.dispatchEvent(new Event('change', { bubbles: true }));

                // 方法2：尝试使用execCommand
                try {
                    amountInput.focus();
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, amount);
                } catch (e) {
                    debugLog(`execCommand方法失败: ${e.message}`);
                }

                // 方法3：尝试使用剪贴板API
                try {
                    const tempInput = document.createElement('input');
                    tempInput.value = amount;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempInput);

                    amountInput.focus();
                    document.execCommand('paste');
                } catch (e) {
                    debugLog(`剪贴板方法失败: ${e.message}`);
                }

                // 方法4：尝试模拟Tab键和回车键
                amountInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, bubbles: true }));
                amountInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', code: 'Tab', keyCode: 9, bubbles: true }));
                amountInput.focus();
                amountInput.value = amount;
                amountInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                amountInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            }

            // 最终验证
            if (!amountInput.value || amountInput.value === '0' || amountInput.value === '') {
                updateStatus('下注金额设置失败，请手动输入金额');
                debugLog('下注金额设置失败');
                return false;
            }

            debugLog(`金额已成功设置为: ${amountInput.value}`);
            return true;
        } catch (error) {
            debugLog(`设置金额时出错: ${error.message}`);
            updateStatus('设置金额时出错，请手动输入');
            return false;
        }
    }

    // 检测并处理盘口关闭提示
    async function handleMarketClosed() {
        debugLog('检查是否出现盘口关闭提示');
        const popupMsg = document.querySelector('.popMsg.fadeShow');
        if (!popupMsg) {
            return false; // 没有检测到盘口关闭提示
        }

        debugLog('检测到盘口关闭提示');
        // 查找并点击关闭按钮
        const closeBtn = document.querySelector('.btn.btnGrey');
        if (closeBtn) {
            debugLog('找到关闭按钮，点击关闭');
            closeBtn.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            updateStatus('盘口已关闭，稍后将重试');
            return true;
        }

        // 尝试查找其他可能的关闭按钮
        const otherCloseBtn = popupMsg.querySelector('button, [class*="close"], [class*="btn"], [role="button"]');
        if (otherCloseBtn) {
            debugLog('找到替代关闭按钮，点击关闭');
            otherCloseBtn.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            updateStatus('盘口已关闭，稍后将重试');
            return true;
        }

        debugLog('未找到关闭按钮，无法处理盘口关闭提示');
        return false;
    }

    // 关闭成功提示框
    async function closeSuccessPopup() {
        debugLog('检查是否出现成功提示框');
        try {
            // 等待成功提示框出现
            for (let i = 0; i < 10; i++) { // 尝试10次，每次等待200ms
                // 尝试多种可能的选择器
                const successPopup = document.querySelector('.btBtn.btBtn3, div.btBtn.btBtn3, button.btBtn.btBtn3, .btBtn3, [class*="btBtn3"]');
                if (successPopup) {
                    debugLog(`找到成功提示框，点击关闭按钮: ${successPopup.outerHTML}`);
                    // 模拟完整的点击事件
                    successPopup.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                    successPopup.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
                    successPopup.click();
                    await new Promise(resolve => setTimeout(resolve, 300)); // 等待关闭动画完成
                    debugLog('成功关闭提示框，返回true');
                    return true;
                }

                // 尝试查找其他可能的成功提示框
                const otherPopups = document.querySelectorAll('div[class*="popup"], div[class*="modal"], div[class*="dialog"], div[class*="message"]');
                for (const popup of otherPopups) {
                    // 检查是否包含关闭按钮或确认按钮
                    const closeButtons = popup.querySelectorAll('button, div[role="button"], div[class*="close"], div[class*="confirm"], div[class*="ok"]');
                    if (closeButtons.length > 0) {
                        debugLog(`找到可能的提示框，点击关闭按钮: ${closeButtons[0].outerHTML}`);
                        closeButtons[0].click();
                        await new Promise(resolve => setTimeout(resolve, 300));
                        debugLog('成功关闭提示框，返回true');
                        return true;
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 200));
            }
            // 如果没有找到提示框，也认为下注成功
            debugLog('未找到提示框，但仍认为下注成功，返回true');
            return true;
        } catch (error) {
            debugLog(`关闭成功提示框时出错: ${error.message}`);
            return false;
        }
    }

    // 确认下注
    async function confirmBet() {
        debugLog('尝试查找确认下注按钮');

        // 检查是否出现盘口关闭提示
        if (await handleMarketClosed()) {
            return false;
        }

        // 尝试多种可能的选择器
        let confirmButton = null;

        // 方法0：使用用户提供的选择器
        confirmButton = document.querySelector('div.btBtn.disabled, div.btBtn:not(.disabled)');
        if (confirmButton) {
            debugLog(`找到用户提供的确认下注按钮: ${confirmButton.outerHTML}`);

            // 检查按钮是否真的被禁用
            if (confirmButton.classList.contains('disabled')) {
                // 尝试移除disabled类以启用按钮
                debugLog('尝试移除disabled类以启用按钮');
                confirmButton.classList.remove('disabled');
            }
        }

        // 方法1：使用原有的选择器
        if (!confirmButton) {
            confirmButton = document.querySelector('div[class*="confirm"]');
            debugLog(`方法1结果: ${confirmButton ? '找到' : '未找到'}确认下注按钮`);
        }

        // 方法2：查找可能的确认按钮
        if (!confirmButton) {
            // 查找包含"确认"、"下注"等文本的按钮或可点击元素
            const possibleButtons = Array.from(document.querySelectorAll('button, div[role="button"], div[class*="button"], a[class*="button"]'));
            debugLog(`找到 ${possibleButtons.length} 个可能的按钮元素`);

            confirmButton = possibleButtons.find(btn => {
                const text = btn.textContent.toLowerCase();
                return text.includes('确认') ||
                       text.includes('下注') ||
                       text.includes('提交') ||
                       text.includes('confirm') ||
                       text.includes('bet') ||
                       text.includes('place') ||
                       text.includes('submit');
            });

            debugLog(`方法2结果: ${confirmButton ? '找到' : '未找到'}可能的确认下注按钮`);
        }

        // 方法3：查找下注面板中的最后一个按钮
        if (!confirmButton) {
            // 查找可能的下注面板
            const betPanels = Array.from(document.querySelectorAll('div[class*="bet"], div[class*="slip"], div[class*="ticket"]'));

            for (const panel of betPanels) {
                // 查找面板中的所有按钮
                const buttons = Array.from(panel.querySelectorAll('button, div[role="button"], div[class*="button"], a[class*="button"]'));

                if (buttons.length > 0) {
                    // 假设最后一个按钮是确认下注按钮
                    confirmButton = buttons[buttons.length - 1];
                    debugLog(`在下注面板中找到可能的确认按钮: ${confirmButton.outerHTML}`);
                    break;
                }
            }
        }

        // 如果仍然找不到，记录页面结构以便调试
        if (!confirmButton) {
            debugLog('无法找到确认下注按钮，记录页面结构以便调试');
            const betSlip = document.querySelector('div[class*="bet"], div[class*="slip"], div[class*="ticket"]');
            if (betSlip) {
                debugLog('下注面板HTML结构', betSlip.outerHTML);
            } else {
                debugLog('无法找到下注面板');
            }

            updateStatus('找不到确认下注按钮，请检查网站结构是否已更新');
            return false;
        }

        // 检查金额输入框是否有值
        const amountInput = document.querySelector('input[class*="amount"]');
        if (amountInput && (!amountInput.value || amountInput.value === '0' || amountInput.value === '')) {
            updateStatus('请先输入下注金额');
            debugLog('金额输入框为空');
            return false;
        }

        // 点击确认按钮
        debugLog('点击确认下注按钮');
        confirmButton.click();

        // 等待一段时间，确保下注操作完成
        await new Promise(resolve => setTimeout(resolve, 500));

        // 检查是否出现成功提示框并关闭
        debugLog('调用closeSuccessPopup函数');
        const success = await closeSuccessPopup();
        debugLog(`closeSuccessPopup返回结果: ${success}`);


        // 如果成功关闭了提示框，说明下注成功，增加下注计数
        if (success) {
            // 获取当前选中的比赛元素
            const selectedOdds = document.querySelector('[class*="odds"][class*="selected"], [class*="selection"][class*="selected"], [class*="option"][class*="selected"]');
            debugLog(`选中的赔率元素: ${selectedOdds ? selectedOdds.outerHTML : '未找到'}`);

            if (selectedOdds) {
                const matchElement = selectedOdds.closest('div[class*="match"], div[class*="event"], div[class*="game"], div[class*="contest"]');
                debugLog(`比赛容器元素: ${matchElement ? matchElement.outerHTML.substring(0, 100) + '...' : '未找到'}`);

                if (matchElement) {
                    // 获取比赛唯一标识符
                    const matchId = getMatchIdentifier(matchElement);
                    debugLog(`获取到比赛ID: ${matchId}`);

                    // 增加下注计数
                    if (!matchBetCounts[matchId]) {
                        matchBetCounts[matchId] = 0;
                    }
                    matchBetCounts[matchId]++;
                    debugLog(`增加下注计数后: ${matchBetCounts[matchId]}`);

                    // 更新下注计数显示
                    updateBetCountsDisplay();
                    debugLog('已更新下注计数显示');

                    // 获取最大下注次数
                    const maxBetsPerMatch = parseInt(document.getElementById('max-bets-per-match').value);
                    if (maxBetsPerMatch > 0) {
                        debugLog(`比赛ID: ${matchId} 下注计数: ${matchBetCounts[matchId]}/${maxBetsPerMatch}`);
                    }
                } else {
                    // 如果找不到比赛元素，使用备用方法
                    debugLog('找不到比赛容器元素，使用备用方法');
                    // 使用当前页面上所有可见的比赛中第一个作为当前比赛
                    const visibleMatches = document.querySelectorAll('div[class*="match"]:not([style*="display: none"]), div[class*="event"]:not([style*="display: none"]), div[class*="game"]:not([style*="display: none"]), div[class*="contest"]:not([style*="display: none"])');
                    if (visibleMatches.length > 0) {
                        const firstMatch = visibleMatches[0];
                        const matchId = getMatchIdentifier(firstMatch);
                        debugLog(`使用备用方法获取比赛ID: ${matchId}`);

                        if (!matchBetCounts[matchId]) {
                            matchBetCounts[matchId] = 0;
                        }
                        matchBetCounts[matchId]++;
                        debugLog(`增加下注计数后: ${matchBetCounts[matchId]}`);

                        updateBetCountsDisplay();
                        debugLog('已更新下注计数显示');
                    } else {
                        debugLog('无法找到任何比赛元素，无法增加下注计数');
                    }
                }
            } else {
                debugLog('找不到选中的赔率元素，无法增加下注计数');
            }
        } else {
            debugLog('下注未成功，不增加下注计数');
        }

        return true;
    }

    // 执行单次下注
    async function placeSingleBet() {
        updateStatus('开始下注...');

        // 选择比赛
        const selection = selectMatch();
        if (!selection) {
            return false;
        }

        // 获取比赛容器元素
        const matchElement = selection.element.closest('div[class*="match"], div[class*="event"], div[class*="game"], div[class*="contest"]');

        // 获取比赛唯一标识符
        const matchId = getMatchIdentifier(matchElement);
        debugLog(`获取到比赛ID: ${matchId}`);

        // 获取并显示比赛状态
        const matchStatus = getMatchStatus(matchElement);

        // 检查该比赛的下注次数是否已达到上限
        const maxBetsPerMatch = parseInt(document.getElementById('max-bets-per-match').value);
        if (maxBetsPerMatch > 0) {
            // 如果matchBetCounts中没有该比赛的记录，初始化为0
            if (!matchBetCounts[matchId]) {
                matchBetCounts[matchId] = 0;
            }

            // 检查是否达到最大下注次数
            if (matchBetCounts[matchId] >= maxBetsPerMatch) {
                updateStatus(`该比赛已下注${matchBetCounts[matchId]}次，达到上限${maxBetsPerMatch}次`);
                debugLog(`比赛ID: ${matchId} 已达到下注上限: ${matchBetCounts[matchId]}/${maxBetsPerMatch}`);
                return false;
            }

            updateStatus(`已选择${matchStatus}的比赛，赔率: ${selection.odds}，当前下注次数: ${matchBetCounts[matchId]}/${maxBetsPerMatch}`);
        } else {
            updateStatus(`已选择${matchStatus}的比赛，赔率: ${selection.odds}`);
        }

        // 点击选择的队伍
        selection.element.click();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 获取下注金额
        const amount = document.getElementById('bet-amount').value;
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            updateStatus('请输入有效的下注金额');
            return false;
        }

        // 直接使用setBetAmount设置下注金额
        debugLog('使用setBetAmount设置下注金额');
        if (!await setBetAmount(amount)) {
            updateStatus('设置下注金额失败');
            return false;
        }

        updateStatus(`已设置下注金额: ${amount}`);
        await new Promise(resolve => setTimeout(resolve, 500));

        // 检查是否出现盘口关闭提示
        if (await handleMarketClosed()) {
            return false;
        }

        // 确认下注
        if (!await confirmBet()) {
            return false;
        }

        // 下注成功，确保下注计数已更新
        // 由于confirmBet函数中可能存在获取不到正确matchElement的情况，这里再次确认下注计数更新
        if (!matchBetCounts[matchId]) {
            matchBetCounts[matchId] = 1;
        } else {
            matchBetCounts[matchId]++;
        }

        // 更新下注计数显示
        updateBetCountsDisplay();

        // 记录详细的比赛标识符信息
        debugLog(`下注成功，比赛标识符: ${matchId}`);

        // 检查是否达到最大下注次数
        if (maxBetsPerMatch > 0 && matchBetCounts[matchId] >= maxBetsPerMatch) {
            const message = `该比赛已下注${matchBetCounts[matchId]}/${maxBetsPerMatch}次，达到上限！`;
            updateStatus(message, 'warning');
            debugLog(message);

            // 在控制面板中显示明显的提示
            const statusElement = document.getElementById('autoBetStatus');
            if (statusElement) {
                statusElement.textContent = `提示: ${message}`;
                statusElement.style.color = 'orange';
                statusElement.style.fontWeight = 'bold';
            }
        } else {
            updateStatus(`下注成功！${maxBetsPerMatch > 0 ? `该比赛已下注${matchBetCounts[matchId]}/${maxBetsPerMatch}次` : ''}`);
        }

        debugLog(`下注成功，比赛ID: ${matchId}，当前下注次数: ${matchBetCounts[matchId]}`);

        // 保存下注记录到本地存储
        try {
            localStorage.setItem('matchBetCounts', JSON.stringify(matchBetCounts));
            debugLog('已保存下注记录到本地存储');
        } catch (error) {
            debugLog('保存下注记录失败: ' + error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));

        updateStatus('下注成功!');

        // 再次检查并关闭可能出现的成功提示框
        await closeSuccessPopup();

        return true;
    }

    // 自动下注循环
    let autoBetInterval = null;

    function startAutoBet() {
        const interval = 30000; // 30秒下注一次
        const includeUpcomingMatches = document.getElementById('bet-upcoming-matches').value === 'true';
        updateStatus(`自动下注已启动，${includeUpcomingMatches ? '包含即将开始的比赛' : '仅下注进行中的比赛'}`);

        document.getElementById('start-auto-bet').disabled = true;
        document.getElementById('stop-auto-bet').disabled = false;

        // 立即执行一次
        placeSingleBet();

        // 设置定时器
        autoBetInterval = setInterval(async () => {
            // 检查是否出现盘口关闭提示
            if (await handleMarketClosed()) {
                debugLog('检测到盘口关闭，等待下一次尝试');
                return;
            }
            await placeSingleBet();
        }, interval);
    }

    function stopAutoBet() {
        if (autoBetInterval) {
            clearInterval(autoBetInterval);
            autoBetInterval = null;

            document.getElementById('start-auto-bet').disabled = false;
            document.getElementById('stop-auto-bet').disabled = true;
            updateStatus('自动下注已停止');
        }
    }

    // 从投注记录中分析同一场比赛下注次数
    async function analyzeBetHistory() {
        debugLog('开始分析投注记录...');
        try {
            // 查找投注记录按钮并点击
            const betHistoryBtn = document.querySelector('[class*="btList"], [class*="betList"], [class*="betHistory"], a[href*="betList"], a[href*="betHistory"], div[data-tab="betList"], div[data-tab="betHistory"]');
            if (betHistoryBtn) {
                debugLog('找到投注记录按钮，点击打开投注记录');
                betHistoryBtn.click();
                await new Promise(resolve => setTimeout(resolve, 1000)); // 等待投注记录加载
            } else {
                debugLog('未找到投注记录按钮');
                // 尝试查找投注记录标签（通过文本内容）
                const allElements = document.querySelectorAll('div, span, a, button');
                let betHistoryTab = null;

                for (const element of allElements) {
                    if (element.textContent.includes('投注记录')) {
                        betHistoryTab = element;
                        break;
                    }
                }

                if (betHistoryTab) {
                    debugLog('找到投注记录标签，点击打开投注记录');
                    betHistoryTab.click();
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待投注记录加载
                } else {
                    debugLog('未找到投注记录标签');
                    return false;
                }
            }

            // 查找投注记录列表 - 使用更广泛的选择器
            let betRecords = document.querySelectorAll('[class*="betRecord"], [class*="betItem"], [class*="betHistory"] > div, [class*="btList"] > div, [class*="betList"] > div, [class*="bet-record"], [class*="bet-item"], [class*="bet-history"] > div, [class*="bet_record"], [class*="bet_item"], [class*="bet_list"] > div');

            // 如果没有找到记录，尝试查找表格中的行
            if (betRecords.length === 0) {
                const betTables = document.querySelectorAll('table[class*="bet"], table[class*="record"], table[class*="history"]');
                if (betTables.length > 0) {
                    betRecords = betTables[0].querySelectorAll('tr');
                    // 跳过表头行
                    if (betRecords.length > 0) {
                        betRecords = Array.from(betRecords).slice(1);
                    }
                }
            }

            // 如果仍然没有找到记录，尝试查找任何可能的投注记录容器
            if (betRecords.length === 0) {
                const possibleContainers = document.querySelectorAll('.btList, .betList, .betHistory, #btList, #betList, #betHistory, [data-role="betList"], [data-role="betHistory"]');
                for (const container of possibleContainers) {
                    if (container.children.length > 0) {
                        betRecords = container.children;
                        break;
                    }
                }
            }

            debugLog(`找到 ${betRecords.length} 条投注记录`);

            if (betRecords.length === 0) {
                debugLog('未找到投注记录列表');
                return false;
            }

            // 临时存储比赛下注次数的对象
            const tempMatchBetCounts = {};

            // 分析每条投注记录
            for (const record of betRecords) {
                // 提取比赛信息 - 尝试多种选择器以提高匹配率
                let matchInfo = record.querySelector('[class*="match"], [class*="event"], [class*="game"], [class*="contest"], [class*="league"], [class*="team"], [class*="vs"]');

                // 如果没有找到匹配的元素，尝试查找包含VS或vs的元素
                if (!matchInfo) {
                    const allElements = record.querySelectorAll('*');
                    for (const element of allElements) {
                        const text = element.textContent.trim().toLowerCase();
                        if (text.includes('vs') || text.includes('对') || text.includes('vs.')) {
                            matchInfo = element;
                            break;
                        }
                    }
                }

                // 如果仍然没有找到，使用整个记录作为匹配信息
                if (!matchInfo) {
                    matchInfo = record;
                }

                const matchText = matchInfo.textContent.trim();
                debugLog(`找到比赛信息: ${matchText}`);

                // 尝试从投注记录中提取游戏名称、比赛名称和局数信息
                let gameName = '未知游戏';
                let leagueName = '未知联赛';
                let teamNames = '';
                let gameCount = '未知局数';
                let currentRound = '1';

                // 尝试提取游戏名称
                const gameNameMatch = matchText.match(/(英雄联盟|刀塔2|CS2|王者荣耀|无尽对决|守望先锋2|彩虹六号|使命召唤|星际争霸2|火箭联盟|炉石传说|NBA 2K|魔兽争霸3|绝地求生|堡垒之夜|云顶之弈|Free Fire|街头霸王6|铁拳8|Apex 英雄|Rennsport)/i);
                if (gameNameMatch) {
                    gameName = gameNameMatch[1];
                }

                // 尝试提取联赛名称
                const leagueNameMatch = matchText.match(/(\d{4}\s*[^\d\s]+\s*[赛季中邀请赛|总决赛|瑞士轮|电子竞技杯|世界杯|系列赛|锦标赛|职业联赛|挑战者|联赛|杯赛])/i);
                if (leagueNameMatch) {
                    leagueName = leagueNameMatch[1];
                }

                // 尝试提取队伍名称
                const teamNamesMatch = matchText.match(/([^\s]+)\s*(?:vs\.?|对)\s*([^\s]+)/i);
                if (teamNamesMatch && teamNamesMatch.length >= 3) {
                    teamNames = `${teamNamesMatch[1]}_vs_${teamNamesMatch[2]}`;
                }

                // 尝试提取比赛局数信息
                const gameCountMatch = matchText.match(/BO[1-9]|BO\s[1-9]|Best\sof\s[1-9]|最佳[1-9]局/i);
                if (gameCountMatch) {
                    gameCount = gameCountMatch[0];
                }

                // 尝试提取当前局数
                const currentRoundMatch = matchText.match(/第([1-9])局|([1-9]):[1-9]|[1-9]:([1-9])/i);
                if (currentRoundMatch) {
                    for (let i = 1; i < currentRoundMatch.length; i++) {
                        if (currentRoundMatch[i]) {
                            currentRound = currentRoundMatch[i];
                            break;
                        }
                    }
                }

                // 构建比赛标识符
                const recordIdentifier = `${gameName}_${leagueName}_${teamNames}_${gameCount}_${currentRound}`;
                debugLog(`投注记录标识符: ${recordIdentifier}`);

                // 增加该比赛的下注计数
                if (!tempMatchBetCounts[recordIdentifier]) {
                    tempMatchBetCounts[recordIdentifier] = 1;
                } else {
                    tempMatchBetCounts[recordIdentifier]++;
                }

                debugLog(`投注记录中的比赛: ${matchText}, ID: ${recordIdentifier}, 计数: ${tempMatchBetCounts[recordIdentifier]}`);
            }

            // 尝试将投注记录中的比赛与当前页面上的比赛匹配
            const currentMatches = document.querySelectorAll('[class*="match"], [class*="event"], [class*="game"], [class*="contest"], [class*="league"]');
            debugLog(`当前页面上找到 ${currentMatches.length} 场比赛`);

            // 创建当前页面比赛的标识符映射
            const currentMatchMap = {};
            for (const match of currentMatches) {
                const pageMatchId = getMatchIdentifier(match);
                currentMatchMap[pageMatchId] = pageMatchId;
                debugLog(`当前页面比赛标识符: ${pageMatchId}`);
            }

            // 更新全局的matchBetCounts对象，尝试匹配当前页面的比赛
            for (const recordMatchId in tempMatchBetCounts) {
                // 尝试在当前页面找到匹配的比赛
                let matched = false;

                for (const pageMatchId in currentMatchMap) {
                    // 分解两个标识符以进行更精确的比较
                    const recordParts = recordMatchId.split('_');
                    const pageParts = pageMatchId.split('_');

                    // 提取关键部分进行比较：游戏名称、联赛名称、队伍名称、比赛局数
                    const recordGameName = recordParts[0] || '';
                    const recordLeagueName = recordParts[1] || '';
                    const recordTeamNames = recordParts[2] || '';
                    const recordGameCount = recordParts[3] || '';
                    const recordCurrentRound = recordParts[4] || '';

                    const pageGameName = pageParts[0] || '';
                    const pageLeagueName = pageParts[1] || '';
                    const pageTeamNames = pageParts[2] || '';
                    const pageGameCount = pageParts[3] || '';
                    const pageCurrentRound = pageParts[4] || '';

                    // 计算各部分的相似度
                    const gameNameSimilarity = textSimilarity(recordGameName, pageGameName);
                    const leagueNameSimilarity = textSimilarity(recordLeagueName, pageLeagueName);
                    const teamNamesSimilarity = textSimilarity(recordTeamNames, pageTeamNames);
                    const gameCountSimilarity = textSimilarity(recordGameCount, pageGameCount);
                    const roundSimilarity = textSimilarity(recordCurrentRound, pageCurrentRound);

                    // 计算总体相似度，加权平均
                    const totalSimilarity = (
                        gameNameSimilarity * 0.2 +
                        leagueNameSimilarity * 0.2 +
                        teamNamesSimilarity * 0.3 +
                        gameCountSimilarity * 0.15 +
                        roundSimilarity * 0.15
                    );

                    debugLog(`比较: ${recordMatchId} 与 ${pageMatchId}, 总相似度: ${totalSimilarity.toFixed(2)}`);

                    // 如果总体相似度高，则认为是同一场比赛同一局
                    if (totalSimilarity > 0.7) {
                        matchBetCounts[pageMatchId] = tempMatchBetCounts[recordMatchId];
                        debugLog(`匹配成功: 投注记录ID ${recordMatchId} 匹配到页面比赛ID ${pageMatchId}, 下注次数: ${matchBetCounts[pageMatchId]}`);
                        matched = true;
                        break;
                    }
                }

                // 如果没有匹配到，仍然保留投注记录中的计数
                if (!matched) {
                    matchBetCounts[recordMatchId] = tempMatchBetCounts[recordMatchId];
                    debugLog(`未匹配: 保留投注记录ID ${recordMatchId} 的计数`);
                }
            }

            // 尝试从本地存储加载之前保存的下注记录
            try {
                const savedBetCounts = localStorage.getItem('matchBetCounts');
                if (savedBetCounts) {
                    const savedCounts = JSON.parse(savedBetCounts);
                    // 合并保存的记录和当前记录
                    for (const matchId in savedCounts) {
                        if (!matchBetCounts[matchId]) {
                            matchBetCounts[matchId] = savedCounts[matchId];
                            debugLog(`从本地存储加载比赛ID ${matchId} 的下注记录: ${matchBetCounts[matchId]}`);
                        }
                    }
                }
            } catch (error) {
                debugLog('加载本地存储的下注记录失败: ' + error.message);
            }

            // 计算文本相似度的辅助函数
            function textSimilarity(text1, text2) {
                // 简化为小写并移除空格
                const a = text1.toLowerCase().replace(/\s+/g, '');
                const b = text2.toLowerCase().replace(/\s+/g, '');

                // 如果一个包含另一个，返回高相似度
                if (a.includes(b) || b.includes(a)) {
                    return 0.9;
                }

                // 计算编辑距离
                const matrix = [];
                for (let i = 0; i <= a.length; i++) {
                    matrix[i] = [i];
                }
                for (let j = 0; j <= b.length; j++) {
                    matrix[0][j] = j;
                }

                for (let i = 1; i <= a.length; i++) {
                    for (let j = 1; j <= b.length; j++) {
                        const cost = a[i-1] === b[j-1] ? 0 : 1;
                        matrix[i][j] = Math.min(
                            matrix[i-1][j] + 1,      // 删除
                            matrix[i][j-1] + 1,      // 插入
                            matrix[i-1][j-1] + cost  // 替换
                        );
                    }
                }

                // 计算相似度 (0-1之间，1表示完全相同)
                const maxLength = Math.max(a.length, b.length);
                if (maxLength === 0) return 1.0; // 两个空字符串
                return 1.0 - matrix[a.length][b.length] / maxLength;
            }

            // 更新下注计数显示
            updateBetCountsDisplay();
            debugLog('投注记录分析完成，已更新下注计数');

            // 关闭投注记录面板（如果有关闭按钮）
            const closeBtn = document.querySelector('[class*="close"], [class*="back"], [class*="return"]');
            if (closeBtn) {
                closeBtn.click();
            }

            return true;
        } catch (error) {
            debugLog(`分析投注记录时出错: ${error.message}`);
            return false;
        }
    }

    // 主函数
    async function main() {
        await waitForPageLoad();

        // 创建控制面板
        const panel = createControlPanel();

        // 根据保存的面板状态设置初始状态（确保面板始终可见，即使之前被隐藏）
        const panelState = GM_getValue('panelState', 'expanded');
        if (panelState === 'minimized') {
            panel.classList.add('minimized');
        } else {
            // 确保面板始终可见，即使之前的状态是'hidden'
            panel.classList.remove('minimized');
            panel.style.display = 'block';
            GM_setValue('panelState', 'expanded');
        }

        // 尝试从本地存储加载之前保存的下注记录
        try {
            const savedBetCounts = localStorage.getItem('matchBetCounts');
            if (savedBetCounts) {
                const savedCounts = JSON.parse(savedBetCounts);
                // 合并保存的记录和当前记录
                for (const matchId in savedCounts) {
                    matchBetCounts[matchId] = savedCounts[matchId];
                    debugLog(`初始化时从本地存储加载比赛ID ${matchId} 的下注记录: ${matchBetCounts[matchId]}`);
                }
                // 更新下注计数显示
                updateBetCountsDisplay();

                // 在控制面板中显示提示
                const statusElement = document.getElementById('autoBetStatus');
                if (statusElement) {
                    statusElement.textContent = '已从本地存储加载下注记录';
                    statusElement.style.color = 'green';
                    setTimeout(() => {
                        statusElement.textContent = '准备就绪';
                        statusElement.style.color = '';
                    }, 3000);
                }
            }
        } catch (error) {
            debugLog('初始化时加载本地存储的下注记录失败: ' + error.message);
        }

        // 分析投注记录，获取已下注的比赛次数
        await analyzeBetHistory();

        // 初始化比赛列表卡片并自动显示比赛标签页
        if (typeof updateMatchCards === 'function') {
            // 自动切换到比赛标签页
            const matchesTab = document.querySelector('.auto-bet-panel-tab[data-tab="matches"]');
            if (matchesTab) {
                matchesTab.click(); // 模拟点击比赛标签页
            }

            // 立即更新比赛列表
            updateMatchCards();

            // 设置定时更新比赛列表卡片，增加刷新频率
            setInterval(() => {
                updateMatchCards();
                debugLog('自动刷新比赛列表和统计数据');
                // 更新状态指示器，但使用淡入淡出效果
                const statusElement = document.getElementById('bet-status');
                if (statusElement) {
                    statusElement.style.opacity = '0.5';
                    statusElement.textContent = '自动刷新比赛数据...';
                    setTimeout(() => {
                        statusElement.style.opacity = '1';
                        statusElement.textContent = '准备就绪';
                    }, 1500);
                }
            }, 8000); // 每8秒更新一次，提高刷新频率
        } else {
            console.error('[自动下注] 错误: updateMatchCards函数未定义');
        }

        // 绑定按钮事件
        document.getElementById('start-auto-bet').addEventListener('click', startAutoBet);
        document.getElementById('stop-auto-bet').addEventListener('click', stopAutoBet);
        document.getElementById('place-single-bet').addEventListener('click', placeSingleBet);
        document.getElementById('reset-bet-counts').addEventListener('click', resetBetCounts);
        document.getElementById('refresh-bet-history').addEventListener('click', async () => {
            updateStatus('正在刷新投注记录...');
            const result = await analyzeBetHistory();
            updateStatus(result ? '投注记录刷新成功' : '投注记录刷新失败');
        });

        // 移除手动刷新功能，因为已经实现自动刷新

        // 添加快捷键
        document.addEventListener('keydown', (e) => {
            // Alt+B 最小化/展开面板（修改后不再完全隐藏面板）
            if (e.altKey && e.key === 'b') {
                if (panel.style.display !== 'none') {
                    panel.classList.toggle('minimized');
                    GM_setValue('panelState', panel.classList.contains('minimized') ? 'minimized' : 'expanded');
                }
            }
            // Alt+S 开始/停止自动下注
            if (e.altKey && e.key === 's') {
                if (autoBetInterval) {
                    stopAutoBet();
                } else {
                    startAutoBet();
                }
            }
            // Alt+M 最小化/展开面板
            if (e.altKey && e.key === 'm') {
                if (panel.style.display !== 'none') {
                    panel.classList.toggle('minimized');
                    GM_setValue('panelState', panel.classList.contains('minimized') ? 'minimized' : 'expanded');
                }
            }
        });

        updateStatus('脚本已加载，按Alt+B最小化/展开面板');
    }

    // 启动脚本
    main().catch(err => {
        console.error('[自动下注] 错误:', err);
        updateStatus(`错误: ${err.message}`);
    });

})();
