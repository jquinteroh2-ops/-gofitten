/* GoFitten - Inicio de sesión del panel de dueños */
(function () {
  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");
  const pwInput = document.getElementById("password");
  const pwToggle = document.getElementById("pwToggle");

  pwToggle.addEventListener("click", () => {
    const showing = pwInput.type === "text";
    pwInput.type = showing ? "password" : "text";
    pwToggle.textContent = showing ? "Ver" : "Ocultar";
  });

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    btn.disabled = true;
    btn.textContent = "Entrando...";

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: document.getElementById("usuario").value,
          password: pwInput.value,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "No pudimos iniciar sesión.");
        return;
      }
      window.location.href = "/admin";
    } catch (err) {
      showError("No hay conexión con el servidor. Intenta de nuevo.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });
})();
