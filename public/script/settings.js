// Prevent access if not logged in
    const accounts = JSON.parse(localStorage.getItem('userAccounts') || '[]');
    if (!accounts.length) {
      window.location.href = 'login.html';
    }

    // Theme color logic
    function applyThemeColor() {
      const color = localStorage.getItem('themeColor') || '#fdf2f8';
      document.body.style.background = color;
      // Also set overlay background
      document.getElementById('themeOverlay').style.background = color;
      document.getElementById('themeOverlay').style.setProperty('--theme-bg', color);
    }
    function setThemeColor(color) {
  // Save as object for dashboard
  const theme = { bg: color, accent: '#ec4899' }; // adjust accent as needed
  localStorage.setItem('theme', JSON.stringify(theme));

  // Save as string for old settings usage
  localStorage.setItem('themeColor', color);

  // Apply the new theme to the page immediately
  applyTheme();

  // Close theme picker
  closeThemeOverlay();
}


    // Apply theme colors everywhere
  function applyTheme() {
    const theme = JSON.parse(localStorage.getItem('theme')) || { bg: '#fdf2f8', accent: '#ec4899' };

    // Set page background
    document.body.style.background = theme.bg;
    document.documentElement.style.setProperty('--theme-bg', theme.bg);
    document.documentElement.style.setProperty('--theme-accent', theme.accent);

    // For overlay
    const overlay = document.getElementById('themeOverlay');
    if (overlay) {
      overlay.style.background = theme.bg;
      document.getElementById('themeOverlayTitle').style.color = theme.accent;
      overlay.querySelector('button[onclick="closeThemeOverlay()"]').style.background = theme.accent;
    }

    // Make list items match theme background
    document.querySelectorAll('li').forEach(li => {
      li.style.background = theme.bg;
      li.style.color = theme.accent;
    });

    // Change bottom nav background if it exists
    const bottomBar = document.querySelector('.bottom-bar');
    if (bottomBar) {
      bottomBar.style.background = theme.bg;
    }
  }
    function setTheme(theme) {
      localStorage.setItem('theme', JSON.stringify(theme));
      applyTheme();
      closeThemeOverlay();
    }
    function toggleThemePicker() {
      applyTheme();
      document.getElementById('themeOverlay').classList.remove('hidden');
      document.querySelector('ul').classList.add('hidden');
    }
    function closeThemeOverlay() {
      document.getElementById('themeOverlay').classList.add('hidden');
      document.querySelector('ul').classList.remove('hidden');
    }
    // Wait for DOM to load before applying theme
    document.addEventListener('DOMContentLoaded', function() {
      applyTheme();
    });

    // DELETE account (with verification flow)
function openDeleteAccountModal() {
  deleteAccountModal.classList.remove('hidden');
}

// SUSPEND account (temporary)
function suspendAccount() {
  if (confirm('Are you sure you want to suspend your account? You can reactivate it later by logging in.')) {
    localStorage.removeItem('userAccounts');
    localStorage.removeItem('currentAccountIndex');
    window.location.href = 'login.html';
  }
}

    // Toggle Theme Color Picker visibility
    function toggleThemePicker() {
      applyThemeColor(); // Ensure overlay uses current theme
      document.getElementById('themeOverlay').classList.remove('hidden');
      document.querySelector('ul').classList.add('hidden');
    }

    // Close Theme Overlay
    function closeThemeOverlay() {
      document.getElementById('themeOverlay').classList.add('hidden');
      document.querySelector('ul').classList.remove('hidden');
    }

    // Open Theme Overlay
    function openThemeOverlay() {
      const overlay = document.getElementById('themeOverlay');
      overlay.classList.remove('hidden');
    }

    // Delete Account Modal logic
    const deleteAccountModal = document.getElementById('deleteAccountModal');
    const deleteVerifyModal = document.getElementById('deleteVerifyModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const verifyDeleteBtn = document.getElementById('verifyDeleteBtn');
    const cancelVerifyBtn = document.getElementById('cancelVerifyBtn');

    // Show confirmation modal
    window.openDeleteAccountModal = function() {
      deleteAccountModal.classList.remove('hidden');
    };

    // Cancel delete
    cancelDeleteBtn.onclick = () => deleteAccountModal.classList.add('hidden');
    cancelVerifyBtn.onclick = () => deleteVerifyModal.classList.add('hidden');

    // Confirm delete: send code
    confirmDeleteBtn.onclick = async () => {
      deleteAccountModal.classList.add('hidden');
      codeSendingModal.classList.remove('hidden');
      let accounts = JSON.parse(localStorage.getItem('userAccounts') || '[]');
      let idx = parseInt(localStorage.getItem('currentAccountIndex') || '0');
      let user = accounts[idx];
      if (!user) {
        codeSendingModal.classList.add('hidden');
        return showPopup('No user found.', 'error');
      }
      try {
        await fetch('/api/send-verification-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.userId, email: user.email })
        });
        codeSendingModal.classList.add('hidden');
        deleteVerifyModal.classList.remove('hidden');
      } catch {
        codeSendingModal.classList.add('hidden');
        showPopup('Failed to send code.', 'error');
      }
    };

    // Verify code and delete
    verifyDeleteBtn.onclick = async () => {
      let code = document.getElementById('deleteVerificationCode').value.trim();
      let accounts = JSON.parse(localStorage.getItem('userAccounts') || '[]');
      let idx = parseInt(localStorage.getItem('currentAccountIndex') || '0');
      let user = accounts[idx];
      if (!user || !code) return showPopup('Enter code.', 'error');
      // Call backend to delete
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, code })
      });
      const data = await res.json();
      if (res.ok) {
        accounts.splice(idx, 1);
        if (accounts.length > 0) {
          localStorage.setItem('userAccounts', JSON.stringify(accounts));
          localStorage.setItem('currentAccountIndex', 0);
          showPopup('Account deleted. Switched to next account.', 'success');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          localStorage.removeItem('userAccounts');
          localStorage.removeItem('currentAccountIndex');
          showPopup('Account deleted. Logging out...', 'success');
          setTimeout(() => window.location.href = 'login.html', 1200);
        }
        deleteVerifyModal.classList.add('hidden');
      } else {
        showPopup(data.message || 'Delete failed.', 'error');
        // DO NOT close verify modal if code is wrong
        // deleteVerifyModal.classList.add('hidden'); <-- removed
      }
    };
    function showPopup(message, type = 'success') {
      const popup = document.createElement('div');
      popup.className = `popup popup-${type}`;
      popup.innerHTML = type === 'success'
        ? `<svg width="20" height="20" fill="#ec4899"><circle cx="10" cy="10" r="10"/></svg>`
        : `<svg width="20" height="20" fill="#ef4444"><circle cx="10" cy="10" r="10"/></svg>`;
      popup.innerHTML += `<span>${message}</span>`;
      document.getElementById('popup-container').appendChild(popup);
      setTimeout(() => popup.remove(), 2500);
    }
    function logout() {
      localStorage.removeItem('userAccounts');
      localStorage.removeItem('currentAccountIndex');
      window.location.href = 'login.html';
    }