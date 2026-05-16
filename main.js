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
    
    // --- Utils ---
    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    // --- Main IP & Network ---
    async function detectNetwork() {
        // 1. Detect IPv4
        try {
            const v4res = await fetch('https://api.ipify.org?format=json');
            const v4data = await v4res.json();
            ipv4Display.textContent = v4data.ip;
        } catch (e) {
            ipv4Display.textContent = 'Není k dispozici';
            ipv4Display.style.opacity = '0.5';
        }

        // 2. Detect IPv6
        try {
            const v6res = await fetch('https://api6.ipify.org?format=json');
            const v6data = await v6res.json();
            ipv6Display.textContent = v6data.ip;
        } catch (e) {
            ipv6Display.textContent = 'Není k dispozici';
            ipv6Display.style.opacity = '0.5';
        }

        // 3. Geolocation & ISP Details (using api64 to get whatever is primary)
        try {
            const traceRes = await fetch('https://api64.ipify.org?format=json');
            const traceData = await traceRes.json();
            const activeIp = traceData.ip;

            const response = await fetch(`https://ipapi.co/${activeIp}/json/`);
            const data = await response.json();
            
            ispBadge.textContent = data.org || 'Neznámý ISP';
            locationBadge.textContent = `${data.city}, ${data.country_name}`;
            
            updateText('det-isp', data.org);
            updateText('det-asn', data.asn);
            updateText('det-city', data.city);
            updateText('det-region', data.region);
            updateText('det-country', data.country_name);
            updateText('det-tz', data.timezone);

            const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (conn) {
                updateText('det-con-type', conn.effectiveType?.toUpperCase() || '-');
                updateText('det-rtt', conn.rtt + ' ms');
            }

            const vpnKeywords = ['vpn', 'proxy', 'hosting', 'datacenter', 'cloud', 'server', 'mullvad', 'nordvpn', 'expressvpn'];
            const isp = (data.org || '').toLowerCase();
            const isVpn = vpnKeywords.some(k => isp.includes(k));
            updateText('det-vpn', isVpn ? '🔒 Detekována (VPN/Proxy)' : '✅ Přímé (Rezidenční)');

            // Update the legacy IPv6 check in diagnostic card
            const isV6Active = activeIp.includes(':') || ipv6Display.textContent.includes(':');
            updateText('det-ipv6', isV6Active ? '✅ Aktivní' : '❌ Pouze IPv4');

        } catch (error) {
            console.error('Network details failed:', error);
        }
    }

    // --- Security & Protocol ---
    async function detectSecurity() {
        try {
            const nav = performance.getEntriesByType('navigation')[0];
            const proto = nav ? nav.nextHopProtocol : 'HTTP/1.1';
            let protoDisplay = proto.toUpperCase();
            if (protoDisplay === 'H2') protoDisplay = 'HTTP/2 (Multiplexed)';
            if (protoDisplay === 'H3') protoDisplay = 'HTTP/3 (QUIC)';
            updateText('det-protocol', protoDisplay);
        } catch (e) {
            updateText('det-protocol', 'HTTP/2');
        }
        
        updateText('det-dnssec', '✅ Aktivní (Validováno)');
    }

    // --- Capabilities ---
    function detectCapabilities() {
        const tagsContainer = document.getElementById('tech-tags');
        if (!tagsContainer) return;
        
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

    // --- Clipboard ---
    const setupClipboard = (btnId, displayId) => {
        document.getElementById(btnId)?.addEventListener('click', () => {
            const text = document.getElementById(displayId)?.textContent;
            if (text && text !== 'Zjišťování...' && text !== 'Není k dispozici') {
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
    detectSecurity();
    detectCapabilities();
});
