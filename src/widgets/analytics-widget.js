// Analytics widget: React (via CDN, no bundler) + Motion for animated counters and charts.
// Mirrors the project's existing CDN-script approach (Tailwind, FontAwesome, Yandex Maps, Omnitone) —
// no build step required, so it keeps working the moment index.html is opened.
import { animate } from 'https://cdn.jsdelivr.net/npm/motion@11.13.5/+esm';

const React = window.React;
const ReactDOM = window.ReactDOM;

if (!React || !ReactDOM) {
    console.warn('Analytics widget: React/ReactDOM CDN scripts not found, skipping.');
} else {
    const { createElement: h, useEffect, useRef } = React;
    const EASE = [0.16, 1, 0.3, 1];

    function CountUp({ value, decimals = 0, className }) {
        const ref = useRef(null);
        useEffect(() => {
            const el = ref.current;
            if (!el) return;
            const controls = animate(0, value, {
                duration: 1,
                ease: EASE,
                onUpdate: (v) => { el.textContent = v.toFixed(decimals); }
            });
            return () => controls.stop();
        }, [value, decimals]);
        return h('span', { ref }, (0).toFixed(decimals));
    }

    function StatCard({ icon, value, decimals, label, colorClass, delay = 0 }) {
        const cardRef = useRef(null);
        useEffect(() => {
            if (!cardRef.current) return;
            const controls = animate(cardRef.current, { opacity: [0, 1], y: [12, 0] }, { duration: 0.5, delay, ease: EASE });
            return () => controls.stop();
        }, []);
        return h('div', { ref: cardRef, className: 'analytics-stat-card', style: { opacity: 0 } },
            h('div', { className: `analytics-stat-icon ${colorClass}` }, h('i', { className: `fa-solid ${icon}` })),
            h('div', { className: `analytics-stat-value ${colorClass}` }, h(CountUp, { value, decimals })),
            h('div', { className: 'analytics-stat-label' }, label)
        );
    }

    // Multi-segment animated ring, drawn stroke-by-stroke (bklit.com/charts-style waterfall reveal).
    function EcoDonut({ segments }) {
        const total = segments.reduce((s, d) => s + d.value, 0) || 1;
        const size = 128, strokeW = 15, r = (size - strokeW) / 2, C = 2 * Math.PI * r;
        const segRefs = useRef([]);

        useEffect(() => {
            const controlsList = [];
            let cum = 0;
            segments.forEach((seg, i) => {
                const el = segRefs.current[i];
                const frac = seg.value / total;
                const dash = frac * C;
                cum += frac;
                if (!el) return;
                controlsList.push(animate(el, { strokeDashoffset: [dash, 0] }, { duration: 0.9, delay: 0.12 * i, ease: EASE }));
            });
            return () => controlsList.forEach(c => c.stop());
        }, [segments, total]);

        let cum = 0;
        return h('div', { className: 'analytics-donut-wrap' },
            h('svg', { width: size, height: size, viewBox: `0 0 ${size} ${size}` },
                h('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', strokeWidth: strokeW, className: 'analytics-donut-track', stroke: 'currentColor' }),
                segments.map((seg, i) => {
                    const frac = seg.value / total;
                    const dash = frac * C;
                    const rotation = cum * 360 - 90;
                    cum += frac;
                    return h('circle', {
                        key: seg.label,
                        ref: (node) => { segRefs.current[i] = node; },
                        cx: size / 2, cy: size / 2, r, fill: 'none',
                        stroke: seg.color, strokeWidth: strokeW, strokeLinecap: 'round',
                        strokeDasharray: `${dash} ${C - dash}`,
                        strokeDashoffset: dash,
                        transform: `rotate(${rotation} ${size / 2} ${size / 2})`
                    });
                })
            ),
            h('div', { className: 'analytics-donut-center' },
                h('div', { className: 'analytics-donut-total' }, h(CountUp, { value: total })),
                h('div', { className: 'analytics-donut-total-label' }, 'записей')
            )
        );
    }

    function TopCategoryBars({ items }) {
        const max = items.length ? Math.max(...items.map(i => i.value)) : 1;
        const barRefs = useRef([]);

        useEffect(() => {
            const controlsList = items.map((it, i) => {
                const el = barRefs.current[i];
                if (!el) return null;
                const pct = Math.max(8, Math.round((it.value / max) * 100));
                return animate(el, { width: ['0%', `${pct}%`] }, { duration: 0.7, delay: 0.1 * i, ease: EASE });
            });
            return () => controlsList.forEach(c => c && c.stop());
        }, [items, max]);

        if (!items.length) {
            return h('p', { className: 'analytics-empty' }, 'Пока нет данных');
        }

        return h('div', { className: 'analytics-bars' },
            items.map((it, i) => h('div', { key: it.label, className: 'analytics-bar-row' },
                h('div', { className: 'analytics-bar-label' }, it.label),
                h('div', { className: 'analytics-bar-track' },
                    h('div', { ref: (n) => { barRefs.current[i] = n; }, className: 'analytics-bar-fill', style: { width: '0%' } },
                        h('span', { className: 'analytics-bar-value' }, it.value)
                    )
                )
            ))
        );
    }

    function AnalyticsWidget({ data }) {
        const rootRef = useRef(null);
        useEffect(() => {
            if (!rootRef.current) return;
            const controls = animate(rootRef.current, { opacity: [0, 1], scale: [0.97, 1] }, { duration: 0.4, ease: EASE });
            return () => controls.stop();
        }, []);

        const ecoSegments = [
            { label: 'Геофония', value: data.byEco.geophony || 0, color: '#0284c7' },
            { label: 'Биофония', value: data.byEco.biophony || 0, color: '#16a34a' },
            { label: 'Антропофония', value: data.byEco.anthrophony || 0, color: '#ea580c' }
        ];

        return h('div', { ref: rootRef, className: 'analytics-widget', style: { opacity: 0 } },
            h('div', { className: 'analytics-cards-row' },
                h(StatCard, { icon: 'fa-microphone-lines', value: data.total, label: 'Записей', colorClass: 'text-blue-500', delay: 0 }),
                h(StatCard, { icon: 'fa-volume-high', value: data.withAudio, label: 'С аудио', colorClass: 'text-emerald-500', delay: 0.06 }),
                h(StatCard, { icon: 'fa-user-group', value: data.recordists, label: 'Авторов', colorClass: 'text-indigo-500', delay: 0.12 }),
                h(StatCard, { icon: 'fa-clock', value: data.totalMinutes, decimals: 1, label: 'Минут звука', colorClass: 'text-amber-500', delay: 0.18 })
            ),
            h('div', { className: 'analytics-charts-row' },
                h('div', { className: 'analytics-chart-card' },
                    h('p', { className: 'analytics-chart-title' }, 'Экоакустический баланс'),
                    h(EcoDonut, { segments: ecoSegments }),
                    h('div', { className: 'analytics-legend' },
                        ecoSegments.map(seg => h('div', { key: seg.label, className: 'analytics-legend-item' },
                            h('span', { className: 'analytics-legend-dot', style: { background: seg.color } }),
                            h('span', null, seg.label),
                            h('span', { className: 'analytics-legend-value' }, seg.value)
                        ))
                    )
                ),
                h('div', { className: 'analytics-chart-card' },
                    h('p', { className: 'analytics-chart-title' }, 'Топ категорий (UCS)'),
                    h(TopCategoryBars, { items: data.topUcsList })
                )
            )
        );
    }

    const roots = new Map();

    window.AnalyticsWidget = {
        mount(container, data) {
            if (!container || !data) return;
            let root = roots.get(container);
            if (!root) {
                root = ReactDOM.createRoot(container);
                roots.set(container, root);
            }
            root.render(h(AnalyticsWidget, { data }));
        },
        unmount(container) {
            const root = roots.get(container);
            if (!root) return;
            root.unmount();
            roots.delete(container);
        }
    };
}
