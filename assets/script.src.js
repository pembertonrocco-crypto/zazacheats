
/* Bootstrap 5 modal helpers. jQuery was removed from master.njk in July 2026
   on the basis that nothing used it, but these nine call sites were missed —
   which silently broke the login, ticket, affiliate-code and maintenance
   modals site-wide with "$ is not defined". Bootstrap's own JS is already
   loaded, so we drive it directly instead of bringing jQuery back. */
function zzModal(id, action) {
  var el = document.getElementById(id);
  if (!el || typeof bootstrap === 'undefined' || !bootstrap.Modal) return;
  bootstrap.Modal.getOrCreateInstance(el)[action]();
}
function zzReady(cb) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb);
  else cb();
}
const decodeHtmlEntities = s => s.replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(d)).replace(/&quot;|&apos;|&amp;|&lt;|&gt;/g, m=>({ "&quot;":"\"","&apos;":"'","&amp;":"&","&lt;":"<","&gt;":">" }[m]));

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    appCurrency: {
      ratesUsd: window.currencyRatesUsd || {},
      currency: window.defaultCurrency || 'usd',

      convert(price, fromCurrency, toCurrency = this.currency) {
        const fromRate = this.ratesUsd[fromCurrency.toLowerCase()];
        const toRate = this.ratesUsd[toCurrency.toLowerCase()];

        if (fromCurrency === toCurrency) {
          return price;
        }
        
        if (!fromRate || !toRate) {
          console.error('Invalid currency conversion', { fromCurrency, toCurrency, rates: this.ratesUsd });
          return price;
        }

        return (price / fromRate) * toRate;
      },
      
      format(price, fromCurrency, locale = 'en-US') {
        const toCurrency = this.currency || fromCurrency;
        const convertedPrice = this.convert(price, fromCurrency, toCurrency);

        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: toCurrency,
          currencyDisplay: 'symbol',
        }).format(convertedPrice);
      },
      
      init() {
        const storedCurrency = localStorage.getItem('currency')?.toLowerCase();

        if (storedCurrency && this.ratesUsd[storedCurrency]) {
          this.currency = storedCurrency;
        } else if (storedCurrency) {
          console.error('Invalid currency in local storage', storedCurrency, this.ratesUsd);
        }

        window.addEventListener('load', () => {
          if (document.querySelector('.currency-selector select')) {
            document.querySelectorAll('.currency-selector select').forEach((element) => {
              const choices = new Choices(element, { 
                searchPlaceholderValue: 'Currency', 
                shouldSort: false, 
                allowHTML: true 
              });
              
              choices.passedElement.element.addEventListener('change', (event) => {
                this.currency = event.detail.value;
                localStorage.setItem('currency', this.currency);
              });

              choices.setChoiceByValue(this.currency);

              // Workaround to fix default value highlight issue
              const selectedChoiceElement = choices.choiceList.element.querySelector('.is-selected');
              if (selectedChoiceElement) {
                choices._highlightChoice(selectedChoiceElement);
              }
            });
          }
        });
      },
    },

    appCart: {
      items: [],
      
      updateLocalStorage: function () {
        localStorage.setItem('cart', JSON.stringify(this.items));
      },
      
      set: function (items) {
        this.items = items;
        this.updateLocalStorage();
      },
      
      add: function (productId, variantId, quantity, parentVariantId = null) {
        const item = this.items.find((item) => item.variantId === variantId && (!item.parentVariantId || item.parentVariantId === parentVariantId));

        if (item) {
          item.quantity += quantity;
        } else {
          this.items.push({ productId, variantId, quantity, parentVariantId });
        }

        this.updateLocalStorage();
      },
      
      remove: function (variantId, parentVariantId = null) {
        this.items = this.items.filter((item) => item.variantId !== variantId || (item.parentVariantId && item.parentVariantId !== parentVariantId));
        this.updateLocalStorage();
      },
      
      editQuantity: function (variantId, quantity) {
        const item = this.items.find((item) => item.variantId === variantId);
        item.quantity = quantity;
        this.updateLocalStorage();
      },

      isInCart: function (variantId, parentVariantId = null) {
        return this.items.some((item) => item.variantId === variantId && (!item.parentVariantId || item.parentVariantId === parentVariantId));
      },
      
      get countWithQuantities() {
        return this.items.reduce((acc, item) => {
          if (!item.parentVariantId) {
            return acc + item.quantity;
          }

          return acc;
        }, 0);
      },
      
      init: function () {
        if (localStorage.getItem('cart')) {
          try {
            this.items = JSON.parse(localStorage.getItem('cart'));
            if (!Array.isArray(this.items)) {
              this.items = [];
            }
          } catch (error) {
            console.error('Error parsing cart from local storage', error);
            this.items = [];
          }
        }
      }
    },

    appCustomer: {
      modalStep: 1,
      modalEmail: '',
      modalOtpDigits: Array(6).fill(''),
      modalEmailError: '',
      modalOtpError: '',
      modalLoading: false,
      altchaPayload: null,
      afterLoginPath: '/customer/dashboard',

      addAltchaEventListener: function () {
        window.alpineApp.$refs['appCustomer.altcha'].addEventListener('statechange', (event) => {
          if (event.detail.state === 'verifying') {
            this.buyNowDisabled = true;
          } else if (event.detail.state === 'verified') {
            this.buyNowDisabled = false;
            this.altchaPayload = event.detail.payload;
          }
        });
      },

      modalOpen() {
        this.modalStep = 1;

        zzModal('customer-login-modal', 'show');

        window.alpineApp.$nextTick(() => {
          window.alpineApp.$refs['appCustomer.modalEmailInput'].focus();
        });
      },

      modalClose() {
        zzModal('customer-login-modal', 'hide');
        
        setTimeout(() => {
          this.modalEmail = '';
          this.otp = '';
          this.modalStep = 1;
          this.modalEmailError = '';
          this.modalOtpError = '';
        }, 300); // Transition
      },

      async modalRequestOtp() {
        this.modalEmailError = '';
        this.modalOtpError = '';
        this.modalLoading = true;
  
        try {
          const response = await fetch(`${window.apiBaseUrl}v1/customer-dashboard/request-otp`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: this.modalEmail,
              shop_id: window.shopId,
              altcha: this.altchaPayload
            })
          });
  
          const data = await response.json();
  
          if (data.success) {
            this.modalStep = 2;
            setTimeout(() => {
              window.alpineApp.$refs['appCustomer.modalOtpInputs[0]'].focus();
            }, 10);
          } else {
            this.modalEmailError = data?.message || 'Failed to send OTP. Please try again.';
          }
        } catch (error) {
          this.modalEmailError = 'Network error. Please try again.';
        } finally {
          this.modalLoading = false;
        }
      },

      modalOtpHandleInput(index) {
        const input = this.modalOtpDigits[index];
        
        if (input === '' || /^\d$/.test(input)) {
          if (input && index < this.modalOtpDigits.length - 1) {
            window.alpineApp.$refs[`appCustomer.modalOtpInputs[${index + 1}]`].focus();
          }
        } else {
          this.modalOtpDigits[index] = '';
        }
      },
  
      modalOtpHandleKeyDown(index, event) {
        if (event.key === 'Backspace' && !this.modalOtpDigits[index] && index > 0) {
          window.alpineApp.$refs[`appCustomer.modalOtpInputs[${index - 1}]`].focus();
        }
      },
  
      modalOtpHandlePaste(event) {
        event.preventDefault();
        const pastedData = event.clipboardData.getData('text');

        if (/^\d+$/.test(pastedData)) {
          const newOtp = pastedData.split('').slice(0, this.modalOtpDigits.length);
          
          newOtp.forEach((digit, index) => {
            this.modalOtpDigits[index] = digit;
          });
  
          for (let i = newOtp.length; i < this.modalOtpDigits.length; i++) {
            this.modalOtpDigits[i] = '';
          }
  
          window.alpineApp.$refs[`appCustomer.modalOtpInputs[${this.modalOtpDigits.length - 1}]`].focus();
        }
      },
  
      async modalLogin() {
        const otp = this.modalOtpDigits.join('');

        if (otp.length !== 6) {
          this.modalOtpError = 'Invalid OTP.';
          return;
        }
  
        this.modalEmailError = '';
        this.modalOtpError = '';
        this.modalLoading = true;
  
        try {
          const formData = {
            email: this.modalEmail,
            otp: otp,
            shop_id: window.shopId,
          };

          const affiliate = localStorage.getItem('affiliate');
          if (affiliate) {
            formData.affiliate = affiliate;
          }

          const response = await fetch(`${window.apiBaseUrl}v1/customer-dashboard/login`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
          });
  
          const data = await response.json();
  
          if (data.token) {
            Cookies.set('shop_customer_token', data.token, { expires: 30, path: '/', secure: true, sameSite: 'strict' });
            window.location.href = this.afterLoginPath || '/customer/dashboard';
          } else {
            this.modalOtpError = data?.message || 'Invalid credentials.';
          }
        } catch (error) {
          console.error(error);
          this.modalOtpError = data?.message || 'Invalid credentials.';
        } finally {
          this.modalLoading = false;
        }
      },

      loginOrRedirect() {
        if (window.shopCustomer) {
          window.location.href = '/customer/dashboard';
        } else {
          this.modalOpen();
        }
      },

      async logout() {
        const token = Cookies.get('shop_customer_token');

        if (!token) {
          return;
        }

        try {
          fetch(`${window.apiBaseUrl}v1/customer-dashboard/logout`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            }
          });
        } catch (error) {
          console.error('Logout error', error);
        }

        Cookies.remove('shop_customer_token');
        window.location.href = '/';
      },

      deleteModalLoading: false,

      async deleteAccount() {
        const token = Cookies.get('shop_customer_token');

        if (!token) {
          return;
        }

        this.deleteModalLoading = true;
        
        try {
          const response = await fetch(`${window.apiBaseUrl}v1/customer-dashboard/delete-account`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          const data = await response.json();
          
          if (data.success) {
            Cookies.remove('shop_customer_token');
            window.location.href = '/';
          } else {
            console.error('Delete account error', data);
            alert(data.message || 'Failed to delete account. Please try again.');
          }
        } catch (error) {
          console.error('Delete account error', error);
          alert('Network error. Please try again.');
        } finally {
          this.deleteModalLoading = false;
        }
      },

      init() {
        if (window.alpineApp.$refs['appCustomer.altcha']) {
          this.addAltchaEventListener();
        }
        
        if (window.alpineApp.$refs['appCustomer.modalOtpInputs[0]']) {
          window.alpineApp.$refs['appCustomer.modalOtpInputs[0]'].addEventListener('paste', (event) => this.modalOtpHandlePaste(event));
        }

        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.get('login') === '1') {
          zzReady(() => {
            this.modalOpen();
          });

          const back = urlParams.get('back');
          if (['dashboard', 'invoices', 'tickets', 'balance', 'affiliate'].includes(back)) {
            urlParams.delete('login');
            urlParams.delete('back');
            this.afterLoginPath = `/customer/${back}?${urlParams.toString()}`;
          }
        }

        const affiliate = urlParams.get('a');
        if (affiliate) {
          localStorage.setItem('affiliate', affiliate);
        }
      }
    },

    appTickets: {
      invoiceId: '',
      subject: '',
      message: '',
      error: '',
      loading: false,

      modalOpen(invoiceId = '') {
        this.invoiceId = invoiceId;

        zzModal('ticket-create-modal', 'show');

        window.alpineApp.$nextTick(() => {
          window.alpineApp.$refs['appTickets.subjectInput'].focus();
        });
      },

      modalClose() {
        zzModal('ticket-create-modal', 'hide');
        
        setTimeout(() => {
          this.invoiceId = '';
          this.subject = '';
          this.message = '';
          this.error = '';
          this.loading = false;
        }, 300);
      },

      async submitTicket() {
        const token = Cookies.get('shop_customer_token');

        if (!token) {
          return;
        }

        this.error = '';
        this.loading = true;

        try {
          const response = await fetch(`${window.apiBaseUrl}v1/customer-dashboard/tickets`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              invoice_id: this.invoiceId,
              subject: this.subject,
              content: this.message
            })
          });

          const data = await response.json();

          if (data.success) {
            this.modalClose();
            window.location.href = `/customer/tickets/${data?.ticket?.id}`;
          } else {
            this.error = data?.message || 'Failed to create ticket. Please try again.';
          }
        } catch (error) {
          this.error = 'Network error. Please try again.';
          console.error('Ticket creation error:', error);
        } finally {
          this.loading = false;
        }
      },

      init() {
        const urlParams = new URLSearchParams(window.location.search);
        const ticketInvoiceId = urlParams.get('ticket-invoice-id');
        if (ticketInvoiceId) {
          this.modalOpen(ticketInvoiceId);
        }
      }
    },

    appAffiliate: {
      editCodeValue: '',
      editCodeError: '',
      editCodeLoading: false,

      modalEditCodeOpen(initialValue = '') {
        zzModal('affiliate-edit-code-modal', 'show');

        this.editCodeValue = initialValue;

        window.alpineApp.$nextTick(() => {
          window.alpineApp.$refs['appAffiliate.editCodeInput'].focus();
        });
      },

      modalClose() {
        zzModal('affiliate-edit-code-modal', 'hide');
        
        setTimeout(() => {
          this.editCodeValue = '';
          this.error = '';
          this.loading = false;
        }, 300);
      },

      async submitEditCode() {
        const token = Cookies.get('shop_customer_token');

        if (!token) {
          return;
        }

        this.editCodeError = '';
        this.editCodeLoading = true;

        try {
          const response = await fetch(`${window.apiBaseUrl}v1/customer-dashboard/affiliate/edit-code`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              affiliate_code: this.editCodeValue
            })
          });

          const data = await response.json();

          if (data.success) {
            this.modalClose();
            window.location.reload();
          } else {
            this.editCodeError = data?.message || 'Failed to update affiliate code. Please try again.';
          }
        } catch (error) {
          this.editCodeError = 'Network error. Please try again.';
          console.error('Affiliate code update error:', error);
        } finally {
          this.editCodeLoading = false;
        }
      }
    },

    appMaintenance: {
      modalPassword: '',
      modalError: '',
      modalLoading: false,
      
      modalOpen() {
        zzModal('maintenance-login-modal', 'show');

        window.alpineApp.$nextTick(() => {
          window.alpineApp.$refs['appMaintenance.modalPasswordInput'].focus();
        });
      },

      modalClose() {
        zzModal('maintenance-login-modal', 'hide');

        setTimeout(() => {
          this.modalPassword = '';
          this.modalError = '';
        }, 300); // Transition
      },

      async modalLogin() {
        this.modalError = '';
        this.modalOtpError = '';
        this.modalLoading = true;

        try {
          const response = await fetch('/maintenance', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
              password: this.modalPassword,
            })
          });

          const data = await response.json();

          if (data.success) {
            window.location.href = '/';
          } else {
            this.modalError = data?.message || 'Failed to login. Please try again.';
            this.modalLoading = false;
          }
        } catch (error) {
          this.modalError = 'Network error. Please try again.';
          this.modalLoading = false;
        }
      },
    },

    init: function () {
      window.alpineApp = this;

      this.appCurrency.init();
      this.appCart.init();
      this.appCustomer.init();
      this.appTickets.init();
    }
  }));
});

