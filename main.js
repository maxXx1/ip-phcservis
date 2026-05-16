import './style.css';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // --- Selectors ---
    const ipv4Display = document.getElementById('ipv4-display');
    const ipv6Display = document.getElementById('ipv6-display');
    const ispBadge = document.getElementById('isp-badge');
    const locationBadge = document.getElementById('location-badge');
    const yearSpan = document.getElementById('year');
    
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    // --- Core Network Detection ---
    async function detectNetwork() {
        let activeIp = '';
        
        // 1. IPv4
        try {
            const v4res = await fetch('https://api.ipify.org?format=json');
            const v4data = await v4res.json();
            ipv4Display.textContent = v4data.ip;
            activeIp = v4data.ip;
        } catch (e) {
            ipv4Display.textContent = 'Není k dispozici';
        }

        // 2. IPv6
        try {
            const v6res = await fetch('https://api6.ipify.org?format=json');
            const v6data = await v6res.json();
            ipv6Display.textContent = v6data.ip;
            if (!activeIp) activeIp = v6data.ip;
        } catch (e) {
            ipv6Display.textContent = 'Není k dispozici';
        }

        // 3. Simple Metadata (Cloudflare - most compatible for prod)
        try {
            const traceRes = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
            const traceText = await traceRes.text();
            const traceData = Object.fromEntries(traceText.trim().split('\n').map(l => l.split('=')));
            
            ispBadge.textContent = 'Načteno přes Cloudflare';
            locationBadge.textContent = `Region: ${traceData.loc || 'Neznámý'}`;
            
            updateText('det-isp', 'Cloudflare Proxy / Direct');
            updateText('det-asn', traceData.as || '-');
            updateText('det-country', traceData.loc || '-');
            
            // IPv6 Diagnostic
            const hasV6 = ipv6Display.textContent.includes(':') || (traceData.ip && traceData.ip.includes(':'));
            updateText('det-ipv6', hasV6 ? '✅ Aktivní' : '❌ Pouze IPv4');
            updateText('det-protocol', traceData.http || 'HTTP/2');
            
        } catch (e) {
            console.error('Metadata failed');
        }
    }

    // --- Clipboard ---
    const setupClipboard = (btnId, displayId) => {
        document.getElementById(btnId)?.addEventListener('click', () => {
            const text = document.getElementById(displayId)?.textContent;
            if (text && !text.includes('Zjišťování') && !text.includes('Není')) {
                navigator.clipboard.writeText(text);
                const btn = document.getElementById(btnId);
                const icon = btn.querySelector('i');
                if (icon && window.lucide) {
                    icon.setAttribute('data-lucide', 'check');
                    window.lucide.createIcons();
                    setTimeout(() => {
                        icon.setAttribute('data-lucide', 'copy');
                        window.lucide.createIcons();
                    }, 2000);
                }
            }
        });
    };

    setupClipboard('copy-ipv4', 'ipv4-display');
    setupClipboard('copy-ipv6', 'ipv6-display');

    // --- Launch ---
    detectNetwork();

    // Tech tags
    const tagsContainer = document.getElementById('tech-tags');
    if (tagsContainer) {
        const caps = [
            { name: 'Cookies', val: navigator.cookieEnabled },
            { name: 'LocalStorage', val: !!window.localStorage },
            { name: 'ServiceWorker', val: 'serviceWorker' in navigator },
            { name: 'WebGL', val: !!window.WebGLRenderingContext }
        ];
        caps.forEach(cap => {
            const span = document.createElement('span');
            span.className = `tag ${cap.val ? 'enabled' : ''}`;
            span.textContent = `${cap.name}: ${cap.val ? 'ANO' : 'NE'}`;
            tagsContainer.appendChild(span);
        });
    }
});
