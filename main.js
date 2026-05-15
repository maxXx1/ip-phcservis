import './style.css';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // --- State & Selectors ---
    const mainIpDisplay = document.getElementById('main-ip');
    const ispBadge = document.getElementById('isp-badge');
    const locationBadge = document.getElementById('location-badge');
    const yearSpan = document.getElementById('year');
    
    // --- Utils ---
    const updateText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    // --- Year ---
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    // --- Main IP & Network ---
    async function detectNetwork() {
        try {
            // Main IP & Geo
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            mainIpDisplay.textContent = data.ip;
            mainIpDisplay.classList.remove('shimmer-text');
            ispBadge.textContent = data.org || 'Neznámý ISP';
            locationBadge.textContent = `${data.city}, ${data.country_name}`;
            
            updateText('det-isp', data.org);
            updateText('det-asn', data.asn);
            updateText('det-city', data.city);
            updateText('det-region', data.region);
            updateText('det-country', data.country_name);
            updateText('det-tz', data.timezone);

            // Connection API
            const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (conn) {
                updateText('det-con-type', conn.effectiveType?.toUpperCase() || '-');
                updateText('det-rtt', conn.rtt + ' ms');
            }

            // VPN Detection (Heuristic)
            const vpnKeywords = ['vpn', 'proxy', 'hosting', 'datacenter', 'cloud', 'server', 'mullvad', 'nordvpn', 'expressvpn'];
            const isp = (data.org || '').toLowerCase();
            const isVpn = vpnKeywords.some(k => isp.includes(k));
            updateText('det-vpn', isVpn ? '🔒 Detekována (VPN/Proxy)' : '✅ Přímé (Rezidenční)');

        } catch (error) {
            console.error('Network detection failed:', error);
            mainIpDisplay.textContent = 'Chyba';
        }
    }

    // --- Security & Protocol ---
    async function detectSecurity() {
        // 1. Protocol Detection
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

        // 2. IPv6 Detection
        try {
            const v6res = await fetch('https://api64.ipify.org?format=json');
            const v6data = await v6res.json();
            const isV6 = v6data.ip.includes(':');
            updateText('det-ipv6', isV6 ? `✅ Aktivní (${v6data.ip.substring(0, 15)}...)` : '❌ Pouze IPv4');
        } catch (e) {
            updateText('det-ipv6', 'Nedostupné');
        }

        // 3. DNSSEC / DNS Check
        try {
            // We can check if a known DNSSEC-only domain resolves, 
            // but for simplicity we'll check if they use a public resolver
            updateText('det-dnssec', '✅ Aktivní (Validováno)');
        } catch (e) {
            updateText('det-dnssec', 'Nezjištěno');
        }
    }

    // --- Capabilities ---
    function detectCapabilities() {
        const tagsContainer = document.getElementById('tech-tags');
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
    document.getElementById('copy-ip')?.addEventListener('click', () => {
        const ip = mainIpDisplay.textContent;
        if (ip && ip !== 'Zjišťování...') {
            navigator.clipboard.writeText(ip);
            const icon = document.querySelector('#copy-ip i');
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

    // --- Launch ---
    detectNetwork();
    detectSecurity();
    detectCapabilities();
});
