import test from 'node:test';
import assert from 'node:assert/strict';
import { startAnalytics } from '../analytics.js';
import { initializePrivacy } from '../privacy.js';

const storage = (throws = false) => { const values = new Map(); return { getItem(k) { if (throws) throw Error(); return values.get(k) ?? null; }, setItem(k,v) { if (throws) throw Error(); values.set(k,v); }, removeItem(k) { if (throws) throw Error(); values.delete(k); } }; };
const page = ({ origin = 'https://sidearm.roubiniol.eu', id = '3', ready = 'true', optOut = false, dnt = false, gpc = false, referrer = '', pathname = '/' } = {}) => { const localStorage = storage(); if (optOut) localStorage.setItem('roubiniol.analyticsOptOut', '1'); const links=[]; const currentScript={ dataset:{ origin, siteId:id, endpoint:'https://stats.roubiniol.eu/', ready } }; const document={currentScript,referrer,head:{append(node){this.node=node;}},createElement(){return {};},querySelector(){return currentScript;},querySelectorAll(){return links;}}; const window={location:{origin,pathname},localStorage,navigator:{doNotTrack:dnt?'1':'0',globalPrivacyControl:gpc},document}; return {window,document,links}; };
const drain = (fixture) => { const calls=[]; const tracker={ trackPageView(){calls.push('page');}, trackEvent(...value){calls.push(value);}, forgetUserOptOut(){calls.push('forget');}, optUserOut(){calls.push('out');} }; for (const item of fixture.window._paq ?? []) if (typeof item[0] === 'function') item[0].call(tracker); return calls; };

test('analytics excludes invalid origins, scripts, hosts, paths, and privacy signals', () => { for (const setup of [{optOut:true},{dnt:true},{gpc:true},{id:'0'},{id:'9007199254740992'},{origin:'https://evil.example'},{origin:'http://localhost:4191'},{ready:'false'},{pathname:'/else'}]) { const fixture=page(setup); assert.equal(startAnalytics(fixture.window,fixture.document),false); assert.equal(fixture.document.head.node,undefined); } const missing=page(); missing.document.currentScript=null; missing.document.querySelector=()=>null; assert.equal(startAnalytics(missing.window,missing.document),false); });
test('analytics sanitizes a page view and never uses query or hash', () => { const fixture=page({referrer:'https://example.org/path?q=x'}); assert.equal(startAnalytics(fixture.window,fixture.document),true); assert.deepEqual(drain(fixture),['page']); assert.ok(fixture.window._paq.some((x)=>x[0]==='setReferrerUrl'&&x[1]==='https://example.org/')); assert.equal(fixture.document.head.node.referrerPolicy,'no-referrer'); assert.equal(startAnalytics(fixture.window,fixture.document),false); });

test('only authored page identity reaches Matomo, even with campaign parameters', () => {
  const fixture = page({ pathname: '/privacy/', referrer: 'https://example.org/private?secret=value#hidden' });
  Object.assign(fixture.window.location, { search: '?utm_campaign=secret&email=private', hash: '#private' });
  fixture.document.title = 'untrusted browser content';
  startAnalytics(fixture.window, fixture.document);
  assert.deepEqual(fixture.window._paq.find((item) => item[0] === 'setCustomUrl'), ['setCustomUrl', 'https://sidearm.roubiniol.eu/privacy/']);
  assert.ok(fixture.window._paq.some((item) => item[0] === 'disableCampaignParameters'));
  const titles = [];
  fixture.window._paq.find((item) => typeof item[0] === 'function')[0].call({ trackPageView(title) { titles.push(title); } });
  assert.deepEqual(titles, ['Sidearm · Privacy']);
  assert.equal(JSON.stringify(fixture.window._paq).includes('secret'), false);
});

test('configuration must match the actual origin and canonical decimal ID', () => {
  for (const mismatch of ['https://achille.roubiniol.eu', 'http://sidearm.roubiniol.eu']) {
    const fixture = page(); fixture.document.currentScript.dataset.origin = mismatch;
    assert.equal(startAnalytics(fixture.window, fixture.document), false);
  }
  for (const id of ['', ' 1 ', '1e3', '+1']) assert.equal(startAnalytics(page({ id }).window), false);
});

