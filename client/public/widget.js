(function() {
  'use strict';

  // Get configuration from script tag
  var script = document.currentScript || (function() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('widget.js') !== -1) return scripts[i];
    }
    return null;
  })();

  var API_KEY = script ? script.getAttribute('data-api-key') : '';
  var POSITION = script ? (script.getAttribute('data-position') || 'bottom-right') : 'bottom-right';
  var BASE_URL = script ? script.src.replace('/widget.js', '') : '';

  if (!API_KEY) {
    console.error('[IntelliChat] Missing data-api-key attribute');
    return;
  }

  // Session management
  var SESSION_KEY = 'intellichat_session_' + API_KEY.slice(0, 8);
  var sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 16) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  // State
  var isOpen = false;
  var messages = [];
  var isLoading = false;
  var config = { botName: 'AI Assistant', welcomeMessage: 'Hi! How can I help you?', primaryColor: '#6366f1' };

  // Fetch widget config
  function fetchConfig() {
    fetch(BASE_URL + '/api/trpc/chat.config?input=' + encodeURIComponent(JSON.stringify({ json: { apiKey: API_KEY } })))
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.result && data.result.data && data.result.data.json) {
          var d = data.result.data.json;
          if (d.botName) config.botName = d.botName;
          if (d.welcomeMessage) config.welcomeMessage = d.welcomeMessage;
          if (d.primaryColor) config.primaryColor = d.primaryColor;
          updateUI();
        }
      })
      .catch(function() {});
  }

  // Send message
  function sendMessage(text) {
    if (!text.trim() || isLoading) return;

    messages.push({ role: 'user', content: text });
    isLoading = true;
    updateUI();

    fetch(BASE_URL + '/api/trpc/chat.send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        json: {
          apiKey: API_KEY,
          sessionId: sessionId,
          message: text
        }
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      isLoading = false;
      if (data.result && data.result.data && data.result.data.json) {
        var response = data.result.data.json;
        messages.push({ role: 'assistant', content: response.answer });
        if (response.escalated) {
          messages.push({ role: 'system', content: 'This conversation has been escalated to a human agent. Someone will follow up shortly.' });
        }
      } else {
        messages.push({ role: 'assistant', content: 'Sorry, something went wrong. Please try again.' });
      }
      updateUI();
    })
    .catch(function() {
      isLoading = false;
      messages.push({ role: 'assistant', content: 'Sorry, I could not connect. Please try again later.' });
      updateUI();
    });
  }

  // Track widget open
  function trackOpen() {
    fetch(BASE_URL + '/api/trpc/chat.opened', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { apiKey: API_KEY } })
    }).catch(function() {});
  }

  // Create DOM elements
  function createWidget() {
    var container = document.createElement('div');
    container.id = 'intellichat-widget';
    container.innerHTML = '<style>' +
      '#intellichat-widget{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.5;position:fixed;z-index:999999;' + (POSITION === 'bottom-left' ? 'left:20px;' : 'right:20px;') + 'bottom:20px;}' +
      '#ic-toggle{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:transform 0.2s,box-shadow 0.2s;}' +
      '#ic-toggle:hover{transform:scale(1.05);box-shadow:0 6px 20px rgba(0,0,0,0.2);}' +
      '#ic-toggle:active{transform:scale(0.97);}' +
      '#ic-toggle svg{width:24px;height:24px;fill:white;}' +
      '#ic-chat{display:none;width:380px;height:520px;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.2);flex-direction:column;margin-bottom:12px;background:#fff;border:1px solid #e5e7eb;}' +
      '#ic-chat.open{display:flex;}' +
      '#ic-header{padding:16px;display:flex;align-items:center;gap:10px;color:white;}' +
      '#ic-header-name{font-weight:600;font-size:15px;}' +
      '#ic-header-status{font-size:11px;opacity:0.85;}' +
      '#ic-close{margin-left:auto;background:none;border:none;color:white;cursor:pointer;font-size:20px;padding:4px 8px;border-radius:4px;}' +
      '#ic-close:hover{background:rgba(255,255,255,0.15);}' +
      '#ic-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f9fafb;}' +
      '.ic-msg{max-width:80%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.5;word-wrap:break-word;}' +
      '.ic-msg-user{align-self:flex-end;color:white;border-bottom-right-radius:4px;}' +
      '.ic-msg-bot{align-self:flex-start;background:#f3f4f6;color:#1f2937;border-bottom-left-radius:4px;}' +
      '.ic-msg-system{align-self:center;background:#fef3c7;color:#92400e;font-size:12px;text-align:center;border-radius:8px;}' +
      '.ic-typing{align-self:flex-start;background:#f3f4f6;padding:12px 16px;border-radius:12px;border-bottom-left-radius:4px;}' +
      '.ic-typing span{display:inline-block;width:6px;height:6px;background:#9ca3af;border-radius:50%;margin:0 2px;animation:ic-bounce 1.4s infinite both;}' +
      '.ic-typing span:nth-child(2){animation-delay:0.2s;}' +
      '.ic-typing span:nth-child(3){animation-delay:0.4s;}' +
      '@keyframes ic-bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}}' +
      '#ic-input-area{padding:12px;border-top:1px solid #e5e7eb;display:flex;gap:8px;background:white;}' +
      '#ic-input{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;transition:border-color 0.2s;}' +
      '#ic-input:focus{border-color:var(--ic-color);}' +
      '#ic-send{border:none;border-radius:8px;padding:8px 14px;color:white;cursor:pointer;font-size:13px;font-weight:500;transition:opacity 0.2s;}' +
      '#ic-send:hover{opacity:0.9;}' +
      '#ic-send:disabled{opacity:0.5;cursor:not-allowed;}' +
      '@media(max-width:440px){#ic-chat{width:calc(100vw - 40px);height:calc(100vh - 120px);}}' +
    '</style>' +
    '<div id="ic-chat">' +
      '<div id="ic-header"><div><div id="ic-header-name"></div><div id="ic-header-status">Online</div></div><button id="ic-close">&times;</button></div>' +
      '<div id="ic-messages"></div>' +
      '<div id="ic-input-area"><input id="ic-input" placeholder="Type your message..." /><button id="ic-send">Send</button></div>' +
    '</div>' +
    '<button id="ic-toggle"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg></button>';

    document.body.appendChild(container);

    // Event listeners
    document.getElementById('ic-toggle').addEventListener('click', function() {
      isOpen = !isOpen;
      if (isOpen) trackOpen();
      updateUI();
    });

    document.getElementById('ic-close').addEventListener('click', function() {
      isOpen = false;
      updateUI();
    });

    document.getElementById('ic-input').addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        var input = document.getElementById('ic-input');
        sendMessage(input.value);
        input.value = '';
      }
    });

    document.getElementById('ic-send').addEventListener('click', function() {
      var input = document.getElementById('ic-input');
      sendMessage(input.value);
      input.value = '';
    });

    updateUI();
  }

  // Update UI
  function updateUI() {
    var chat = document.getElementById('ic-chat');
    var toggle = document.getElementById('ic-toggle');
    var header = document.getElementById('ic-header');
    var headerName = document.getElementById('ic-header-name');
    var messagesEl = document.getElementById('ic-messages');
    var sendBtn = document.getElementById('ic-send');

    if (!chat) return;

    // Apply colors
    var color = config.primaryColor || '#6366f1';
    document.documentElement.style.setProperty('--ic-color', color);
    toggle.style.background = color;
    header.style.background = color;
    sendBtn.style.background = color;

    // Toggle chat
    if (isOpen) {
      chat.classList.add('open');
      toggle.style.display = 'none';
    } else {
      chat.classList.remove('open');
      toggle.style.display = 'flex';
    }

    // Header
    headerName.textContent = config.botName || 'AI Assistant';

    // Messages
    var html = '';
    if (messages.length === 0) {
      html += '<div class="ic-msg ic-msg-bot">' + escapeHtml(config.welcomeMessage || 'Hi! How can I help you?') + '</div>';
    }
    messages.forEach(function(msg) {
      var cls = msg.role === 'user' ? 'ic-msg-user' : (msg.role === 'system' ? 'ic-msg-system' : 'ic-msg-bot');
      var style = msg.role === 'user' ? ' style="background:' + color + '"' : '';
      html += '<div class="ic-msg ' + cls + '"' + style + '>' + escapeHtml(msg.content) + '</div>';
    });
    if (isLoading) {
      html += '<div class="ic-typing"><span></span><span></span><span></span></div>';
    }
    messagesEl.innerHTML = html;
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Send button
    sendBtn.disabled = isLoading;
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      createWidget();
      fetchConfig();
    });
  } else {
    createWidget();
    fetchConfig();
  }
})();
