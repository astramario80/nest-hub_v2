/* Search homepage navigation and the shared directory of nested SOP tools. */
(() => {
    const root = document.querySelector('.tool-search');
    if (!root) return;
    const form = root.querySelector('form');
    const input = root.querySelector('input');
    const clear = root.querySelector('button');
    const results = root.querySelector('.tool-search-results');
    const status = root.querySelector('[role="status"]');
    const list = root.querySelector('ul');
    const aliases = {
        '/safety': 'bathroom break queue line safety officer pre flight post flight drone checklist alerts maintenance',
        '/inventory': 'equipment supplies materials lookup find tools',
        '/nestrequest': 'nest request lab pass visit permission classroom',
        '/print-queue': 'printer printing 3d laser fabrication queue',
        '/service': 'help repair broken fix service ticket',
        '/computer-lookup': 'laptop computer device number lookup',
        '/bell-schedule': 'class times period lunch schedule',
        '/signals': 'music sound timer classroom signals',
        '/divisions': 'division home headquarters hq trip meter slides folders',
        '/finished-list': 'done completed work assignments finished list',
        '/parking-lot': 'ideas questions parking lot',
        '/sops': 'procedures instructions rules how to sop',
        '/sign-in-sheet': 'attendance sign in check in',
        '/hiring': 'jobs apply application join us employment robotics team membership signup',
        '/join-robotics': 'join robotics team membership signup sign up apply application',
        '/thingiverse': 'thingiverse thingaverse 3d models',
        '/field-trips': 'field trip permission travel',
    };
    const normalize = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const label = node => node.textContent.replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s+/g, ' ').trim();
    const entries = new Map();
    document.querySelectorAll('.gear-links a, .header-dropdown a, .footer-dropdown:first-child a, .doughnut-menu-link').forEach(source => {
        const href = source.getAttribute('href');
        if (!href || entries.has(href)) return;
        const panel = source.closest('.gear-panel');
        const group = source.closest('.gear-group');
        const category = [panel?.querySelector('.gear-label')?.textContent, group ? label(group.querySelector('.gear-group-trigger')).replace(/\s*▶$/, '') : ''].filter(Boolean).join(' · ') || 'Quick Access';
        const title = label(source);
        const path = new URL(href, location.href).pathname;
        entries.set(href, { source, title, category, search: normalize(`${title} ${category} ${aliases[path] || ''} ${href.includes('smartpass') ? 'hall pass' : ''}`) });
    });
    for (const { href, title, category, keywords } of window.NestSopTools || []) {
        const source = document.createElement('a');
        source.href = href;
        entries.set(href, { source, title, category, search: normalize(`${title} ${category} ${keywords}`) });
    }
    function render() {
        const query = normalize(input.value);
        clear.hidden = !input.value;
        list.replaceChildren();
        results.hidden = !query;
        if (!query) { status.textContent = ''; return; }
        const words = query.split(' ');
        // Collapsed menus use hidden on their containers; their links remain searchable.
        const matches = [...entries.values()].filter(entry => !entry.source.hidden && words.every(word => entry.search.includes(word)));
        matches.sort((a, b) => Number(normalize(b.title).startsWith(query)) - Number(normalize(a.title).startsWith(query)) || a.title.localeCompare(b.title));
        status.textContent = matches.length ? `${matches.length} ${matches.length === 1 ? 'match' : 'matches'} found` : 'No tools found. Try a tool name or a shorter search.';
        for (const entry of matches) {
            const item = document.createElement('li');
            // Preserve resource viewer behavior and external-link attributes.
            const link = entry.source.cloneNode(false);
            link.removeAttribute('id');
            link.removeAttribute('class');
            link.removeAttribute('aria-label');
            if (link.target === '_blank') link.rel = 'noopener noreferrer';
            const title = document.createElement('strong');
            title.textContent = entry.title;
            const detail = document.createElement('small');
            detail.textContent = entry.category;
            link.append(title, detail);
            item.append(link);
            list.append(item);
        }
    }
    input.addEventListener('input', render);
    form.addEventListener('reset', event => {
        event.preventDefault();
        input.value = '';
        render();
        input.focus();
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        list.querySelector('a')?.focus();
    });
    root.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); form.reset(); }
        if (event.key === 'ArrowDown' && event.target === input && list.firstElementChild) {
            event.preventDefault();
            list.querySelector('a').focus();
        }
    });
    root.hidden = false;
})();