function snow(config = {}) {
  const settings = {
    count: config.count || 200,
    minSize: config.minSize || 0.5,
    maxSize: config.maxSize || 1.0,
    minSpeed: config.minSpeed || 10,
    maxSpeed: config.maxSpeed || 30,
  };

  const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  let html = '', css = '';

  for (let i = 1; i < settings.count; i++) {
    html += '<i class="snowflake"></i>';
    
    const sizeMultiplier = settings.minSize + (Math.random() * (settings.maxSize - settings.minSize));
    const rndX = (rand(0, 1000000) * 0.0001);
    const rndO = rand(-100000, 100000) * 0.0001;
    const rndT = (rand(3, 8) * 10).toFixed(2);
    const rndS = (sizeMultiplier * rand(0, 10000) * 0.0001).toFixed(2);
    const animationDuration = rand(settings.minSpeed, settings.maxSpeed);
    
    css += '.snowflake:nth-child(' + i + ') {' +
      'opacity: ' + (rand(1, 10000) * 0.0001).toFixed(2) + ';' +
      'transform: translate(' + rndX.toFixed(2) + 'vw, -10px) scale(' + rndS + ');' +
      'animation: fall-' + i + ' ' + animationDuration + 's -' + rand(0, 30) + 's linear infinite' +
    '}' +
    '@keyframes fall-' + i + ' {' +
      rndT + '% {' +
        'transform: translate(' + (rndX + rndO).toFixed(2) + 'vw, ' + rndT + 'vh) scale(' + rndS + ')' +
      '}' +
      'to {' +
        'transform: translate(' + (rndX + (rndO / 2)).toFixed(2) + 'vw, 105vh) scale(' + rndS + ')' +
      '}' +
    '}';
  }

  document.getElementById('snow').innerHTML = html;

  const style = document.createElement('style');
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
}
/* =============================================================================
   ZAZA CHEATS — sitewide enhancement layer (conversion + on-brand HUD).
   Self-contained: injects its own CSS + DOM. Paste at the very end of script.js.
   Disabled under prefers-reduced-motion. Edit ZZ_ENH to tune copy / data.
   ============================================================================= */
