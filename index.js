const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const axios = require('axios');
const qrcode = require('qrcode');
const { state, saveState } = useSingleFileAuthState('./auth.json');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function startBot() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      await qrcode.toFile('./qr.png', qr, { width: 300 });
      console.log('✅ QR Code disimpan di qr.png (scan pakai WA kamu)');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Koneksi terputus. Reconnect?', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('✅ Bot terhubung ke WhatsApp!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const pesan = msg.message.conversation || msg.message.extendedTextMessage?.text;
    console.log('📥 Pesan:', pesan);

    const balasan = await tanyaGPT(pesan);
    await sock.sendMessage(msg.key.remoteJid, { text: balasan });
  });
}

async function tanyaGPT(pesan) {
  try {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Kamu adalah admin Diksar Satpam PT. Praja Putra Wangsa. Jawab dengan sopan, ringkas, dan informatif.' },
        { role: 'user', content: pesan }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return res.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('❌ GPT Error:', err.message);
    return '⚠️ Maaf, sistem sedang sibuk. Coba lagi nanti.';
  }
}

startBot();
