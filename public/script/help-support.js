document.addEventListener('DOMContentLoaded', () => {
  // Apply theme
  const theme = JSON.parse(localStorage.getItem('theme')) || { bg: '#fdf2f8', accent: '#ec4899' };
  document.body.style.background = theme.bg;
  document.querySelectorAll('.text-pink-600').forEach(el => { el.style.color = theme.accent; });
  document.querySelectorAll('.bg-pink-600').forEach(el => { el.style.background = theme.accent; });

  // Message limit logic
  function getTodayKey() {
    const today = new Date();
    return `supportMsgCount_${today.getFullYear()}_${today.getMonth()}_${today.getDate()}`;
  }

  document.getElementById('supportForm').onsubmit = async function(e) {
    e.preventDefault();
    const email = document.getElementById('supportEmail').value.trim();
    const message = document.getElementById('supportMessage').value.trim();
    const sendBtn = document.getElementById('supportSendBtn');

    // Limit: 5 messages per day
    const todayKey = getTodayKey();
    let count = parseInt(localStorage.getItem(todayKey) || '0');
    if (count >= 5) {
      showPopup("You can only send 5 messages per day. Please try again tomorrow.", "error");
      return;
    }

    if (!email || !message) {
      showPopup("Both fields are required.", "error");
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    try {
      const res = await fetch('/api/support-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, message })
      });
      const data = await res.json();
      if (res.ok) {
        showPopup("Message sent! We'll get back to you soon.", "success");
        localStorage.setItem(todayKey, count + 1);
        document.getElementById('supportForm').reset();
      } else {
        showPopup(data.message || "Failed to send message.", "error");
      }
    } catch {
      showPopup("Network error. Please try again.", "error");
    }
    sendBtn.disabled = false;
    sendBtn.textContent = "Send Message";
  };

function showPopup(message, type = 'success') {
  const popup = document.createElement('div');
  popup.className = `flex items-center gap-2 px-4 py-2 rounded-lg shadow-md border popup-${type}`;
  popup.style.backgroundColor = '#ffffff'; // force white background

  const icon =
    type === 'success'
      ? `<svg width="20" height="20" fill="#ec4899"><circle cx="10" cy="10" r="10"/></svg>`
      : `<svg width="20" height="20" fill="#ef4444"><circle cx="10" cy="10" r="10"/></svg>`;

  popup.innerHTML = `${icon}<span class="text-gray-800">${message}</span>`;
  
  const container = document.getElementById('popup-container');
  container.appendChild(popup);

  setTimeout(() => popup.remove(), 2500);
}
});