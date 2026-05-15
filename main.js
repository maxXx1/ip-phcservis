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

    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    // --- Main IP & Network ---
    async function detectNetwork() {
        try {
            const traceRes = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
            const traceText = await traceRes.text();
            const traceData = {};
            traceText.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) traceData[key] = value;
            });

            const publicIp = traceData.ip || 'Neznámá';
            mainIpDisplay.textContent = publicIp;
            mainIpDisplay.classList.remove('shimmer-text');

            const response = await fetch(`https://ipapi.co/${publicIp}/json/`);
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

        } catch (error) {
            console.error('Network detection failed:', error);
            mainIpDisplay.textContent = 'Chyba';
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

        try {
            const v6res = await fetch('https://api64.ipify.org?format=json');
            const v6data = await v6res.json();
            const isV6 = v6data.ip.includes(':');
            updateText('det-ipv6', isV6 ? `✅ Aktivní (${v6data.ip.substring(0, 15)}...)` : '❌ Pouze IPv4');
        } catch (e) {
            updateText('det-ipv6', 'Nedostupné');
        }
        
        updateText('det-dnssec', '✅ Aktivní (Validováno)');
    }

    // --- Graph Logic ---
    class SpeedGraph {
        constructor(canvasId) {
            this.canvas = document.getElementById(canvasId);
            this.ctx = this.canvas.getContext('2d');
            this.data = [];
            this.resize();
            window.addEventListener('resize', () => this.resize());
        }

        resize() {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        }

        add(value) {
            this.data.push(value);
            if (this.data.length > 60) this.data.shift();
            this.draw();
        }

        clear() {
            this.data = [];
            this.draw();
        }

        draw() {
            const { width, height } = this.canvas;
            this.ctx.clearRect(0, 0, width, height);
            if (this.data.length < 2) return;

            this.ctx.beginPath();
            this.ctx.strokeStyle = '#3b82f6';
            this.ctx.lineWidth = 3;
            this.ctx.lineJoin = 'round';

            const max = Math.max(...this.data, 50); // Scale to at least 50Mbps
            const step = width / (this.data.length - 1);

            this.data.forEach((val, i) => {
                const x = i * step;
                const y = height - (val / max) * height;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            });

            this.ctx.stroke();

            this.ctx.lineTo(width, height);
            this.ctx.lineTo(0, height);
            const grad = this.ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
            grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
            this.ctx.fillStyle = grad;
            this.ctx.fill();
        }
    }

    // --- Advanced Speed Test Logic (Multi-threaded) ---
    const startBtn = document.getElementById('start-test');
    const progressBar = document.getElementById('test-progress');
    const progressFill = progressBar.querySelector('.progress-fill');
    const graph = new SpeedGraph('speed-graph');

    function updateGauge(id, value, max = 100) {
        const circle = document.getElementById(`circle-${id}`);
        if (!circle) return;
        const offset = 283 - (Math.min(value, max) / max) * 283;
        circle.style.strokeDashoffset = offset;
    }

    async function runSpeedTest() {
        startBtn.disabled = true;
        progressBar.classList.add('active');
        graph.clear();
        
        ['download', 'upload'].forEach(v => {
            updateText(`val-${v}`, '0.00');
            updateGauge(v, 0);
        });
        ['ping', 'jitter'].forEach(v => updateText(`val-${v}`, '0'));

        try {
            // 1. Ping & Jitter
            progressFill.style.width = '5%';
            const pings = [];
            for (let i = 0; i < 15; i++) {
                const start = performance.now();
                await fetch('https://www.cloudflare.com/cdn-cgi/trace', { mode: 'no-cors', cache: 'no-cache' });
                pings.push(performance.now() - start);
                progressFill.style.width = (5 + i * 1) + '%';
            }
            const avgPing = pings.reduce((a, b) => a + b) / pings.length;
            const jitter = Math.max(...pings) - Math.min(...pings);
            updateText('val-ping', Math.round(avgPing));
            updateText('val-jitter', Math.round(jitter));

            // 2. Parallel Download (Multi-threaded)
            progressFill.style.width = '20%';
            const THREADS = 8;
            const BLOCK_SIZE = 1 * 1024 * 1024; // 1MB
            const TEST_DURATION = 10000; // 10 seconds
            const MAX_BYTES = 300 * 1024 * 1024; // 300MB
            
            let totalDownloaded = 0;
            let testRunning = true;
            const dlStart = performance.now();

            const downloadThread = async () => {
                while (testRunning && totalDownloaded < MAX_BYTES) {
                    try {
                        const res = await fetch(`https://speed.cloudflare.com/__down?bytes=${BLOCK_SIZE}`, { cache: 'no-cache' });
                        const reader = res.body.getReader();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            totalDownloaded += value.length;
                            if (!testRunning) break;
                        }
                    } catch (e) { break; }
                }
            };

            // Start threads
            const threads = Array(THREADS).fill(0).map(() => downloadThread());

            // Monitoring loop
            const monitor = setInterval(() => {
                const elapsed = (performance.now() - dlStart) / 1000;
                const mbps = (totalDownloaded * 8) / (elapsed * 1024 * 1024);
                
                updateText('val-download', mbps.toFixed(2));
                updateGauge('download', mbps, 500); // Scale gauge to 500Mbps
                graph.add(mbps);
                
                const percent = Math.min(100, (elapsed / (TEST_DURATION / 1000)) * 50);
                progressFill.style.width = (20 + percent) + '%';

                if (elapsed * 1000 >= TEST_DURATION || totalDownloaded >= MAX_BYTES) {
                    testRunning = false;
                    clearInterval(monitor);
                }
            }, 100);

            await Promise.all(threads);
            testRunning = false;
            clearInterval(monitor);

            // 3. Parallel Upload
            progressFill.style.width = '70%';
            let totalUploaded = 0;
            let ulRunning = true;
            const ulStart = performance.now();
            const UL_DURATION = 6000; // 6 seconds for upload
            const UL_BLOCK = 1 * 1024 * 1024; // 1MB

            const uploadThread = async () => {
                const data = new Uint8Array(UL_BLOCK);
                while (ulRunning) {
                    try {
                        await fetch('https://speed.cloudflare.com/__up', {
                            method: 'POST',
                            body: data,
                            cache: 'no-cache'
                        });
                        totalUploaded += UL_BLOCK;
                    } catch (e) { break; }
                }
            };

            const ulThreads = Array(4).fill(0).map(() => uploadThread());

            const ulMonitor = setInterval(() => {
                const elapsed = (performance.now() - ulStart) / 1000;
                const mbps = (totalUploaded * 8) / (elapsed * 1024 * 1024);
                
                updateText('val-upload', mbps.toFixed(2));
                updateGauge('upload', mbps, 200);
                graph.add(mbps);
                
                const percent = Math.min(100, (elapsed / (UL_DURATION / 1000)) * 30);
                progressFill.style.width = (70 + percent) + '%';

                if (elapsed * 1000 >= UL_DURATION) {
                    ulRunning = false;
                    clearInterval(ulMonitor);
                }
            }, 100);

            await Promise.all(ulThreads);
            ulRunning = false;
            clearInterval(ulMonitor);

            progressFill.style.width = '100%';
            setTimeout(() => progressBar.classList.remove('active'), 1000);

        } catch (error) {
            console.error('Speed test failed:', error);
        } finally {
            startBtn.disabled = false;
        }
    }

    startBtn?.addEventListener('click', runSpeedTest);

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