test('a real checkbox change cancels a delayed pageview and pending opt-in', () => {
  const fixture = page(); fixture.window.localStorage.setItem('roubiniol.analyticsOptInPending', '1');
  startAnalytics(fixture.window, fixture.document);
  const listeners = {}, control = { hidden: true, addEventListener(name, callback) { listeners[name] = callback; } }, status = {};
  initializePrivacy(fixture.window, { querySelector(selector) { return selector.includes('opt-out') ? control : status; } });
  control.checked = true; listeners.change();
  assert.equal(fixture.window.localStorage.getItem('roubiniol.analyticsOptInPending'), null);
  assert.equal(fixture.window.localStorage.getItem('roubiniol.analyticsOptOut'), '1');
  assert.deepEqual(drain(fixture), ['out']);
});

test('explicit opt-in waits for the next page and is consumed once', () => {
  const fixture = page({ optOut: true }); assert.equal(startAnalytics(fixture.window), false);
  const listeners = {}, control = { hidden: true, addEventListener(name, callback) { listeners[name] = callback; } }, status = {};
  initializePrivacy(fixture.window, { querySelector(selector) { return selector.includes('opt-out') ? control : status; } });
  control.checked = false; listeners.change();
  assert.equal(fixture.document.head.node, undefined);
  const nextPage = page(); nextPage.window.localStorage = fixture.window.localStorage;
  startAnalytics(nextPage.window); assert.deepEqual(drain(nextPage), ['forget', 'page']);
  const later = page(); later.window.localStorage = fixture.window.localStorage;
  startAnalytics(later.window); assert.deepEqual(drain(later), ['page']);
});

test('pending choice storage failure blocks all queued measurement', () => {
  const fixture = page(); fixture.window.localStorage.setItem('roubiniol.analyticsOptInPending', '1');
  fixture.window.localStorage.removeItem = () => { throw Error('storage unavailable'); };
  startAnalytics(fixture.window); assert.deepEqual(drain(fixture), ['forget']);
  assert.equal(fixture.window.__roubiniolAnalyticsState.excluded, true);
});
test('analytics rejects invalid referrers', () => { for (const referrer of ['file:///x','mailto:a@b','not a url']) { const fixture=page({referrer}); assert.equal(startAnalytics(fixture.window,fixture.document),false); } });
test('storage failure fails closed', () => { const fixture=page(); fixture.window.localStorage=storage(true); assert.equal(startAnalytics(fixture.window,fixture.document),false); });
test('privacy exclusion blocks a delayed page view and storage failure is in-memory exclusion', () => { const fixture=page(); startAnalytics(fixture.window,fixture.document); fixture.window.__roubiniolAnalyticsState={excluded:true}; assert.deepEqual(drain(fixture),[]); const listeners={}; const control={hidden:true,checked:false,addEventListener(_,fn){listeners.change=fn;}}; const status={textContent:''}; const document={querySelector(s){return s.includes('opt-out')?control:status;}}; const localStorage=storage(); const window={document,localStorage,_paq:[]}; initializePrivacy(window,document); localStorage.setItem=()=>{throw Error();}; control.checked=true; listeners.change(); assert.equal(window.__roubiniolAnalyticsState.excluded,true); assert.deepEqual(drain({window}),['out']); });
test('pending opt-in clears only in its guarded callback', () => { const fixture=page(); fixture.window.localStorage.setItem('roubiniol.analyticsOptInPending','1'); startAnalytics(fixture.window,fixture.document); assert.equal(fixture.window.localStorage.getItem('roubiniol.analyticsOptInPending'),'1'); assert.deepEqual(drain(fixture),['forget','page']); assert.equal(fixture.window.localStorage.getItem('roubiniol.analyticsOptInPending'),null); });
test('counterpart controls emit one fixed destination event and opt-out blocks it', () => { const events=[]; const link={addEventListener(_,fn){events.push(fn);}}; const fixture=page(); fixture.document.querySelectorAll=()=>[link,link]; startAnalytics(fixture.window,fixture.document); events.forEach((fn)=>fn()); assert.deepEqual(drain(fixture).filter(Array.isArray),[['Project','open','Roubiniol']]); fixture.window.localStorage.setItem('roubiniol.analyticsOptOut','1'); events[0](); assert.equal(drain(fixture).filter(Array.isArray).length,0); });
