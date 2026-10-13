/**
 * CARTIVA — Client-side Vanilla JavaScript
 * Keeps frontend logic lightweight, beginner-friendly, and accessible.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Auto-dismiss flash alert messages after 6 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    // Add close button dynamically
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.style.marginLeft = 'auto';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '1.2rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.color = 'inherit';
    closeBtn.style.lineHeight = '1';

    closeBtn.addEventListener('click', () => {
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 250);
    });

    alert.appendChild(closeBtn);

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      if (document.body.contains(alert)) {
        alert.style.transition = 'opacity 0.4s ease';
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 400);
      }
    }, 6000);
  });

  // 2. Client-side password match feedback on registration form
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');

    function checkPasswordsMatch() {
      if (confirmInput.value && passwordInput.value !== confirmInput.value) {
        confirmInput.setCustomValidity('Passwords do not match.');
      } else {
        confirmInput.setCustomValidity('');
      }
    }

    if (passwordInput && confirmInput) {
      passwordInput.addEventListener('input', checkPasswordsMatch);
      confirmInput.addEventListener('input', checkPasswordsMatch);
    }
  }

  // 3. Prevent duplicate checkout submissions by disabling button on click
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', () => {
      const submitBtn = document.getElementById('btn-place-order');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing Order...';
      }
    });
  }
});
