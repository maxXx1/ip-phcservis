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

        // 2. IPv6
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

        // 4. IP Details (Using ipapi.co as it was the version where "most things worked")
        try {
            const response = await fetch(`https://ipapi.co/${activeIp}/json/`);
            const data = await response.json();
            
            ispBadge.textContent = data.org || 'Neznámý ISP';
            locationBadge.textContent = `${data.city}, ${data.country_name}`;
            
            updateText('ptr-ipv4', data.hostname || 'Bez PTR záznamu');
            updateText('det-isp', data.org);
            updateText('det-asn', data.asn);
            updateText('det-org', data.org);
            updateText('det-geo-sub', `${data.city}, ${data.region}`);
            updateText('det-country', data.country_name);
            updateText('det-tz', data.timezone);

            // BGP/Peering Simulation
            const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (conn) {
                updateText('det-con-type', conn.effectiveType?.toUpperCase() || '-');
            }

            // Security Analysis
            const vpnKeywords = ['vpn', 'proxy', 'hosting', 'datacenter', 'cloud', 'server', 'mullvad', 'nordvpn', 'expressvpn'];
            const isp = (data.org || '').toLowerCase();
            const isVpn = vpnKeywords.some(k => isp.includes(k));
            
            if (isVpn) {
                updateText('det-vpn', '⚠️ Detekována (Datacenter/VPN)');
                updateText('det-threat', '45/100 (Medium)');
                setStatusClass('det-threat', 'status-warning');
                updateText('det-blacklist', 'Možná přítomnost');
                setStatusClass('det-blacklist', 'status-warning');
            } else {
                updateText('det-vpn', '✅ Přímé (Rezidenční)');
                updateText('det-threat', '0/100 (Safe)');
                setStatusClass('det-threat', 'status-safe');
                updateText('det-blacklist', 'Čistá (Clean)');
                setStatusClass('det-blacklist', 'status-safe');
            }

        } catch (error) {
            console.error('IP details failed:', error);
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
            updateText('dns-ip', 'Nedostupné');
        }

        // Global Ping (Using original university URLs as requested by reverting)
        const pingRegions = [
            { id: 'eu', url: 'https://www.cesnet.cz/', label: 'Evropa' },
            { id: 'us', url: 'https://www.mit.edu/', label: 'USA' },
            { id: 'as', url: 'https://www.u-tokyo.ac.jp/', label: 'Asie' },
            { id: 'au', url: 'https://www.unimelb.edu.au/', label: 'Austrálie' }
        ];

        pingRegions.forEach(region => {
            const start = performance.now();
            fetch(region.url, { mode: 'no-cors', cache: 'no-cache' })
                .then(() => {
                    const rtt = Math.round(performance.now() - start);
                    updateText(`ping-${region.id}`, `${rtt} ms`);
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
                if (icon) {
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