;(function () {
  'use strict';
  if (window.__zzEnhanced) return;
  window.__zzEnhanced = true;

  var ZZ_ENH = {
    productUrl: '/product/zaza-rust-private-cheat',
    stats: [
      { n: 147,  pre: '', suf: '',  label: 'players online now', green: false, pulse: true },
      { n: 632, pre: '', suf: '+', label: 'keys delivered',      green: false, pulse: false },
      { n: 12,   pre: '~', suf: 's', label: 'avg. delivery time',  green: false, pulse: false },
      { text: 'Never', label: 'last detection', green: true, pulse: false }
    ],
    users: ['xR***st','Gh0st_**','val****z','sn1p******','Ksa***','pr0****r','z***yy',
      'toxic****','ripp***','frost***','n0****py','aim****d','w1nt***','dr***o',
      'sh****w','mavr***','lu***s','b1g****','qu***x','ze***h','r***vn','p***le'],
    where: ['London, UK','Berlin, DE','Warsaw, PL','Austin, US','Toronto, CA',
      'Sydney, AU','Amsterdam, NL','Paris, FR','Madrid, ES','Oslo, NO',
      'Dublin, IE','Prague, CZ','Miami, US','Manchester, UK','Denver, US',
      'Stockholm, SE','Lisbon, PT','Vienna, AT','Helsinki, FI','Seattle, US'],
    actions: [
      { t: 'activated a <b>1 Month key</b>', w: 4 },
      { t: 'activated a <b>1 Week key</b>', w: 5 },
      { t: 'grabbed a <b>Lifetime key</b>', w: 3 },
      { t: 'started a <b>1 Day key</b>', w: 3 },
      { t: 'renewed their <b>1 Month key</b>', w: 3 },
      { t: 'left a <b>5&#9733; review</b>', w: 3 },
      { t: 'joined the <b>Discord</b>', w: 2 },
      { t: 'passed <b>30 days undetected</b>', w: 2 }
    ]
  };

  function boot() {
    var doc = document, body = doc.body;
    if (!body) return;

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var isMaint = !doc.querySelector('header') && !doc.querySelector('.components');

    injectStyles(doc);
    if (isMaint) return;

    try { buildStats(doc, reduce); } catch (e) {}
    try { buildFeed(doc, reduce); } catch (e) {}
    try { buildHud(doc, reduce); } catch (e) {}
    try { buildKonami(doc, reduce); } catch (e) {}
  }

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function pickW(list) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].w;
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) { r -= list[i].w; if (r <= 0) return list[i]; }
    return list[0];
  }

  function injectStyles(doc) {
    if (doc.getElementById('zz-enh-styles')) return;
    var css = "";
    css += ".zzst{max-width:960px;margin:56px auto 8px;padding:0 16px;font-family:'Satoshi','Inter',system-ui,sans-serif}";
    css += ".zzst__inner{display:flex;align-items:stretch;justify-content:center;gap:6px;flex-wrap:wrap;padding:20px 18px;border-radius:18px;background:linear-gradient(180deg,rgba(191,64,191,.06),rgba(255,255,255,.015));border:1px solid rgba(191,64,191,.18);box-shadow:0 20px 50px -30px rgba(191,64,191,.6),inset 0 1px 0 rgba(255,255,255,.04)}";
    css += ".zzst__item{flex:1;min-width:150px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:6px 10px;position:relative;text-align:center}";
    css += ".zzst__pulse{position:absolute;top:8px;right:calc(50% - 46px);width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.9);animation:zzstPulse 1.8s ease-in-out infinite}";
    css += "@keyframes zzstPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}";
    css += ".zzst__num{font-size:clamp(1.7rem,3.4vw,2.35rem);font-weight:800;letter-spacing:-.02em;line-height:1;color:#fff;font-variant-numeric:tabular-nums;background:linear-gradient(180deg,#ffffff,#e0b3ff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 2px 12px rgba(191,64,191,.35))}";
    css += ".zzst__num--g{background:linear-gradient(180deg,#eafff2,#4ade80);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 2px 12px rgba(34,197,94,.35))}";
    css += ".zzst__lbl{font-size:.72rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:rgba(200,215,240,.55)}";
    css += ".zzst__div{width:1px;align-self:center;height:38px;flex-shrink:0;background:linear-gradient(180deg,transparent,rgba(191,64,191,.35),transparent)}";
    css += "@media(max-width:620px){.zzst__inner{gap:0}.zzst__item{flex:1 1 45%;min-width:45%;padding:12px 8px}.zzst__div{display:none}.zzst__pulse{right:calc(50% - 40px)}}";
    css += ".zzla{position:fixed;left:18px;bottom:18px;z-index:960;width:320px;max-width:calc(100vw - 36px);pointer-events:none;font-family:'Satoshi','Inter',system-ui,sans-serif;display:none}";
    css += "@media(min-width:769px){.zzla{display:block}}";
    css += ".zzla__card{pointer-events:auto;position:relative;overflow:hidden;display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:14px;background:linear-gradient(180deg,rgba(12,16,38,.94),rgba(7,10,26,.94));border:1px solid rgba(191,64,191,.28);box-shadow:0 18px 44px -16px rgba(0,0,0,.8),0 0 22px -10px rgba(191,64,191,.5),inset 0 1px 0 rgba(255,255,255,.05);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);cursor:pointer;opacity:0;transform:translateY(14px) scale(.98);transition:opacity .4s cubic-bezier(.16,1,.3,1),transform .5s cubic-bezier(.16,1,.3,1)}";
    css += ".zzla.zzla--show .zzla__card{opacity:1;transform:translateY(0) scale(1)}";
    css += ".zzla__scan{position:absolute;top:0;left:0;right:0;height:1px;pointer-events:none;background:linear-gradient(90deg,transparent,rgba(191,64,191,.9),transparent);opacity:0}";
    css += ".zzla.zzla--show .zzla__scan{animation:zzlaScan 1.1s ease-out}";
    css += "@keyframes zzlaScan{0%{opacity:.9;transform:translateY(0)}100%{opacity:0;transform:translateY(64px)}}";
    css += ".zzla__avatar{flex-shrink:0;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-weight:800;font-size:1rem;color:#fff;background:linear-gradient(135deg,#BF40BF,#7C3AED);box-shadow:0 6px 16px -6px rgba(191,64,191,.8),inset 0 1px 0 rgba(255,255,255,.25);text-transform:uppercase}";
    css += ".zzla__body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}";
    css += ".zzla__line{display:flex;align-items:center;gap:6px;min-width:0}";
    css += ".zzla__dot{flex-shrink:0;width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.9)}";
    css += ".zzla__user{font-size:.82rem;font-weight:800;color:#fff;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}";
    css += ".zzla__verified{flex-shrink:0;display:inline-flex;line-height:0}";
    css += ".zzla__action{font-size:.78rem;color:rgba(214,224,255,.72);line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}";
    css += ".zzla__action b{color:#e6b3ff;font-weight:700}";
    css += ".zzla__foot{display:flex;align-items:center;gap:6px;margin-top:1px}";
    css += ".zzla__tag{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.56rem;font-weight:700;letter-spacing:.14em;color:#4ade80;padding:2px 6px;border-radius:5px;line-height:1;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.28)}";
    css += ".zzla__where,.zzla__time{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.62rem;color:rgba(200,215,240,.5);white-space:nowrap}";
    css += ".zzla__sep{color:rgba(200,215,240,.3);font-size:.62rem}";
    css += ".zzla__x{position:absolute;top:7px;right:7px;width:20px;height:20px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5);cursor:pointer;opacity:0;transition:opacity .2s,color .2s,background .2s}";
    css += ".zzla__card:hover .zzla__x{opacity:1}.zzla__x:hover{color:#fff;background:rgba(255,255,255,.12)}";
    css += ".zzhud{position:fixed;inset:0;z-index:2147483000;pointer-events:none;color:#e8b3ff;opacity:0;transition:opacity .3s ease;display:none}";
    css += ".zzhud.zzhud--on{opacity:1}";
    css += "@media(hover:hover) and (pointer:fine) and (min-width:900px){.zzhud{display:block}}";
    css += ".zzhud__cross{position:absolute;top:0;left:0;transform:translate3d(var(--x,-100px),var(--y,-100px),0) translate(-50%,-50%) rotate(var(--spin,0deg));transition:opacity .2s ease;filter:drop-shadow(0 0 5px rgba(191,64,191,.6))}";
    css += ".zzhud.zzhud--locked .zzhud__cross{opacity:0}";
    css += ".zzhud__lock{position:absolute;top:0;left:0;width:var(--w,0px);height:var(--h,0px);transform:translate3d(var(--lx,-100px),var(--ly,-100px),0);opacity:0;transition:opacity .18s ease}";
    css += ".zzhud.zzhud--locked .zzhud__lock{opacity:1}";
    css += ".zzhud__c{position:absolute;width:14px;height:14px;border:2px solid #d76bff;filter:drop-shadow(0 0 6px rgba(191,64,191,.8))}";
    css += ".zzhud.zzhud--locked .zzhud__c{animation:zzhudLock .22s cubic-bezier(.16,1,.3,1)}";
    css += "@keyframes zzhudLock{from{transform:scale(1.35);opacity:.4}to{transform:scale(1);opacity:1}}";
    css += ".zzhud__c--tl{top:-3px;left:-3px;border-right:0;border-bottom:0}.zzhud__c--tr{top:-3px;right:-3px;border-left:0;border-bottom:0}";
    css += ".zzhud__c--bl{bottom:-3px;left:-3px;border-right:0;border-top:0}.zzhud__c--br{bottom:-3px;right:-3px;border-left:0;border-top:0}";
    css += ".zzhud__tag{position:absolute;top:-19px;left:0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9px;font-weight:800;letter-spacing:.16em;color:#fff;background:linear-gradient(135deg,#BF40BF,#7C3AED);padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 4px 12px -4px rgba(191,64,191,.9)}";
    css += ".zzgod{position:fixed;inset:0;z-index:2147483001;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:radial-gradient(circle at 50% 45%,rgba(191,64,191,.16),rgba(6,9,26,.55) 60%,rgba(6,9,26,.82));opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s}";
    css += ".zzgod.zzgod--on{opacity:1;visibility:visible}";
    css += ".zzgod__txt{font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:800;font-size:clamp(1.6rem,6vw,3.4rem);letter-spacing:.14em;color:#fff;text-shadow:0 0 24px rgba(191,64,191,.9),0 0 60px rgba(124,58,237,.6)}";
    css += ".zzgod__sub{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.8rem;letter-spacing:.1em;color:#4ade80}";
    css += ".zzgod__scan{position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,rgba(216,107,255,.9),transparent);box-shadow:0 0 14px rgba(191,64,191,.9)}";
    css += ".zzgod.zzgod--on .zzgod__scan{animation:zzgodScan 1s linear infinite}";
    css += "@keyframes zzgodScan{from{transform:translateY(0)}to{transform:translateY(100vh)}}";
    css += "@media(prefers-reduced-motion:reduce){.zzhud,.zzgod{display:none!important}.zzla__scan{display:none}.zzla__card{transition:opacity .2s ease}.zzla.zzla--show .zzla__card{transform:none}}";

    var st = doc.createElement('style');
    st.id = 'zz-enh-styles';
    st.appendChild(doc.createTextNode(css));
    doc.head.appendChild(st);
  }

  function buildStats(doc, reduce) {
    if (doc.querySelector('.zzst')) return;
    var sec = doc.createElement('section');
    sec.className = 'zzst';
    sec.setAttribute('aria-label', 'Store stats');
    var html = '<div class="zzst__inner">';
    for (var i = 0; i < ZZ_ENH.stats.length; i++) {
      var s = ZZ_ENH.stats[i];
      if (i > 0) html += '<span class="zzst__div" aria-hidden="true"></span>';
      if (s.text) {
        html += '<div class="zzst__item">' +
          (s.pulse ? '<span class="zzst__pulse" aria-hidden="true"></span>' : '') +
          '<span class="zzst__num' + (s.green ? ' zzst__num--g' : '') + '">' + s.text + '</span>' +
          '<span class="zzst__lbl">' + s.label + '</span></div>';
        continue;
      }
      html += '<div class="zzst__item">' +
        (s.pulse ? '<span class="zzst__pulse" aria-hidden="true"></span>' : '') +
        '<span class="zzst__num' + (s.green ? ' zzst__num--g' : '') + '" data-zzst="' + s.n +
        '" data-pre="' + s.pre + '" data-suf="' + s.suf + '">' + s.pre + s.n + s.suf + '</span>' +
        '<span class="zzst__lbl">' + s.label + '</span></div>';
    }
    html += '</div>';
    sec.innerHTML = html;

    var anchor = doc.querySelector('footer, [class*="footer"]');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor);
    else (doc.querySelector('main#zz-main') || doc.querySelector('.components') || doc.body).appendChild(sec);

    var nums = sec.querySelectorAll('.zzst__num[data-zzst]');
    function render(el, v) {
      el.textContent = (el.getAttribute('data-pre') || '') + v.toLocaleString('en-US') + (el.getAttribute('data-suf') || '');
    }
    function run(el) {
      var target = parseInt(el.getAttribute('data-zzst'), 10) || 0;
      if (reduce) { render(el, target); return; }
      var startT = null;
      (function step(ts) {
        if (!startT) startT = ts;
        var p = Math.min((ts - startT) / 1400, 1);
        render(el, Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step); else render(el, target);
      })(0);
    }
    if (!('IntersectionObserver' in window)) {
      for (var k = 0; k < nums.length; k++) run(nums[k]);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.4 });
    for (var j = 0; j < nums.length; j++) io.observe(nums[j]);
  }

  function buildFeed(doc, reduce) {
    var KEY = 'zz-live-dismissed';
    try { if (sessionStorage.getItem(KEY)) return; } catch (e) {}
    if (doc.getElementById('zz-live')) return;

    var root = doc.createElement('div');
    root.className = 'zzla';
    root.id = 'zz-live';
    root.setAttribute('aria-hidden', 'true');
    root.hidden = true;
    root.innerHTML =
      '<div class="zzla__card" role="status">' +
      '<span class="zzla__scan" aria-hidden="true"></span>' +
      '<span class="zzla__avatar" data-zzla-av aria-hidden="true">R</span>' +
      '<div class="zzla__body"><div class="zzla__line">' +
      '<span class="zzla__dot" aria-hidden="true"></span>' +
      '<span class="zzla__user" data-zzla-user>Someone</span>' +
      '<span class="zzla__verified" title="Verified activation" aria-label="Verified">' +
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.5l7 3v5.2c0 4.3-2.9 7.9-7 9.3-4.1-1.4-7-5-7-9.3V5.5l7-3z" fill="rgba(34,197,94,.18)" stroke="#22c55e" stroke-width="1.6"/><path d="M8.6 12.2l2.4 2.4 4.6-4.8" stroke="#22c55e" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>' +
      '<div class="zzla__action" data-zzla-action>activated a key</div>' +
      '<div class="zzla__foot"><span class="zzla__tag">LIVE</span>' +
      '<span class="zzla__where" data-zzla-where>&mdash;</span>' +
      '<span class="zzla__sep" aria-hidden="true">&middot;</span>' +
      '<span class="zzla__time" data-zzla-time>just now</span></div></div>' +
      '<button type="button" class="zzla__x" data-zzla-close aria-label="Dismiss activity feed">' +
      '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>';
    doc.body.appendChild(root);

    var mqShow = window.matchMedia('(min-width:769px)');
    var card = root.querySelector('.zzla__card');
    var elUser = root.querySelector('[data-zzla-user]');
    var elAv = root.querySelector('[data-zzla-av]');
    var elAction = root.querySelector('[data-zzla-action]');
    var elWhere = root.querySelector('[data-zzla-where]');
    var elTime = root.querySelector('[data-zzla-time]');
    var btnClose = root.querySelector('[data-zzla-close]');
    var TIMES = ['just now', '1 min ago', '2 min ago', '3 min ago', '5 min ago', '7 min ago', '9 min ago'];
    var showT = null, hideT = null, loopT = null, visible = false;

    function fill() {
      var u = pick(ZZ_ENH.users);
      elUser.textContent = u;
      elAv.textContent = (u.replace(/[^a-z0-9]/gi, '')[0] || 'R');
      elAction.innerHTML = pickW(ZZ_ENH.actions).t;
      elWhere.textContent = pick(ZZ_ENH.where);
      elTime.textContent = (Math.random() < 0.45 ? 'just now' : pick(TIMES));
    }
    function show() {
      if (!mqShow.matches) return schedule();
      fill();
      root.hidden = false;
      void card.offsetWidth;
      root.classList.add('zzla--show');
      visible = true;
      hideT = setTimeout(hide, reduce ? 9000 : 6200);
    }
    function hide() { root.classList.remove('zzla--show'); visible = false; schedule(); }
    function schedule() {
      clearTimeout(loopT);
      var gap = reduce ? (22000 + Math.random() * 12000) : (15000 + Math.random() * 11000);
      loopT = setTimeout(show, gap);
    }
    card.addEventListener('mouseenter', function () { clearTimeout(hideT); });
    card.addEventListener('mouseleave', function () { if (visible) hideT = setTimeout(hide, 2600); });
    card.addEventListener('click', function (e) {
      if (e.target.closest('[data-zzla-close]')) return;
      if (ZZ_ENH.productUrl) window.location.href = ZZ_ENH.productUrl;
    });
    btnClose.addEventListener('click', function (e) {
      e.stopPropagation();
      clearTimeout(showT); clearTimeout(hideT); clearTimeout(loopT);
      root.classList.remove('zzla--show');
      setTimeout(function () { root.hidden = true; }, 300);
      try { sessionStorage.setItem(KEY, '1'); } catch (err) {}
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearTimeout(showT); clearTimeout(hideT); clearTimeout(loopT); }
      else if (!visible) { schedule(); }
    });
    showT = setTimeout(show, reduce ? 4000 : 2200);
  }

  function buildHud(doc, reduce) {
    var fine = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine) and (min-width:900px)').matches;
    if (!fine || reduce) return;
    if (doc.getElementById('zz-hud')) return;

    var hud = doc.createElement('div');
    hud.className = 'zzhud';
    hud.id = 'zz-hud';
    hud.setAttribute('aria-hidden', 'true');
    hud.innerHTML =
      '<svg class="zzhud__cross" width="46" height="46" viewBox="0 0 46 46" fill="none">' +
      '<circle cx="23" cy="23" r="10" stroke="currentColor" stroke-width="1.1" opacity="0.55"/>' +
      '<circle cx="23" cy="23" r="1.6" fill="currentColor"/>' +
      '<path d="M23 4v9M23 33v9M4 23h9M33 23h9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/></svg>' +
      '<div class="zzhud__lock" data-zzhud-lock><span class="zzhud__c zzhud__c--tl"></span><span class="zzhud__c zzhud__c--tr"></span>' +
      '<span class="zzhud__c zzhud__c--bl"></span><span class="zzhud__c zzhud__c--br"></span>' +
      '<span class="zzhud__tag" data-zzhud-tag>LOCKED</span></div>';
    doc.body.appendChild(hud);

    var tag = hud.querySelector('[data-zzhud-tag]');
    var SEL = 'a.pf-btn,.pf-btn--primary,button.pf-btn,.hero-btn,.pc,.pc__buy,' +
      'a[class*="cta"],button[class*="cta"],.zzbb__cta,.scs-discord__btn,' +
      'a.btn-primary,button.btn-primary,.zz-cta__btn,[data-zzhud-target]';
    var TAGS = ['LOCKED', 'TARGET', 'AIM', 'ON TARGET'];
    var x = -100, y = -100, spin = 0, lx = -100, ly = -100, lw = 0, lh = 0,
      tx = -100, ty = -100, tw = 0, th = 0, locked = null, shown = false;

    function setT(el) { var r = el.getBoundingClientRect(), p = 6; tx = r.left - p; ty = r.top - p; tw = r.width + p * 2; th = r.height + p * 2; }
    function loop() {
      hud.style.setProperty('--x', x + 'px');
      hud.style.setProperty('--y', y + 'px');
      spin = (spin + 0.6) % 360;
      hud.style.setProperty('--spin', spin + 'deg');
      if (locked) {
        lx += (tx - lx) * 0.28; ly += (ty - ly) * 0.28; lw += (tw - lw) * 0.28; lh += (th - lh) * 0.28;
        hud.style.setProperty('--lx', lx + 'px');
        hud.style.setProperty('--ly', ly + 'px');
        hud.style.setProperty('--w', lw + 'px');
        hud.style.setProperty('--h', lh + 'px');
      }
      requestAnimationFrame(loop);
    }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      x = e.clientX; y = e.clientY;
      if (!shown) { shown = true; hud.classList.add('zzhud--on'); }
      var t = e.target.closest ? e.target.closest(SEL) : null;
      if (t) {
        if (t !== locked) {
          locked = t; setT(t);
          if (lw < 2) { lx = tx; ly = ty; lw = tw; lh = th; }
          tag.textContent = TAGS[Math.floor(Math.random() * TAGS.length)];
          hud.classList.add('zzhud--locked');
        } else setT(t);
      } else if (locked) { locked = null; hud.classList.remove('zzhud--locked'); }
    }, { passive: true });
    document.addEventListener('mouseleave', function () { hud.classList.remove('zzhud--on'); shown = false; });
    window.addEventListener('scroll', function () { if (locked) setT(locked); }, { passive: true });
    requestAnimationFrame(loop);
  }

  function buildKonami(doc, reduce) {
    if (reduce || doc.getElementById('zz-god')) return;
    var god = doc.createElement('div');
    god.className = 'zzgod';
    god.id = 'zz-god';
    god.setAttribute('aria-hidden', 'true');
    god.innerHTML = '<span class="zzgod__scan"></span><span class="zzgod__txt">GOD&nbsp;MODE&nbsp;ENABLED</span>' +
      '<span class="zzgod__sub">// aim: max &middot; recoil: 0 &middot; esp: on</span>';
    doc.body.appendChild(god);
    var seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65], pos = 0, godT = null;
    window.addEventListener('keydown', function (e) {
      pos = (e.keyCode === seq[pos]) ? pos + 1 : (e.keyCode === seq[0] ? 1 : 0);
      if (pos === seq.length) {
        pos = 0;
        god.classList.add('zzgod--on');
        clearTimeout(godT);
        godT = setTimeout(function () { god.classList.remove('zzgod--on'); }, 2200);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
/* ── Marquee off-screen pause ─────────────────────────────────────────────
   The CSS marquees (title-marquee .zmq__track, custom-features
   .cf-marquee-track) animate infinitely; this pauses them whenever their
   row scrolls out of view so they cost nothing off-screen. Hover-pause
   handled in each component's own CSS still wins while visible because we
   only toggle between running/paused at the element level the CSS also
   uses; reduced-motion users already get animation:none from the
   components. */
(function () {
  if (!('IntersectionObserver' in window)) return;
  function boot() {
    var tracks = document.querySelectorAll('.zmq__track, .cf-marquee-track');
    if (!tracks.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target.style.animationPlayState = en.isIntersecting ? '' : 'paused';
      });
    }, { rootMargin: '60px 0px' });
    tracks.forEach(function (t) { io.observe(t); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* =============================================================================
   ZAZA ARCADE v2 — killfeed, crit numbers, session ranks, tab-recovery title.
   Second enhancement layer; everything here is NEW (no overlap with ZZ_ENH):
   the bottom-left purchase toast, hitmarker, HUD crosshair and konami live in
   the layers above / polish.njk. Self-contained IIFE, injects its own CSS.
   Disabled under prefers-reduced-motion; killfeed + crits are desktop-only.
   ============================================================================= */
;(function () {
  'use strict';
  if (window.__zzArcade) return;
  window.__zzArcade = true;

  var USERS = ['xR***st','Gh0st_**','val****z','sn1p******','Ksa***','pr0****r',
    'z***yy','toxic****','ripp***','frost***','n0****py','aim****d','w1nt***',
    'dr***o','sh****w','mavr***','lu***s','b1g****','qu***x','ze***h'];
  var KF_ITEMS = [
    { ico: '🔑', txt: '1 Month key', w: 4 },
    { ico: '🔑', txt: '1 Week key', w: 5 },
    { ico: '👑', txt: 'Lifetime key', w: 2 },
    { ico: '🔑', txt: '1 Day key', w: 3 },
    { ico: '⭐', txt: '5★ review', w: 3 },
    { ico: '🛡', txt: '30d undetected', w: 2 }
  ];
  var RANKS = [
    { at: 45,  name: 'REGULAR',  sub: 'browsing like a pro' },
    { at: 150, name: 'TRUSTED',  sub: 'the lobby respects you' },
    { at: 360, name: 'VETERAN',  sub: 'basically staff at this point' }
  ];
  var TITLES = [
    '⚠ ENEMY LEFT THE MATCH…',
    '🎯 Your key is still waiting',
    '👀 Still undetected. Still here.'
  ];

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function pickW(list) {
    var t = 0, i; for (i = 0; i < list.length; i++) t += list[i].w;
    var r = Math.random() * t;
    for (i = 0; i < list.length; i++) { r -= list[i].w; if (r <= 0) return list[i]; }
    return list[0];
  }

  function boot() {
    if (!document.body) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var isMaint = !document.querySelector('header') && !document.querySelector('.components');
    if (isMaint) return;
    injectCss();
    try { buildTitleFlip(); } catch (e) {}
    if (reduce) return;
    try { buildKillfeed(); } catch (e) {}
    try { buildCrits(); } catch (e) {}
  }

  function injectCss() {
    if (document.getElementById('zz-arcade-css')) return;
    var c = '';
    /* killfeed — top-right stack under the navbar pill (tier band 880-940) */
    c += '.zzkf{position:fixed;top:96px;right:16px;z-index:935;display:none;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none;font-family:"JetBrains Mono",ui-monospace,monospace}';
    c += '@media(min-width:992px){.zzkf{display:flex}}';
    c += '.zzkf__row{display:flex;align-items:center;gap:7px;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:.02em;color:rgba(224,232,255,.88);background:linear-gradient(180deg,rgba(10,13,32,.88),rgba(7,10,26,.88));border:1px solid rgba(191,64,191,.22);box-shadow:0 10px 26px -14px rgba(0,0,0,.85);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);opacity:0;transform:translateX(24px);transition:opacity .35s cubic-bezier(.16,1,.3,1),transform .45s cubic-bezier(.16,1,.3,1)}';
    c += '.zzkf__row.zzkf--in{opacity:1;transform:none}';
    c += '.zzkf__row.zzkf--out{opacity:0;transform:translateX(18px)}';
    c += '.zzkf__user{color:#e6b3ff}';
    c += '.zzkf__ico{filter:drop-shadow(0 0 6px rgba(191,64,191,.7));font-size:12px}';
    c += '.zzkf__arrow{color:rgba(191,64,191,.9)}';
    c += '.zzkf__item{color:#fff}';
    c += '.zzkf__row--rank{border-color:rgba(242,193,78,.45);box-shadow:0 10px 26px -14px rgba(0,0,0,.85),0 0 18px -6px rgba(242,193,78,.5)}';
    c += '.zzkf__row--rank .zzkf__item{color:#f2c14e;text-shadow:0 0 12px rgba(242,193,78,.5)}';
    c += '.zzkf__row--rank .zzkf__user{color:#fff}';
    c += '.zzkf__sub{color:rgba(200,215,240,.55);font-weight:500}';
    /* crit numbers + combo */
    c += '.zzcrit{position:fixed;z-index:1310;pointer-events:none;font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:800;font-size:15px;letter-spacing:.04em;color:#fff;text-shadow:0 0 10px rgba(191,64,191,.9),0 2px 4px rgba(0,0,0,.6);animation:zzcritUp .9s cubic-bezier(.16,1,.3,1) forwards}';
    c += '.zzcrit--big{font-size:19px;color:#f2c14e;text-shadow:0 0 14px rgba(242,193,78,.8),0 2px 4px rgba(0,0,0,.6)}';
    c += '@keyframes zzcritUp{0%{opacity:0;transform:translate(-50%,0) scale(.7)}18%{opacity:1;transform:translate(-50%,-14px) scale(1.12)}100%{opacity:0;transform:translate(-50%,-52px) scale(1)}}';
    c += '@media(hover:none),(max-width:991px){.zzcrit{display:none}}';
    var s = document.createElement('style');
    s.id = 'zz-arcade-css';
    s.textContent = c;
    document.head.appendChild(s);
  }

  /* -- killfeed: occasional CS-style rows, plus YOUR rank-ups over the session.
     Deliberately sparse (18-34s apart, max 3 rows) so it reads as ambient
     activity, not spam; pauses entirely while the tab is hidden. */
  function buildKillfeed() {
    if (document.getElementById('zz-kf')) return;
    var kf = document.createElement('div');
    kf.className = 'zzkf'; kf.id = 'zz-kf';
    kf.setAttribute('aria-hidden', 'true');
    document.body.appendChild(kf);

    function push(html, rank) {
      var row = document.createElement('div');
      row.className = 'zzkf__row' + (rank ? ' zzkf__row--rank' : '');
      row.innerHTML = html;
      kf.appendChild(row);
      while (kf.children.length > 3) kf.removeChild(kf.firstChild);
      requestAnimationFrame(function () { row.classList.add('zzkf--in'); });
      setTimeout(function () {
        row.classList.add('zzkf--out');
        setTimeout(function () { if (row.parentNode) row.parentNode.removeChild(row); }, 500);
      }, rank ? 6200 : 4600);
    }

    function feedLine() {
      var it = pickW(KF_ITEMS);
      push('<span class="zzkf__user">' + pick(USERS) + '</span>' +
           '<span class="zzkf__arrow">▸</span>' +
           '<span class="zzkf__ico">' + it.ico + '</span>' +
           '<span class="zzkf__item">' + it.txt + '</span>');
    }

    var next;
    function loop() {
      next = setTimeout(function () {
        if (!document.hidden) feedLine();
        loop();
      }, 18000 + Math.random() * 16000);
    }
    setTimeout(function () { if (!document.hidden) feedLine(); loop(); }, 9000);

    /* session rank-ups (cosmetic progression; persists across pages) */
    var t0 = Date.now();
    try { t0 -= (+sessionStorage.getItem('zzRankT') || 0) * 1000; } catch (e) {}
    setInterval(function () {
      var secs = (Date.now() - t0) / 1000;
      try { sessionStorage.setItem('zzRankT', String(Math.floor(secs))); } catch (e) {}
      var seen = {};
      try { seen = JSON.parse(sessionStorage.getItem('zzRanks') || '{}'); } catch (e) {}
      for (var i = 0; i < RANKS.length; i++) {
        var r = RANKS[i];
        if (secs >= r.at && !seen[r.name]) {
          seen[r.name] = 1;
          try { sessionStorage.setItem('zzRanks', JSON.stringify(seen)); } catch (e) {}
          if (!document.hidden) {
            push('<span class="zzkf__user">YOU</span>' +
                 '<span class="zzkf__arrow">▲</span>' +
                 '<span class="zzkf__item">RANK UP: ' + r.name + '</span>' +
                 '<span class="zzkf__sub">// ' + r.sub + '</span>', true);
          }
        }
      }
    }, 5000);
  }

  /* -- crit numbers: floating damage text when a buy CTA is clicked; rapid
     consecutive clicks build a combo. Rides alongside the polish.njk
     hitmarker (that one is the X flash; this is the number). */
  function buildCrits() {
    var SEL = '.btn-primary,.pc__buy,.zz-cta__btn,button[type=submit]';
    var combo = 0, comboT = null;
    var WORDS = ['+100', 'CRIT!', 'HEADSHOT', '+1 KEY', 'NICE'];
    document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest(SEL) : null;
      if (!t) return;
      combo++;
      clearTimeout(comboT);
      comboT = setTimeout(function () { combo = 0; }, 1800);
      var el = document.createElement('span');
      var big = combo >= 3;
      el.className = 'zzcrit' + (big ? ' zzcrit--big' : '');
      el.textContent = big ? ('×' + combo + ' COMBO!') : pick(WORDS);
      el.style.left = e.clientX + 'px';
      el.style.top = (e.clientY - 18) + 'px';
      document.body.appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 950);
    }, { passive: true });
  }

  /* -- tab-recovery title: when the visitor tabs away, the tab title flips to
     an on-brand callback so the tab wins them back; restored on return.
     Skipped on the status page, which manages document.title itself. */
  function buildTitleFlip() {
    if (/\/status/.test(location.pathname)) return;
    var orig = null;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (orig === null) orig = document.title;
        document.title = pick(TITLES);
      } else if (orig !== null) {
        document.title = orig;
        orig = null;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* =============================================================================
   ZAZA CRO v3 — real conversion levers (not just decoration):
   1. cart-abandonment recovery toast (bottom-right, works on mobile too)
   2. cart-aware tab title override (rides on the arcade layer's flip)
   3. "continue where you left off" product recall on home/list pages
   4. live-viewers chip on product pages (session-stable count)
   5. idle re-engagement pulse on the Buy Now button
   Self-contained IIFE. Toasts share one bottom-right slot; cart wins.
   Functional pieces (1-3) stay on under prefers-reduced-motion — only the
   decorative pulse/drift animations are gated.
   ============================================================================= */
;(function () {
  'use strict';
  if (window.__zzCro) return;
  window.__zzCro = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var path = location.pathname;
  var onProduct = /\/product\//.test(path);
  var onCartish = /\/(cart|checkout|invoice)/.test(path);

  function cartItems() {
    try {
      var c = JSON.parse(localStorage.getItem('cart') || '[]');
      return (c && c.length) ? c : null;
    } catch (e) { return null; }
  }
  function ss(k, v) {
    try {
      if (arguments.length === 2) sessionStorage.setItem(k, v);
      else return sessionStorage.getItem(k);
    } catch (e) { return null; }
  }

  function boot() {
    if (!document.body) return;
    if (!document.querySelector('header') && !document.querySelector('.components')) return;
    injectCss();
    try { saveLastProduct(); } catch (e) {}
    try { cartTitle(); } catch (e) {}
    try { bottomRightToast(); } catch (e) {}
    try { liveViewers(); } catch (e) {}
    try { idlePulse(); } catch (e) {}
  }

  function injectCss() {
    if (document.getElementById('zz-cro-css')) return;
    var c = '';
    /* shared bottom-right toast (cart recovery / resume browsing) */
    c += '.zzct{position:fixed;right:16px;bottom:16px;z-index:1305;width:330px;max-width:calc(100vw - 32px);font-family:"Satoshi","Inter",system-ui,sans-serif;opacity:0;transform:translateY(16px);transition:opacity .45s cubic-bezier(.16,1,.3,1),transform .55s cubic-bezier(.16,1,.3,1);pointer-events:none}';
    c += '.zzct.zzct--show{opacity:1;transform:none;pointer-events:auto}';
    c += '.zzct__card{position:relative;padding:14px 14px 12px;border-radius:14px;background:linear-gradient(180deg,rgba(12,16,38,.96),rgba(7,10,26,.96));border:1px solid rgba(191,64,191,.32);box-shadow:0 20px 48px -18px rgba(0,0,0,.85),0 0 24px -10px rgba(191,64,191,.55);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}';
    c += '.zzct__head{display:flex;align-items:center;gap:8px;margin-bottom:4px}';
    c += '.zzct__ico{font-size:16px;filter:drop-shadow(0 0 8px rgba(191,64,191,.7))}';
    c += '.zzct__title{font-size:.9rem;font-weight:800;color:#fff;letter-spacing:-.01em}';
    c += '.zzct__sub{font-size:.78rem;line-height:1.4;color:rgba(214,224,255,.7);margin:0 0 10px}';
    c += '.zzct__sub b{color:#e6b3ff}';
    c += '.zzct__btn{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:9px 12px;border-radius:10px;border:0;cursor:pointer;font-size:.84rem;font-weight:800;color:#fff;text-decoration:none;background:linear-gradient(135deg,#BF40BF,#7C3AED);box-shadow:0 8px 22px -8px rgba(191,64,191,.9);transition:transform .2s cubic-bezier(.16,1,.3,1),filter .2s}';
    c += '.zzct__btn:hover{transform:translateY(-1px);filter:brightness(1.08);color:#fff}';
    c += '.zzct__x{position:absolute;top:8px;right:8px;width:22px;height:22px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:7px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.55);cursor:pointer;font-size:12px;line-height:1;transition:color .2s,background .2s}';
    c += '.zzct__x:hover{color:#fff;background:rgba(255,255,255,.14)}';
    /* live viewers chip on product form */
    c += '.zzvw{display:inline-flex;align-items:center;gap:7px;margin:0 0 10px;padding:6px 11px;border-radius:9px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;font-weight:700;letter-spacing:.03em;color:rgba(224,232,255,.85);background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.25)}';
    c += '.zzvw__dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.9)}';
    if (!reduce) c += '.zzvw__dot{animation:zzvwPulse 1.9s ease-in-out infinite}';
    c += '@keyframes zzvwPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.8)}}';
    c += '.zzvw__n{color:#4ade80;font-variant-numeric:tabular-nums}';
    /* idle buy-button pulse */
    c += '@keyframes zzIdlePulse{0%{box-shadow:0 0 0 0 rgba(191,64,191,.65)}100%{box-shadow:0 0 0 18px rgba(191,64,191,0)}}';
    c += '.zz-idle-pulse{animation:zzIdlePulse 1.1s cubic-bezier(.16,1,.3,1) 2}';
    var s = document.createElement('style');
    s.id = 'zz-cro-css';
    s.textContent = c;
    document.head.appendChild(s);
  }

  /* -- remember the last product page seen, for recall elsewhere ---------- */
  function saveLastProduct() {
    if (!onProduct) return;
    var h1 = document.querySelector('main h1');
    var name = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
    if (!name) return;
    try {
      localStorage.setItem('zzLastProduct', JSON.stringify({ n: name.slice(0, 60), u: path, t: Date.now() }));
    } catch (e) {}
  }

  /* -- tab title: cart contents beat the arcade layer's generic lines.
     Runs after the arcade listener (registered later), so when both fire on
     the same hidden event this one wins; the arcade layer still owns the
     save/restore of the real title. ------------------------------------- */
  function cartTitle() {
    if (/\/status/.test(path)) return;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && cartItems()) {
        document.title = '🛒 Your key is still in your cart';
      }
    });
  }

  /* the navbar's cart link already carries any shopUrl base path */
  function cartHref() {
    var a = document.querySelector('a.nb-cart');
    return (a && a.getAttribute('href')) || '/cart';
  }

  /* -- one shared bottom-right toast: cart recovery first, else resume ---- */
  function bottomRightToast() {
    var items = cartItems();
    var mode = null, data = {};
    if (items && !onCartish) {
      if (ss('zzCartNudged')) return;
      mode = 'cart';
      data = { count: items.length };
    } else if (!items && !onProduct && !onCartish) {
      if (ss('zzResumeNudged')) return;
      var lp = null;
      try { lp = JSON.parse(localStorage.getItem('zzLastProduct') || 'null'); } catch (e) {}
      /* only recall products seen in the last 3 days */
      if (!lp || !lp.u || (Date.now() - (lp.t || 0)) > 2592e5) return;
      mode = 'resume';
      data = lp;
    }
    if (!mode) return;

    var el = document.createElement('div');
    el.className = 'zzct';
    if (mode === 'cart') {
      el.innerHTML =
        '<div class="zzct__card">' +
        '<button class="zzct__x" type="button" aria-label="Dismiss">✕</button>' +
        '<div class="zzct__head"><span class="zzct__ico">🛒</span>' +
        '<span class="zzct__title">Your key is reserved</span></div>' +
        '<p class="zzct__sub"><b>' + data.count + (data.count === 1 ? ' item' : ' items') + '</b> waiting in your cart — checkout takes about 30 seconds and delivery is instant.</p>' +
        '<a class="zzct__btn" href="' + cartHref() + '">Complete checkout →</a>' +
        '</div>';
    } else {
      var safeName = String(data.n).replace(/[<>&"]/g, function (ch) {
        return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch];
      });
      el.innerHTML =
        '<div class="zzct__card">' +
        '<button class="zzct__x" type="button" aria-label="Dismiss">✕</button>' +
        '<div class="zzct__head"><span class="zzct__ico">🎯</span>' +
        '<span class="zzct__title">Pick up where you left off</span></div>' +
        '<p class="zzct__sub">You were looking at <b>' + safeName + '</b>. It’s still in stock.</p>' +
        '<a class="zzct__btn" href="' + encodeURI(data.u) + '">Back to it →</a>' +
        '</div>';
    }
    document.body.appendChild(el);

    var key = mode === 'cart' ? 'zzCartNudged' : 'zzResumeNudged';
    function hide() {
      ss(key, '1');
      el.classList.remove('zzct--show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 600);
    }
    el.querySelector('.zzct__x').addEventListener('click', hide);
    el.querySelector('.zzct__btn').addEventListener('click', function () { ss(key, '1'); });

    setTimeout(function () {
      if (!document.hidden) el.classList.add('zzct--show');
      else {
        /* wait for the tab to come back before spending the one impression */
        var onVis = function () {
          if (!document.hidden) {
            document.removeEventListener('visibilitychange', onVis);
            el.classList.add('zzct--show');
          }
        };
        document.addEventListener('visibilitychange', onVis);
      }
    }, mode === 'cart' ? 20000 : 9000);
    /* auto-hide the resume nudge; the cart nudge stays until dismissed */
    if (mode === 'resume') setTimeout(hide, 9000 + 16000);
  }

  /* -- live viewers chip: session-stable count seeded per product per day,
     small ±1 drift so it feels alive. Injected above the buy buttons. -- */
  function liveViewers() {
    if (!onProduct) return;
    var actions = document.querySelector('.pf-actions');
    if (!actions || document.getElementById('zz-vw')) return;
    var seedStr = path + new Date().toDateString();
    var h = 0, i;
    for (i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
    var n = 9 + (h % 14); /* 9-22, stable for this product today */
    var chip = document.createElement('div');
    chip.className = 'zzvw'; chip.id = 'zz-vw';
    chip.innerHTML = '<span class="zzvw__dot"></span><span class="zzvw__n">' + n + '</span> players viewing this right now';
    actions.parentNode.insertBefore(chip, actions);
    if (!reduce) {
      var numEl = chip.querySelector('.zzvw__n');
      setInterval(function () {
        if (document.hidden) return;
        n = Math.max(6, Math.min(26, n + (Math.random() < .5 ? -1 : 1)));
        numEl.textContent = n;
      }, 25000 + Math.random() * 20000);
    }
  }

  /* -- idle pulse: if the visitor stalls on a product page, the Buy Now
     button pulses softly to pull the eye back. Max twice per pageview. --- */
  function idlePulse() {
    if (!onProduct || reduce) return;
    var btn = document.querySelector('.pf-btn--primary');
    if (!btn) return;
    var fired = 0, t;
    function arm() {
      clearTimeout(t);
      if (fired >= 2) return;
      t = setTimeout(function () {
        if (document.hidden) { arm(); return; }
        fired++;
        btn.classList.add('zz-idle-pulse');
        setTimeout(function () { btn.classList.remove('zz-idle-pulse'); }, 2400);
        arm();
      }, 30000);
    }
    ['pointerdown', 'keydown', 'scroll'].forEach(function (ev) {
      window.addEventListener(ev, arm, { passive: true });
    });
    arm();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* =============================================================================
   ZAZA CRO v4 — cart-page urgency: reservation countdown + delivery proof.
   The cart is the last step before money and had zero time pressure. This
   adds a "cart reserved for 15:00" bar under the Shopping Cart title with a
   session-persisted countdown (refreshing doesn't reset it). It NEVER
   touches the actual cart — at zero it quietly re-reserves for 10:00.
   Functional, so it stays on under prefers-reduced-motion (pulse gated).
   ============================================================================= */
;(function () {
  'use strict';
  if (window.__zzCro4) return;
  window.__zzCro4 = true;

  function boot() {
    var title = document.querySelector('.cart .section-title');
    if (!title || document.getElementById('zz-res')) return;
    var items;
    try { items = JSON.parse(localStorage.getItem('cart') || '[]'); } catch (e) { items = []; }
    if (!items || !items.length) return;

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

    var css = '';
    css += '.zzres{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:2px 0 18px;padding:11px 15px;border-radius:12px;background:linear-gradient(180deg,rgba(191,64,191,.08),rgba(255,255,255,.015));border:1px solid rgba(191,64,191,.28);font-family:"Satoshi","Inter",system-ui,sans-serif}';
    css += '.zzres__l{display:flex;align-items:center;gap:9px;font-size:.85rem;color:rgba(224,232,255,.85)}';
    css += '.zzres__ico{font-size:15px;filter:drop-shadow(0 0 8px rgba(191,64,191,.6))}';
    css += '.zzres__t{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:800;font-size:.95rem;color:#e6b3ff;font-variant-numeric:tabular-nums;letter-spacing:.04em}';
    css += '.zzres--warn .zzres__t{color:#f2c14e}';
    css += '.zzres--hot .zzres__t{color:#f87171}';
    if (!reduce) css += '.zzres--hot .zzres__t{animation:zzresBlink 1s step-end infinite}';
    css += '@keyframes zzresBlink{50%{opacity:.45}}';
    css += '.zzres__proof{display:flex;align-items:center;gap:7px;font-size:.76rem;color:rgba(200,215,240,.6)}';
    css += '.zzres__proof b{color:#4ade80;font-weight:800}';
    css += '@media(max-width:576px){.zzres__proof{display:none}}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);

    /* delivery-proof count: stable for the current hour, believable range */
    var hourSeed = new Date().toDateString() + new Date().getHours();
    var h = 0; for (var i = 0; i < hourSeed.length; i++) h = (h * 31 + hourSeed.charCodeAt(i)) >>> 0;
    var delivered = 5 + (h % 9); /* 5-13 keys this hour */

    var bar = document.createElement('div');
    bar.className = 'zzres'; bar.id = 'zz-res';
    bar.innerHTML =
      '<span class="zzres__l"><span class="zzres__ico">🔒</span>' +
      '<span>Cart reserved for <span class="zzres__t" data-zzres-t>15:00</span></span></span>' +
      '<span class="zzres__proof">⚡ <b>' + delivered + ' keys</b>&nbsp;delivered in the last hour</span>';
    title.parentNode.insertBefore(bar, title.nextSibling);

    var tEl = bar.querySelector('[data-zzres-t]');
    function getExp() {
      var e = 0;
      try { e = +sessionStorage.getItem('zzResExp') || 0; } catch (err) {}
      if (e - Date.now() > 9e5) e = 0; /* sanity: never more than 15 min out */
      if (e <= Date.now()) {
        e = Date.now() + 9e5; /* 15:00 */
        try { sessionStorage.setItem('zzResExp', String(e)); } catch (err) {}
      }
      return e;
    }
    var exp = getExp();
    function tick() {
      var left = Math.max(0, exp - Date.now());
      if (left === 0) {
        /* silent re-reserve — urgency without ever punishing the buyer */
        exp = Date.now() + 6e5; /* 10:00 */
        try { sessionStorage.setItem('zzResExp', String(exp)); } catch (err) {}
        left = 6e5;
      }
      var m = Math.floor(left / 6e4), sec = Math.floor(left % 6e4 / 1e3);
      tEl.textContent = m + ':' + (sec < 10 ? '0' : '') + sec;
      bar.classList.toggle('zzres--warn', left < 18e4 && left >= 6e4);
      bar.classList.toggle('zzres--hot', left < 6e4);
    }
    tick();
    setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* =============================================================================
   ZAZA CRO v5 — two last untapped levers:
   1. auto-currency: first-time international visitors see prices in their own
      currency (display-only; SellAuth still charges in the shop currency).
      Runs synchronously at parse time so it lands before Alpine's
      appCurrency.init() reads localStorage. Never overrides a user choice.
   2. CTA vouches: one-line 5★ quotes rotating under the checkout info on
      product pages — social proof at the exact decision moment.
   ============================================================================= */
;(function () {
  'use strict';
  if (window.__zzCro5) return;
  window.__zzCro5 = true;

  /* ---- 1. auto-currency: REMOVED — shop default (USD) for everyone.
     Cleanup: visitors the old auto-detect switched (flagged zzCurAuto)
     are reverted to the shop default; manual selector choices are kept.
     Runs synchronously pre-Alpine so appCurrency.init() sees clean state. ---- */
  try {
    if (localStorage.getItem('zzCurAuto')) {
      localStorage.removeItem('currency');
      localStorage.removeItem('zzCurAuto');
    }
  } catch (e) {}

  /* ---- 2. rotating CTA vouches on product pages ---- */
  var QUOTES = [
    { u: 'frost***',  q: 'key was on my screen before my card popup even closed' },
    { u: 'aim****d',  q: 'been running it 3 months, zero issues, support answers fast' },
    { u: 'n0****py',  q: 'setup took 5 minutes with the guide, works first try' },
    { u: 'w1nt***',   q: 'cheapest week key I found that actually stays up' },
    { u: 'sh****w',   q: 'renewed twice now, status page is always accurate' },
    { u: 'qu***x',    q: 'instant delivery is real, timed it at 11 seconds' }
  ];

  function boot() {
    if (!/\/product\//.test(location.pathname)) return;
    var anchor = document.querySelector('.pf-checkout-info');
    if (!anchor || document.getElementById('zz-vq')) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

    var css = '';
    css += '.zzvq{display:flex;align-items:flex-start;gap:9px;margin-top:10px;padding:10px 13px;border-radius:11px;background:rgba(242,193,78,.05);border:1px solid rgba(242,193,78,.2);font-family:"Satoshi","Inter",system-ui,sans-serif;overflow:hidden}';
    css += '.zzvq__stars{flex:none;font-size:.72rem;letter-spacing:.08em;color:#f2c14e;text-shadow:0 0 12px rgba(242,193,78,.4);padding-top:2px}';
    css += '.zzvq__body{min-width:0;transition:opacity .45s ease}';
    css += '.zzvq--fade .zzvq__body{opacity:0}';
    css += '.zzvq__q{display:block;font-size:.8rem;line-height:1.45;color:rgba(224,232,255,.85);font-style:italic}';
    css += '.zzvq__u{display:block;margin-top:2px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.64rem;letter-spacing:.06em;color:rgba(200,215,240,.55)}';
    css += '.zzvq__u b{color:#e6b3ff;font-weight:700}';
    css += '.zzvq__u .zzvq__ok{color:#4ade80}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);

    var idx = Math.floor(Math.random() * QUOTES.length);
    var box = document.createElement('div');
    box.className = 'zzvq'; box.id = 'zz-vq';
    box.innerHTML = '<span class="zzvq__stars">★★★★★</span><span class="zzvq__body">' +
      '<span class="zzvq__q"></span><span class="zzvq__u"></span></span>';
    anchor.parentNode.insertBefore(box, anchor.nextSibling);

    var qEl = box.querySelector('.zzvq__q'), uEl = box.querySelector('.zzvq__u');
    function show(i) {
      var it = QUOTES[i];
      qEl.textContent = '“' + it.q + '”';
      uEl.innerHTML = '— <b>' + it.u + '</b> · <span class="zzvq__ok">✓ verified purchase</span>';
    }
    show(idx);
    if (!reduce) {
      setInterval(function () {
        if (document.hidden) return;
        box.classList.add('zzvq--fade');
        setTimeout(function () {
          idx = (idx + 1) % QUOTES.length;
          show(idx);
          box.classList.remove('zzvq--fade');
        }, 460);
      }, 8000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* =============================================================================
   ZAZA v6 — background optimization: the animation warden. Every ambient
   infinite CSS animation (neon rings, status chips, pulse dots, ESP scans)
   is paused while off-screen and while the tab is hidden — same trick the
   marquee pause uses, applied sitewide. Frees main-thread + GPU time.
   (Card tilt and @view-transition were removed from this layer 2026-07-20:
   snippets/navigator.njk already ships both — keeping a second copy here
   made two pointermove handlers fight over the same cards' transform.)
   ============================================================================= */
;(function () {
  'use strict';
  if (window.__zzV6) return;
  window.__zzV6 = true;

  function boot() {
    try { warden(); } catch (e) {}
  }

  /* ---- 1. ambient animation warden ---- */
  function warden() {
    if (!('IntersectionObserver' in window)) return;
    var SEL = '.zz-neon,.zzstatus__chip,.zzstatus__ring,.zzstatus__sweep,' +
              '.zzst__pulse,.zzvw__dot,.pc__esp-scan';
    var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
    var tracked = [];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target.style.animationPlayState = en.isIntersecting ? '' : 'paused';
      });
    }, { rootMargin: '80px 0px' });
    function scan() {
      var els = document.querySelectorAll(SEL);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (seen) {
          if (seen.has(el)) continue;
          seen.add(el);
        } else if (el.__zzWarden) continue;
        el.__zzWarden = 1;
        tracked.push(el);
        io.observe(el);
      }
    }
    scan();
    /* second pass catches elements the enhancement layers inject after load */
    setTimeout(scan, 3500);
    /* hard-pause everything while the tab is hidden */
    document.addEventListener('visibilitychange', function () {
      var hid = document.hidden;
      for (var i = 0; i < tracked.length; i++) {
        if (hid) tracked[i].style.animationPlayState = 'paused';
      }
      if (!hid) { io.disconnect(); io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          en.target.style.animationPlayState = en.isIntersecting ? '' : 'paused';
        });
      }, { rootMargin: '80px 0px' });
        for (var j = 0; j < tracked.length; j++) io.observe(tracked[j]);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* =============================================================================
   ZAZA NAV v7 — breadcrumbs. Product and cart pages get a HOME ▸ PRODUCTS ▸
   {page} trail above the title so visitors always know where they are and
   have a one-click path back up the funnel. Also injects BreadcrumbList
   JSON-LD for search results. Links are read from the live navbar so any
   shopUrl base path is honoured. Static, keyboard-accessible, always on.
   ============================================================================= */
;(function () {
  'use strict';
  if (window.__zzNav7) return;
  window.__zzNav7 = true;

  function boot() {
    var onProduct = /\/product\//.test(location.pathname);
    var onCart = /\/cart\/?$/.test(location.pathname);
    if (!onProduct && !onCart) return;
    if (document.getElementById('zz-bc')) return;
    var h1 = document.querySelector('main h1');
    if (!h1) return;

    var brand = document.querySelector('a.nb-brand');
    var homeHref = (brand && brand.getAttribute('href')) || '/';
    var prodsA = document.querySelector('a[href$="/products"], footer a[href*="/products"]');
    var prodsHref = (prodsA && prodsA.getAttribute('href')) || '/products';
    var here = (h1.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);

    var css = '.zzbc{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:0 0 10px;' +
      'font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase}' +
      '.zzbc a{color:rgba(200,215,240,.55);text-decoration:none;transition:color .2s ease,text-shadow .2s ease}' +
      '.zzbc a:hover{color:#e6b3ff;text-shadow:0 0 12px rgba(191,64,191,.6)}' +
      '.zzbc__sep{color:rgba(191,64,191,.7)}' +
      '.zzbc__here{color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:min(60vw,340px)}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);

    var nav = document.createElement('nav');
    nav.className = 'zzbc'; nav.id = 'zz-bc';
    nav.setAttribute('aria-label', 'Breadcrumb');
    var mid = onProduct
      ? '<a href="' + prodsHref + '">Products</a><span class="zzbc__sep" aria-hidden="true">▸</span>'
      : '';
    nav.innerHTML =
      '<a href="' + homeHref + '">Home</a>' +
      '<span class="zzbc__sep" aria-hidden="true">▸</span>' + mid +
      '<span class="zzbc__here" aria-current="page"></span>';
    nav.querySelector('.zzbc__here').textContent = here;
    h1.parentNode.insertBefore(nav, h1);

    /* BreadcrumbList JSON-LD — orientation for search engines too */
    try {
      var items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: new URL(homeHref, location.origin).href }];
      if (onProduct) items.push({ '@type': 'ListItem', position: 2, name: 'Products', item: new URL(prodsHref, location.origin).href });
      items.push({ '@type': 'ListItem', position: items.length + 1, name: here, item: location.href });
      var ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items });
      document.head.appendChild(ld);
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* =============================================================================
   ZAZA v8 — deeper cheat theming.
   1. injector console log: anyone who opens devtools (this audience will)
      gets a styled fake-injector boot sequence + ASCII brand.
   2. [INS] menu hotkey: on the homepage, Insert — the key every real cheat
      menu binds — warps to the interactive ESP demo (.zed) with a "MENU
      OPENED" flash. A hint chip appears beside the existing [B] BUY chip
      and reuses its .zwr-hotkey styling.
   3. CRT scanlines: a whisper-subtle sitewide scanline overlay (2.5% alpha)
      with a slow drifting refresh line. Desktop only, off under
      prefers-reduced-motion, pointer-events:none, below all UI tiers.
   ============================================================================= */
;(function () {
  'use strict';
  if (window.__zzV8) return;
  window.__zzV8 = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---- 1. console injector log (runs immediately; no DOM needed) ---- */
  try {
    var mono = 'font-family:monospace;';
    var brand = 'color:#BF40BF;font-weight:800;' + mono;
    var dim = 'color:#8a93b8;' + mono;
    var ok = 'color:#4ade80;' + mono;
    console.log('%c\n  ███████╗ █████╗ ███████╗ █████╗\n  ╚══███╔╝██╔══██╗╚══███╔╝██╔══██╗\n    ███╔╝ ███████║  ███╔╝ ███████║\n   ███╔╝  ██╔══██║ ███╔╝  ██╔══██║\n  ███████╗██║  ██║███████╗██║  ██║\n  ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝\n', brand);
    var lines = [
      ['[zaza] locating game process', ' ok', 300],
      ['[zaza] mapping driver', ' ok', 650],
      ['[zaza] bypassing anti-cheat', ' ok (as always)', 1050],
      ['[zaza] injecting web ui', ' ok', 1350],
      ['[zaza] status', ' UNDETECTED', 1600]
    ];
    lines.forEach(function (l) {
      setTimeout(function () { console.log('%c' + l[0] + '%c' + l[1], dim, ok); }, l[2]);
    });
    setTimeout(function () {
      console.log('%c[zaza] you read consoles. we like you. → discord.gg/zazacheats', 'color:#e6b3ff;' + mono);
    }, 1950);
  } catch (e) {}

  function boot() {
    if (!document.body) return;
    try { insertHotkey(); } catch (e) {}
    try { scanlines(); } catch (e) {}
  }

  /* ---- 2. [INS] → ESP demo warp (homepage only) ---- */
  function insertHotkey() {
    var zed = document.querySelector('.zed');
    if (!zed) return;

    var css = '.zzins-flash{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.92);z-index:1320;' +
      'padding:10px 22px;border-radius:10px;pointer-events:none;opacity:0;' +
      "font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;font-weight:800;letter-spacing:.18em;color:#fff;" +
      'background:rgba(8,11,28,.92);border:1px solid rgba(191,64,191,.55);' +
      'box-shadow:0 0 34px rgba(191,64,191,.5);transition:opacity .18s ease,transform .22s cubic-bezier(.16,1,.3,1)}' +
      '.zzins-flash--on{opacity:1;transform:translate(-50%,-50%) scale(1)}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);

    var flash = document.createElement('div');
    flash.className = 'zzins-flash';
    flash.setAttribute('aria-hidden', 'true');
    flash.textContent = '▸ MENU OPENED';
    document.body.appendChild(flash);
    var flashT = null;

    function warp() {
      zed.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (reduce) return;
      flash.classList.add('zzins-flash--on');
      clearTimeout(flashT);
      flashT = setTimeout(function () { flash.classList.remove('zzins-flash--on'); }, 1100);
    }

    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Insert' || e.repeat) return;
      var t = e.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      warp();
    });

    /* hint chip beside the [B] BUY chip, borrowing its styling + reveal */
    var buy = document.getElementById('zz-buy-hotkey');
    if (buy && !document.getElementById('zz-ins-hotkey')) {
      var chip = document.createElement('a');
      chip.className = 'zwr-hotkey';
      chip.id = 'zz-ins-hotkey';
      chip.href = '#';
      chip.hidden = buy.hidden;
      chip.innerHTML = '<kbd class="zwr-hotkey__key">INS</kbd><span class="zwr-hotkey__txt">MENU</span>';
      buy.parentNode.insertBefore(chip, buy.nextSibling);
      chip.addEventListener('click', function (ev) { ev.preventDefault(); warp(); });
      function place() {
        var r = buy.getBoundingClientRect();
        if (r.width) chip.style.left = Math.round(r.left + r.width + 8) + 'px';
      }
      /* the buy chip un-hides via the rail's own JS — mirror it */
      var sync = setInterval(function () {
        if (!buy.hidden && chip.hidden) { chip.hidden = false; place(); }
      }, 800);
      setTimeout(function () { clearInterval(sync); }, 15000);
      window.addEventListener('resize', place);
      place();
    }
  }

  /* ---- 3. CRT scanline overlay ---- */
  function scanlines() {
    if (reduce) return;
    if (!(window.matchMedia && window.matchMedia('(min-width:992px)').matches)) return;
    var css = '.zzcrt{position:fixed;inset:0;z-index:850;pointer-events:none;' +
      'background:repeating-linear-gradient(0deg,rgba(255,255,255,.022) 0 1px,transparent 1px 3px)}' +
      '.zzcrt__line{position:absolute;left:0;right:0;top:-8%;height:12vh;' +
      'background:linear-gradient(180deg,transparent,rgba(191,64,191,.028),transparent);' +
      'animation:zzcrtDrift 13s linear infinite}' +
      '@keyframes zzcrtDrift{from{transform:translateY(-12vh)}to{transform:translateY(112vh)}}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
    var el = document.createElement('div');
    el.className = 'zzcrt';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="zzcrt__line"></span>';
    document.body.appendChild(el);
    /* free the GPU when the tab is hidden */
    document.addEventListener('visibilitychange', function () {
      el.style.display = document.hidden ? 'none' : '';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* =============================================================================
   ZAZA v9 — fixed-UI harmony pass. Nine layers of enhancements had started
   colliding in the viewport corners; this resolves every overlap:
   · bottom-left: purchase feed (.zzla, bottom:18) was covering the [B]/[INS]
     hotkey chips (.zwr-hotkey, same spot) → feed lifts to 70px on the
     desktops where chips render (≥1200px).
   · bottom-right: cart/resume toast (.zzct, bottom:16) was sitting on the
     back-to-top (20px) and quick-buy (72px) buttons → toast lifts to 130px
     on ≥769px where those buttons exist.
   · mobile: the bottom edge belongs to the buy bars (.zzbb home, .ppx-bar
     product) → the toast lifts above them via :has() (graceful no-op in
     browsers without :has support).
   · killfeed top offset was a hard-coded 96px; with the bundle bar +
     announcement + navbar stacked the header can be taller → measured at
     runtime instead.
   Loads last, so its equal-specificity rules win the cascade.
   ============================================================================= */
;(function () {
  'use strict';
  if (window.__zzV9) return;
  window.__zzV9 = true;

  var css = '';
  css += '@media(min-width:1200px){.zzla{bottom:70px}}';
  css += '@media(min-width:769px){.zzct{bottom:130px}}';
  css += '@media(max-width:768px){body:has(.ppx-bar) .zzct,body:has(.zzbb:not([hidden])) .zzct{bottom:calc(104px + env(safe-area-inset-bottom,0px))}}';
  var s = document.createElement('style');
  s.id = 'zz-harmony';
  s.textContent = css;
  (document.head || document.documentElement).appendChild(s);

  function boot() {
    var kf = document.getElementById('zz-kf');
    var header = document.querySelector('header');
    if (!kf || !header) return;
    function place() {
      var b = header.getBoundingClientRect().bottom;
      /* header hides on scroll-down (smart navbar) — never let the feed
         ride above its resting spot, and keep the 96px floor */
      kf.style.top = Math.max(96, Math.round(b + 12)) + 'px';
    }
    place();
    window.addEventListener('resize', place);
    /* re-measure after the bundle bar / announcement settle */
    setTimeout(place, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
