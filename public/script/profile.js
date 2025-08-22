document.addEventListener('DOMContentLoaded', async () => {
  // --------------------
  // Section Navigation
  // --------------------
  function showSection(section) {
    document.querySelectorAll('.section-block').forEach(div => div.classList.add('hidden'));
    document.getElementById('section' + section.charAt(0).toUpperCase() + section.slice(1)).classList.remove('hidden');
  }

  document.getElementById('breadcrumbNav').addEventListener('click', function(e) {
    if (e.target.dataset.section) {
      showSection(e.target.dataset.section);
    }
  });

  // Show profile by default
  showSection('profile');

  // --------------------
  // Change Functions
  // --------------------

  async function changeUsername() {
  const newUsername = document.getElementById('username').value;
  if (!newUsername) return showPopup('Enter a username.', 'error');
  if (newUsername === user.username) return showPopup('Username is the same as current.', 'error');
  try {
    const res = await axios.post('/api/update-profile', { userId, newUsername }); // <-- FIXED HERE
    user.username = res.data.username;
    accounts[idx].username = res.data.username;
    localStorage.setItem('userAccounts', JSON.stringify(accounts));
    showPopup('Username updated!', 'success');
  } catch (err) {
    showPopup(err.response?.data?.message || 'Update failed.', 'error');
  }
}

async function changeFullName() {
  const newFullName = document.getElementById('fullName').value;
  if (!newFullName) return showPopup('Enter a full name.', 'error');
  if (newFullName === user.fullName) return showPopup('Full name is the same as current.', 'error');
  try {
    const res = await axios.post('/api/update-profile', { userId, fullName: newFullName });
    user.fullName = res.data.fullName;
    accounts[idx].fullName = res.data.fullName;
    localStorage.setItem('userAccounts', JSON.stringify(accounts));
    showPopup('Full name updated!', 'success');
  } catch (err) {
    showPopup(err.response?.data?.message || 'Update failed.', 'error');
  }
}

  async function changeGender() {
    const newGender = document.getElementById('gender').value;
    if (!['Male', 'Female', 'Other'].includes(newGender)) {
      return showPopup('Gender must be Male, Female, or Other.', 'error');
    }
    if (newGender === user.gender) return showPopup('Gender is the same as current.', 'error');
    try {
      const res = await axios.post('/api/update-profile', { userId, gender: newGender });
      showPopup('Gender updated!', 'success');
      user.gender = res.data.gender;
      accounts[idx].gender = res.data.gender;
      localStorage.setItem('userAccounts', JSON.stringify(accounts));
    } catch (err) {
      showPopup(err.response?.data?.message || 'Update failed.', 'error');
    }
  }

  async function changeDob() {
    const newDob = document.getElementById('dob').value;
    if (!newDob) return showPopup('Please select a valid date.', 'error');
    if (newDob === (user.dob ? user.dob.split('T')[0] : '')) {
      return showPopup('DOB is the same as current.', 'error');
    }
    try {
      const res = await axios.post('/api/update-profile', { userId, dob: newDob });
      showPopup('Date of birth updated!', 'success');
      user.dob = res.data.dob;
      accounts[idx].dob = res.data.dob;
      localStorage.setItem('userAccounts', JSON.stringify(accounts));
    } catch (err) {
      showPopup(err.response?.data?.message || 'Update failed.', 'error');
    }
  }

  // --------------------
  // Avatar Upload
  // --------------------
  document.getElementById('avatarPreview').src = user.avatar || '';
  document.getElementById('avatarInput').addEventListener('change', async function() {
    const file = this.files[0];
    if (!file) return;

    const { timestamp, signature, cloudName, apiKey } = (await axios.get('/api/cloudinary-signature')).data;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('timestamp', timestamp);
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    try {
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const publicId = res.data.public_id;
      const avatarUrl = `https://res.cloudinary.com/${cloudName}/image/upload/c_thumb,g_face,w_150,h_150/${publicId}.jpg`;

      document.getElementById('avatarPreview').src = avatarUrl;

      const updateRes = await axios.post('/api/update-profile', { userId, avatar: avatarUrl });
      user.avatar = updateRes.data.avatar;
      accounts[idx].avatar = updateRes.data.avatar;
      localStorage.setItem('userAccounts', JSON.stringify(accounts));
      showPopup('Avatar uploaded!', 'success');
    } catch (err) {
      showPopup('Avatar upload failed.', 'error');
    }
  });

  // --------------------
  // Verification Status
  // --------------------
  document.getElementById('isVerified').textContent = user.isVerified ? '✅ Verified' : '❌ Not Verified';
  document.getElementById('isVerified').className = user.isVerified ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
  const verifyBox = document.getElementById('verifyBox');
  if (!user.isVerified) {
    verifyBox.innerHTML = `<button class="px-4 py-2 rounded bg-pink-500 text-white font-semibold" onclick="showVerifyPrompt()">Verify Account</button>`;
  } else {
    verifyBox.innerHTML = '';
  }

  // --------------------
  // Utility
  // --------------------
  function handleButtonAction(button, action) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Changing…';
    action()
      .catch(err => showPopup(err.response?.data?.message || 'Update failed.', 'error'))
      .finally(() => {
        button.disabled = false;
        button.textContent = originalText;
      });
  }

  // --------------------
  // Button Event Bindings (for existing HTML buttons)
  // --------------------
document.getElementById('changeUsernameBtn').onclick = (e) => {
  e.preventDefault(); // 👈 prevents reload
  handleButtonAction(document.getElementById('changeUsernameBtn'), changeUsername);
};
document.getElementById('changeFullNameBtn').onclick = (e) => {
  e.preventDefault();
  handleButtonAction(document.getElementById('changeFullNameBtn'), changeFullName);
};
  document.getElementById('changePasswordBtn').onclick = (e) => {
    e.preventDefault();
    handleButtonAction(document.getElementById('changePasswordBtn'), changePassword);
  };
  document.getElementById('changeEmailBtn').onclick = (e) => {
    e.preventDefault();
    handleButtonAction(document.getElementById('changeEmailBtn'), changeEmail);
  };
  document.getElementById('changePhoneBtn').onclick = (e) => {
    e.preventDefault();
    handleButtonAction(document.getElementById('changePhoneBtn'), changePhone);
  };
  document.getElementById('changeGenderBtn').onclick = (e) => {
    e.preventDefault();
    handleButtonAction(document.getElementById('changeGenderBtn'), changeGender);
  };
  document.getElementById('changeDobBtn').onclick = (e) => {
    e.preventDefault();
    handleButtonAction(document.getElementById('changeDobBtn'), changeDob);
  };
});
