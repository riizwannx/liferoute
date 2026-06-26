
/**
 * Sends notification via Telegram Bot API
 * @param {Object} params 
 * @param {Object} params.hospital - Hospital details
 * @param {Object} params.patient - Patient details
 * @param {string} params.emergencyType - Type of emergency
 * @param {number} params.eta - Estimated arrival time in minutes
 */

/**
 * Gets or stores the Telegram group chat ID
 * @returns {Promise<string>} - The group chat ID
 */
async function getTelegramGroupChatId(botToken) {
  // Check if we already have it in localStorage
  const storedChatId = localStorage.getItem('telegram_group_chat_id');
  if (storedChatId) return storedChatId;

  // If not, prompt the admin to get it
  const lastUpdateResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getUpdates`
  );
  const updates = await lastUpdateResponse.json();
  
  // Find the group chat from updates
  const groupChat = updates.result.find(update => update.message?.chat?.type === 'group');
  if (!groupChat) {
    throw new Error('Please have your bot added to the group and send a message first');
  }
  
  const chatId = groupChat.message.chat.id;
  localStorage.setItem('telegram_group_chat_id', chatId);
  return chatId;
}

/**
 * Sends notification to Telegram group
 */
export async function sendTelegramNotification({ hospital, patient, emergencyType, eta }) {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error('Telegram credentials not configured');
  }

  const message = `
🚨 *EMERGENCY ALERT* 🚨
  
*Patient En Route To:*
🏥 ${hospital.name}
📍 [Map Location](https://www.google.com/maps?q=${hospital.position[0]},${hospital.position[1]})
⏱ ETA: ${eta} minutes

*Patient Details:*
👤 ${patient.name || 'Not provided'}
🔢 ${patient.age || 'Not provided'} years
💊 ${patient.condition || 'Not provided'}

*Required Actions:*
- Hospital: Prepare ER team
- Police: Clear suggested route
- Confirm readiness with button below
  `.trim();

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Hospital Ready", callback_data: `ready_${hospital.id}` }],
            [{ text: "🚦 Route Cleared", callback_data: `cleared_${hospital.id}` }]
          ]
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${await response.text()}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Telegram notification failed:', error);
    throw error;
  }
}