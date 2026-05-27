(function () {
  var currentScript = document.currentScript;
  if (!currentScript) return;

  var scriptUrl = new URL(currentScript.src);
  var widgetOrigin = currentScript.getAttribute('data-widget-origin') || scriptUrl.origin;
  var apiBaseUrl =
    currentScript.getAttribute('data-api-base-url') || 'http://localhost:3004/api';
  var brand = currentScript.getAttribute('data-brand') || 'FLOR Dubai';
  var locale = currentScript.getAttribute('data-locale') || 'en';
  var position = currentScript.getAttribute('data-position') || 'right';
  var appended = false;

  var iframe = document.createElement('iframe');
  var iframeUrl = new URL(widgetOrigin);
  iframeUrl.searchParams.set('apiBaseUrl', apiBaseUrl);
  iframeUrl.searchParams.set('brand', brand);
  iframeUrl.searchParams.set('locale', locale);

  iframe.src = iframeUrl.toString();
  iframe.title = brand + ' chat assistant';
  iframe.setAttribute('aria-label', brand + ' chat assistant');
  iframe.style.position = 'fixed';
  iframe.style.bottom = '20px';
  iframe.style[position === 'left' ? 'left' : 'right'] = '20px';
  iframe.style.width = '220px';
  iframe.style.height = '92px';
  iframe.style.border = '0';
  iframe.style.zIndex = '2147483647';
  iframe.style.background = 'transparent';
  iframe.style.colorScheme = 'normal';
  iframe.style.transition = 'width 180ms ease, height 180ms ease';
  iframe.allow = 'clipboard-write';

  function setWidgetSize(isOpen) {
    if (isOpen) {
      iframe.style.width = Math.min(window.innerWidth - 24, 472) + 'px';
      iframe.style.height = Math.min(window.innerHeight - 24, 752) + 'px';
      iframe.style.bottom = '12px';
      iframe.style[position === 'left' ? 'left' : 'right'] = '12px';
      return;
    }

    iframe.style.width = '220px';
    iframe.style.height = '92px';
    iframe.style.bottom = '20px';
    iframe.style[position === 'left' ? 'left' : 'right'] = '20px';
  }

  function appendIframe() {
    if (appended || !document.body) return;
    appended = true;
    document.body.appendChild(iframe);
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== widgetOrigin) return;
    if (!event.data || event.data.type !== 'operon-widget-size') return;

    setWidgetSize(Boolean(event.data.isOpen));
  });

  window.addEventListener('resize', function () {
    setWidgetSize(iframe.style.width !== '220px');
  });

  document.addEventListener('DOMContentLoaded', appendIframe);

  if (document.body) {
    appendIframe();
  }
})();
