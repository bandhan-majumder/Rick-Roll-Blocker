(function() {
    'use strict';
    
    const RICKROLL_PATTERNS = [
        'dQw4w9WgXcQ',
        'watch?v=dQw4w9WgXcQ',
        'youtube.com/watch?v=dQw4w9WgXcQ',
        'youtu.be/dQw4w9WgXcQ'
    ];
    
    let isBlocking = false;

    function isProtectionEnabled() {
        return localStorage.getItem('rickrollEnabled') !== 'false';
    }

    function updateBlockStats() {
        try {
            let count = parseInt(localStorage.getItem('rickrollBlocks') || '0', 10);
            count++;
            localStorage.setItem('rickrollBlocks', count.toString());
            localStorage.setItem('lastRickrollBlock', new Date().toISOString());
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'updateStats',
                    blockCount: count,
                    lastBlock: new Date().toISOString()
                }).catch(() => {});
            }
        } catch (error) {
            console.log('Error updating stats:', error);
        }
    }

    function containsRickRoll(url) {
        if (!url) return false;
        return RICKROLL_PATTERNS.some(pattern => 
            url.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    function redirectToBlockedPage() {
        if (isBlocking) return;
        isBlocking = true;
        updateBlockStats();
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
                window.location.href = chrome.runtime.getURL('blocked.html');
            } else {
                const blockedPageHTML = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>You Are Saved!</title>
                        <style>
                            body { font-family: sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
                            .container { max-width: 500px; margin: 0 auto; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                            h1 { color: #2c3e50; margin-bottom: 20px; }
                            p { color: #5a6c7d; margin-bottom: 20px; }
                            .btn { display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>You Are Saved!</h1>
                            <p>Our extension has successfully blocked a potential Rick Roll attempt!</p>
                            <a href="javascript:history.back()" class="btn">Go Back Safely</a>
                        </div>
                    </body>
                    </html>
                `;
                const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(blockedPageHTML);
                window.location.href = dataUrl;
            }
        } catch (error) {
            alert('Rick Roll Blocked!');
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'about:blank';
            }
        }
    }

    function checkCurrentUrl() {
        if (!isProtectionEnabled() || isBlocking) return;
        const currentUrl = window.location.href;
        if (containsRickRoll(currentUrl)) {
            redirectToBlockedPage();
        }
    }

    function initializeBlocker() {
        checkCurrentUrl();
        let lastUrl = location.href;
        const urlObserver = new MutationObserver(() => {
            const url = location.href;
            if (url !== lastUrl) {
                lastUrl = url;
                setTimeout(() => {
                    if (isProtectionEnabled() && containsRickRoll(url)) {
                        redirectToBlockedPage();
                    }
                }, 100);
            }
        });
        if (document.documentElement) {
            urlObserver.observe(document.documentElement, { subtree: true, childList: true });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                urlObserver.observe(document.documentElement, { subtree: true, childList: true });
            });
        }
        document.addEventListener('click', function(e) {
            if (!isProtectionEnabled() || isBlocking) return;
            const link = e.target.closest('a');
            if (link && link.href && containsRickRoll(link.href)) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                redirectToBlockedPage();
                return false;
            }
        }, true);
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            setTimeout(checkCurrentUrl, 10);
        };
        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            setTimeout(checkCurrentUrl, 10);
        };
        window.addEventListener('popstate', () => {
            setTimeout(checkCurrentUrl, 10);
        });
        const originalWindowOpen = window.open;
        window.open = function(url, ...args) {
            if (isProtectionEnabled() && url && containsRickRoll(url)) {
                redirectToBlockedPage();
                return null;
            }
            return originalWindowOpen.call(window, url, ...args);
        };
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'toggleProtection') {
                    setTimeout(checkCurrentUrl, 100);
                    sendResponse({success: true});
                }
                return true;
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeBlocker);
    } else {
        initializeBlocker();
    }
    setTimeout(initializeBlocker, 10);
})();
