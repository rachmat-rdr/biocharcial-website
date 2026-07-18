(function () {
  const existing = document.getElementById('bc-ai-widget');
  if (existing) return;

  const shell = document.createElement('div');
  shell.id = 'bc-ai-widget';
  shell.className = 'bc-ai-widget';
  shell.innerHTML = `
    <button class="bc-ai-fab" type="button" aria-label="Buka asisten BioChar AI">BioChar AI</button>
    <div class="bc-ai-panel" role="dialog" aria-label="Asisten BioChar AI">
      <div class="bc-ai-header">
        <strong>BioChar AI</strong>
        <button class="bc-ai-close" type="button" aria-label="Tutup chat">×</button>
      </div>
      <div class="bc-ai-messages"></div>
      <form class="bc-ai-form">
        <input class="bc-ai-input" type="text" placeholder="Tanya tentang produk, stok, harga..." />
        <button class="bc-ai-send" type="submit">Kirim</button>
      </form>
    </div>
  `;
  document.body.appendChild(shell);

  const fab = shell.querySelector('.bc-ai-fab');
  const panel = shell.querySelector('.bc-ai-panel');
  const closeBtn = shell.querySelector('.bc-ai-close');
  const messagesBox = shell.querySelector('.bc-ai-messages');
  const form = shell.querySelector('.bc-ai-form');
  const input = shell.querySelector('.bc-ai-input');

  let isDragging = false;
  let dragPointerId = null;
  let shouldIgnoreClick = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function savePosition() {
    const right = parseFloat(getComputedStyle(shell).getPropertyValue('--bc-ai-right')) || 20;
    const bottom = parseFloat(getComputedStyle(shell).getPropertyValue('--bc-ai-bottom')) || 110;
    localStorage.setItem('bc-ai-position', JSON.stringify({ right, bottom }));
  }

  function restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem('bc-ai-position') || 'null');
      if (!saved) return;
      const viewportWidth = window.visualViewport?.width || window.innerWidth;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const safeRight = clamp(saved.right || 20, 12, Math.max(12, viewportWidth - 110));
      const safeBottom = clamp(saved.bottom || 110, 12, Math.max(12, viewportHeight - 80));
      shell.style.setProperty('--bc-ai-right', `${safeRight}px`);
      shell.style.setProperty('--bc-ai-bottom', `${safeBottom}px`);
    } catch (error) {
      console.warn('Gagal memuat posisi widget BioChar AI', error);
    }
  }

  function syncKeyboardState() {
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height || window.innerHeight;
    const keyboardOffset = Math.max(0, window.innerHeight - viewportHeight - (viewport?.offsetTop || 0));
    document.documentElement.style.setProperty('--bc-ai-keyboard-offset', `${keyboardOffset}px`);
    document.body.classList.toggle('bc-ai-keyboard-open', keyboardOffset > 0);
    if (keyboardOffset > 0) {
      requestAnimationFrame(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    }
  }

  function updatePositionFromClient(clientX, clientY) {
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const widgetWidth = shell.offsetWidth || 140;
    const widgetHeight = shell.offsetHeight || 56;
    const right = clamp(viewportWidth - clientX - widgetWidth / 2, 12, Math.max(12, viewportWidth - widgetWidth - 12));
    const bottom = clamp(viewportHeight - clientY - widgetHeight / 2, 12, Math.max(12, viewportHeight - widgetHeight - 12));
    shell.style.setProperty('--bc-ai-right', `${right}px`);
    shell.style.setProperty('--bc-ai-bottom', `${bottom}px`);
    savePosition();
  }

  function addMessage(role, text) {
    const row = document.createElement('div');
    row.className = role === 'assistant' ? 'bc-ai-row assistant' : 'bc-ai-row user';
    row.textContent = text;
    messagesBox.appendChild(row);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  function fallbackReply(message) {
    const text = message.toLowerCase();
    if (text.includes('harga') || text.includes('price')) {
      return 'Harga produk Bio Charcoal adalah Briket Kotak Rp 10.000 dan Briket Hexagonal Rp 12.000.';
    }
    if (text.includes('stok') || text.includes('stock')) {
      return 'Stok tersedia untuk Briket Kotak dan Briket Hexagonal. Silakan cek bagian pembelian untuk melihat sisa stok terbaru.';
    }
    if (text.includes('qris') || text.includes('bayar') || text.includes('pembayaran')) {
      return 'Pembayaran dapat dilakukan melalui QRIS atau transfer bank Mandiri ke rekening 0310023795324.';
    }
    if (text.includes('alamat')) {
      return 'Alamat Bio Charcoal: Jl. Desa Kolam Makmur, RT.06/RW.01, Kecamatan Wanaraya.';
    }
    return 'Saya bisa membantu menjawab pertanyaan seputar produk, harga, stok, pembayaran, dan alur pembelian Bio Charcoal.';
  }

  async function askGemini(message) {
    const geminiApiKey = localStorage.getItem('gemini-api-key') || window.GEMINI_API_KEY;
    if (!geminiApiKey) return null;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'Kamu adalah BioChar AI untuk Bio Charcoal. Jawab ramah, informatif, dan cukup luas dalam bahasa Indonesia sesuai kebutuhan pengguna. Fokus pada produk briket arang, harga, stok, pembayaran, alur pembelian, dan informasi bisnis. Jika tidak tahu, akui dengan santun.' }]
          },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 500
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return answer || null;
    } catch (error) {
      console.error('Gemini request failed', error);
      return null;
    }
  }

  async function askAssistant(message) {
    const geminiResponse = await askGemini(message);
    if (geminiResponse) {
      addMessage('assistant', geminiResponse);
      return;
    }

    const openAiKey = localStorage.getItem('openai-api-key') || window.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'Kamu adalah BioChar AI untuk Bio Charcoal. Jawab ramah, informatif, dan cukup luas dalam bahasa Indonesia sesuai kebutuhan pengguna.' },
              { role: 'user', content: message }
            ],
            temperature: 0.7
          })
        });
        const data = await response.json();
        const answer = data?.choices?.[0]?.message?.content || fallbackReply(message);
        addMessage('assistant', answer);
        return;
      } catch (error) {
        console.error('OpenAI request failed', error);
      }
    }

    addMessage('assistant', fallbackReply(message));
  }

  fab.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    isDragging = true;
    dragPointerId = event.pointerId;
    shouldIgnoreClick = false;
    shell.classList.add('dragging');
    fab.setPointerCapture?.(event.pointerId);
  });

  window.addEventListener('pointermove', (event) => {
    if (!isDragging || event.pointerId !== dragPointerId) return;
    shouldIgnoreClick = true;
    event.preventDefault();
    updatePositionFromClient(event.clientX, event.clientY);
  });

  function stopDragging(event) {
    if (!isDragging || (dragPointerId !== null && event.pointerId !== dragPointerId)) return;
    isDragging = false;
    dragPointerId = null;
    shell.classList.remove('dragging');
  }

  window.addEventListener('pointerup', stopDragging);
  window.addEventListener('pointercancel', stopDragging);

  fab.addEventListener('click', (event) => {
    if (shouldIgnoreClick) {
      event.preventDefault();
      event.stopPropagation();
      shouldIgnoreClick = false;
      return;
    }
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      requestAnimationFrame(() => {
        input.focus();
        syncKeyboardState();
      });
    }
  });

  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  input.addEventListener('focus', () => {
    requestAnimationFrame(() => {
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
      syncKeyboardState();
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMessage('user', text);
    input.value = '';
    await askAssistant(text);
  });

  restorePosition();
  syncKeyboardState();
  window.visualViewport?.addEventListener('resize', syncKeyboardState);
  window.visualViewport?.addEventListener('scroll', syncKeyboardState);
  window.addEventListener('resize', syncKeyboardState);

  addMessage('assistant', 'Halo! Saya BioChar AI, asisten Bio Charcoal. Saya siap membantu menjawab pertanyaan seputar produk, stok, harga, pembayaran, alur pembelian, dan informasi lainnya.');
})();
