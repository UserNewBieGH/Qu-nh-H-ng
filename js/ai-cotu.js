/**
 * AI Cô Tư Companion & Live On-Tour Audio Experience
 * Southern Vietnamese culinary guide with NLP intent parsing, auto-fill, and audio controls
 */

window.AICoTu = (function() {
  let isChatOpen = false;
  let isAudioPlaying = false;
  let isAmbienceActive = false;

  // Web Audio Context & Synthesizers
  let audioCtx = null;
  let chimeInterval = null;
  let ambienceSource = null;
  let ambienceGain = null;

  function init() {
    setupChatListeners();
    setupAudioPlayer();
    setupAmbienceSimulator();
    setupSOSAlert();
  }

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Synthesize a gentle warm acoustic bell/chime (pentatonic melody)
  function playTourChime() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const pentatonicNotes = [261.63, 293.66, 329.63, 392.00, 440.00]; // C4, D4, E4, G4, A4
      const note = pentatonicNotes[Math.floor(Math.random() * pentatonicNotes.length)];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, ctx.currentTime);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {
      // Graceful fallback if Web Audio is blocked
    }
  }

  // Synthesize soft alleyway street ambience (warm sizzling wok & subtle low rumble)
  function startAmbienceAudio() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      // Create 2 seconds of pink/brown noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.11;
      }

      ambienceSource = ctx.createBufferSource();
      ambienceSource.buffer = noiseBuffer;
      ambienceSource.loop = true;

      // Bandpass filter to mimic frying wok / gentle street sizzle
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 1.2;

      ambienceGain = ctx.createGain();
      ambienceGain.gain.setValueAtTime(0.001, ctx.currentTime);
      ambienceGain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.3);

      ambienceSource.connect(filter);
      filter.connect(ambienceGain);
      ambienceGain.connect(ctx.destination);

      ambienceSource.start();
    } catch (e) {
      // Graceful fallback
    }
  }

  function stopAmbienceAudio() {
    try {
      if (ambienceGain && audioCtx) {
        ambienceGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
        setTimeout(() => {
          if (ambienceSource) {
            ambienceSource.stop();
            ambienceSource.disconnect();
            ambienceSource = null;
          }
        }, 250);
      }
    } catch (e) {
      // Ignore
    }
  }

  function setupChatListeners() {
    const fabBtn = document.getElementById('ai-fab-toggle');
    const closeChatBtn = document.getElementById('btn-close-ai-chat');
    const sendBtn = document.getElementById('btn-send-ai-msg');
    const userInput = document.getElementById('ai-chat-input');
    const reasoningToggle = document.getElementById('btn-toggle-reasoning');

    if (fabBtn) {
      fabBtn.addEventListener('click', toggleChatWindow);
    }
    if (closeChatBtn) {
      closeChatBtn.addEventListener('click', closeChatWindow);
    }

    if (sendBtn && userInput) {
      sendBtn.addEventListener('click', () => sendMessage(userInput.value));
      userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendMessage(userInput.value);
        }
      });
    }

    if (reasoningToggle) {
      reasoningToggle.addEventListener('click', () => {
        const drawer = document.getElementById('ai-reasoning-drawer');
        if (drawer) drawer.classList.toggle('hidden');
      });
    }

    // Quick Prompt Chips inside chat & across page
    document.querySelectorAll('.ai-prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const promptText = chip.getAttribute('data-prompt') || chip.textContent.trim();
        openChatWithPrompt(promptText);
      });
    });
  }

  function toggleChatWindow() {
    const chatWin = document.getElementById('ai-chat-window');
    if (!chatWin) return;
    isChatOpen = !isChatOpen;
    if (isChatOpen) {
      chatWin.classList.remove('hidden');
      setTimeout(() => {
        chatWin.classList.add('opacity-100', 'translate-y-0');
        chatWin.classList.remove('opacity-0', 'translate-y-4');
        document.getElementById('ai-chat-input')?.focus();
      }, 10);
    } else {
      closeChatWindow();
    }
  }

  function closeChatWindow() {
    const chatWin = document.getElementById('ai-chat-window');
    if (!chatWin) return;
    isChatOpen = false;
    chatWin.classList.add('opacity-0', 'translate-y-4');
    chatWin.classList.remove('opacity-100', 'translate-y-0');
    setTimeout(() => chatWin.classList.add('hidden'), 250);
  }

  function openChatWithPrompt(text) {
    const chatWin = document.getElementById('ai-chat-window');
    if (chatWin && chatWin.classList.contains('hidden')) {
      toggleChatWindow();
    }
    sendMessage(text);
  }

  function sendMessage(text) {
    const input = document.getElementById('ai-chat-input');
    const msgContainer = document.getElementById('ai-chat-messages');
    if (!text || !text.trim() || !msgContainer) return;
    const cleanText = text.trim();

    // Append User Message
    const userDiv = document.createElement('div');
    userDiv.className = "flex justify-end gap-2 mb-3";
    userDiv.innerHTML = `
      <div class="user-bubble bg-primary-container text-on-primary-container px-4 py-2.5 shadow-sm max-w-[85%] text-xs sm:text-sm font-medium">
        <p>${escapeHTML(cleanText)}</p>
      </div>
    `;
    msgContainer.appendChild(userDiv);
    if (input) input.value = '';
    msgContainer.scrollTop = msgContainer.scrollHeight;

    // AI Typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.id = 'ai-typing-indicator';
    typingDiv.className = "flex gap-2.5 items-start mb-3";
    typingDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-primary text-surface flex items-center justify-center text-xs font-bold shrink-0">Tư</div>
      <div class="co-tu-bubble bg-surface-container-low px-4 py-3 text-on-surface-variant text-xs flex items-center gap-1.5 shadow-sm">
        <span class="w-2 h-2 rounded-full bg-primary animate-bounce"></span>
        <span class="w-2 h-2 rounded-full bg-primary animate-bounce" style="animation-delay: 0.2s"></span>
        <span class="w-2 h-2 rounded-full bg-primary animate-bounce" style="animation-delay: 0.4s"></span>
        <span class="text-xs ml-1 font-medium text-on-surface-variant">Cô Tư đang suy nghĩ...</span>
      </div>
    `;
    msgContainer.appendChild(typingDiv);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    // Process Intent
    setTimeout(() => {
      typingDiv.remove();
      processIntentAndReply(cleanText, msgContainer);
    }, 450);
  }

  function processIntentAndReply(userText, container) {
    const lower = userText.toLowerCase();
    const knowledge = window.CO_TU_DATA?.aiKnowledge || { intents: [] };
    const reasoningLog = document.getElementById('ai-reasoning-log');

    let reply = "";
    let matchedIntent = "General Greeting";
    let autoAction = null;

    // Detect Form fill request (e.g. "tôi tên Nam", "đặt cho 2 người")
    if (lower.includes("đặt") || lower.includes("tên là") || lower.includes("tên tôi") || lower.includes("người") || lower.includes("khách")) {
      let extractedName = "Thực Khách Hào Sảng";
      const nameMatch = userText.match(/(?:tên(?: là)?|mình là)\s+([A-ZÀ-Ỹa-zà-ỹ\s]+?)(?:,|$|\.|\s+muốn|\s+đặt)/i);
      if (nameMatch && nameMatch[1]) {
        extractedName = nameMatch[1].trim();
      }

      let guestNum = 2;
      const numMatch = userText.match(/(\d+)\s*(?:người|khách|chỗ|vé)/i);
      if (numMatch && numMatch[1]) {
        guestNum = Math.min(16, Math.max(1, parseInt(numMatch[1], 10)));
      }

      autoAction = { name: extractedName, adults: guestNum };
      reply = `Dạ Cô Tư nghe rồi nè! Cô Tư đã tự động điền sẵn tên *"${extractedName}"* và số lượng *${guestNum} khách* vào đơn đặt tour dưới kia rồi nha. Con chỉ cần kiểm tra lại ngày và bấm nút 'Xác nhận giữ chỗ' là xong liền!`;
      matchedIntent = `Auto Form-Fill (Name: ${extractedName}, Guests: ${guestNum})`;
    } else {
      // Find matching intent in knowledge base
      let found = false;
      for (const intent of knowledge.intents) {
        if (intent.keywords.some(kw => lower.includes(kw))) {
          reply = intent.answer;
          matchedIntent = `Rule Match: [${intent.keywords.slice(0, 3).join(', ')}]`;
          found = true;
          break;
        }
      }
      if (!found) {
        reply = "Cô Tư nghe rồi nghen con! Vị nào khó ăn, muốn bớt cay hay muốn hỏi thêm về món chè món bánh nào thì con cứ nói. Tối nay mình hẹn nhau lúc 16:30 ăn sập hẻm Đa Kao nhé!";
        matchedIntent = "Friendly Fallback / Hospitality Dialect";
      }
    }

    if (reasoningLog) {
      reasoningLog.textContent = `[Context Analysis]: Input "${userText.substring(0, 35)}..." -> ${matchedIntent} -> Personality: Ấm áp, bình dị, chất phác Nam Bộ.`;
    }

    // Append Bot Message
    const botDiv = document.createElement('div');
    botDiv.className = "flex gap-2.5 items-start mb-3";
    botDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-primary text-surface flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">Tư</div>
      <div class="co-tu-bubble bg-surface-container-lowest p-3.5 shadow-sm max-w-[85%] text-on-surface text-xs space-y-1.5 border border-outline-variant/30">
        <p class="leading-relaxed">${reply}</p>
        ${autoAction ? `
          <button class="mt-2 px-3.5 py-1.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center gap-1 hover:brightness-105 transition-all shadow-sm" onclick="window.BookingEngine.prefillBooking(${JSON.stringify(autoAction).replace(/"/g, '&quot;')})">
            <span class="material-symbols-outlined text-[16px]">touch_app</span> Xem Ngay Đơn Đã Điền
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(botDiv);
    container.scrollTop = container.scrollHeight;

    // Trigger prefill if requested
    if (autoAction && window.BookingEngine) {
      window.BookingEngine.prefillBooking(autoAction);
    }
  }

  function parseDurationToSeconds(timeStr) {
    if (!timeStr) return 165;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    return 165;
  }

  function setupAudioPlayer() {
    const playBtn = document.getElementById('btn-audio-play-toggle');
    const playIcon = document.getElementById('audio-play-icon');
    const waveform = document.getElementById('audio-waveform');
    const progressFill = document.getElementById('audio-progress-bar');
    const currentTimeEl = document.getElementById('audio-current-time');
    const totalDurationEl = document.getElementById('audio-total-duration');

    if (!playBtn) return;

    let simulatedSec = 14;
    let totalTrackSec = parseDurationToSeconds(totalDurationEl?.textContent || '2:45');
    let audioTimer = null;

    function startPlaybackTimer() {
      if (audioTimer) clearInterval(audioTimer);
      if (chimeInterval) clearInterval(chimeInterval);

      // Play initial chime
      playTourChime();
      chimeInterval = setInterval(playTourChime, 8000);

      audioTimer = setInterval(() => {
        simulatedSec++;
        if (simulatedSec > totalTrackSec) {
          simulatedSec = 0;
        }
        const mm = Math.floor(simulatedSec / 60);
        const ss = simulatedSec % 60;
        if (currentTimeEl) currentTimeEl.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
        if (progressFill && totalTrackSec > 0) {
          progressFill.style.width = `${Math.min(100, (simulatedSec / totalTrackSec) * 100)}%`;
        }
      }, 1000);
    }

    function stopPlaybackTimer() {
      if (audioTimer) {
        clearInterval(audioTimer);
        audioTimer = null;
      }
      if (chimeInterval) {
        clearInterval(chimeInterval);
        chimeInterval = null;
      }
    }

    playBtn.addEventListener('click', () => {
      isAudioPlaying = !isAudioPlaying;
      if (isAudioPlaying) {
        if (playIcon) playIcon.textContent = 'pause';
        if (waveform) waveform.classList.remove('waveform-paused');
        playBtn.classList.remove('bg-surface-container-highest');
        playBtn.classList.add('bg-primary-container');
        startPlaybackTimer();
      } else {
        if (playIcon) playIcon.textContent = 'play_arrow';
        if (waveform) waveform.classList.add('waveform-paused');
        playBtn.classList.add('bg-surface-container-highest');
        playBtn.classList.remove('bg-primary-container');
        stopPlaybackTimer();
      }
    });

    // Audio Stop selector pills
    document.querySelectorAll('.audio-track-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const trackTitle = pill.getAttribute('data-track-title');
        const trackTime = pill.getAttribute('data-track-time');
        const activeTrackLabel = document.getElementById('active-track-name');

        document.querySelectorAll('.audio-track-pill').forEach(p => {
          p.classList.remove('active', 'bg-primary-container', 'text-on-primary-container');
          p.classList.add('bg-surface-container', 'text-on-surface');
        });
        pill.classList.add('active', 'bg-primary-container', 'text-on-primary-container');
        pill.classList.remove('bg-surface-container', 'text-on-surface');

        if (activeTrackLabel) activeTrackLabel.textContent = trackTitle;
        if (totalDurationEl) totalDurationEl.textContent = trackTime;
        
        // Dynamically compute track total seconds!
        totalTrackSec = parseDurationToSeconds(trackTime);
        simulatedSec = 0;
        if (currentTimeEl) currentTimeEl.textContent = "0:00";
        if (progressFill) progressFill.style.width = "0%";

        if (isAudioPlaying) {
          startPlaybackTimer();
        }
      });
    });
  }

  function setupAmbienceSimulator() {
    const ambienceBtn = document.getElementById('btn-toggle-ambience');
    if (!ambienceBtn) return;

    ambienceBtn.addEventListener('click', () => {
      isAmbienceActive = !isAmbienceActive;
      const statusText = ambienceBtn.querySelector('.ambience-status-text');
      const icon = ambienceBtn.querySelector('.material-symbols-outlined');

      if (isAmbienceActive) {
        ambienceBtn.classList.remove('bg-surface-container', 'text-on-surface-variant');
        ambienceBtn.classList.add('bg-tertiary-fixed', 'text-on-tertiary-fixed-variant', 'border-tertiary');
        if (statusText) statusText.textContent = "Đang phát tiếng xèo xèo & tiếng rao hẻm xưa ♫";
        if (icon) icon.textContent = "volume_up";
        startAmbienceAudio();
      } else {
        ambienceBtn.classList.remove('bg-tertiary-fixed', 'text-on-tertiary-fixed-variant', 'border-tertiary');
        ambienceBtn.classList.add('bg-surface-container', 'text-on-surface-variant');
        if (statusText) statusText.textContent = "Bật tiếng xe lách cách & chảo gang hẻm";
        if (icon) icon.textContent = "volume_mute";
        stopAmbienceAudio();
      }
    });
  }

  function setupSOSAlert() {
    const sosBtn = document.getElementById('btn-sos-emergency');
    const sosModal = document.getElementById('sos-emergency-modal');
    const closeSos = document.getElementById('btn-close-sos');

    if (sosBtn && sosModal) {
      sosBtn.addEventListener('click', () => {
        sosModal.classList.remove('hidden');
        setTimeout(() => sosModal.classList.add('active'), 10);
      });
    }
    if (closeSos && sosModal) {
      closeSos.addEventListener('click', () => {
        sosModal.classList.remove('active');
        setTimeout(() => sosModal.classList.add('hidden'), 250);
      });
    }
    if (sosModal) {
      sosModal.addEventListener('click', (e) => {
        if (e.target === sosModal) {
          sosModal.classList.remove('active');
          setTimeout(() => sosModal.classList.add('hidden'), 250);
        }
      });
    }
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  return {
    init,
    toggleChatWindow,
    openChatWithPrompt,
    sendMessage
  };
})();
