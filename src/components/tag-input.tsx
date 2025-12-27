"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZipUpload } from "@/components/zip-upload";
import type { ZipLoadResult } from "@/lib/html5/zip-loader";

/**
 * TagInput Component
 *
 * Textarea for pasting raw MRAID ad tags, plus HTML5 zip upload.
 */

// Test tags for development - parsed from tags.md
const TEST_TAGS = [
  // Celtra v3
  `<script src="mraid.js"></script>
<div class="celtra-ad-v3">
    <img src="data:image/png,celtra" style="display: none" onerror="
        (function(img) {
            var params = {'accountId':'1d489087','clickUrl':'','clickEvent':'advertiser','externalAdServer':'Custom','tagVersion':'html-standard-9'};
            var req = document.createElement('script');
            req.id = params.scriptId = 'celtra-script-' + (window.celtraScriptIndex = (window.celtraScriptIndex||0)+1);
            params.clientTimestamp = new Date/1000;
            params.clientTimeZoneOffsetInMinutes = new Date().getTimezoneOffset();
            params.hostPageLoadId=window.celtraHostPageLoadId=window.celtraHostPageLoadId||(Math.random()+'').slice(2);
            var qs = '';
            for (var k in params) {
                qs += '&amp;' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
            }
            var src = 'https://cdn.celtra.com/ads/acf4983a/mraid-ad.js?' + qs;
            if (src.length >= 8192) {
                src = 'https://ads.celtra.com/acf4983a/mraid-ad.js?' + qs;
            }
            req.src = src;
            img.parentNode.insertBefore(req, img.nextSibling);
        })(this);
    "/>
</div>`,

  // Celtra v4
  `<div class="celtra-ad-v4">
    <!-- celtra-tag-payload
        (function(e){try{
            var params={'accountId':'1d489087','clickUrl':'','clickEvent':'advertiser','externalAdServer':'Custom','preferredClickThroughWindow':'new','tagVersion':'html-universal-11'};

            params.hostPageLoadId=window.celtraHostPageLoadId=window.celtraHostPageLoadId||(Math.random()+'').slice(2);var t=params,a=window,n=document,r=n.createElement.bind(document),c=encodeURIComponent,i=e.parentNode,o=e.tagName&&'script'==e.tagName.toLowerCase(),l='celtra-executed',d={urldecode:decodeURIComponent,htmldecode:function(e){var t=r('div');t.innerHTML=e;return t.textContent},eval:eval,raw:function(e){return e}},s=r('script');var SignalsExtractor={};SignalsExtractor.getWindowSignals=function(t){function n(t){return t.replace(new RegExp(window.atob('XHM='),'g'),'')}function e(t){return r(t).length}var a=t.document,i=a.documentElement,r=a.querySelectorAll.bind(a),o=r('head>title'),l=t.location,s=l.pathname.split('/').pop(),s=s.slice(2+(s.lastIndexOf('.')-1>>>0)),c=null;try{c=[].slice.call(a.styleSheets).reduce(function(t,e){return t+(e.cssRules?e.cssRules.length:0)},0)}catch(t){}return{isTop:t===t.top,readyState:a.readyState,hasBody:!!a.body,mraid:!!t.MRAID_ENV||!!t.mraid,safeframe:'$sf'in t&&'object'==typeof t.$sf.ext,hasJQuery:!!t.jQuery,locationPrefix:l.href.slice(0,100),locationExtension:!s.length||5<s.length?null:s,innerDimensions:{width:t.innerWidth,height:t.innerHeight},documentClientDimensions:{width:i.clientWidth,height:i.clientHeight},hasRobotsMeta:!!e('meta[name="robots"],meta[name^="google"],meta[name="slurp"]'),hasSocialMeta:!!e('meta[property^="og:"],meta[name^="twitter:"],meta[name^="flattr:"],meta[property^="fb:"],meta[property^="article:"]'),hasLanguageMeta:!!e('html[lang],meta[http-equiv="content-language"]'),hasWindowsMeta:!!e('meta[name^="msapplication"]'),linkCount:e('link'),hasFaviconLink:!!e('link[rel*="icon"]'),noScriptCount:e('noscript'),scriptCount:e('script'),externalScriptCount:e('script[src]'),embeddedStyleCount:e('style'),externalStyleCount:e('link[type="text/css"]'),styleRuleCount:c,anchorCount:e('a[href]'),imageCount:e('img[src]'),titleLength:o&&o[0]&&o[0].textContent.length||0,innerTextLength:a.body?n(a.body.innerText).length-[].slice.call(r('div[class|="celtra-ad-v"]')).reduce(function(t,e){return t+n(e.innerText).length},0):0}},SignalsExtractor.getPageSignals=function(){var t=window,e=t;try{for(;e!==e.parent&&e.parent.document;)e=e.parent}catch(t){}return{tagWindow:SignalsExtractor.getWindowSignals(t),topmostAccessibleAncestorWindow:e===t?null:SignalsExtractor.getWindowSignals(e)}};t.utSignals=JSON.stringify(SignalsExtractor.getPageSignals());t.clientTimestamp=new Date/1e3;t.clientTimeZoneOffsetInMinutes=(new Date).getTimezoneOffset();if(-1!==i.className.indexOf(l))return;i.className+=' '+l;var _=new RegExp(a.atob('XlxzKyhbXHclLl0rKShcWy4rXF0pP1xzKz1ccysoXHcrKVxzKyguKikk'));var u=new RegExp(a.atob('XlxzK3xccysk'),'g');[].slice.call(i.childNodes).forEach(function(e){if(8==e.nodeType&&!e.textContent.startsWith(' celtra-tag-payload')&&(e=e.textContent.match(_)))try{t[e[1]+(e[2]||'')]=d[e[3]](e[4].replace(u,''))}catch(e){}});s.id=t.scriptId='celtra-script-'+(a.celtraScriptIndex=(a.celtraScriptIndex||0)+1);var v=Object.keys(t).map(function(e){return c(e)+'='+c(t[e])}).join('&');var m='https://cdn.celtra.com/ads/85bdcedb/universal.js'+'?'+v;(!true||8192<=m.length)&&(m='https://ads.celtra.com/85bdcedb/universal.js'+'?'+v);s.src=m;'loading'==n.readyState&&o?n.write(s.outerHTML):i.insertBefore(s,e.nextSibling);
        }catch(e){console.error(e);(new Image).src='https://track.celtra.com/'+'pixel.gif?accountId='+'1d489087'+'&name=tagException&message='+encodeURIComponent(e)+'&stream=adErrorEvents&placementId='+'85bdcedb'+'&creativeId='+'e3d8f600'+'&externalAdServer='+'Custom'}})(s); -->
    <script>
        var e=document.currentScript;[].slice.call(e.parentNode.childNodes).forEach(function(t){8==t.nodeType&&t.textContent.startsWith(' celtra-tag-payload')&&new Function('s',t.textContent.substring(19))(e)});
    </script>
    <img src="data:image/png,celtra" style="display: none" onerror="var e=this;[].slice.call(this.parentNode.childNodes).forEach(function(t){8==t.nodeType&&t.textContent.startsWith(' celtra-tag-payload')&&new Function('s',t.textContent.substring(19))(e)});">
</div>`,

  // Custom MRAID video tag
  `<script src="mraid.js"></script>
<script>
  var video;

  function mraidReady() {
    if (mraid.getState() === 'loading') {
      mraid.addEventListener('ready', onReady);
    } else {
      onReady();
    }
  }

  function onReady() {
    video = document.getElementById('vid');
    mraid.addEventListener('viewableChange', function(viewable) {
      if (viewable) {
        video.play();
      } else {
        video.pause();
      }
    });
    if (mraid.isViewable()) video.play();
  }

  function handleClick() {
    mraid.open('https://example.com/landing');
  }

  function closeAd() {
    mraid.close();
  }

  mraidReady();
</script>
<div style="position:relative;width:320px;height:480px;background:#000;font-family:sans-serif;">
  <video id="vid" playsinline muted loop style="width:100%;height:100%;object-fit:cover;">
    <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4">
  </video>
  <div onclick="handleClick()" style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);background:#e94560;color:#fff;padding:12px 32px;border-radius:6px;cursor:pointer;font-weight:600;">
    Shop Now
  </div>
  <div onclick="closeAd()" style="position:absolute;top:12px;right:12px;width:28px;height:28px;background:rgba(0,0,0,0.5);border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;">✕</div>
</div>`,
];

