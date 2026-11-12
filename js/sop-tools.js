/* Shared searchable SOP sections and direct links into the SOPs page. */
(() => {
    const sections = [
        ['Community Agreements', 'classroom expectations agreements'],
        ['SOAR Matrix', 'safety ownership attending respecting expectations'],
        ['Division Norms', 'professionalism division expectations'],
        ['Manager Norms', 'leadership manager expectations'],
        ['First 5 / Last 5', 'start end class routines cleanup clean up'],
        ['Magic Spinner', 'random name picker wheel spin choose student selection'],
        ['Team Roles', 'teamwork collaboration responsibilities'],
        ['Rules of Engagement', 'respectful productive teamwork'],
        ['Break Protocol', 'bathroom hall pass leaving room'],
        ['Presentation Norms', 'presenting sharing work presentations'],
        ['Peer Editing', 'feedback review editing'],
        ['File Naming', 'save files naming conventions'],
        ['Team Workbooks', 'shared work organization workbook'],
        ['3D Printing', 'printer authorization submission queue fabrication'],
        ['Corrections', 'expectations behavior consequences'],
        ['Mission Statement', 'purpose mission nest'],
    ].map(([title, keywords]) => ({
        title, keywords, category: 'SOAR · SOPs',
        href: '/sops#' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    }));
    window.NestSopTools = sections;

    const buttons = [...document.querySelectorAll('.sops-link')];
    if (!buttons.length) return;
    const defaultButton = buttons.find(button => button.classList.contains('active'));
    const routes = new Map(sections.map(section => [section.href.split('#')[1], buttons.find(button => button.textContent.trim() === section.title)]));
    let routing = false;
    function openSection() {
        const button = location.hash ? routes.get(location.hash.slice(1)) : defaultButton;
        if (!button) return;
        routing = true;
        try { if (!button.classList.contains('active')) button.click(); }
        finally { routing = false; }
        if (location.hash) document.querySelector('.sops-content')?.scrollIntoView?.({ block: 'start' });
    }
    for (const [slug, button] of routes) {
        button?.addEventListener('click', () => {
            if (!routing && location.hash !== '#' + slug) history.pushState(null, '', '#' + slug);
        });
    }
    window.addEventListener('hashchange', openSection);
    window.addEventListener('popstate', openSection);
    openSection();
})();
