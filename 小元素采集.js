// ==UserScript==
// @name         DOM元素采集器
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  点击页面元素即可复制该元素
// @author       AI助手
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(`
        #element-picker-panel {
            position: fixed;
            top: 10px;
            right: 10px;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 10px;
            z-index: 9999;
            box-shadow: 0 0 10px rgba(0,0,0,0.2);
            font-family: Arial, sans-serif;
            min-width: 200px;
        }
        #element-picker-panel button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 5px 10px;
            margin: 5px;
            border-radius: 3px;
            cursor: pointer;
        }
        #element-picker-panel button:hover {
            background: #45a049;
        }
        #element-picker-panel button.stop {
            background: #f44336;
        }
        #element-picker-panel button.stop:hover {
            background: #d32f2f;
        }
        .element-picker-highlight {
            outline: 2px dashed #f00 !important;
            outline-offset: 1px !important;
        }
        #copy-options {
            margin-top: 10px;
        }
        #copy-options label {
            display: block;
            margin: 5px 0;
        }
        #status-message {
            margin-top: 10px;
            padding: 5px;
            border-radius: 3px;
            font-size: 12px;
        }
        .success {
            background-color: #dff0d8;
            color: #3c763d;
        }
        .info {
            background-color: #d9edf7;
            color: #31708f;
        }
    `);

    // 创建控制面板
    const panel = document.createElement('div');
    panel.id = 'element-picker-panel';
    panel.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 10px;">DOM元素采集器</h3>
        <button id="start-picker">开始采集</button>
        <button id="stop-picker" class="stop" style="display: none;">停止采集</button>
        <div id="copy-options">
            <label><input type="radio" name="copy-type" value="outerHTML" checked> 复制完整元素</label>
            <label><input type="radio" name="copy-type" value="innerHTML"> 复制内部HTML</label>
            <label><input type="radio" name="copy-type" value="textContent"> 仅复制文本</label>
            <label><input type="radio" name="copy-type" value="selector"> 复制CSS选择器</label>
        </div>
        <div id="status-message"></div>
    `;
    document.body.appendChild(panel);

    // 获取DOM元素
    const startButton = document.getElementById('start-picker');
    const stopButton = document.getElementById('stop-picker');
    const statusMessage = document.getElementById('status-message');

    // 当前高亮的元素
    let currentHighlightedElement = null;
    // 是否处于采集模式
    let isPickerActive = false;

    // 开始采集
    startButton.addEventListener('click', function() {
        isPickerActive = true;
        startButton.style.display = 'none';
        stopButton.style.display = 'inline-block';
        statusMessage.textContent = '采集模式已开启，点击页面元素即可复制';
        statusMessage.className = 'info';
    });

    // 停止采集
    stopButton.addEventListener('click', function() {
        isPickerActive = false;
        startButton.style.display = 'inline-block';
        stopButton.style.display = 'none';
        removeHighlight();
        statusMessage.textContent = '采集模式已关闭';
        statusMessage.className = '';
    });

    // 移除高亮
    function removeHighlight() {
        if (currentHighlightedElement) {
            currentHighlightedElement.classList.remove('element-picker-highlight');
            currentHighlightedElement = null;
        }
    }

    // 获取元素的唯一CSS选择器
    function getCssSelector(element) {
        if (element.id) {
            return '#' + element.id;
        }

        if (element === document.body) {
            return 'body';
        }

        // 如果元素有类名，使用第一个类名
        if (element.classList.length > 0) {
            let selector = element.tagName.toLowerCase() + '.' + element.classList[0];

            // 检查这个选择器是否唯一
            if (document.querySelectorAll(selector).length === 1) {
                return selector;
            }
        }

        // 使用nth-child
        let siblings = Array.from(element.parentNode.children);
        let index = siblings.indexOf(element) + 1;
        let selector = element.tagName.toLowerCase() + ':nth-child(' + index + ')';

        // 递归获取父元素的选择器
        if (element.parentNode && element.parentNode !== document.documentElement) {
            return getCssSelector(element.parentNode) + ' > ' + selector;
        }

        return selector;
    }

    // 鼠标移动事件 - 高亮元素
    document.addEventListener('mousemove', function(e) {
        if (!isPickerActive) return;

        // 忽略面板内的移动
        if (panel.contains(e.target)) return;

        removeHighlight();

        // 高亮当前元素
        currentHighlightedElement = e.target;
        currentHighlightedElement.classList.add('element-picker-highlight');

        // 阻止默认行为和事件冒泡
        e.preventDefault();
        e.stopPropagation();
    }, true);

    // 点击事件 - 复制元素
    document.addEventListener('click', function(e) {
        if (!isPickerActive) return;

        // 忽略面板内的点击
        if (panel.contains(e.target)) return;

        // 获取选中的复制类型
        const copyType = document.querySelector('input[name="copy-type"]:checked').value;
        let copyContent = '';

        switch (copyType) {
            case 'outerHTML':
                copyContent = e.target.outerHTML;
                break;
            case 'innerHTML':
                copyContent = e.target.innerHTML;
                break;
            case 'textContent':
                copyContent = e.target.textContent;
                break;
            case 'selector':
                copyContent = getCssSelector(e.target);
                break;
        }

        // 复制到剪贴板
        GM_setClipboard(copyContent);

        // 显示成功消息
        statusMessage.textContent = '已复制到剪贴板！';
        statusMessage.className = 'success';

        // 3秒后恢复消息
        setTimeout(function() {
            if (isPickerActive) {
                statusMessage.textContent = '采集模式已开启，点击页面元素即可复制';
                statusMessage.className = 'info';
            }
        }, 3000);

        // 阻止默认行为和事件冒泡
        e.preventDefault();
        e.stopPropagation();
    }, true);

})();
