document.addEventListener('DOMContentLoaded', () => {
  document.body.style.opacity = 1;
});
window.addEventListener('error', () => {
  document.body.style.opacity = 1;
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.add('hidden');
    setTimeout(() => boot.style.display = 'none', 300);
  }
});
