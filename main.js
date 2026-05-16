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
        // 1. IPv4 (ipify)
        try {
            const v4res = await fetch('https://api.ipify.org?format=json');
            const v4data = await v4res.json();
            ipv4Display.textContent = v4data.ip;
        } catch (e) {
            ipv4Display.textContent = 'Není k dispozici';
        }

        // 2. IPv6 (ipify)
        try {
            const v6res = await fetch('https://api6.ipify.org?format=json');
            const v6data = await v6res.json();
            ipv6Display.textContent = v6data.ip;
        } catch (e) {
            ipv6Display.textContent = 'Není k dispozici';
        }

        // 3. Metadata (FreeIPAPI - Highly CORS compatible)
        try {
            // We call without IP to let the server detect the client IP
            const response = await fetch('https://freeipapi.com/api/json/');
            const data = await response.json();
            
            ispBadge.textContent = data.asName || 'Neznámý ISP';
            locationBadge.textContent = `${data.cityName}, ${data.countryName}`;
            
            updateText('det-isp', data.asName || '-');
            updateText('det-asn', data.asNumber ? `AS${data.asNumber}` : '-');
            updateText('det-org', data.asName || '-');
            updateText('det-geo-sub', `${data.cityName}, ${data.regionName}`);
            updateText('det-country', data.countryName);
            updateText('det-tz', data.timeZone || '-');
            
            // Connection Type
            const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (conn) {
                updateText('det-con-type', conn.effectiveType?.toUpperCase() || '-');
            }

            // Security Analysis
            if (data.isProxy) {
                updateText('det-vpn', '⚠️ Detekována (Proxy/VPN)');
                updateText('det-threat', '50/100 (Medium)');
                setStatusClass('det-threat', 'status-warning');
            } else {
                updateText('det-vpn', '✅ Přímé (Rezidenční)');
                updateText('det-threat', '0/100 (Čisté)');
                setStatusClass('det-threat', 'status-safe');
                updateText('det-blacklist', 'Čistá (Clean)');
                setStatusClass('det-blacklist', 'status-safe');
            }

            // Cloudflare Trace (for Edge info)
            const traceRes = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
            const traceText = await traceRes.text();
            const traceData = Object.fromEntries(traceText.trim().split('\n').map(l => l.split('=')));
            updateText('det-colo', traceData.colo || '-');
            updateText('det-protocol', traceData.http || 'HTTP/2');
            
            // IPv6 Diagnostic
            const hasV6 = ipv6Display.textContent.includes(':') || (traceData.ip && traceData.ip.includes(':'));
            updateText('det-ipv6', hasV6 ? '✅ Aktivní' : '❌ Pouze IPv4');

        } catch (error) {
            console.error('Metadata fetch failed:', error);
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
            updateText('dns-ip', 'Zjišťování...');
            updateText('dns-isp', '-');
        }

        // Global Ping (Stable targets)
        const pingRegions = [
            { id: 'eu', url: 'https://www.google.cz/favicon.ico', label: 'Evropa' },
            { id: 'us', url: 'https://www.google.com/favicon.ico', label: 'USA' },
            { id: 'as', url: 'https://www.u-tokyo.ac.jp/favicon.ico', label: 'Asie' },
            { id: 'au', url: 'https://www.unimelb.edu.au/favicon.ico', label: 'Austrálie' }
        ];

        pingRegions.forEach(region => {
            const start = performance.now();
            fetch(region.url, { mode: 'no-cors', cache: 'no-cache' })
                .then(() => {
                    updateText(`ping-${region.id}`, `${Math.round(performance.now() - start)} ms`);
                })
                .catch(() => {
                    updateText(`ping-${region.id}`, 'Timeout');
                });
        });
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
    detectAdvanced();

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
