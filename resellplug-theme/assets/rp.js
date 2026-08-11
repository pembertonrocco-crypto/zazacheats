/* ==========================================================================
   Resell Plug — behaviour for the rp-* sections.
   Loaded once, deferred, from layout/theme.liquid.

   Everything here is written to run on a page that may not contain the
   element it targets: sections are placeable, so any of these can be absent.
   ========================================================================== */

(function () {
  'use strict';

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

  function init(root) {
    initFaq(root);
    initMarquees(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
      initDialogs(document);
      initSticky();
    });
  } else {
    init(document);
    initDialogs(document);
    initSticky();
  }

  // The theme editor re-renders one section at a time; re-bind inside it.
  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
    initSticky();
  });
})();
