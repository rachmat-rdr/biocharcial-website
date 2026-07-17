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

  async function askAssistant(message) {
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

  fab.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      input.focus();
    }
  });

  closeBtn.addEventListener('click', () => panel.classList.remove('open'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMessage('user', text);
    input.value = '';
    await askAssistant(text);
  });

  addMessage('assistant', 'Halo! Saya BioChar AI, asisten Bio Charcoal. Saya siap membantu menjawab pertanyaan seputar produk, stok, harga, pembayaran, alur pembelian, dan informasi lainnya.');
})();
