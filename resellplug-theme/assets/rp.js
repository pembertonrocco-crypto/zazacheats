/* ==========================================================================
   Resell Plug — behaviour for the rp-* sections.
   Loaded once, deferred, from layout/theme.liquid.

   Everything here is written to run on a page that may not contain the
   element it targets: sections are placeable, so any of these can be absent.
   ========================================================================== */

(function () {
  'use strict';

  // rp.js is loaded once from layout/theme.liquid. If it ever ends up on the
  // page twice — a section adding its own tag, the theme editor re-injecting
  // after an edit — a second run would bind a second set of listeners and
  // observers over the same elements. That is not harmless: two counter
  // observers raced each other and left the figure reading 0.
  if (window.__rpInit) return;
  window.__rpInit = true;

  /* ---------------------------------------------------------------------
     FAQ accordion
     One open at a time. max-height is set from scrollHeight so the panel
     animates; it is cleared to 'none' after opening so that a panel whose
     content reflows (rotated phone, font swap) is not left clipped.
     --------------------------------------------------------------------- */

  function initFaq(root) {
    var items = root.querySelectorAll('.rp-faq__item');
    if (!items.length) return;

    function close(item) {
      var panel = item.querySelector('.rp-faq__a');
      var button = item.querySelector('.rp-faq__q');
      if (!panel || !button) return;
      // Already shut. Without this guard, closing every item before opening
      // one would pin the target panel to its full height and then queue a
      // frame that sets it back to 0 — which is what stopped panels opening.
      if (!item.classList.contains('is-open')) return;
      // Going from 'none' straight to 0 does not animate, so pin the current
      // height for a frame first.
      panel.style.maxHeight = panel.scrollHeight + 'px';
      requestAnimationFrame(function () {
        panel.style.maxHeight = '0px';
      });
      item.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
    }

    function open(item) {
      var panel = item.querySelector('.rp-faq__a');
      var button = item.querySelector('.rp-faq__q');
      if (!panel || !button) return;
      panel.style.maxHeight = panel.scrollHeight + 'px';
      item.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
      panel.addEventListener('transitionend', function done(event) {
        if (event.propertyName !== 'max-height') return;
        panel.removeEventListener('transitionend', done);
        if (item.classList.contains('is-open')) panel.style.maxHeight = 'none';
      });
    }

    Array.prototype.forEach.call(items, function (item) {
      var button = item.querySelector('.rp-faq__q');
      if (!button) return;
      button.addEventListener('click', function () {
        var wasOpen = item.classList.contains('is-open');
        Array.prototype.forEach.call(items, function (other) {
          if (other !== item) close(other);
        });
        if (wasOpen) {
          close(item);
        } else {
          open(item);
        }
      });
    });
  }

  /* ---------------------------------------------------------------------
     Product "details" dialogs
     --------------------------------------------------------------------- */

  function initDialogs(root) {
    root.addEventListener('click', function (event) {
      var opener = event.target.closest('[data-rp-dialog-open]');
      if (opener) {
        var dialog = document.getElementById(opener.getAttribute('data-rp-dialog-open'));
        if (dialog && typeof dialog.showModal === 'function') {
          event.preventDefault();
          dialog.showModal();
        }
        return;
      }

      var closer = event.target.closest('[data-rp-dialog-close]');
      if (closer) {
        var owner = closer.closest('dialog');
        if (owner) owner.close();
        return;
      }

      // Click on the backdrop area of an open dialog closes it. The dialog
      // element itself fills the backdrop, so compare against its box.
      if (event.target.tagName === 'DIALOG') {
        var box = event.target.getBoundingClientRect();
        var outside =
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom;
        if (outside) event.target.close();
      }
    });
  }

  /* ---------------------------------------------------------------------
     Sticky CTA bar
     Hidden while the hero is on screen — a visitor still reading the
     headline already has a bigger button in front of them — then revealed
     for the rest of the page. Its height is published as --rp-stickybar so
     the page can pad its own bottom instead of the bar covering the footer.
     --------------------------------------------------------------------- */

  function initSticky() {
    var bar = document.querySelector('[data-rp-sticky]');
    if (!bar) return;

    var anchor = document.querySelector('[data-rp-sticky-after]');

    function show(visible) {
      bar.classList.toggle('is-visible', visible);
      bar.setAttribute('aria-hidden', visible ? 'false' : 'true');
      document.documentElement.style.setProperty(
        '--rp-stickybar',
        visible ? bar.offsetHeight + 'px' : '0px'
      );
    }

    show(false);

    if (anchor && 'IntersectionObserver' in window) {
      new IntersectionObserver(
        function (entries) {
          show(!entries[0].isIntersecting);
        },
        { threshold: 0 }
      ).observe(anchor);
      return;
    }

    // No hero on this page (or no observer): fall back to a scroll offset.
    var onScroll = function () {
      show(window.scrollY > 500);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------------------
     Marquee duplication guard
     Each marquee ships two identical groups and translates -50%. If the
     single group is narrower than the viewport the loop shows a gap, so
     clone groups until the track is at least twice the viewport wide.
     --------------------------------------------------------------------- */

  function fillMarquee(track, groupSelector) {
    var groups = track.querySelectorAll(groupSelector);
    if (groups.length !== 2) return;
    var first = groups[0];
    if (!first.children.length) return;

    var guard = 0;
    while (first.scrollWidth < window.innerWidth && guard < 6) {
      var source = Array.prototype.slice.call(first.children);
      source.forEach(function (node) {
        groups[0].appendChild(node.cloneNode(true));
        groups[1].appendChild(node.cloneNode(true));
      });
      guard += 1;
    }
  }

  function initMarquees(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.rp-ticker__track'), function (track) {
      fillMarquee(track, '.rp-ticker__group');
    });
    Array.prototype.forEach.call(root.querySelectorAll('.rp-proof__track'), function (track) {
      fillMarquee(track, '.rp-proof__group');
    });
  }

  /* ---------------------------------------------------------------------
     CTA tracking

     Every join button carries data-rp-cta with the section that rendered it.
     Without this there is no way to answer the only question that matters
     when tuning the page — which section is actually sending people to the
     group — because the click leaves for Telegram and Shopify's analytics
     never see it.

     No third-party script is loaded here and nothing personal is collected.
     Two neutral signals go out and whatever you already have installed can
     listen: a dataLayer push (Google Tag Manager reads this natively) and a
     DOM event on document. If neither is present, both are no-ops.
     --------------------------------------------------------------------- */

  function initTracking() {
    document.addEventListener(
      'click',
      function (event) {
        var link = event.target.closest('[data-rp-cta]');
        if (!link) return;

        var detail = {
          source: link.getAttribute('data-rp-cta'),
          href: link.getAttribute('href') || '',
          text: (link.textContent || '').trim().slice(0, 80),
          path: window.location.pathname,
        };

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'rp_cta_click', rp: detail });

        document.dispatchEvent(new CustomEvent('rp:cta', { detail: detail }));
      },
      // Capture phase: the click navigates away, and a bubbling listener can
      // lose the race with the unload on a slow phone.
      true
    );
  }

  /* ---------------------------------------------------------------------
     Results counter

     Animates from zero up to the figure in the markup when it scrolls into
     view. The target is whatever the owner typed into theme settings — this
     only animates toward it, it never invents or advances it. Under reduced
     motion the final figure is shown immediately.
     --------------------------------------------------------------------- */

  function initCounters(root) {
    var nodes = root.querySelectorAll('[data-rp-counter]');
    if (!nodes.length) return;

    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function run(el) {
      var out = el.querySelector('[data-rp-counter-out]');
      var target = parseInt(el.getAttribute('data-rp-counter'), 10);
      if (!out || !target || still) return;

      // Stashed on first sight, so the finishing value is always the figure
      // the owner typed and never whatever the animation happened to be
      // showing when this ran.
      var final = out.getAttribute('data-rp-final');
      if (final === null) {
        final = out.textContent;
        out.setAttribute('data-rp-final', final);
      }
      if (el.hasAttribute('data-rp-counted')) return;
      el.setAttribute('data-rp-counted', '');
      var started = null;
      var DURATION = 1400;

      function frame(now) {
        if (started === null) started = now;
        var t = Math.min((now - started) / DURATION, 1);
        // Ease out, so it decelerates into the real figure rather than
        // stopping dead.
        var eased = 1 - Math.pow(1 - t, 3);
        if (t >= 1) {
          out.textContent = final;
          return;
        }
        out.textContent = Math.floor(target * eased).toLocaleString('en-GB');
        requestAnimationFrame(frame);
      }

      out.textContent = '0';
      requestAnimationFrame(frame);
    }

    if (!('IntersectionObserver' in window)) return;

    var seen = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          seen.unobserve(entry.target);
          run(entry.target);
        });
      },
      { threshold: 0.4 }
    );

    Array.prototype.forEach.call(nodes, function (el) {
      seen.observe(el);
    });
  }

  /* ---------------------------------------------------------------------
     Mobile menu drawer

     The inline nav is hidden under 990px, so without this the site has no
     navigation at all on the device most of its traffic arrives on.

     A drawer that opens is the easy half. The half that gets skipped, and
     that makes it usable rather than merely present:

     - focus moves into the panel on open and back to the button on close,
       so a keyboard or screen-reader user is not left where the page used
       to be
     - Tab is trapped inside while it is open, or focus walks off into the
       page behind it
     - Escape closes
     - the body cannot scroll behind the panel, which on iOS otherwise
       means the page underneath moves while the drawer stays put
     --------------------------------------------------------------------- */

  function initDrawer() {
    var drawer = document.querySelector('[data-rp-drawer]');
    var opener = document.querySelector('[data-rp-menu-open]');
    if (!drawer || !opener) return;

    var panel = drawer.querySelector('.rp-drawer__panel');
    var scrollY = 0;

    function focusable() {
      return Array.prototype.filter.call(
        panel.querySelectorAll('a[href], button:not([disabled])'),
        function (el) { return el.offsetParent !== null; }
      );
    }

    function open() {
      scrollY = window.scrollY;
      drawer.hidden = false;
      // Next frame, so the transition has a state to move away from.
      requestAnimationFrame(function () { drawer.classList.add('is-open'); });
      opener.setAttribute('aria-expanded', 'true');

      document.body.style.position = 'fixed';
      document.body.style.top = '-' + scrollY + 'px';
      document.body.style.width = '100%';

      var first = focusable()[0];
      if (first) first.focus();
    }

    function close() {
      drawer.classList.remove('is-open');
      opener.setAttribute('aria-expanded', 'false');

      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';

      // While the body was fixed the document had no scrollable height.
      // Reading offsetHeight forces that layout back through before we ask
      // the document to scroll.
      void document.body.offsetHeight;
      window.scrollTo(0, scrollY);

      // preventScroll matters here. Returning focus to the menu button is
      // correct for keyboard and screen-reader users, but a plain focus()
      // also scrolls the element into view — and it undid the restore above,
      // measured landing at 464px after scrollTo had correctly reached 900.
      // The button lives in a sticky header that is on screen at every
      // scroll position, so there is nothing to scroll to in the first place.
      opener.focus({ preventScroll: true });

      var done = function () { drawer.hidden = true; };
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        done();
      } else {
        setTimeout(done, 260);
      }
    }

    opener.addEventListener('click', open);

    Array.prototype.forEach.call(drawer.querySelectorAll('[data-rp-menu-close]'), function (el) {
      el.addEventListener('click', close);
    });

    // Tapping a link should close the drawer as well as navigate — on a
    // same-page anchor there is no page load to do it for us.
    Array.prototype.forEach.call(panel.querySelectorAll('a[href]'), function (link) {
      link.addEventListener('click', function () {
        if (link.target !== '_blank') close();
      });
    });

    document.addEventListener('keydown', function (event) {
      if (drawer.hidden) return;

      if (event.key === 'Escape') {
        close();
        return;
      }

      if (event.key !== 'Tab') return;

      var items = focusable();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function init(root) {
    initFaq(root);
    initMarquees(root);
    initCounters(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
      initDialogs(document);
      initSticky();
      initTracking();
      initDrawer();
    });
  } else {
    init(document);
    initDialogs(document);
    initSticky();
    initTracking();
    initDrawer();
  }

  // The theme editor re-renders one section at a time; re-bind inside it.
  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
    initSticky();
  });
})();
