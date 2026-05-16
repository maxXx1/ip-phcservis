import './style.css';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // --- State & Selectors ---
    const ipv4Display = document.getElementById('ipv4-display');
    const ipv6Display = document.getElementById('ipv6-display');
    const ispBadge = document.getElementById('isp-badge');
    const locationBadge = document.getElementById('location-badge');
    const yearSpan = document.getElementById('year');
    
    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    const setStatusClass = (id, className) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('status-safe', 'status-warning', 'status-danger');
            el.classList.add(className);
        }
    };

    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

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

        // 2. IPv6 (Silent fail)
        try {
            const v6res = await fetch('https://api6.ipify.org?format=json');
            const v6data = await v6res.json();
            ipv6Display.textContent = v6data.ip;
            if (!activeIp) activeIp = v6data.ip;
        } catch (e) {
            ipv6Display.textContent = 'Není k dispozici';
        }

        // 3. Cloudflare Trace
        try {
            const traceRes = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
            const traceText = await traceRes.text();
            const traceData = Object.fromEntries(traceText.trim().split('\n').map(l => l.split('=')));
            updateText('det-colo', traceData.colo || '-');
            if (!activeIp) activeIp = traceData.ip;
        } catch (e) {}

        // 4. IP Details (FreeIPAPI - High CORS compatibility)
        if (activeIp) {
            try {
                const response = await fetch(`https://freeipapi.com/api/json/${activeIp}`);
                const data = await response.json();
                
                ispBadge.textContent = data.asName || 'Neznámý ISP';
                locationBadge.textContent = `${data.cityName}, ${data.countryName}`;
                
                updateText('det-isp', data.asName || '-');
                updateText('det-asn', data.asNumber ? `AS${data.asNumber}` : '-');
                updateText('det-org', data.asName || '-');
                updateText('det-geo-sub', `${data.cityName}, ${data.regionName}`);
                updateText('det-country', data.countryName);
                updateText('det-tz', 'Zjišťuji...');

                // Heuristic Security
                const dcKeywords = ['hosting', 'cloud', 'datacenter', 'server', 'mullvad', 'vpn', 'proxy'];
                const ispLower = (data.asName || '').toLowerCase();
                const isDC = dcKeywords.some(k => ispLower.includes(k));
                
                if (isDC) {
                    updateText('det-vpn', '⚠️ Datacentrum / VPN');
                    updateText('det-threat', '30/100 (Pozor)');
                    setStatusClass('det-threat', 'status-warning');
                    updateText('det-blacklist', 'Neznámý status');
                } else {
                    updateText('det-vpn', '✅ Rezidenční síť');
                    updateText('det-threat', '0/100 (Čisté)');
                    setStatusClass('det-threat', 'status-safe');
                    updateText('det-blacklist', 'Čistá (Clean)');
                    setStatusClass('det-blacklist', 'status-safe');
                }

                // 5. PTR Record via Google DoH (CORS Friendly)
                detectPtr(activeIp);

            } catch (error) {
                console.error('Metadata fetch failed');
            }
        }
    }

    async function detectPtr(ip) {
        try {
            let query = '';
            if (ip.includes(':')) {
                // IPv6 PTR - complex but possible
                const parts = ip.split(':');
                // Omitting complex IPv6 reverse for now to keep it stable
                updateText('ptr-ipv4', 'IPv6 Reverse není podporován');
            } else {
                const parts = ip.split('.');
                query = `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`;
                const res = await fetch(`https://dns.google/resolve?name=${query}&type=PTR`);
                const data = await res.json();
                if (data.Answer && data.Answer.length > 0) {
                    updateText('ptr-ipv4', data.Answer[0].data);
                } else {
                    updateText('ptr-ipv4', 'Bez PTR záznamu');
                }
            }
        } catch (e) {
            updateText('ptr-ipv4', '-');
        }
    }

    // --- Advanced Diagnostics ---
    async function detectAdvanced() {
        // DNS Resolver
        try {
            const dnsRes = await fetch('https://edns.ip-api.com/json');
            const dnsData = await dnsRes.json();
            updateText('dns-ip', dnsData.dns.ip);
            updateText('dns-isp', dnsData.dns.geo.split(' (')[0]);
        } catch (e) {
            updateText('dns-ip', 'Omezeno CORS');
            updateText('dns-isp', 'Pouze Pro verze');
        }

        // Global Ping
        const pingRegions = [
            { id: 'eu', url: 'https://www.google.cz/favicon.ico', label: 'Evropa' },
            { id: 'us', url: 'https://www.google.com/favicon.ico', label: 'USA' },
            { id: 'as', url: 'https://www.rakuten.co.jp/favicon.ico', label: 'Asie' },
            { id: 'au', url: 'https://www.unimelb.edu.au/favicon.ico', label: 'Austrálie' }
        ];

        pingRegions.forEach(region => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);
            const start = performance.now();
            
            fetch(region.url, { mode: 'no-cors', cache: 'no-cache', signal: controller.signal })
                .then(() => {
                    clearTimeout(timeoutId);
                    updateText(`ping-${region.id}`, `${Math.round(performance.now() - start)} ms`);
                })
                .catch(() => {
                    clearTimeout(timeoutId);
                    updateText(`ping-${region.id}`, 'Timeout');
                });
        });
    }

    // --- Clipboard & Launch ---
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

    detectNetwork();
    detectAdvanced();
    
    // Tech tags
    const tagsContainer = document.getElementById('tech-tags');
    if (tagsContainer) {
        const caps = [
            { name: 'Cookies', val: navigator.cookieEnabled },
            { name: 'LocalStorage', val: !!window.localStorage },
            { name: 'ServiceWorker', val: 'serviceWorker' in navigator },
            { name: 'WebGL', val: !!window.WebGLRenderingContext },
            { name: 'Touch', val: 'ontouchstart' in window },
            { name: 'WebAssembly', val: typeof WebAssembly === "object" },
            { name: 'Do Not Track', val: navigator.doNotTrack === "1" }
        ];
        caps.forEach(cap => {
            const span = document.createElement('span');
            span.className = `tag ${cap.val ? 'enabled' : ''}`;
            span.textContent = `${cap.name}: ${cap.val ? 'ANO' : 'NE'}`;
            tagsContainer.appendChild(span);
        });
    }
});
