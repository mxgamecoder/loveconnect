function isValidEmail(email) {
  const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com'];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  const domain = email.split('@')[1].toLowerCase();
  return allowedDomains.includes(domain);
}

function isValidPhone(phone) {
  return /^\+\d{10,15}$/.test(phone);
}

function isValidFullName(name) {
  return /^[A-Za-z ]+$/.test(name);
}

module.exports = { isValidEmail, isValidPhone, isValidFullName };