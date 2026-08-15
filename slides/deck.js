(function () {
    'use strict';

    var stage = document.getElementById('stage');
    var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    var hudBlock = document.getElementById('hud-block');
    var hudCount = document.getElementById('hud-count');
    var progress = document.getElementById('progress');
    var notes = document.getElementById('notes');
    var notesBody = document.getElementById('notes-body');
    var overview = document.getElementById('overview');
    var ovGrid = document.getElementById('ov-grid');
    var help = document.getElementById('help');
    var blackout = document.getElementById('blackout');

    var cur = 0;
    var step = 0;
    var timers = {};   // índice do slide -> estado do cronômetro

    /* ---------- escala do palco ---------- */

    function fit() {
        var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
        stage.style.transform = 'translate(-50%,-50%) scale(' + s + ')';
    }
    window.addEventListener('resize', fit);

    /* ---------- passos ---------- */

    function stepsOf(i) {
        return Array.prototype.slice.call(slides[i].querySelectorAll('[data-step]'));
    }

    function paintSteps() {
        stepsOf(cur).forEach(function (el, k) {
            el.classList.toggle('shown', k < step);
        });
    }

    function revealAll(i) {
        stepsOf(i).forEach(function (el) { el.classList.add('shown'); });
    }

    /* ---------- navegação ---------- */

    function go(i, mode) {
        i = Math.max(0, Math.min(slides.length - 1, i));
        if (slides[cur]) slides[cur].classList.remove('current');
        cur = i;
        slides[cur].classList.add('current');
        step = (mode === 'end') ? stepsOf(cur).length : 0;
        paintSteps();
        paint();
        if (location.hash !== '#' + (cur + 1)) {
            history.replaceState(null, '', '#' + (cur + 1));
        }
    }

    function next() {
        if (step < stepsOf(cur).length) { step++; paintSteps(); }
        else if (cur < slides.length - 1) { go(cur + 1); }
    }

    function prev() {
        if (step > 0) { step--; paintSteps(); }
        else if (cur > 0) { go(cur - 1, 'end'); }
    }

    /* ---------- HUD e notas ---------- */

    function paint() {
        var s = slides[cur];
        hudBlock.textContent = s.getAttribute('data-hud') || '';
        hudCount.innerHTML = '<b>' + (cur + 1) + '</b> / ' + slides.length;
        progress.style.width = ((cur + 1) / slides.length * 100) + '%';

        var n = s.querySelector('.notes');
        notesBody.innerHTML = n ? n.innerHTML
            : '<p style="color:#6e6e73">Sem notas para este slide.</p>';

        var items = ovGrid.children;
        for (var k = 0; k < items.length; k++) {
            items[k].classList.toggle('is-now', k === cur);
        }
        paintTimer();
    }

    /* ---------- cronômetros ---------- */

    function timerEl() {
        return slides[cur].querySelector('.timer');
    }

    function timerState() {
        var el = timerEl();
        if (!el) return null;
        if (!timers[cur]) {
            var total = parseFloat(el.getAttribute('data-t')) * 60;
            timers[cur] = { total: total, left: total, running: false };
        }
        return timers[cur];
    }

    function fmt(sec) {
        sec = Math.max(0, Math.round(sec));
        var m = Math.floor(sec / 60), s = sec % 60;
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function paintTimer() {
        var el = timerEl(), st = timerState();
        if (!el || !st) return;
        el.querySelector('.timer__time').textContent = fmt(st.left);
        el.classList.toggle('is-running', st.running && st.left > 0);
        el.classList.toggle('is-warning', st.left > 0 && st.left <= 60);
        el.classList.toggle('is-done', st.left <= 0);
        var hint = el.querySelector('.timer__hint');
        if (st.left <= 0) hint.textContent = 'tempo esgotado';
        else if (st.running) hint.textContent = 'T pausa · R zera';
        else hint.textContent = 'T inicia · R zera';
    }

    function toggleTimer() {
        var st = timerState();
        if (!st) return;
        if (st.left <= 0) { st.left = st.total; st.running = false; }
        else { st.running = !st.running; }
        paintTimer();
    }

    function resetTimer() {
        var st = timerState();
        if (!st) return;
        st.left = st.total;
        st.running = false;
        paintTimer();
    }

    setInterval(function () {
        var st = timers[cur];
        if (st && st.running && st.left > 0) {
            st.left -= 1;
            if (st.left <= 0) { st.left = 0; st.running = false; }
            paintTimer();
        }
    }, 1000);

    /* ---------- visão geral ---------- */

    function buildOverview() {
        slides.forEach(function (s, i) {
            var t = s.querySelector('.divider-title, h1, h2, .statement, .quote, .consigna, .display');
            var item = document.createElement('div');
            item.className = 'ov-item';
            item.innerHTML = '<div class="ov-item__n">' + (i + 1) + ' · ' +
                (s.getAttribute('data-hud') || '') + '</div>' +
                '<div class="ov-item__t"></div>';
            item.querySelector('.ov-item__t').textContent =
                t ? t.textContent.replace(/\s+/g, ' ').trim() : '—';
            item.addEventListener('click', function () {
                overview.classList.remove('open');
                go(i);
            });
            ovGrid.appendChild(item);
        });
    }

    /* ---------- overlays ---------- */

    function closeOverlays() {
        overview.classList.remove('open');
        help.classList.remove('open');
        blackout.classList.remove('open');
    }

    /* ---------- teclado ---------- */

    document.addEventListener('keydown', function (e) {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var k = e.key;

        if (k === 'Escape') { closeOverlays(); return; }

        if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ') {
            e.preventDefault(); next(); return;
        }
        if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') {
            e.preventDefault(); prev(); return;
        }
        if (k === 'Home') { e.preventDefault(); go(0); return; }
        if (k === 'End') { e.preventDefault(); go(slides.length - 1); return; }

        switch (k.toLowerCase()) {
            case 't': toggleTimer(); break;
            case 'r': resetTimer(); break;
            case 'p': notes.classList.toggle('open'); break;
            case 'o': help.classList.remove('open'); overview.classList.toggle('open'); break;
            case 'b': blackout.classList.toggle('open'); break;
            case 'f':
                if (document.fullscreenElement) document.exitFullscreen();
                else document.documentElement.requestFullscreen();
                break;
            case '?': case 'h':
                overview.classList.remove('open'); help.classList.toggle('open'); break;
        }
    });

    /* ---------- mouse e toque ---------- */

    document.addEventListener('click', function (e) {
        if (e.target.closest('#overview, #help, #notes')) return;
        if (blackout.classList.contains('open')) { blackout.classList.remove('open'); return; }
        if (e.clientX > window.innerWidth * 0.5) next(); else prev();
    });

    var tx = null;
    document.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', function (e) {
        if (tx === null) return;
        var dx = e.changedTouches[0].clientX - tx;
        if (Math.abs(dx) > 46) { dx < 0 ? next() : prev(); }
        tx = null;
    }, { passive: true });

    /* ---------- impressão ---------- */

    window.addEventListener('beforeprint', function () {
        slides.forEach(function (_, i) { revealAll(i); });
    });

    /* ---------- início ---------- */

    buildOverview();
    fit();

    // permite saltar editando a URL (#12) e faz voltar/avançar do navegador funcionar
    window.addEventListener('hashchange', function () {
        var n = parseInt((location.hash || '').replace('#', ''), 10);
        if (!isNaN(n) && n - 1 !== cur) go(n - 1);
    });

    var start = parseInt((location.hash || '').replace('#', ''), 10);
    go(isNaN(start) ? 0 : start - 1);
})();


