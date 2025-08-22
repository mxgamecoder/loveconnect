 let accounts = JSON.parse(localStorage.getItem('userAccounts') || '[]');
    let currentIndex = parseInt(localStorage.getItem('currentAccountIndex') || '0');
    if (!accounts.length) {
      window.location.href = 'login.html';
    }
    if (currentIndex < 0 || currentIndex >= accounts.length) {
      currentIndex = 0;
      localStorage.setItem('currentAccountIndex', currentIndex);
    }
  // Apply theme color from localStorage
document.addEventListener('DOMContentLoaded', function () {
  // Get theme or default
  let theme = JSON.parse(localStorage.getItem('theme')) || { bg: '#fdf2f8', accent: '#ec4899' };

  // Apply page background
  document.body.style.background = theme.bg;
  document.documentElement.style.setProperty('--theme-bg', theme.bg);
  document.documentElement.style.setProperty('--theme-accent', theme.accent);

  // TOP NAV (header)
  const header = document.querySelector('header');
  if (header) {
    header.style.background = theme.bg; // match background
    header.style.color = theme.accent;  // text/icons
  }

  // BOTTOM NAV
  const bottomBar = document.querySelector('.bottom-bar');
  if (bottomBar) {
    bottomBar.style.background = theme.bg;
  }

  document.querySelectorAll('.theme-bg').forEach(el => {
  el.style.background = theme.bg;
});
document.querySelectorAll('.accent-text').forEach(el => {
  el.style.color = theme.accent;
});

  // PROFILE MODAL
  const modal = document.getElementById('miniModal');
  if (modal) {
    modal.style.background = theme.bg;
    modal.style.borderColor = theme.accent;
  }

  // ACCENT colors (icons, text, etc.)
  document.querySelectorAll('.icon-btn svg').forEach(svg => {
    svg.setAttribute('stroke', theme.accent);
  });
  document.querySelectorAll('.text-pink-600').forEach(el => {
    el.style.color = theme.accent;
  });
  document.querySelectorAll('.bg-pink-600').forEach(el => {
    el.style.background = theme.accent;
  });

  const socket = io("http://localhost:3000");
const userId = accounts[currentIndex].userId;

// Mark online when connected
socket.emit("online", userId);

// Send heartbeat every 10s
setInterval(() => {
  socket.emit("heartbeat", userId);
}, 10000);

// Update UI when someone changes status
socket.on("status", ({ userId, online }) => {
  const dot = document.getElementById(`status-dot-${userId}`);
  if (dot) {
    dot.style.background = online ? "#ec4899" : "#d1d5db";
  }
});
  const user = accounts[currentIndex];
  const profileLink = document.querySelector('.icon-btn[title="Profile"]');
  if (profileLink) {
    profileLink.href = `view-profile.html?userId=${user.userId}`;
  }
});