export type InputMode = "tag" | "html5";

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  onLoad: () => void;
  onHtml5Load: (result: ZipLoadResult) => void;
  inputMode: InputMode;
  onInputModeChange: (mode: InputMode) => void;
  disabled?: boolean;
}

export function TagInput({
  value,
  onChange,
  onLoad,
  onHtml5Load,
  inputMode,
  onInputModeChange,
  disabled,
}: TagInputProps) {
  const handleRandomTag = () => {
    const randomIndex = Math.floor(Math.random() * TEST_TAGS.length);
    onChange(TEST_TAGS[randomIndex]);
  };

  return (
    <Tabs value={inputMode} onValueChange={(v) => onInputModeChange(v as InputMode)}>
      <TabsList className="w-full">
        <TabsTrigger value="tag" className="flex-1">
          Paste Tag
        </TabsTrigger>
        <TabsTrigger value="html5" className="flex-1">
          Upload HTML5
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tag" className="mt-3">
        <div className="space-y-2">
          <Textarea
            placeholder="Paste MRAID tag here..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-[150px] max-h-[150px] overflow-y-auto font-mono text-sm resize-none"
            disabled={disabled}
          />
          <div className="flex gap-2">
            <Button onClick={onLoad} disabled={disabled || !value.trim()}>
              Load Tag
            </Button>
            <Button
              onClick={handleRandomTag}
              variant="outline"
              disabled={disabled}
            >
              Random Tag
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="html5" className="mt-3">
        <ZipUpload onLoad={onHtml5Load} disabled={disabled} />
      </TabsContent>
    </Tabs>
  );
}
