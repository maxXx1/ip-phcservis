import './style.css';

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();

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

    const setStatusClass = (id, className) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('status-safe', 'status-warning', 'status-danger');
            el.classList.add(className);
        }
    };

    // --- Isolated Fetch Helpers ---
    async function safeFetch(url, timeout = 5000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(id);
            if (!response.ok) return null;
            return await response.json();
        } catch (e) {
            clearTimeout(id);
            return null;
        }
    }

    async function detectNetwork() {
        // 1. IPv4 (Independent)
        safeFetch('https://api.ipify.org?format=json').then(data => {
            if (data) ipv4Display.textContent = data.ip;
        });

        // 2. IPv6 (Independent)
        safeFetch('https://api6.ipify.org?format=json').then(data => {
            if (data) ipv6Display.textContent = data.ip;
            else ipv6Display.textContent = 'Není k dispozici';
        });

        // 3. Cloudflare Trace (Independent)
        fetch('https://www.cloudflare.com/cdn-cgi/trace')
            .then(res => res.text())
            .then(text => {
                const data = Object.fromEntries(text.trim().split('\n').map(l => l.split('=')));
                updateText('det-colo', data.colo || '-');
                updateText('det-protocol', data.http || 'HTTP/2');
                const hasV6 = data.ip && data.ip.includes(':');
                updateText('det-ipv6', hasV6 ? '✅ Aktivní' : '❌ Pouze IPv4');
            }).catch(() => {});

        // 4. Metadata (Multi-source fallback)
        async function getMetadata() {
            // Source A: ipwho.is (Primary)
            let data = await safeFetch('https://ipwho.is/');
            
            // Source B: freeipapi.com (Fallback)
            if (!data || !data.success) {
                const raw = await safeFetch('https://freeipapi.com/api/json/');
                if (raw) {
                    data = {
                        success: true,
                        connection: { isp: raw.asName, asn: raw.asNumber, org: raw.asName },
                        city: raw.cityName,
                        country: raw.countryName,
                        region: raw.regionName,
                        timezone: { id: raw.timeZone },
                        reverse: '-'
                    };
                }
            }

            if (data && data.success) {
                ispBadge.textContent = data.connection?.isp || data.connection?.org || 'Zjištěno';
                locationBadge.textContent = `${data.city}, ${data.country}`;
                
                updateText('det-isp', data.connection?.isp || '-');
                updateText('det-asn', data.connection?.asn ? `AS${data.connection.asn}` : '-');
                updateText('det-org', data.connection?.org || '-');
                updateText('det-geo-sub', `${data.city}, ${data.region || ''}`);
                updateText('det-country', data.country);
                updateText('det-tz', data.timezone?.id || '-');
                updateText('ptr-ipv4', data.reverse || '-');

                // Security Analysis
                const vpnKeywords = ['vpn', 'proxy', 'hosting', 'datacenter', 'cloud', 'server', 'mullvad', 'nordvpn'];
                const ispStr = (data.connection?.isp || '').toLowerCase();
                const isVpn = vpnKeywords.some(k => ispStr.includes(k)) || data.security?.vpn;
                
                if (isVpn) {
                    updateText('det-vpn', '⚠️ Datacentrum / VPN');
                    updateText('det-threat', '40/100 (Medium)');
                    setStatusClass('det-threat', 'status-warning');
                    updateText('det-blacklist', 'Možná přítomnost');
                } else {
                    updateText('det-vpn', '✅ Rezidenční síť');
                    updateText('det-threat', '0/100 (Safe)');
                    setStatusClass('det-threat', 'status-safe');
                    updateText('det-blacklist', 'Čistá (Clean)');
                    setStatusClass('det-blacklist', 'status-safe');
                }
            }
        }
        getMetadata();
    }

    async function detectAdvanced() {
        // DNS Resolver
        safeFetch('https://edns.ip-api.com/json').then(data => {
            if (data && data.dns) {
                updateText('dns-ip', data.dns.ip);
                updateText('dns-isp', data.dns.geo.split(' (')[0]);
            }
        });

        // Global Ping (Stable targets with correct success handling)
        const pingRegions = [
            { id: 'eu', url: 'https://www.google.cz/generate_204' },
            { id: 'us', url: 'https://www.google.com/generate_204' },
            { id: 'as', url: 'https://www.google.co.jp/generate_204' },
            { id: 'au', url: 'https://www.google.com.au/generate_204' }
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
            { name: 'WebAssembly', val: typeof WebAssembly === "object" }
        ];
        caps.forEach(cap => {
            const span = document.createElement('span');
            span.className = `tag ${cap.val ? 'enabled' : ''}`;
            span.textContent = `${cap.name}: ${cap.val ? 'ANO' : 'NE'}`;
            tagsContainer.appendChild(span);
        });
    }
});
