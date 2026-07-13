/* util.js — tiny shared helpers: DOM builder, URL-safe encoding, seeded RNG, share/toast.
   Plain-script (no modules) so it works everywhere including older mobile Safari. */
(function (root) {
  'use strict';

  // ---- DOM builder -------------------------------------------------------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const sk in v) {
            if (sk.charCodeAt(0) === 45 && sk.charCodeAt(1) === 45) el.style.setProperty(sk, v[sk]); // --custom-prop
            else el.style[sk] = v[sk];
          }
        }
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.length > 2 && k.slice(0, 2) === 'on' && typeof v === 'function')
          el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat(4)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  // ---- URL-safe base64 (Unicode-safe) -----------------------------------
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ---- deterministic PRNG (mulberry32) ----------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- toast -------------------------------------------------------------
  let toastTimer = null;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = h('div', { id: 'toast', class: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  // ---- share / copy ------------------------------------------------------
  async function shareLink(url, text) {
    if (navigator.share) {
      try { await navigator.share({ title: 'Matt & Matt', text: text || 'Your turn 👇', url }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return false; /* fall through to copy */ }
    }
    return copyText(url);
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast('Link copied — paste it to your bro!');
        return true;
      }
    } catch (e) { /* fall through */ }
    // Legacy fallback
    try {
      const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      toast('Link copied — paste it to your bro!');
      return true;
    } catch (e) { toast('Copy failed — long-press the link to copy.'); return false; }
  }

  root.UI = { h, clear, b64urlEncode, b64urlDecode, mulberry32, toast, shareLink, copyText };
})(typeof window !== 'undefined' ? window : globalThis);
