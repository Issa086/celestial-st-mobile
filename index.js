// ═══════════════════════════════════════════════════
//  星空背景 · 手机专属纯装饰版
//  不显示星名，不拦截触控，纯背景
// ═══════════════════════════════════════════════════

(function () {
    'use strict';

    if (document.getElementById('celestial-canvas')) return;

    const STARS = [
        { ra:5.242,  dec:-8.202,  mag:0.18 },
        { ra:5.795,  dec:-9.670,  mag:0.12 },
        { ra:5.533,  dec:-0.299,  mag:2.23 },
        { ra:5.603,  dec:-1.202,  mag:1.70 },
        { ra:5.679,  dec:-1.943,  mag:2.05 },
        { ra:5.418,  dec: 6.350,  mag:1.64 },
        { ra:5.920,  dec: 7.407,  mag:2.06 },
        { ra:11.062, dec:61.751,  mag:1.79 },
        { ra:11.030, dec:56.383,  mag:2.37 },
        { ra:12.257, dec:57.033,  mag:2.44 },
        { ra:12.900, dec:55.960,  mag:1.76 },
        { ra:13.792, dec:49.314,  mag:1.85 },
        { ra:16.490, dec:-26.432, mag:1.06 },
        { ra:10.140, dec:11.967,  mag:1.36 },
        { ra:11.817, dec:14.572,  mag:2.14 },
        { ra:0.945,  dec:60.717,  mag:2.24 },
        { ra:0.153,  dec:59.150,  mag:2.28 },
        { ra:20.690, dec:45.280,  mag:1.25 },
        { ra:18.615, dec:38.783,  mag:0.03 },
        { ra:19.847, dec:8.868,   mag:0.77 },
        { ra:4.599,  dec:16.509,  mag:0.87 },
        { ra:7.755,  dec:28.026,  mag:1.14 },
        { ra:7.577,  dec:31.889,  mag:1.58 },
        { ra:13.420, dec:-11.162, mag:0.97 },
        { ra:5.278,  dec:45.998,  mag:0.08 },
        { ra:14.261, dec:19.182,  mag:-0.05 },
        { ra:6.752,  dec:-16.713, mag:-1.46 },
        { ra:7.655,  dec:5.225,   mag:0.50 },
    ];

    const Rad = d => d * Math.PI / 180;
    const Deg = r => r * 180 / Math.PI;
    const julianDate = d => d.getTime() / 86400000 + 2440587.5;

    function gmst(j) {
        const T = (j - 2451545) / 36525;
        return (((280.46061837 + 360.98564736629 * (j - 2451545) + T*T*0.000387933 - T*T*T/38710000) % 360) + 360) % 360;
    }
    function lst(j, lon) { return ((gmst(j) + lon) % 360 + 360) % 360; }

    function altAz(ra, dec, lstD, lat) {
        const ha = Rad(((lstD - ra) % 360 + 360) % 360), d = Rad(dec), La = Rad(lat);
        const sa = Math.sin(d)*Math.sin(La) + Math.cos(d)*Math.cos(La)*Math.cos(ha);
        const alt = Math.asin(Math.max(-1, Math.min(1, sa)));
        const ca = (Math.sin(d) - Math.sin(alt)*Math.sin(La)) / (Math.cos(alt)*Math.cos(La));
        let az = Math.acos(Math.max(-1, Math.min(1, ca)));
        if (Math.sin(ha) > 0) az = 2*Math.PI - az;
        return { alt: Deg(alt), az: Deg(az) };
    }

    function project(alt, az, W, H) {
        const r = Math.cos(Rad(alt)) / (1 + Math.sin(Rad(alt)));
        const s = Math.min(W, H) * 0.5;
        return { x: W/2 + s*r*Math.sin(Rad(az)), y: H/2 - s*r*Math.cos(Rad(az)), ok: alt > -8 };
    }

    function init() {
        // 背景层
        const bgDiv = document.createElement('div');
        bgDiv.id = 'celestial-bg';
        Object.assign(bgDiv.style, {
            position:'fixed', inset:'0',
            background:'#060608',
            zIndex:'1',
            pointerEvents:'none',
        });
        document.body.insertBefore(bgDiv, document.body.firstChild);

        // canvas（永远不拦截触控）
        const canvas = document.createElement('canvas');
        canvas.id = 'celestial-canvas';
        Object.assign(canvas.style, {
            position:'fixed', top:'0', left:'0',
            width:'100%', height:'100%',
            zIndex:'2',
            pointerEvents:'none',
            display:'block',
        });
        document.body.insertBefore(canvas, bgDiv.nextSibling);
        const ctx = canvas.getContext('2d');

        // ST 容器提升，确保 UI 在星空上面
        function liftST() {
            ['#page-wrapper','#sheld','#chat-wrapper',
             '#top-settings-holder','#send_form',
             '#shadow_popup','#dialogue_popup'].forEach(sel => {
                const el = document.querySelector(sel);
                if (!el) return;
                if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';
                el.style.zIndex = '20';
            });
        }
        liftST();
        setTimeout(liftST, 800);

        let W, H, bgStars = [], frame = 0;
        let LAT = 39.9, LON = 116.4;

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                p => { LAT = p.coords.latitude; LON = p.coords.longitude; },
                () => {}
            );
        }

        function resize() {
            W = canvas.width = window.innerWidth;
            H = canvas.height = window.innerHeight;
            bgStars = Array.from({ length: Math.floor(W * H / 6000) }, () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 0.9 + 0.15,
                a: Math.random() * 0.38 + 0.08,
                tw: Math.random() * Math.PI * 2,
                spd: Math.random() * 0.007 + 0.002,
            }));
        }

        const starR   = mag => Math.max(0.6, (3.2 - mag * 0.50) * 1.3);
        const starAlp = mag => Math.max(0.20, Math.min(0.96, 1.05 - mag * 0.12));

        function draw() {
            frame++;
            ctx.clearRect(0, 0, W, H);

            const g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W, H) * 0.75);
            g.addColorStop(0,   'rgba(10,10,25,0)');
            g.addColorStop(0.6, 'rgba(4,4,12,0.18)');
            g.addColorStop(1,   'rgba(2,2,8,0.50)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);

            bgStars.forEach(s => {
                const tw = Math.sin(s.tw + frame * s.spd) * 0.12;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(215,222,255,${Math.max(0, s.a + tw)})`;
                ctx.fill();
            });

            const now  = new Date();
            const lstD = lst(julianDate(now), LON);

            STARS.forEach(s => {
                const pos = altAz(s.ra * 15, s.dec, lstD, LAT);
                const px  = project(pos.alt, pos.az, W, H);
                if (!px.ok) return;

                const fade = Math.min(1, (pos.alt + 5) / 20);
                if (fade <= 0) return;

                const r   = starR(s.mag);
                const alp = starAlp(s.mag) * fade;

                if (s.mag < 2.0) {
                    const gr   = r * 5.5;
                    const glow = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, gr);
                    glow.addColorStop(0,   `rgba(215,230,255,${alp * 0.32})`);
                    glow.addColorStop(0.4, `rgba(195,215,255,${alp * 0.12})`);
                    glow.addColorStop(1,   'rgba(0,0,0,0)');
                    ctx.beginPath();
                    ctx.arc(px.x, px.y, gr, 0, Math.PI * 2);
                    ctx.fillStyle = glow;
                    ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(px.x, px.y, r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(235,240,255,${alp})`;
                ctx.fill();
            });

            requestAnimationFrame(draw);
        }

        window.addEventListener('resize', resize);
        resize();
        draw();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
