// ==UserScript==
// @name         网站全文本与DOM元素采集器
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  通过拖动选择DOM元素并复制元素信息，或一键采集网站所有文本和DOM元素
// @author       You
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @grant        GM_saveTab
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(`
        .dom-collector-highlight {
            outline: 2px dashed #ff5722 !important;
            outline-offset: 1px !important;
            background-color: rgba(255, 87, 34, 0.1) !important;
            cursor: pointer !important;
            position: relative;
            z-index: 9999 !important;
        }

        .dom-collector-tooltip {
            position: fixed;
            background: #333;
            color: #fff;
            padding: 5px 10px;
            border-radius: 3px;
            font-size: 12px;
            z-index: 10000;
            pointer-events: none;
            max-width: 300px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }

        .dom-collector-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ff5722;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 14px;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }

        .dom-collector-button:hover {
            background: #e64a19;
        }

        .dom-collector-fullsite-button {
            position: fixed;
            bottom: 20px;
            right: 150px;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 14px;
            cursor: pointer;
            z-index: 10000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }

        .dom-collector-fullsite-button:hover {
            background: #1976D2;
        }

        .dom-collector-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            opacity: 0;
            transition: opacity 0.3s;
        }

        .dom-collector-progress {
            position: fixed;
            top: 60px;
            right: 20px;
            background: #333;
            color: white;
            padding: 10px 15px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            display: none;
        }

        .dom-collector-progress-bar {
            width: 100%;
            height: 10px;
            background-color: #555;
            border-radius: 5px;
            margin-top: 5px;
        }

        .dom-collector-progress-bar-fill {
            height: 100%;
            background-color: #4CAF50;
            border-radius: 5px;
            width: 0%;
            transition: width 0.3s;
        }
    `);

    // 状态变量
    let isActive = false;
    let isCollectingFullSite = false;
    let currentElement = null;
    let tooltip = null;
    let notification = null;
    let progressBar = null;
    let websiteData = {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        allText: '',
        elements: []
    };

    // 创建控制按钮
    const button = document.createElement('button');
    button.className = 'dom-collector-button';
    button.textContent = '启动元素采集器';
    document.body.appendChild(button);

    // 创建全站采集按钮
    const fullSiteButton = document.createElement('button');
    fullSiteButton.className = 'dom-collector-fullsite-button';
    fullSiteButton.textContent = '采集全站信息';
    document.body.appendChild(fullSiteButton);

    // 创建提示工具
    function createTooltip() {
        tooltip = document.createElement('div');
        tooltip.className = 'dom-collector-tooltip';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);
    }

    // 创建通知元素
    function createNotification() {
        notification = document.createElement('div');
        notification.className = 'dom-collector-notification';
        document.body.appendChild(notification);
    }

    // 创建进度条
    function createProgressBar() {
        progressBar = document.createElement('div');
        progressBar.className = 'dom-collector-progress';
        progressBar.innerHTML = `
            <div>正在采集网站信息...</div>
            <div class="dom-collector-progress-bar">
                <div class="dom-collector-progress-bar-fill"></div>
            </div>
        `;
        document.body.appendChild(progressBar);
    }

    // 显示通知
    function showNotification(message) {
        if (!notification) createNotification();
        notification.textContent = message;
        notification.style.opacity = '1';
        setTimeout(() => {
            notification.style.opacity = '0';
        }, 2000);
    }

    // 获取元素的XPath
    function getXPath(element) {
        if (!element) return '';
        if (element === document.body) return '/html/body';

        let path = '';
        let current = element;
        while (current && current !== document.body) {
            let index = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
                if (sibling.nodeName === current.nodeName) {
                    index++;
                }
                sibling = sibling.previousElementSibling;
            }

            const nodeName = current.nodeName.toLowerCase();
            const pathSegment = nodeName + (index > 1 ? '[' + index + ']' : '');
            path = '/' + pathSegment + path;
            current = current.parentElement;
        }

        return '/html/body' + path;
    }

    // 获取元素的CSS选择器
    function getCssSelector(element) {
        if (!element) return '';
        if (element === document.body) return 'body';

        // 尝试使用ID
        if (element.id) {
            return '#' + element.id;
        }

        // 尝试使用类名
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.trim().split(/\s+/);
            if (classes.length > 0) {
                const selector = '.' + classes.join('.');
                // 验证选择器是否唯一
                if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }
        }

        // 使用标签名和位置
        const parent = element.parentElement;
        if (!parent) return element.tagName.toLowerCase();

        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(element) + 1;

        return getCssSelector(parent) + ' > ' + element.tagName.toLowerCase() + ':nth-child(' + index + ')';
    }

    // 获取元素信息
    function getElementInfo(element) {
        if (!element) return {};

        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);

        return {
            tagName: element.tagName.toLowerCase(),
            id: element.id || null,
            className: element.className || null,
            text: element.textContent.trim().substring(0, 100) + (element.textContent.length > 100 ? '...' : ''),
            innerText: element.innerText || null,
            textContent: element.textContent || null,
            attributes: Array.from(element.attributes).map(attr => ({ name: attr.name, value: attr.value })),
            xpath: getXPath(element),
            cssSelector: getCssSelector(element),
            dimensions: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                top: Math.round(rect.top + window.scrollY),
                left: Math.round(rect.left + window.scrollX)
            },
            styles: {
                color: computedStyle.color,
                backgroundColor: computedStyle.backgroundColor,
                fontSize: computedStyle.fontSize,
                fontWeight: computedStyle.fontWeight,
                display: computedStyle.display,
                position: computedStyle.position,
                visibility: computedStyle.visibility
            },
            isVisible: isElementVisible(element)
        };
    }

    // 检查元素是否可见
    function isElementVisible(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0' &&
               element.offsetWidth > 0 &&
               element.offsetHeight > 0;
    }

    // 更新提示工具位置和内容
    function updateTooltip(event, element) {
        if (!tooltip) createTooltip();

        const info = getElementInfo(element);
        tooltip.innerHTML = `
            <strong>${info.tagName}</strong>
            ${info.id ? `#${info.id}` : ''}
            ${info.className ? `.${info.className.replace(/\s+/g, '.')}` : ''}
            <br>
            <small>点击复制元素信息</small>
        `;

        tooltip.style.display = 'block';
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY + 10) + 'px';
    }

    // 复制元素信息到剪贴板
    function copyElementInfo(element) {
        const info = getElementInfo(element);
        const jsonStr = JSON.stringify(info, null, 2);
        GM_setClipboard(jsonStr, 'text');
        showNotification('元素信息已复制到剪贴板');
    }

    // 鼠标移动事件处理
    function handleMouseMove(event) {
        if (!isActive) return;

        // 忽略工具本身的元素
        if (event.target === button || event.target === tooltip || event.target === notification) {
            if (currentElement) {
                currentElement.classList.remove('dom-collector-highlight');
                currentElement = null;
            }
            if (tooltip) tooltip.style.display = 'none';
            return;
        }

        if (currentElement !== event.target) {
            if (currentElement) {
                currentElement.classList.remove('dom-collector-highlight');
            }

            currentElement = event.target;
            currentElement.classList.add('dom-collector-highlight');
            updateTooltip(event, currentElement);
        } else {
            updateTooltip(event, currentElement);
        }
    }

    // 鼠标点击事件处理
    function handleMouseClick(event) {
        if (!isActive) return;

        // 忽略工具本身的元素
        if (event.target === button || event.target === tooltip || event.target === notification) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        copyElementInfo(event.target);
    }

    // 切换采集器状态
    function toggleCollector() {
        isActive = !isActive;
        button.textContent = isActive ? '停止元素采集器' : '启动元素采集器';
        button.style.background = isActive ? '#4CAF50' : '#ff5722';

        if (isActive) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('click', handleMouseClick, true);
            showNotification('元素采集器已启动，移动鼠标选择元素，点击复制元素信息');
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('click', handleMouseClick, true);

            if (currentElement) {
                currentElement.classList.remove('dom-collector-highlight');
                currentElement = null;
            }

            if (tooltip) tooltip.style.display = 'none';
            showNotification('元素采集器已停止');
        }
    }

    // 采集全站信息
    function collectFullSiteInfo() {
        if (isCollectingFullSite) return;

        isCollectingFullSite = true;
        if (!progressBar) createProgressBar();
        progressBar.style.display = 'block';

        // 重置数据
        websiteData = {
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString(),
            allText: document.body.innerText,
            elements: [],
            meta: {
                metaTags: Array.from(document.querySelectorAll('meta')).map(meta => ({
                    name: meta.getAttribute('name') || meta.getAttribute('property') || null,
                    content: meta.getAttribute('content') || null
                })),
                links: Array.from(document.querySelectorAll('link')).map(link => ({
                    rel: link.getAttribute('rel') || null,
                    href: link.getAttribute('href') || null
                })),
                scripts: Array.from(document.querySelectorAll('script')).map(script => ({
                    src: script.getAttribute('src') || null,
                    type: script.getAttribute('type') || null
                }))
            }
        };

        // 开始递归采集
        setTimeout(() => {
            const totalElements = document.querySelectorAll('*').length;
            let processedElements = 0;

            function updateProgress() {
                const percentage = Math.min(Math.round((processedElements / totalElements) * 100), 100);
                const progressFill = progressBar.querySelector('.dom-collector-progress-bar-fill');
                progressFill.style.width = percentage + '%';
                progressBar.querySelector('div:first-child').textContent = `正在采集网站信息... ${percentage}%`;
            }

            function processElement(element, depth = 0) {
                // 跳过我们自己添加的UI元素
                if (element.classList && (
                    element.classList.contains('dom-collector-button') ||
                    element.classList.contains('dom-collector-fullsite-button') ||
                    element.classList.contains('dom-collector-tooltip') ||
                    element.classList.contains('dom-collector-notification') ||
                    element.classList.contains('dom-collector-progress')
                )) {
                    return;
                }

                // 跳过不可见元素
                if (!isElementVisible(element)) {
                    return;
                }

                // 获取元素信息并添加到数据中
                const info = getElementInfo(element);
                info.depth = depth;
                websiteData.elements.push(info);

                // 处理子元素
                Array.from(element.children).forEach(child => {
                    processElement(child, depth + 1);
                });

                processedElements++;
                if (processedElements % 100 === 0) {
                    updateProgress();
                }
            }

            // 从body开始处理
            processElement(document.body);
            updateProgress();

            // 完成采集
            setTimeout(() => {
                // 提取所有文本内容
                const textNodes = [];
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    { acceptNode: node => node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT },
                    false
                );

                while (walker.nextNode()) {
                    const node = walker.currentNode;
                    if (node.nodeValue.trim()) {
                        textNodes.push({
                            text: node.nodeValue.trim(),
                            xpath: getXPath(node.parentElement),
                            parentTag: node.parentElement ? node.parentElement.tagName.toLowerCase() : null
                        });
                    }
                }

                websiteData.textNodes = textNodes;

                // 导出数据
                const jsonStr = JSON.stringify(websiteData, null, 2);
                GM_setClipboard(jsonStr, 'text');

                // 尝试下载文件
                try {
                    const blob = new Blob([jsonStr], {type: 'application/json'});
                    const url = URL.createObjectURL(blob);
                    const filename = document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_data.json';

                    const downloadLink = document.createElement('a');
                    downloadLink.href = url;
                    downloadLink.download = filename;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                } catch (e) {
                    console.error('下载文件失败:', e);
                }

                progressBar.style.display = 'none';
                isCollectingFullSite = false;
                showNotification('网站信息采集完成，数据已复制到剪贴板');
            }, 500);
        }, 100);
    }

    // 初始化
    function init() {
        createTooltip();
        createNotification();
        createProgressBar();
        button.addEventListener('click', toggleCollector);
        fullSiteButton.addEventListener('click', collectFullSiteInfo);
    }

    // 启动脚本
    init();
})();
